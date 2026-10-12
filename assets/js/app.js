/*!
 * Blog estático — Bruno Floriano
 * Lê posts em Markdown da pasta /posts, extrai tags (#tag), título e data,
 * e monta Home (com paginação), página do post, categorias e busca em tempo real.
 *
 * Este arquivo também é usado pelo script Node (scripts/build-index.js),
 * por isso o "parser" fica separado da parte que mexe no navegador.
 */
(function () {
  'use strict';

  /* ===========================================================
   * CONFIGURAÇÃO — ajuste aqui
   * =========================================================== */
  const CONFIG = {
    siteName: 'Bruno Floriano',
    postsPerPage: 5,
    locale: 'pt-BR',
    timeZone: 'America/Sao_Paulo',
    tzOffset: '-03:00', // usado quando a data do post não informa fuso
    // Só é usado se posts/index.json não existir (publicação direto da branch,
    // sem a GitHub Action). Deixe vazio para detectar pelo endereço *.github.io.
    github: { owner: '', repo: '', branch: '' },
  };

  /* ===========================================================
   * PARSER (funciona no navegador e no Node)
   * =========================================================== */
  const TAG_LINE = /^\s*(#[\p{L}\p{N}_-]+[ \t]*)+$/u; // linha só com #tags (sem espaço após o #)
  const TAG_TOKEN = /#([\p{L}\p{N}_-]+)/gu;
  const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?\s*(Z|[+-]\d{2}:?\d{2})?$/;

  function parseFrontMatter(text) {
    if (!text.startsWith('---\n')) return { meta: {}, body: text };
    const end = text.indexOf('\n---', 3);
    if (end === -1) return { meta: {}, body: text };
    const meta = {};
    text.slice(4, end).split('\n').forEach(function (line) {
      const m = line.match(/^\s*([\w-]+)\s*:\s*(.*?)\s*$/);
      if (m) meta[m[1].toLowerCase()] = m[2].replace(/^["']|["']$/g, '');
    });
    const nl = text.indexOf('\n', end + 4);
    return { meta: meta, body: nl === -1 ? '' : text.slice(nl + 1) };
  }

  /** "2026-10-12" ou "2026-10-12 14:30" → { iso, hasTime } */
  function parseDateString(str, offset) {
    const m = String(str || '').trim().match(DATE_RE);
    if (!m) return null;
    const tz = m[7] ? (m[7] === 'Z' ? 'Z' : m[7].replace(/^([+-]\d{2})(\d{2})$/, '$1:$2')) : (offset || CONFIG.tzOffset);
    if (m[4] === undefined) return { iso: m[1] + '-' + m[2] + '-' + m[3] + 'T12:00:00' + tz, hasTime: false };
    const hh = m[4].padStart(2, '0');
    return { iso: m[1] + '-' + m[2] + '-' + m[3] + 'T' + hh + ':' + m[5] + ':' + (m[6] || '00') + tz, hasTime: true };
  }

  function offsetMinutes(off) {
    const m = String(off).match(/^([+-])(\d{2}):?(\d{2})$/);
    return m ? (m[1] === '-' ? -1 : 1) * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10)) : 0;
  }

  /** Dia (AAAA-MM-DD) de um ISO no fuso configurado */
  function localDay(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return null;
    return new Date(d.getTime() + offsetMinutes(CONFIG.tzOffset) * 60000).toISOString().slice(0, 10);
  }

  function stripMarkdown(md) {
    return String(md || '')
      .replace(/```[^\n]*\n([\s\S]*?)```/g, ' $1 ')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, ' $1 ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/<[^>]+>/g, ' ')
      .replace(/^\s*[-|:*_ ]{3,}\s*$/gm, ' ')
      .replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+|\d+\.\s+)/gm, '')
      .replace(/[*_~`|]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function truncate(text, max) {
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    return cut.slice(0, Math.max(cut.lastIndexOf(' '), max * 0.6)).replace(/[\s,.;:—-]+$/, '') + '…';
  }

  function titleFromSlug(slug) {
    const t = slug.replace(/^\d{4}-\d{2}-\d{2}-?/, '').replace(/[-_]+/g, ' ').trim() || slug;
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  /**
   * Interpreta um post em Markdown.
   * @param {string} raw       conteúdo do .md
   * @param {string} filename  ex.: "2026-10-12-post-teste.md"
   * @param {object} [extra]   { gitDate, mtime } (usado pelo script de build)
   */
  function parsePost(raw, filename, extra) {
    extra = extra || {};
    const text = String(raw).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    const fm = parseFrontMatter(text);
    const meta = fm.meta;
    const lines = fm.body.split('\n');

    // 1) Tags no início do texto (#tag #outra), removidas do corpo
    const tags = [];
    let i = 0;
    while (i < lines.length && (lines[i].trim() === '' || TAG_LINE.test(lines[i]))) {
      for (const m of lines[i].matchAll(TAG_TOKEN)) tags.push(m[1]);
      i++;
    }
    if (meta.tags) meta.tags.replace(/[[\]]/g, '').split(/[,\s]+/).forEach(function (t) { if (t) tags.push(t.replace(/^#/, '')); });
    const uniqueTags = Array.from(new Set(tags.map(function (t) { return t.toLowerCase(); })));

    // 2) Título: primeiro "# Título" logo depois das tags (ou front matter / nome do arquivo)
    const slug = filename.replace(/^.*[\\/]/, '').replace(/\.md$/i, '');
    let title = meta.titulo || meta.title || '';
    const h1 = lines[i] !== undefined ? lines[i].match(/^#\s+(.+?)\s*#*\s*$/) : null;
    if (h1) { if (!title) title = h1[1]; i++; }
    if (!title) title = titleFromSlug(slug);
    const body = lines.slice(i).join('\n').trim();

    // 3) Data: front matter > commit que criou o arquivo > nome do arquivo > data do arquivo
    let date = null;
    if (meta.data || meta.date) date = parseDateString(meta.data || meta.date);
    const fileDate = slug.match(/^(\d{4}-\d{2}-\d{2})/);
    if (!date && extra.gitDate && (!fileDate || localDay(extra.gitDate) === fileDate[1])) {
      date = { iso: extra.gitDate, hasTime: true };
    }
    if (!date && fileDate) date = parseDateString(fileDate[1]);
    if (!date && extra.mtime) date = { iso: extra.mtime, hasTime: true };
    if (!date) date = { iso: null, hasTime: false };

    // 4) Resumo: primeiro parágrafo de texto
    let excerpt = meta.resumo || meta.description || '';
    if (!excerpt) {
      const block = body.split(/\n\s*\n/).find(function (b) {
        const t = b.trim();
        return t && !/^(#|!\[|```|<|\||---|\* \* \*)/.test(t);
      });
      excerpt = truncate(stripMarkdown(block || ''), 220);
    }

    return {
      slug: slug,
      file: 'posts/' + slug + '.md',
      title: title,
      date: date.iso,
      hasTime: date.hasTime,
      tags: uniqueTags,
      excerpt: excerpt,
      text: stripMarkdown(body),
      body: body,
    };
  }

  function sortPosts(posts) {
    return posts.slice().sort(function (a, b) {
      const da = a.date ? Date.parse(a.date) : 0;
      const db = b.date ? Date.parse(b.date) : 0;
      return db - da || (a.slug < b.slug ? 1 : -1);
    });
  }

  /** minúsculas e sem acentos, preservando o tamanho da string (para destacar resultados) */
  function fold(s) {
    s = String(s || '');
    let out = '';
    for (let i = 0; i < s.length; i++) out += s[i].toLowerCase().normalize('NFD')[0] || s[i];
    return out;
  }

  function searchTerms(q) { return fold(q).split(/\s+/).filter(Boolean); }

  function searchPosts(posts, q) {
    const terms = searchTerms(q);
    if (!terms.length) return posts;
    return posts.map(function (p) {
      const title = fold(p.title), tags = fold(p.tags.join(' ')), text = fold(p.text);
      let score = 0;
      for (const t of terms) {
        const inTitle = title.includes(t), inTags = tags.includes(t), inText = text.includes(t);
        if (!inTitle && !inTags && !inText) return null;
        score += (inTitle ? 5 : 0) + (inTags ? 3 : 0) + (inText ? 1 : 0);
      }
      return { post: p, score: score };
    }).filter(Boolean).sort(function (a, b) {
      return b.score - a.score || (Date.parse(b.post.date || 0) - Date.parse(a.post.date || 0));
    }).map(function (r) { return r.post; });
  }

  const api = {
    CONFIG: CONFIG, parsePost: parsePost, parseFrontMatter: parseFrontMatter, parseDateString: parseDateString,
    stripMarkdown: stripMarkdown, sortPosts: sortPosts, searchPosts: searchPosts, fold: fold,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return; // Node: para por aqui

  /* ===========================================================
   * NAVEGADOR
   * =========================================================== */
  const scriptEl = document.currentScript;
  const BASE = scriptEl ? new URL('../../', scriptEl.src).href : new URL('./', location.href).href;
  const url = function (p) { return new URL(p, BASE).href; };
  const enc = encodeURIComponent;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fetchText(path) {
    return fetch(url(path), { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw Object.assign(new Error('HTTP ' + r.status + ' em ' + path), { status: r.status });
      return r.text();
    });
  }

  /* ---------- Índice de posts ---------- */
  let indexPromise = null;
  function loadIndex() {
    if (!indexPromise) {
      indexPromise = fetch(url('posts/index.json'), { cache: 'no-cache' })
        .then(function (r) { if (!r.ok) throw new Error('sem índice'); return r.json(); })
        .then(function (data) { return Array.isArray(data) ? data : data.posts; })
        .catch(loadFromGitHub)
        .then(sortPosts);
    }
    return indexPromise;
  }

  /** Plano B: lista /posts pela API do GitHub quando não existe posts/index.json */
  async function loadFromGitHub() {
    let owner = CONFIG.github.owner, repo = CONFIG.github.repo;
    if (!owner || !repo) {
      const m = location.hostname.match(/^([^.]+)\.github\.io$/i);
      if (!m) {
        throw new Error('Não encontrei posts/index.json. Rode "node scripts/build-index.js" na raiz do projeto ' +
          'ou preencha CONFIG.github em assets/js/app.js.');
      }
      owner = m[1];
      const first = location.pathname.split('/').filter(Boolean)[0];
      repo = first && !/\.html?$/i.test(first) ? first : location.hostname;
    }
    const ref = CONFIG.github.branch ? '?ref=' + enc(CONFIG.github.branch) : '';
    const r = await fetch('https://api.github.com/repos/' + owner + '/' + repo + '/contents/posts' + ref);
    if (!r.ok) throw new Error('Não consegui listar os posts pela API do GitHub (HTTP ' + r.status + ').');
    const files = (await r.json()).filter(function (f) { return f.type === 'file' && /\.md$/i.test(f.name) && f.name.charAt(0) !== '_'; });
    return Promise.all(files.map(async function (f) {
      const p = parsePost(await fetchText('posts/' + f.name), f.name);
      delete p.body;
      return p;
    }));
  }

  /* ---------- Formatação ---------- */
  function formatDate(iso, hasTime) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const opts = { day: 'numeric', month: 'long', year: 'numeric', timeZone: CONFIG.timeZone };
    if (hasTime) { opts.hour = '2-digit'; opts.minute = '2-digit'; }
    return new Intl.DateTimeFormat(CONFIG.locale, opts).format(d).replace(/,? às /, ' · ').replace(/, (\d{2}:\d{2})$/, ' · $1');
  }

  function timeTag(p) {
    return p.date ? '<time class="post-date" datetime="' + esc(p.date) + '">' + esc(formatDate(p.date, p.hasTime)) + '</time>' : '';
  }

  function tagsHtml(tags) {
    if (!tags || !tags.length) return '';
    return '<ul class="tags" aria-label="Categorias">' + tags.map(function (t) {
      return '<li><a class="tag" data-tag="' + esc(t) + '" href="categorias.html?tag=' + enc(t) + '">#' + esc(t) + '</a></li>';
    }).join('') + '</ul>';
  }

  function postHref(p) { return 'post.html?p=' + enc(p.slug); }

  function postCard(p) {
    return '<article class="post-item">' +
      timeTag(p) +
      '<h2 class="post-item-title"><a href="' + postHref(p) + '">' + esc(p.title) + '</a></h2>' +
      (p.excerpt ? '<p class="post-excerpt">' + esc(p.excerpt) + '</p>' : '') +
      tagsHtml(p.tags) +
      '</article>';
  }

  function buildHref(page, params) {
    const qs = Object.keys(params).filter(function (k) { return params[k] != null && params[k] !== ''; })
      .map(function (k) { return k + '=' + enc(params[k]); }).join('&');
    return page + (qs ? '?' + qs : '');
  }

  function pagination(current, total, hrefFor) {
    if (total <= 1) return '';
    let pages = [];
    if (total <= 7) { for (let i = 1; i <= total; i++) pages.push(i); }
    else {
      pages = [1];
      if (current > 3) pages.push('…');
      for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
      if (current < total - 2) pages.push('…');
      pages.push(total);
    }
    const prev = current > 1
      ? '<a class="page-prev" rel="prev" href="' + hrefFor(current - 1) + '">← Mais recentes</a>'
      : '<span class="page-prev is-disabled">← Mais recentes</span>';
    const next = current < total
      ? '<a class="page-next" rel="next" href="' + hrefFor(current + 1) + '">Mais antigos →</a>'
      : '<span class="page-next is-disabled">Mais antigos →</span>';
    const nums = pages.map(function (n) {
      if (n === '…') return '<li><span class="page-gap">…</span></li>';
      return n === current
        ? '<li><span class="page-num" aria-current="page">' + n + '</span></li>'
        : '<li><a class="page-num" href="' + hrefFor(n) + '">' + n + '</a></li>';
    }).join('');
    return '<nav class="pagination" aria-label="Paginação">' + prev + '<ol class="page-list">' + nums + '</ol>' + next + '</nav>';
  }

  /* ---------- Markdown → HTML ---------- */
  function renderMarkdown(md, fileUrl) {
    let html;
    if (window.marked) html = window.marked.parse(md, { gfm: true });
    else html = '<pre>' + esc(md) + '</pre>';
    if (window.DOMPurify) html = window.DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });
    const box = document.createElement('div');
    box.innerHTML = html;
    fixUrls(box, fileUrl);
    return box;
  }

  /** Corrige caminhos de imagens/links (ex.: /imagens/x.jpg funciona mesmo em usuario.github.io/repositorio/) */
  function fixUrls(el, fileUrl) {
    el.querySelectorAll('img[src], source[src], video[src], audio[src], a[href]').forEach(function (n) {
      const attr = n.hasAttribute('src') ? 'src' : 'href';
      const v = n.getAttribute(attr);
      if (!v || /^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(v)) return;
      let abs = v.charAt(0) === '/' ? url(v.slice(1)) : new URL(v, fileUrl).href;
      // Link para outro post em .md → página do post
      const postMatch = attr === 'href' && abs.indexOf(url('posts/')) === 0 && abs.match(/\/posts\/([^/?#]+)\.md(#.*)?$/i);
      if (postMatch) abs = url('post.html?p=' + enc(decodeURIComponent(postMatch[1]))) + (postMatch[2] || '');
      n.setAttribute(attr, abs);
    });
    el.querySelectorAll('img').forEach(function (img) { img.loading = 'lazy'; img.decoding = 'async'; });
    el.querySelectorAll('a[href^="http"]').forEach(function (a) {
      if (new URL(a.href).host !== location.host) { a.target = '_blank'; a.rel = 'noopener'; }
    });
  }

  function notice(main, html) { main.innerHTML = '<div class="notice">' + html + '</div>'; }

  function setTitle(t) { document.title = t ? t + ' — ' + CONFIG.siteName : CONFIG.siteName; }

  /* ---------- Páginas ---------- */
  async function renderHome(main) {
    const params = new URLSearchParams(location.search);
    const q = (params.get('q') || '').trim();
    const posts = await loadIndex();
    const list = q ? searchPosts(posts, q) : posts;
    const per = CONFIG.postsPerPage;
    const total = Math.max(1, Math.ceil(list.length / per));
    const page = Math.min(Math.max(1, parseInt(params.get('page'), 10) || 1), total);
    const items = list.slice((page - 1) * per, page * per);

    let head = '';
    if (q) {
      setTitle('Busca: ' + q);
      head = '<header class="page-header"><h1 class="page-title">Resultados para “' + esc(q) + '”</h1>' +
        '<p class="page-sub">' + list.length + (list.length === 1 ? ' post encontrado' : ' posts encontrados') +
        ' · <a href="index.html">limpar busca</a></p></header>';
    } else {
      setTitle('');
      if (page > 1) head = '<header class="page-header"><p class="page-sub">Página ' + page + ' de ' + total + '</p></header>';
    }

    const body = items.length
      ? items.map(postCard).join('')
      : '<p class="empty">' + (q ? 'Nenhum post encontrado. Tente outras palavras.' : 'Ainda não há posts por aqui.') + '</p>';

    main.innerHTML = head + '<div class="post-list">' + body + '</div>' +
      pagination(page, total, function (n) { return buildHref('index.html', { q: q, page: n > 1 ? n : null }); });

    const input = document.querySelector('.search input');
    if (input && q) input.value = q;
  }

  async function renderPost(main) {
    const slug = new URLSearchParams(location.search).get('p') || '';
    if (!slug || /[\\/]|^\./.test(slug)) return notFound(main);
    let raw;
    try { raw = await fetchText('posts/' + slug + '.md'); }
    catch (e) { return notFound(main); }

    const index = await loadIndex().catch(function () { return []; });
    const pos = index.findIndex(function (p) { return p.slug === slug; });
    const meta = pos >= 0 ? index[pos] : null;
    const post = parsePost(raw, slug + '.md');
    if (meta && meta.date) { post.date = meta.date; post.hasTime = meta.hasTime; }

    setTitle(post.title);
    const content = renderMarkdown(post.body, url('posts/' + slug + '.md'));

    const newer = pos > 0 ? index[pos - 1] : null;
    const older = pos >= 0 && pos < index.length - 1 ? index[pos + 1] : null;
    const nav = (newer || older)
      ? '<nav class="post-nav" aria-label="Outros posts">' +
        (older ? '<a class="post-nav-older" href="' + postHref(older) + '"><span>← Anterior</span>' + esc(older.title) + '</a>' : '<span></span>') +
        (newer ? '<a class="post-nav-newer" href="' + postHref(newer) + '"><span>Próximo →</span>' + esc(newer.title) + '</a>' : '<span></span>') +
        '</nav>'
      : '';

    main.innerHTML = '<article class="post">' +
      '<header class="post-header"><h1 class="post-title">' + esc(post.title) + '</h1>' + timeTag(post) + '</header>' +
      tagsHtml(post.tags) +
      '<div class="prose post-body"></div>' +
      '</article>' + nav;
    main.querySelector('.post-body').appendChild(content);
  }

  async function renderCategories(main) {
    const posts = await loadIndex();
    const byTag = new Map();
    posts.forEach(function (p) {
      p.tags.forEach(function (t) { if (!byTag.has(t)) byTag.set(t, []); byTag.get(t).push(p); });
    });
    const tags = Array.from(byTag.keys()).sort(function (a, b) { return a.localeCompare(b, CONFIG.locale); });

    function draw() {
      const active = (new URLSearchParams(location.search).get('tag') || '').toLowerCase();
      setTitle(active ? '#' + active : 'Categorias');

      const cloud = '<div class="tag-cloud">' +
        '<a class="tag' + (active ? '' : ' is-active') + '" href="categorias.html" data-tag="">Todas <span class="tag-count">' + posts.length + '</span></a>' +
        tags.map(function (t) {
          return '<a class="tag' + (t === active ? ' is-active' : '') + '" data-tag="' + esc(t) + '" href="categorias.html?tag=' + enc(t) + '">#' +
            esc(t) + ' <span class="tag-count">' + byTag.get(t).length + '</span></a>';
        }).join('') + '</div>';

      let section;
      if (!tags.length) {
        section = '<p class="empty">Nenhuma tag encontrada nos posts ainda.</p>';
      } else if (active) {
        const list = byTag.get(active) || [];
        section = '<h2 class="section-title">Posts em #' + esc(active) + '</h2>' +
          (list.length ? '<div class="post-list">' + list.map(postCard).join('') + '</div>'
            : '<p class="empty">Nenhum post com essa tag.</p>');
      } else {
        section = tags.map(function (t) {
          return '<section class="tag-group"><h2 class="section-title"><a data-tag="' + esc(t) + '" href="categorias.html?tag=' + enc(t) + '">#' + esc(t) + '</a></h2>' +
            '<ul class="compact-list">' + byTag.get(t).map(function (p) {
              return '<li><a href="' + postHref(p) + '">' + esc(p.title) + '</a>' +
                (p.date ? '<time datetime="' + esc(p.date) + '">' + esc(formatDate(p.date, false)) + '</time>' : '') + '</li>';
            }).join('') + '</ul></section>';
        }).join('');
      }

      main.innerHTML = '<header class="page-header"><h1 class="page-title">Categorias</h1>' +
        '<p class="page-sub">' + tags.length + (tags.length === 1 ? ' categoria' : ' categorias') + ' em ' + posts.length + (posts.length === 1 ? ' post' : ' posts') + '</p></header>' +
        cloud + section;
    }

    main.addEventListener('click', function (e) {
      const a = e.target.closest('a[data-tag]');
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      history.pushState(null, '', a.getAttribute('href'));
      draw();
      main.scrollIntoView({ block: 'start' });
    });
    window.addEventListener('popstate', draw);
    draw();
  }

  async function renderStatic(main, file) {
    const raw = await fetchText(file);
    const content = renderMarkdown(raw.replace(/^﻿/, ''), url(file));
    const h1 = content.querySelector('h1');
    setTitle(h1 ? h1.textContent : '');
    if (h1) h1.className = 'page-title';
    main.innerHTML = '<article class="prose page"></article>';
    main.firstChild.appendChild(content);
  }

  function notFound(main) {
    setTitle('Post não encontrado');
    notice(main, '<h1 class="page-title">Post não encontrado</h1><p>O endereço pode ter mudado. <a href="index.html">Voltar para a Home</a>.</p>');
  }

  /* ---------- Busca em tempo real ---------- */
  function snippet(p, q) {
    const terms = searchTerms(q);
    const text = p.text || '';
    const f = fold(text);
    let idx = -1;
    terms.forEach(function (t) { const i = f.indexOf(t); if (i !== -1 && (idx === -1 || i < idx)) idx = i; });
    if (idx === -1) return p.excerpt || truncate(text, 140);
    let start = Math.max(0, idx - 50);
    if (start > 0) start = text.indexOf(' ', start) + 1 || start;
    const end = Math.min(text.length, start + 150);
    return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '');
  }

  function highlight(text, q) {
    const terms = searchTerms(q);
    if (!terms.length) return esc(text);
    const f = fold(text);
    const marks = new Array(text.length).fill(false);
    terms.forEach(function (t) {
      let i = f.indexOf(t);
      while (i !== -1) { for (let k = i; k < i + t.length; k++) marks[k] = true; i = f.indexOf(t, i + t.length); }
    });
    let out = '', open = false;
    for (let i = 0; i < text.length; i++) {
      if (marks[i] && !open) { out += '<mark>'; open = true; }
      else if (!marks[i] && open) { out += '</mark>'; open = false; }
      out += esc(text[i]);
    }
    return out + (open ? '</mark>' : '');
  }

  function initSearch() {
    const form = document.querySelector('.search');
    if (!form) return;
    const input = form.querySelector('input');
    const panel = document.createElement('div');
    panel.className = 'search-results';
    panel.hidden = true;
    panel.id = 'search-results';
    form.appendChild(panel);
    input.setAttribute('aria-controls', panel.id);
    form.setAttribute('action', url('index.html'));

    let timer = null, seq = 0;
    const close = function () { panel.hidden = true; input.setAttribute('aria-expanded', 'false'); };

    async function run() {
      const q = input.value.trim();
      if (q.length < 2) return close();
      const mine = ++seq;
      let posts;
      try { posts = await loadIndex(); } catch (e) { return; }
      if (mine !== seq) return;
      const res = searchPosts(posts, q);
      panel.innerHTML = res.length
        ? res.slice(0, 6).map(function (p) {
            return '<a class="search-hit" href="' + url(postHref(p)) + '">' +
              '<span class="hit-title">' + highlight(p.title, q) + '</span>' +
              '<span class="hit-snippet">' + highlight(snippet(p, q), q) + '</span></a>';
          }).join('') +
          (res.length > 6 ? '<a class="search-all" href="' + url(buildHref('index.html', { q: q })) + '">Ver todos os ' + res.length + ' resultados →</a>' : '')
        : '<p class="search-empty">Nada encontrado para “' + esc(q) + '”.</p>';
      panel.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }

    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(run, 120); });
    input.addEventListener('focus', function () { if (input.value.trim().length >= 2) run(); });
    form.addEventListener('keydown', function (e) {
      const links = Array.from(panel.querySelectorAll('a'));
      const i = links.indexOf(document.activeElement);
      if (e.key === 'Escape') { close(); input.focus(); }
      else if (e.key === 'ArrowDown' && !panel.hidden && links.length) { e.preventDefault(); links[Math.min(i + 1, links.length - 1)].focus(); }
      else if (e.key === 'ArrowUp' && i >= 0) { e.preventDefault(); (i === 0 ? input : links[i - 1]).focus(); }
    });
    document.addEventListener('click', function (e) { if (!form.contains(e.target)) close(); });
  }

  /* ---------- Inicialização ---------- */
  function init() {
    const page = document.body.dataset.page;
    document.querySelectorAll('[data-nav]').forEach(function (a) {
      if (a.dataset.nav === page) a.setAttribute('aria-current', 'page');
    });
    document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
    initSearch();

    const main = document.getElementById('conteudo');
    const routes = {
      home: renderHome,
      post: renderPost,
      categorias: renderCategories,
      sobre: function (m) { return renderStatic(m, 'content/sobre.md'); },
      contato: function (m) { return renderStatic(m, 'content/contato.md'); },
    };
    const fn = routes[page];
    if (fn) {
      Promise.resolve().then(function () { return fn(main); }).catch(function (err) {
        console.error(err);
        notice(main, '<h1 class="page-title">Algo deu errado</h1><p>' + esc(err.message) + '</p>');
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
