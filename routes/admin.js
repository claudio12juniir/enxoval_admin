const express = require("express");
const { scrapeProduct, extractAsin } = require("../lib/amazonScraper");
const store = require("../lib/store");
const auth = require("../lib/auth");

const router = express.Router();

const isProd = process.env.NODE_ENV === "production";

// Express 4 não encaminha rejeições de promise pra próxima middleware
// sozinho — sem isso, um erro (ex: Blob não configurado) travaria a
// requisição em vez de virar um JSON de erro previsível.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function setSessionCookie(res, token) {
  res.cookie(auth.COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    maxAge: auth.SESSION_TTL_MS,
  });
}

router.post("/login", (req, res) => {
  const { password } = req.body || {};

  let valid;
  try {
    valid = auth.checkPassword(password);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  if (!valid) {
    return res.status(401).json({ error: "Senha incorreta." });
  }

  const token = auth.createSession();
  setSessionCookie(res, token);
  res.json({ ok: true });
});

router.post("/logout", (req, res) => {
  // Sessão é sem estado (assinada no próprio cookie) — não há nada pra
  // invalidar no servidor, só apagar o cookie do navegador.
  res.clearCookie(auth.COOKIE_NAME);
  res.json({ ok: true });
});

router.get("/me", (req, res) => {
  const token = req.cookies ? req.cookies[auth.COOKIE_NAME] : null;
  res.json({ authenticated: auth.isValidSession(token) });
});

// A partir daqui, todas as rotas exigem sessão de admin válida.
router.use(auth.requireAdmin);

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
