import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";
import { authRouter } from "./auth.js";
import { convictosRouter } from "./routes/convictos.js";
import { cardapioRouter } from "./routes/cardapio.js";
import { acoesRouter } from "./routes/acoes.js";
import { accessProfilesRouter } from "./routes/accessProfiles.js";

// 404 com a identidade visual do site (cores do cardápio) em vez do "Cannot
// GET" cru do Express. %HOME% é trocado pela home certa (raiz ou /cardapio/,
// conforme o domínio que serviu a requisição).
const NOT_FOUND_HTML = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#ece8cb">
<title>Página não encontrada — Convictos</title>
<style>
  :root { --cream: #ece8cb; --paper: #fcfbf3; --green-dark: #2e5733; --green-darker: #234127; --ink: #17150a; --muted: #6f6b52; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: var(--cream); color: var(--ink); padding: 24px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  .card { max-width: 400px; width: 100%; background: var(--paper); border-radius: 24px; padding: 40px 28px; text-align: center; box-shadow: 0 10px 30px rgba(46, 87, 51, 0.15); }
  .emoji { font-size: 52px; margin-bottom: 6px; }
  h1 { font-family: Archivo, system-ui, sans-serif; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; font-size: 21px; margin: 0 0 8px; color: var(--green-dark); }
  p { margin: 0 0 26px; font-size: 14.5px; color: var(--muted); line-height: 1.5; }
  .actions { display: flex; flex-direction: column; gap: 10px; }
  .btn { font-family: Archivo, system-ui, sans-serif; font-weight: 800; font-size: 15px; padding: 14px; border-radius: 14px; border: none; cursor: pointer; text-decoration: none; display: block; }
  .btn-primary { background: var(--green-dark); color: #fff; box-shadow: 0 4px 0 var(--green-darker); }
  .btn-ghost { background: transparent; color: var(--muted); }
</style>
</head>
<body>
  <div class="card">
    <div class="emoji">🧭</div>
    <h1>Página não encontrada</h1>
    <p>O endereço que você tentou abrir não existe ou foi movido.</p>
    <div class="actions">
      <a class="btn btn-primary" href="%HOME%">Ir para a página inicial</a>
      <button class="btn btn-ghost" onclick="history.length > 1 ? history.back() : location.href = '%HOME%'">← Voltar</button>
    </div>
  </div>
</body>
</html>
`;

const app = express();
// 8mb: cabe a lista inteira de patrocinadores com banners em base64
// (cada banner até ~1.5mb, ver MAX_BANNER_LEN em routes/convictos.js).
app.use(express.json({ limit: "8mb" }));
app.use(cookieParser());

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/cardapio", cardapioRouter);
app.use("/api", acoesRouter);
app.use("/api", accessProfilesRouter);
app.use("/api", convictosRouter);

// Em produção serve o build do Vite. O domínio cardapio.querc.app é reescrito
// para as páginas em /cardapio/ (mesmo build, dois domínios).
const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
if (existsSync(dist)) {
  app.use((req, res, next) => {
    const host = String(req.headers.host || "");
    // /assets fica na raiz do dist (compartilhado entre as páginas) — não reescrever.
    if (host.startsWith("cardapio.") && !req.path.startsWith("/cardapio") && !req.path.startsWith("/api") && !req.path.startsWith("/assets")) {
      req.url = "/cardapio" + (req.url === "/" ? "/" : req.url);
    }
    // URL RESTful do ranking: /rifa/<id> serve a página (o front lê o id do path).
    if (/^\/rifa\/[0-9a-f-]{36}\/?$/i.test(req.path)) {
      req.url = "/rifa/";
    }
    next();
  });
  app.use(express.static(dist));

  // Rota inexistente: API responde JSON, o resto ganha uma 404 com a cara do
  // site (cores do cardápio) em vez do "Cannot GET" cru do Express.
  app.use((req, res) => {
    if (req.path.startsWith("/api")) return res.status(404).json({ error: "não encontrado" });
    const home = String(req.headers.host || "").startsWith("cardapio.") ? "/cardapio/" : "/";
    res.status(404).send(NOT_FOUND_HTML.replaceAll("%HOME%", home));
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "erro interno" });
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => console.log(`API convictos ouvindo em http://localhost:${port}`));
