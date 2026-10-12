#!/usr/bin/env node
/**
 * Gera posts/index.json com título, data/hora, tags, resumo e texto de cada post.
 * Roda automaticamente na GitHub Action; para testar localmente:
 *   node scripts/build-index.js
 *
 * A hora do post vem, nesta ordem, de:
 *   1. campo "data:" no front matter (opcional)
 *   2. data do commit que criou o arquivo (se for o mesmo dia do nome do arquivo)
 *   3. data no nome do arquivo (AAAA-MM-DD-...)  → mostra só o dia
 *   4. data de modificação do arquivo
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { parsePost, sortPosts } = require('../assets/js/app.js');

const ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'posts');
const OUT = path.join(POSTS_DIR, 'index.json');

function gitCreatedAt(relPath) {
  try {
    const out = execFileSync('git', ['log', '--diff-filter=A', '--follow', '--format=%aI', '--', relPath], {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim().split('\n').filter(Boolean);
    return out.length ? out[out.length - 1] : null; // o mais antigo = criação
  } catch (e) {
    return null;
  }
}

const files = fs.readdirSync(POSTS_DIR).filter((f) => /\.md$/i.test(f) && !f.startsWith('_'));

const posts = sortPosts(files.map((name) => {
  const full = path.join(POSTS_DIR, name);
  const post = parsePost(fs.readFileSync(full, 'utf8'), name, {
    gitDate: gitCreatedAt(path.posix.join('posts', name)),
    mtime: fs.statSync(full).mtime.toISOString(),
  });
  delete post.body;
  return post;
}));

fs.writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), total: posts.length, posts }, null, 2) + '\n');

console.log(`posts/index.json gerado com ${posts.length} post(s):`);
for (const p of posts) console.log(`  ${p.date || 'sem data'}  ${p.title}  [${p.tags.map((t) => '#' + t).join(' ')}]`);
