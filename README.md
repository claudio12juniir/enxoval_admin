# Enxoval admin

Painel privado da sua cliente: cola o link do produto na Amazon, o sistema
busca imagem, galeria, descrição, destaques e vídeo, ela revisa e salva.
É um projeto **separado** de `enxoval_da_mari` (o site público) de propósito
— veja [por que dois projetos](#por-que-dois-projetos-separados) mais abaixo.

## Rodando localmente

```bash
npm install
cp .env.example .env   # edite ADMIN_PASSWORD e SESSION_SECRET
npm start               # http://localhost:8935
```

Sem `BLOB_READ_WRITE_TOKEN` no ambiente, o catálogo é lido/gravado em
`data/*.json` local — perfeito para desenvolver, mas é só local mesmo (veja
abaixo por que isso muda em produção).

## Publicando no Vercel

Este projeto tem duas partes: os arquivos estáticos do painel (`index.html`,
`admin.css`, `admin.js`, `css/`, `js/`) e a API em `api/index.js`
(função serverless). O `vercel.json` já direciona `/api/*` pra essa função;
os estáticos a Vercel serve sozinha, sem configuração.

Depois de importar este repositório na Vercel, **antes de usar o painel de
verdade**, faça duas coisas no dashboard do projeto:

1. **Settings → Environment Variables**: adicione `ADMIN_PASSWORD` (a senha
   real que ela vai usar) e `SESSION_SECRET` (uma string aleatória longa —
   gere com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
2. **Storage → Connect Store → Blob**: crie/conecte um Blob Store a este
   projeto. É assim que o catálogo persiste em produção — sem isso, o
   sistema de arquivos da função é somente leitura e salvar um produto
   retorna erro (a mensagem já explica o que fazer). Conectar o Blob injeta
   `BLOB_READ_WRITE_TOKEN` sozinho, não precisa copiar nada manualmente.

Depois de configurar os dois, faça um redeploy (Deployments → ⋯ → Redeploy)
pra pegar as variáveis novas.

Depois do deploy, atualize [admin.js](admin.js) linha 6 (`PUBLIC_SITE_URL`)
com a URL real do site público (`enxoval_da_mari` na Vercel) — é só o link
do botão "Ver site" dentro do painel, não afeta nada além disso.

## Por que dois projetos separados

Os dois erros que você teve na Vercel (`Cannot GET /` no site público,
`404` no admin) aconteciam porque o código original era um servidor Node
tradicional (`app.listen()`), e a Vercel não roda assim — ela espera ou
arquivos estáticos, ou funções serverless. Aproveitando a reestruturação,
o admin ficou isolado do site público por dois motivos:

1. **Sessão em memória não sobrevive em serverless.** Cada requisição pode
   cair numa instância diferente da função; um `Map` guardado em memória
   "esquece" o login a qualquer momento. Trocamos por um cookie assinado
   (sem estado no servidor) — resolve isso e também simplifica.
2. **O painel fica fora do alcance de quem só navega a loja** — o domínio
   do site público não tem nenhuma rota nem arquivo do admin, então mesmo
   sabendo a URL não tem o que encontrar lá.

O site público (`enxoval_da_mari`) busca o catálogo direto na API pública
deste projeto (`/api/public/products` e `/api/public/categorias`, sem
senha, com CORS liberado — são os mesmos dados que já aparecem na loja,
não tem nada sensível nisso).

## Como o painel funciona

1. Acesse a URL do projeto e faça login com `ADMIN_PASSWORD`.
2. Cole o link do produto na Amazon e clique em **Buscar dados**.
3. Revise imagem, preço, descrição, destaques e vídeo antes de salvar — a
   Amazon muda o layout das páginas com frequência e às vezes bloqueia
   acessos automatizados; quando isso acontece o formulário fica vazio pra
   preencher na mão, o cadastro nunca trava por isso.
4. Escolha a categoria (ou crie uma nova) e clique em **Salvar produto**.

## Vídeo do produto

A Amazon serve vídeo de produto como HLS (`.m3u8`). O player já sabe tocar
isso (nativo no Safari/iOS, `hls.js` sob demanda nos demais navegadores).
Nem todo produto tem vídeo — quando falta, o campo fica vazio e pode ser
preenchido na mão (ex: um link do YouTube).

## Limitações a ter em mente

- **Busca automática é "melhor esforço".** A Amazon pode bloquear acessos
  automatizados a qualquer momento, inclusive em funções serverless. O
  preenchimento manual no painel sempre funciona como alternativa.
- **Termos da Amazon Associates.** Buscar dados via HTML (em vez da API
  oficial Product Advertising) foge do uso recomendado pela Amazon para
  preços exibidos automaticamente — a política pede que não fiquem
  desatualizados por mais de 24h. Use "Buscar dados" pra atualizar produtos
  com alguma regularidade, especialmente os de preço variável.
- **Logout não invalida o cookie no servidor** (não existe "servidor" com
  memória entre requisições) — ele só é apagado do navegador. Pra uma
  senha única de admin, é uma troca aceitável pela simplicidade.

## Script de linha de comando (opcional)

`npm run add-produto -- <link-amazon> [categoria]` é um atalho de terminal
com o mesmo buscador do painel. Rodado localmente sem
`BLOB_READ_WRITE_TOKEN`, grava no `data/products.json` local — **não** é o
catálogo em produção. O painel web é o caminho recomendado no dia a dia.
