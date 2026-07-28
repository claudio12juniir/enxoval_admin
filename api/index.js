require("dotenv").config();

const express = require("express");
const adminRoutes = require("../routes/admin");
const publicRoutes = require("../routes/public");

// App Express "pura" (sem app.listen) para rodar como função serverless na
// Vercel. Localmente, local-server.js importa este mesmo app e chama
// listen() nele. Não serve nenhum arquivo estático — index.html, admin.css,
// admin.js e css/style.css são servidos direto pela Vercel como arquivos
// estáticos (zero configuração, sem passar por esta função).
//
// Sem autenticação de propósito: o painel não pede senha. A "proteção" é só
// o link não ser divulgado (veja README) — quem tiver o endereço consegue
// editar o catálogo.
const app = express();

app.use(express.json());

app.use("/api/admin", adminRoutes);
app.use("/api/public", publicRoutes);

// Sem catch-all 404 aqui de propósito: em produção a Vercel só invoca esta
// função para caminhos que batem com o rewrite de /api/(.*) no vercel.json,
// e localmente o local-server.js registra os arquivos estáticos depois
// deste app — um catch-all aqui interceptaria essas rotas antes delas.

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error(err);
  // As mensagens que a gente mesmo lança (lib/store.js, lib/amazonScraper.js)
  // já são frases seguras pra mostrar pro admin — sem isso, um erro claro
  // tipo "conecte o Blob Store" virava um genérico "erro interno" sem pista
  // nenhuma de onde procurar.
  res.status(500).json({ error: err.message || "Erro interno no servidor." });
});

module.exports = app;
