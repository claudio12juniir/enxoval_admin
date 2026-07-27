const crypto = require("node:crypto");

const COOKIE_NAME = "enxoval_admin_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas

// Sem estado de propósito: numa função serverless, cada requisição pode
// cair numa instância diferente (ou numa instância "fria" nova), então uma
// sessão guardada em memória (ex: um Map) some a qualquer momento e derruba
// o login sem aviso. Em vez disso, o cookie carrega a validade (timestamp)
// mais uma assinatura HMAC — dá pra validar sem guardar nada no servidor.
// Compromisso: não existe "invalidar sessão" no logout, o cookie só é
// apagado no navegador. Para um painel de admin única, é suficiente.

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET (ou ADMIN_PASSWORD) não configurada. Defina a variável de ambiente antes de iniciar o servidor (veja .env.example)."
    );
  }
  return secret;
}

function getAdminPassword() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error(
      "ADMIN_PASSWORD não configurada. Defina a variável de ambiente antes de iniciar o servidor (veja .env.example)."
    );
  }
  return password;
}

function sign(value) {
  return crypto.createHmac("sha256", getSessionSecret()).update(value).digest("hex");
}

function safeCompare(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function checkPassword(password) {
  if (!password) return false;
  return safeCompare(password, getAdminPassword());
}

function createSession() {
  const payload = String(Date.now() + SESSION_TTL_MS);
  const signature = sign(payload);
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

function isValidSession(token) {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [payload, signature] = decoded.split(".");
    if (!payload || !signature) return false;
    if (!safeCompare(signature, sign(payload))) return false;
    return Number(payload) > Date.now();
  } catch {
    return false;
  }
}

function requireAdmin(req, res, next) {
  const token = req.cookies ? req.cookies[COOKIE_NAME] : null;
  if (!isValidSession(token)) {
    return res.status(401).json({ error: "Não autenticado." });
  }
  next();
}

module.exports = {
  COOKIE_NAME,
  SESSION_TTL_MS,
  checkPassword,
  createSession,
  isValidSession,
  requireAdmin,
};
