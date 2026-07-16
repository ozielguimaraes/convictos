import { Router } from "express";
import bcrypt from "bcryptjs";
import { query, withTransaction } from "../db.js";
import { requirePermission } from "../auth.js";
import { isValidPermissionList } from "../permissions.js";

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

convictosRouter.put("/admin/profile", requirePermission("aparencia:manage"), async (req, res, next) => {
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

convictosRouter.get("/admin/links", requirePermission("links:view"), async (req, res, next) => {
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
convictosRouter.put("/admin/links", requirePermission("links:manage"), async (req, res, next) => {
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

convictosRouter.get("/admin/avisos", requirePermission("avisos:view"), async (req, res, next) => {
  try {
    const { rows } = await query(
      "select id, title, body, pinned, published, created_at, updated_at from avisos order by pinned desc, created_at desc"
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

convictosRouter.post("/admin/avisos", requirePermission("avisos:manage"), async (req, res, next) => {
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

convictosRouter.put("/admin/avisos/:id", requirePermission("avisos:manage"), async (req, res, next) => {
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

convictosRouter.delete("/admin/avisos/:id", requirePermission("avisos:manage"), async (req, res, next) => {
  try {
    const { rowCount } = await query("delete from avisos where id = $1", [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "aviso não encontrado" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ---------- usuários (permissão "usuarios") ----------
// Ninguém cria super admin: role nunca vem do payload (fixado no schema).
// Quem não é super admin não concede a permissão "perfis" — nem como extra,
// nem atribuindo um perfil que a contenha.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USER_FIELDS = `u.id, u.email, u.name, u.role, u.profile_id, p.name as profile_name,
  u.extra_permissions, u.password_hash is not null as has_password, u.created_at`;

const userQuery = (where) => `
  select ${USER_FIELDS} from admin_users u
  left join access_profiles p on p.id = u.profile_id
  ${where}`;

/* Valida perfil/extras do payload e aplica a regra anti-escalação.
   Retorna { profile_id, extra_permissions } ou { error }. */
async function accessInput(body, caller) {
  const profile_id = body.profile_id == null || body.profile_id === "" ? null : Number(body.profile_id);
  const extra_permissions = body.extra_permissions ?? [];
  if (profile_id !== null && !Number.isInteger(profile_id)) return { error: "perfil inválido" };
  if (!isValidPermissionList(extra_permissions)) return { error: "acessos extras inválidos" };
  let profilePerms = [];
  if (profile_id !== null) {
    const { rows } = await query("select permissions from access_profiles where id = $1", [profile_id]);
    if (!rows.length) return { error: "perfil não encontrado" };
    profilePerms = rows[0].permissions;
  }
  if (caller.role !== "super_admin" && [...extra_permissions, ...profilePerms].some((k) => k.startsWith("perfis:"))) {
    return { error: "somente o super admin concede acesso a perfis" };
  }
  return { profile_id, extra_permissions };
}

convictosRouter.get("/admin/users", requirePermission("usuarios:view"), async (req, res, next) => {
  try {
    const { rows } = await query(userQuery("order by u.created_at"));
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

convictosRouter.post("/admin/users", requirePermission("usuarios:manage"), async (req, res, next) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    const name = String(req.body.name || "").trim();
    const password = String(req.body.password || "");
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "e-mail inválido" });
    if (password && password.length < 6) return res.status(400).json({ error: "senha precisa de ao menos 6 caracteres" });
    const access = await accessInput(req.body, req.admin);
    if (access.error) return res.status(400).json({ error: access.error });
    const hash = password ? bcrypt.hashSync(password, 10) : null;
    const ins = await query(
      `insert into admin_users (email, name, password_hash, profile_id, extra_permissions)
       values ($1, $2, $3, $4, $5)
       on conflict (email) do nothing
       returning id`,
      [email, name, hash, access.profile_id, access.extra_permissions]
    );
    if (!ins.rows.length) return res.status(409).json({ error: "já existe usuário com esse e-mail" });
    const { rows } = await query(userQuery("where u.id = $1"), [ins.rows[0].id]);
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

convictosRouter.put("/admin/users/:id", requirePermission("usuarios:manage"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const name = String(req.body.name || "").trim();
    const password = String(req.body.password || "");
    if (password && password.length < 6) return res.status(400).json({ error: "senha precisa de ao menos 6 caracteres" });
    const cur = await query("select role from admin_users where id = $1", [id]);
    if (!cur.rows.length) return res.status(404).json({ error: "usuário não encontrado" });
    const targetIsSuper = cur.rows[0].role === "super_admin";
    if (targetIsSuper && req.admin.role !== "super_admin") {
      return res.status(403).json({ error: "somente o próprio super admin altera essa conta" });
    }
    // Perfil/extras não se aplicam ao super admin (acesso total é fixo).
    const access = targetIsSuper
      ? { profile_id: null, extra_permissions: [] }
      : await accessInput(req.body, req.admin);
    if (access.error) return res.status(400).json({ error: access.error });
    const hash = password ? bcrypt.hashSync(password, 10) : null;
    await query(
      `update admin_users set name = $1,
         password_hash = coalesce($2, password_hash),
         profile_id = $3, extra_permissions = $4
       where id = $5`,
      [name, hash, access.profile_id, access.extra_permissions, id]
    );
    const { rows } = await query(userQuery("where u.id = $1"), [id]);
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

convictosRouter.delete("/admin/users/:id", requirePermission("usuarios:manage"), async (req, res, next) => {
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
