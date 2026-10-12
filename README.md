# Bruno Floriano — blog

Blog pessoal estático, minimalista e em modo escuro, escrito em Markdown e publicado no GitHub Pages. Sem framework, sem banco de dados, sem etapa de build obrigatória.

## Estrutura

```
/
├── index.html            Home (5 posts mais recentes + paginação + resultados de busca)
├── post.html             Página de um post  (post.html?p=nome-do-arquivo)
├── sobre.html            Renderiza content/sobre.md
├── contato.html          Renderiza content/contato.md
├── categorias.html       Todas as tags; clique para filtrar (categorias.html?tag=x)
├── assets/css/style.css  Visual (cores, tipografia, responsivo)
├── assets/js/app.js      Lógica (posts, tags, datas, paginação, busca) + CONFIG
├── content/              Textos das páginas fixas
├── posts/                Um arquivo .md por post
├── imagens/              Imagens do blog
├── scripts/build-index.js        Gera posts/index.json
└── .github/workflows/pages.yml   Publica automaticamente no GitHub Pages
```

## Escrevendo um post

Crie um arquivo em `posts/` com o nome `AAAA-MM-DD-titulo-do-post.md`:

```markdown
#tecnologia #javascript

# Título do post

Primeiro parágrafo (vira o resumo na Home)...

![Descrição da imagem](/imagens/minha-foto.jpg)
```

- **Tags:** linhas no início do arquivo com `#palavra` (sem espaço depois do `#`). Elas são removidas do texto e exibidas como pílulas acima do conteúdo. Acentos funcionam (`#programação`).
- **Título:** a primeira linha `# Título` depois das tags. `# Título` (com espaço) é título; `#tag` (sem espaço) é tag.
- **Imagens:** coloque em `imagens/` e use `/imagens/arquivo.jpg` ou `../imagens/arquivo.jpg`. O caminho é corrigido automaticamente, inclusive em `usuario.github.io/repositorio/`.
- **Link para outro post:** `[texto](2026-10-12-post-teste.md)` vira link para a página do post.

### Data e hora

A data exibida segue esta ordem:

1. Campo `data` em um front matter opcional (no topo do arquivo):
   ```markdown
   ---
   data: 2026-10-12 14:30
   ---
   #geral

   # Título
   ```
2. Hora do commit que criou o arquivo no Git (calculada pela GitHub Action), quando for o mesmo dia do nome do arquivo.
3. Data do nome do arquivo (mostra só o dia).

Outros campos opcionais do front matter: `titulo`, `tags` (ex.: `tags: a, b`) e `resumo`.

## Publicando no GitHub Pages

1. Crie um repositório (ex.: `blog`, ou `seu-usuario.github.io` para ficar na raiz do domínio) e envie estes arquivos para a branch `main`.
2. Em **Settings → Pages**, em *Build and deployment → Source*, escolha **GitHub Actions**.
3. Pronto. A cada push a Action gera `posts/index.json` e publica o site. Acompanhe na aba **Actions**.

**Alternativa sem Action:** se preferir *Source: Deploy from a branch*, o site também funciona. Sem o `index.json`, ele lista os posts pela API pública do GitHub (detecta usuário e repositório pelo endereço `*.github.io`). Nesse modo a hora vem só do front matter. Se usar domínio próprio, preencha `CONFIG.github` em `assets/js/app.js`.

## Testando no computador

O navegador não abre arquivos `.md` via `file://`, então use um servidor local:

```bash
node scripts/build-index.js     # gera posts/index.json
python3 -m http.server 8000     # ou: npx serve
```

Abra http://localhost:8000. Rode o primeiro comando de novo sempre que criar um post.

## Personalizando

- **Nome, posts por página, fuso horário:** objeto `CONFIG` no topo de `assets/js/app.js`.
- **Cores e fontes:** variáveis em `:root` no início de `assets/css/style.css`.
- **Nome no cabeçalho/rodapé:** está nos arquivos `.html` (mesmo bloco em todos).
- **Rascunhos:** arquivos em `posts/` que começam com `_` (ex.: `_rascunho.md`) são ignorados pelo índice.
