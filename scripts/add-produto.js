#!/usr/bin/env node
/**
 * Adiciona (ou atualiza) um produto no catálogo colando apenas o link da Amazon.
 *
 * Uso:
 *   node scripts/add-produto.js <link-amazon> [categoria] [preco]
 *
 * Atalho de terminal que usa o mesmo motor de busca do painel web. Prefira o
 * painel no dia a dia. Atenção: sem a variável BLOB_READ_WRITE_TOKEN, este
 * script grava no data/products.json local — não é o catálogo em produção
 * (que fica no Vercel Blob). Rodar isso na sua máquina não afeta o site
 * publicado, a menos que você exporte o mesmo token de produção.
 */

const path = require("node:path");
const readline = require("node:readline/promises");

const { scrapeProduct } = require(path.join("..", "lib", "amazonScraper"));
const store = require(path.join("..", "lib", "store"));

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (question) => rl.question(question);

function printUsage(categorias) {
  console.log(`
Uso:
  node scripts/add-produto.js <link-amazon> [categoria] [preco]

Categorias disponíveis:
  ${categorias.map((c) => `${c.slug} (${c.label})`).join("\n  ")}

Exemplo:
  node scripts/add-produto.js https://www.amazon.com.br/dp/B0EXEMPLO cozinha
`);
}

async function resolveCategory(categorias, provided) {
  const slugs = categorias.map((c) => c.slug);
  if (provided && slugs.includes(provided)) return provided;

  if (provided) {
    console.log(`\nCategoria "${provided}" não existe ainda.`);
    const criar = (await ask(`Criar nova categoria "${provided}"? (s/n) `)).trim().toLowerCase();
    if (criar === "s") {
      const label = (await ask("Nome de exibição da categoria: ")).trim() || provided;
      const icon = (await ask("Ícone/emoji (opcional): ")).trim() || "🛍️";
      await store.saveCategory({ slug: provided, label, icon });
      return provided;
    }
  }

  console.log("\nCategorias disponíveis:");
  categorias.forEach((c, i) => console.log(`  ${i + 1}. ${c.label} (${c.slug})`));
  const answer = (await ask("Escolha o número ou digite um novo slug de categoria: ")).trim();
  const byIndex = categorias[Number(answer) - 1];
  if (byIndex) return byIndex.slug;
  return resolveCategory(categorias, answer);
}

async function main() {
  const [, , urlArg, categoriaArg, precoArg] = process.argv;
  const categorias = await store.listCategories();

  if (!urlArg) {
    printUsage(categorias);
    rl.close();
    return;
  }

  console.log("Buscando dados do produto...");
  let data;
  try {
    data = await scrapeProduct(urlArg);
  } catch (err) {
    console.error(err.message);
    rl.close();
    return;
  }

  let titulo = data.title;
  let imagem = data.images[0] || null;
  let preco = precoArg || data.price;

  if (data.blocked) {
    console.log("\nA Amazon bloqueou o acesso automático a esta página desta vez.");
  }
  if (!titulo) {
    titulo = (await ask("Digite o título do produto: ")).trim();
  }
  if (!imagem) {
    imagem = (await ask("Cole a URL da imagem do produto (opcional, Enter para pular): ")).trim() || null;
  }
  if (!preco) {
    preco = (await ask("Preço para exibir (opcional, ex: R$ 129,90 — Enter para pular): ")).trim() || null;
  }

  const categoria = await resolveCategory(categorias, categoriaArg);

  const entry = await store.saveProduct({
    id: data.asin,
    asin: data.asin,
    title: titulo,
    description: data.description,
    bullets: data.bullets,
    image: imagem,
    images: data.images,
    video: data.video,
    price: preco,
    category: categoria,
    url: data.url,
  });

  console.log(`\nProduto salvo: ${entry.title}`);
  console.log(`Categoria: ${categoria} | Preço: ${preco || "não informado"}`);

  rl.close();
}

main();
