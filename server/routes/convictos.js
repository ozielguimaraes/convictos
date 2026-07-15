import { Router } from "express";
import bcrypt from "bcryptjs";
import { query, withTransaction } from "../db.js";
import { requireAdmin, requireSuperAdmin } from "../auth.js";

export const convictosRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const asUuid = (v) => (UUID_RE.test(String(v)) ? v : null);

const PROFILE_FIELDS = "title, subtitle, avatar_emoji, theme";

// ---------- público ----------

// Página inicial (linktree): perfil + links visíveis.
convictosRouter.get("/profile", async (req, res, next) => {
  try {
    const profile = await query(`select ${PROFILE_FIELDS} from profile where id = 1`);
    const links = await query(
      "select id, label, url, emoji from links where visible order by position"
    );
    res.json({ ...profile.rows[0], links: links.rows });
  } catch (e) {
    next(e);
  }
});

convictosRouter.get("/avisos", async (req, res, next) => {
  try {
    const { rows } = await query(
      `select id, title, body, pinned, created_at from avisos
       where published order by pinned desc, created_at desc`
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// ---------- admin ----------

convictosRouter.put("/admin/profile", requireAdmin, async (req, res, next) => {
  try {
    const { title, subtitle, avatar_emoji, theme } = req.body;
    if (!title || typeof title !== "string") return res.status(400).json({ error: "título obrigatório" });
    const { rows } = await query(
      `update profile set title = $1, subtitle = $2, avatar_emoji = $3, theme = $4
       where id = 1 returning ${PROFILE_FIELDS}`,
      [title, subtitle || "", avatar_emoji || "", theme || {}]
    );
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

convictosRouter.get("/admin/links", requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await query(
      "select id, label, url, emoji, visible from links order by position"
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// Substitui a lista inteira de links de forma atômica, atualizando pelo id
// (mesma estratégia do replace_menu do cardapio-on: ids existentes são mantidos).
convictosRouter.put("/admin/links", requireAdmin, async (req, res, next) => {
  try {
    const list = req.body;
    if (!Array.isArray(list)) return res.status(400).json({ error: "esperado um array de links" });
    for (const l of list) {
      if (!l.label || !l.url) return res.status(400).json({ error: "todo link precisa de label e url" });
    }
    await withTransaction(async (client) => {
      const keep = [];
      for (let i = 0; i < list.length; i++) {
        const l = list[i];
        const id = asUuid(l.id);
        const exists = id
          ? (await client.query("select 1 from links where id = $1", [id])).rows.length
          : 0;
        if (exists) {
          await client.query(
            "update links set label = $1, url = $2, emoji = $3, visible = $4, position = $5 where id = $6",
            [l.label, l.url, l.emoji || "", l.visible !== false, i, id]
          );
          keep.push(id);
        } else {
          const ins = await client.query(
            "insert into links (label, url, emoji, visible, position) values ($1, $2, $3, $4, $5) returning id",
            [l.label, l.url, l.emoji || "", l.visible !== false, i]
          );
          keep.push(ins.rows[0].id);
        }
      }
      await client.query("delete from links where not (id = any($1::uuid[]))", [keep]);
    });
    const { rows } = await query("select id, label, url, emoji, visible from links order by position");
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

convictosRouter.get("/admin/avisos", requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await query(
      "select id, title, body, pinned, published, created_at, updated_at from avisos order by pinned desc, created_at desc"
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

convictosRouter.post("/admin/avisos", requireAdmin, async (req, res, next) => {
  try {
    const { title, body, pinned, published } = req.body;
    if (!title) return res.status(400).json({ error: "título obrigatório" });
    const { rows } = await query(
      `insert into avisos (title, body, pinned, published) values ($1, $2, $3, $4)
       returning id, title, body, pinned, published, created_at, updated_at`,
      [title, body || "", !!pinned, published !== false]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

convictosRouter.put("/admin/avisos/:id", requireAdmin, async (req, res, next) => {
  try {
    const { title, body, pinned, published } = req.body;
    if (!title) return res.status(400).json({ error: "título obrigatório" });
    const { rows } = await query(
      `update avisos set title = $1, body = $2, pinned = $3, published = $4, updated_at = now()
       where id = $5 returning id, title, body, pinned, published, created_at, updated_at`,
      [title, body || "", !!pinned, published !== false, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "aviso não encontrado" });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

convictosRouter.delete("/admin/avisos/:id", requireAdmin, async (req, res, next) => {
  try {
    const { rowCount } = await query("delete from avisos where id = $1", [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "aviso não encontrado" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ---------- usuários (somente super admin) ----------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USER_FIELDS = "id, email, name, role, password_hash is not null as has_password, created_at";

convictosRouter.get("/admin/users", requireSuperAdmin, async (req, res, next) => {
  try {
    const { rows } = await query(`select ${USER_FIELDS} from admin_users order by created_at`);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

convictosRouter.post("/admin/users", requireSuperAdmin, async (req, res, next) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    const name = String(req.body.name || "").trim();
    const password = String(req.body.password || "");
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "e-mail inválido" });
    if (password && password.length < 6) return res.status(400).json({ error: "senha precisa de ao menos 6 caracteres" });
    const hash = password ? bcrypt.hashSync(password, 10) : null;
    const { rows } = await query(
      `insert into admin_users (email, name, password_hash) values ($1, $2, $3)
       on conflict (email) do nothing
       returning ${USER_FIELDS}`,
      [email, name, hash]
    );
    if (!rows.length) return res.status(409).json({ error: "já existe usuário com esse e-mail" });
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

convictosRouter.put("/admin/users/:id", requireSuperAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const name = String(req.body.name || "").trim();
    const password = String(req.body.password || "");
    if (password && password.length < 6) return res.status(400).json({ error: "senha precisa de ao menos 6 caracteres" });
    const hash = password ? bcrypt.hashSync(password, 10) : null;
    const { rows } = await query(
      `update admin_users set name = $1,
         password_hash = coalesce($2, password_hash)
       where id = $3 returning ${USER_FIELDS}`,
      [name, hash, id]
    );
    if (!rows.length) return res.status(404).json({ error: "usuário não encontrado" });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

convictosRouter.delete("/admin/users/:id", requireSuperAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (id === req.admin.id) return res.status(400).json({ error: "não é possível excluir a própria conta" });
    const { rows } = await query("select role from admin_users where id = $1", [id]);
    if (!rows.length) return res.status(404).json({ error: "usuário não encontrado" });
    if (rows[0].role === "super_admin") return res.status(400).json({ error: "o super admin não pode ser excluído" });
    await query("delete from admin_users where id = $1", [id]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
