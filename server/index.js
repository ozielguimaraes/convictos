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

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/cardapio", cardapioRouter);
app.use("/api", acoesRouter);
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
    next();
  });
  app.use(express.static(dist));
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "erro interno" });
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => console.log(`API convictos ouvindo em http://localhost:${port}`));
