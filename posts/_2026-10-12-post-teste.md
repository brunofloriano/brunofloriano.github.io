#geral #teste

# Primeiro post: um caderno aberto, escrito em Markdown

Este é o post de estreia do blog e serve para testar tudo de uma vez: as tags lá em cima, o título, a data, a citação, a imagem e a formatação. Se você está vendo as pílulas `#geral` e `#teste` acima deste texto e a data de publicação certinha, está tudo funcionando.

> Escrever é pensar com calma. Publicar é deixar esse pensamento à disposição de quem passar por aqui.

A ideia é simples: cada texto é um arquivo `.md` na pasta `posts/`. Não há banco de dados, painel de administração ou plugin para atualizar — só texto puro, versionado no Git e publicado pelo GitHub Pages.

![Ilustração genérica de um caderno aberto](/imagens/exemplo.svg)
*Imagens ficam na pasta `/imagens/` e são referenciadas direto no Markdown.*

## O que dá para fazer em um post

- Escrever em **negrito**, *itálico* e ~~riscado~~
- Criar [links para outros sites](https://pages.github.com/)
- Fazer listas, numeradas ou não
- Inserir trechos de código e tabelas

1. Crie um arquivo em `posts/` com o nome `AAAA-MM-DD-titulo.md`
2. Escreva as tags na primeira linha
3. Faça o commit e pronto

### Exemplo de código

```js
// O blog lê as tags da primeira linha do arquivo
const tags = '#geral #teste'.match(/#[\p{L}\p{N}_-]+/gu);
console.log(tags); // ["#geral", "#teste"]
```

### Exemplo de tabela

| Pasta       | Para que serve                  |
|-------------|---------------------------------|
| `posts/`    | Um arquivo `.md` por post       |
| `content/`  | Textos das páginas fixas        |
| `imagens/`  | Todas as imagens do blog        |

---

Por enquanto é isso. Os próximos textos chegam em breve.
