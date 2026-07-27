require("dotenv").config();

const express = require("express");
const path = require("node:path");
const app = require("./api/index");

// Só para desenvolvimento local: serve os arquivos estáticos (que na Vercel
// são servidos direto, sem passar pela função) e sobe o mesmo app Express
// da API na mesma porta, imitando o comportamento final em produção.
const PORT = process.env.ADMIN_PORT || 8935;

app.use("/css", express.static(path.join(__dirname, "css")));
app.use("/js", express.static(path.join(__dirname, "js")));
app.use(express.static(path.join(__dirname), { index: "index.html" }));

app.listen(PORT, () => {
  console.log(`Painel admin (local) rodando em http://localhost:${PORT}`);
});
