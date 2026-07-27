const express = require("express");
const store = require("../lib/store");

const router = express.Router();

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// Leitura pública do catálogo — sem senha, é o que a vitrine (enxoval_da_mari,
// outro domínio/deploy) consome no navegador do cliente final. CORS liberado
// porque esses dados já são públicos por natureza (é o que aparece na loja).
router.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

router.get("/products", asyncHandler(async (req, res) => {
  res.json(await store.listProducts());
}));

router.get("/categorias", asyncHandler(async (req, res) => {
  res.json(await store.listCategories());
}));

module.exports = router;
