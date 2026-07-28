const express = require("express");
const { scrapeProduct, extractAsin } = require("../lib/amazonScraper");
const store = require("../lib/store");

const router = express.Router();

// Express 4 não encaminha rejeições de promise pra próxima middleware
// sozinho — sem isso, um erro (ex: Blob não configurado) travaria a
// requisição em vez de virar um JSON de erro previsível.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

router.post("/scrape", async (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: "Informe o link do produto." });

  try {
    const data = await scrapeProduct(url);
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/products", asyncHandler(async (req, res) => {
  res.json(await store.listProducts());
}));

router.post("/products", asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!body.title || !body.url || !body.category) {
    return res.status(400).json({ error: "Título, categoria e link são obrigatórios." });
  }

  const asin = body.asin || extractAsin(body.url);
  const entry = {
    ...body,
    id: body.id || asin,
    asin,
  };

  const saved = await store.saveProduct(entry);
  res.status(201).json(saved);
}));

router.put("/products/:id", asyncHandler(async (req, res) => {
  const body = req.body || {};
  const products = await store.listProducts();
  const existing = products.find((p) => p.id === req.params.id);
  if (!existing) return res.status(404).json({ error: "Produto não encontrado." });

  const saved = await store.saveProduct({ ...existing, ...body, id: req.params.id });
  res.json(saved);
}));

router.delete("/products/:id", asyncHandler(async (req, res) => {
  const removed = await store.deleteProduct(req.params.id);
  if (!removed) return res.status(404).json({ error: "Produto não encontrado." });
  res.json({ ok: true });
}));

router.get("/categorias", asyncHandler(async (req, res) => {
  res.json(await store.listCategories());
}));

router.post("/categorias", asyncHandler(async (req, res) => {
  const { slug, label, icon } = req.body || {};
  if (!slug) return res.status(400).json({ error: "Informe o slug da categoria." });
  const categorias = await store.saveCategory({ slug, label, icon });
  res.status(201).json(categorias);
}));

module.exports = router;
