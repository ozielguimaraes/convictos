import { Router } from "express";
import { randomBytes } from "crypto";
import { query } from "../db.js";
import { requirePermission } from "../auth.js";

export const encurtadorRouter = Router();

const CODE_LEN = 7;
// Sem 0/O/1/l/I para evitar confusão visual ao ditar ou digitar o link.
const CODE_CHARS = "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";

function generateCode() {
  const bytes = randomBytes(CODE_LEN);
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) out += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  return out;
}

function normalizeTargetUrl(raw) {
  const value = String(raw || "").trim();
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

const FIELDS = "id, code, target_url, click_count, created_at";
const CODE_RE = /^[A-Za-z0-9]{1,32}$/;

encurtadorRouter.get("/admin/encurtador", requirePermission("encurtador:view"), async (req, res, next) => {
  try {
    const { rows } = await query(`select ${FIELDS} from short_links order by created_at desc`);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// Se o body trouxer "code", tenta usar exatamente esse valor (código
// escolhido pelo usuário) — 409 se já estiver em uso. Sem "code", gera um
// aleatório e tenta algumas vezes até não colidir com a constraint unique
// (7 chars em 57 símbolos: colisão é praticamente nula).
encurtadorRouter.post("/admin/encurtador", requirePermission("encurtador:manage"), async (req, res, next) => {
  try {
    const targetUrl = normalizeTargetUrl(req.body?.target_url);
    if (!targetUrl) return res.status(400).json({ error: "URL inválida (use http:// ou https://)" });

    const customCode = String(req.body?.code || "").trim();
    if (customCode) {
      if (!CODE_RE.test(customCode)) {
        return res.status(400).json({ error: "código inválido (use só letras e números, até 32 caracteres)" });
      }
      const { rows } = await query(
        `insert into short_links (code, target_url, created_by) values ($1, $2, $3)
         on conflict (code) do nothing returning ${FIELDS}`,
        [customCode, targetUrl, req.admin.id]
      );
      if (!rows.length) return res.status(409).json({ error: "esse código já está em uso, escolha outro" });
      return res.status(201).json(rows[0]);
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      const { rows } = await query(
        `insert into short_links (code, target_url, created_by) values ($1, $2, $3)
         on conflict (code) do nothing returning ${FIELDS}`,
        [code, targetUrl, req.admin.id]
      );
      if (rows.length) return res.status(201).json(rows[0]);
    }
    res.status(500).json({ error: "não foi possível gerar um código único, tente novamente" });
  } catch (e) {
    next(e);
  }
});

encurtadorRouter.put("/admin/encurtador/:id", requirePermission("encurtador:manage"), async (req, res, next) => {
  try {
    const targetUrl = normalizeTargetUrl(req.body?.target_url);
    if (!targetUrl) return res.status(400).json({ error: "URL inválida (use http:// ou https://)" });
    const { rows } = await query(
      `update short_links set target_url = $1 where id = $2 returning ${FIELDS}`,
      [targetUrl, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "link não encontrado" });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

encurtadorRouter.delete("/admin/encurtador/:id", requirePermission("encurtador:manage"), async (req, res, next) => {
  try {
    const { rowCount } = await query("delete from short_links where id = $1", [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "link não encontrado" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// Usado pelo redirect do subdomínio url.querc.app (ver server/index.js).
export async function resolveShortLink(code) {
  if (!CODE_RE.test(code)) return null;
  const { rows } = await query(
    "update short_links set click_count = click_count + 1 where code = $1 returning target_url",
    [code]
  );
  return rows[0]?.target_url || null;
}
