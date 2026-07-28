# Enxoval admin

Painel privado da sua cliente: cola o link do produto na Amazon, o sistema
busca imagem, galeria, descrição, destaques e vídeo, ela revisa e salva.
É um projeto **separado** de `enxoval_da_mari` (o site público) de propósito
— veja [por que dois projetos](#por-que-dois-projetos-separados) mais abaixo.

**Sem senha de propósito** (removida a pedido) — qualquer pessoa com o
endereço do projeto consegue abrir o painel e editar o catálogo direto,
sem login. A única barreira é o link não ser divulgado publicamente em
nenhum lugar (não tem link pra ele em nenhuma página do site público). Veja
[reativar a senha](#reativar-a-senha-se-quiser-de-volta) se mudar de ideia.

## Rodando localmente

```bash
npm install
npm start   # http://localhost:8935
```

Sem `BLOB_READ_WRITE_TOKEN` no ambiente, o catálogo é lido/gravado em
`data/*.json` local — perfeito para desenvolver, mas é só local mesmo (veja
abaixo por que isso muda em produção).

## Publicando no Vercel

Este projeto tem duas partes: os arquivos estáticos do painel (`index.html`,
`admin.css`, `admin.js`, `css/`, `js/`) e a API em `api/index.js`
(função serverless). O `vercel.json` já direciona `/api/*` pra essa função;
os estáticos a Vercel serve sozinha, sem configuração.

Antes de usar o painel de verdade, no dashboard do projeto:

1. **Storage → Connect Store → Blob**: crie/conecte um Blob Store a este
   projeto. É assim que o catálogo persiste em produção — sem isso, o
   sistema de arquivos da função é somente leitura e salvar um produto
   retorna erro (a mensagem já explica o que fazer). Conectar o Blob injeta
   `BLOB_READ_WRITE_TOKEN` sozinho, não precisa copiar nada manualmente.
2. **Settings → Deployment Protection**: confira se "Vercel Authentication"
   está desligada para Production (ou você vai bater numa tela de login da
   própria Vercel antes mesmo de chegar no painel).

Depois do deploy, confira a **URL real do projeto** em Settings → Domains —
às vezes a Vercel usa um endereço com sufixo (tipo `-beta` ou `-2`) se o
nome já estiver em uso por outro projeto seu. Atualize:

- [admin.js](admin.js) linha 6 (`PUBLIC_SITE_URL`) com a URL do site público.
- [enxoval_da_mari/js/script.js](../enxoval_da_mari/js/script.js) linha 10
  (`ADMIN_API_URL`) com a URL real **deste** projeto.

## Por que dois projetos separados

Os dois erros que você teve na Vercel (`Cannot GET /` no site público,
`404` no admin) aconteciam porque o código original era um servidor Node
tradicional (`app.listen()`), e a Vercel não roda assim — ela espera ou
arquivos estáticos, ou funções serverless. Aproveitando a reestruturação,
o admin ficou isolado do site público por dois motivos:

1. Sessão em memória não sobrevivia em serverless (cada requisição podia
   cair numa instância diferente). Isso deixou de importar depois que a
   senha foi removida — hoje é só uma preocupação a menos.
2. **O painel fica fora do alcance de quem só navega a loja** — o domínio
   do site público não tem nenhuma rota nem arquivo do admin, então mesmo
   sabendo a URL não tem o que encontrar lá.

O site público (`enxoval_da_mari`) busca o catálogo direto na API pública
deste projeto (`/api/public/products` e `/api/public/categorias`, com CORS
liberado — são os mesmos dados que já aparecem na loja, não tem nada
sensível nisso).

## Como o painel funciona

1. Acesse a URL do projeto — abre direto no painel, sem login.
2. Cole o link do produto na Amazon e clique em **Buscar dados**. Esse
   mesmo link colado é o que fica salvo como link final do produto (não
   existe mais uma etapa separada de "limpar" a URL) — funciona com
   qualquer link de produto da Amazon, incluindo links encurtados
   (`amzn.to`), que são resolvidos automaticamente pro link real.
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
- **Sem senha, sem log de quem mudou o quê.** Qualquer pessoa com o link
  edita/apaga produtos livremente. Enquanto o link não vazar, na prática é
  só quem você mandar o endereço — mas não é uma barreira real de segurança.

## Reativar a senha (se quiser de volta)

Se em algum momento quiser proteger de novo, o histórico do git deste
projeto tem o commit que adicionava login por senha com sessão assinada por
cookie (sem precisar de banco de dados) — é só recuperar esse código, ou
pedir pra recriar do zero.

## Script de linha de comando (opcional)

`npm run add-produto -- <link-amazon> [categoria]` é um atalho de terminal
com o mesmo buscador do painel. Rodado localmente sem
`BLOB_READ_WRITE_TOKEN`, grava no `data/products.json` local — **não** é o
catálogo em produção. O painel web é o caminho recomendado no dia a dia.
