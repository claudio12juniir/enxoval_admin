const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");
const PRODUCTS_PATH = path.join(ROOT, "data", "products.json");
const CATEGORIES_PATH = path.join(ROOT, "data", "categorias.json");

const PRODUCTS_BLOB_KEY = "data/products.json";
const CATEGORIES_BLOB_KEY = "data/categorias.json";

// No Vercel o disco da função é somente leitura (fora de /tmp, que não é
// compartilhado entre instâncias) — não dá pra persistir com fs.writeFileSync
// como num servidor tradicional. Quando existe um token de Blob Storage da
// Vercel, usamos ele; sem o token (desenvolvimento local), caímos de volta
// pros arquivos JSON em data/, exatamente como antes.
function blobEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

// process.env.VERCEL é definido automaticamente pela Vercel em toda função
// serverless — usamos isso pra distinguir "rodando local, sem Blob configurado
// ainda" (fallback em arquivo é ok) de "rodando em produção sem Blob"
// (gravar em arquivo vai falhar de qualquer forma; melhor um erro claro).
function assertWritable() {
  if (!blobEnabled() && process.env.VERCEL) {
    throw new Error(
      "Armazenamento não configurado: conecte um Blob Store a este projeto na Vercel (Storage → Connect Store → Blob) antes de salvar produtos."
    );
  }
}

function readJSONFile(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  const raw = fs.readFileSync(filePath, "utf-8").trim();
  return raw ? JSON.parse(raw) : fallback;
}

function writeJSONFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

async function readBlobJSON(key, fallback) {
  const { get } = require("@vercel/blob");
  // useCache: false ignora o cache de CDN — sem isso, salvar um produto e
  // atualizar a lista logo em seguida podia mostrar uma versão antiga.
  const result = await get(key, { access: "public", useCache: false });
  if (!result || !result.stream) return fallback;
  const text = await new Response(result.stream).text();
  return text.trim() ? JSON.parse(text) : fallback;
}

async function writeBlobJSON(key, data) {
  const { put } = require("@vercel/blob");
  await put(key, JSON.stringify(data, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

async function readData(key, filePath, fallback) {
  if (blobEnabled()) return readBlobJSON(key, fallback);
  return readJSONFile(filePath, fallback);
}

async function writeData(key, filePath, data) {
  assertWritable();
  if (blobEnabled()) return writeBlobJSON(key, data);
  return writeJSONFile(filePath, data);
}

async function listProducts() {
  return readData(PRODUCTS_BLOB_KEY, PRODUCTS_PATH, []);
}

async function saveProduct(entry) {
  const products = await listProducts();
  const now = new Date().toISOString();
  const existingIndex = products.findIndex((p) => p.id === entry.id);

  const record = {
    id: entry.id || entry.asin || crypto.randomUUID(),
    asin: entry.asin || null,
    title: entry.title,
    description: entry.description || null,
    bullets: Array.isArray(entry.bullets) ? entry.bullets : [],
    image: entry.image || (entry.images && entry.images[0]) || null,
    images: Array.isArray(entry.images) ? entry.images : [],
    video: entry.video || null,
    price: entry.price || null,
    category: entry.category,
    url: entry.url,
    addedAt: existingIndex >= 0 ? products[existingIndex].addedAt : now,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    products[existingIndex] = record;
  } else {
    products.push(record);
  }

  await writeData(PRODUCTS_BLOB_KEY, PRODUCTS_PATH, products);
  return record;
}

async function deleteProduct(id) {
  const products = await listProducts();
  const next = products.filter((p) => p.id !== id);
  const removed = next.length !== products.length;
  if (removed) await writeData(PRODUCTS_BLOB_KEY, PRODUCTS_PATH, next);
  return removed;
}

async function listCategories() {
  return readData(CATEGORIES_BLOB_KEY, CATEGORIES_PATH, []);
}

async function saveCategory({ slug, label, icon }) {
  const categorias = await listCategories();
  if (categorias.some((c) => c.slug === slug)) return categorias;
  categorias.push({ slug, label: label || slug, icon: icon || "🛍️" });
  await writeData(CATEGORIES_BLOB_KEY, CATEGORIES_PATH, categorias);
  return categorias;
}

module.exports = {
  listProducts,
  saveProduct,
  deleteProduct,
  listCategories,
  saveCategory,
};
