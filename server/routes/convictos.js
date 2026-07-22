import { Router } from "express";
import bcrypt from "bcryptjs";
import { query, withTransaction } from "../db.js";
import { requirePermission } from "../auth.js";
import { isValidPermissionList } from "../permissions.js";

export const convictosRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const asUuid = (v) => (UUID_RE.test(String(v)) ? v : null);

const PROFILE_FIELDS = "title, subtitle, avatar_emoji, theme";
const SPONSOR_FIELDS = "id, name, emoji, plan, url, banner, address, whatsapp, phone, instagram";
const SPONSOR_CLICK_KINDS = ["click_site", "click_whatsapp", "click_phone", "click_instagram", "click_address"];
// ~1.5MB base64 (~1MB de imagem original) — banner cabe direto no Postgres
// sem precisar de storage externo nem volume persistente no deploy.
const MAX_BANNER_LEN = 1_500_000;

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

// Grade pública de patrocinadores (raiz do site). Nunca expõe valor/benefícios
// do plano — só nome, emoji, plano (define o tamanho no grid), banner e contatos.
convictosRouter.get("/sponsors", async (req, res, next) => {
  try {
    const { rows } = await query(
      `select ${SPONSOR_FIELDS} from sponsors where visible order by position`
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// Métricas públicas (sem dado pessoal do visitante) — para prestação de
// contas aos patrocinadores. Falha silenciosa não existe: erro vira 400,
// mas nunca derruba a navegação do visitante (chamado com fire-and-forget).

convictosRouter.post("/visits", async (req, res, next) => {
  try {
    const path = typeof req.body?.path === "string" ? req.body.path.slice(0, 200) : "/";
    await query("insert into site_visits (path) values ($1)", [path]);
    res.status(201).json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// Visualização em lote dos cards renderizados na grade (1 chamada por carregamento de página).
convictosRouter.post("/sponsors/views", async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(asUuid).filter(Boolean) : [];
    if (ids.length === 0) return res.status(201).json({ ok: true });
    await query(
      "insert into sponsor_events (sponsor_id, kind) select id, 'view' from sponsors where id = any($1::uuid[])",
      [ids]
    );
    res.status(201).json({ ok: true });
  } catch (e) {
    next(e);
  }
});

convictosRouter.post("/sponsors/:id/click", async (req, res, next) => {
  try {
    const id = asUuid(req.params.id);
    if (!id) return res.status(400).json({ error: "id inválido" });
    if (!SPONSOR_CLICK_KINDS.includes(req.body?.kind)) return res.status(400).json({ error: "tipo de clique inválido" });
    await query(
      "insert into sponsor_events (sponsor_id, kind) select $1, $2 where exists (select 1 from sponsors where id = $1)",
      [id, req.body.kind]
    );
    res.status(201).json({ ok: true });
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

convictosRouter.get("/admin/sponsors", requirePermission("patrocinadores:view"), async (req, res, next) => {
  try {
    const { rows } = await query(
      `select ${SPONSOR_FIELDS}, visible from sponsors order by position`
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// Relatório de métricas para prestação de contas: visitas totais do site +
// visualizações/cliques por patrocinador (contadores acumulados, sem filtro de data).
// dias exibidos na quebra diária do relatório (padrão 30, teto 90).
function reportDays(req) {
  const n = parseInt(req.query.days, 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), 90) : 30;
}

async function buildSponsorsReport(days) {
  const visits = await query("select count(*)::int as total from site_visits");
  const sponsors = await query(`
    select s.id, s.name,
      count(*) filter (where e.kind = 'view') as views,
      count(*) filter (where e.kind = 'click_site') as clicks_site,
      count(*) filter (where e.kind = 'click_whatsapp') as clicks_whatsapp,
      count(*) filter (where e.kind = 'click_phone') as clicks_phone,
      count(*) filter (where e.kind = 'click_instagram') as clicks_instagram,
      count(*) filter (where e.kind = 'click_address') as clicks_address
    from sponsors s
    left join sponsor_events e on e.sponsor_id = s.id
    group by s.id, s.name
    order by s.position
  `);
  // Visitas por dia (últimos N dias, com dia zerado quando não houve visita).
  const dailyVisits = await query(
    `select to_char(d::date, 'YYYY-MM-DD') as date, coalesce(v.c, 0)::int as visits
     from generate_series(current_date - ($1::int - 1), current_date, interval '1 day') d
     left join (
       select date_trunc('day', created_at)::date as day, count(*) as c
       from site_visits
       where created_at >= now() - ($1 || ' days')::interval
       group by 1
     ) v on v.day = d::date
     order by d`,
    [days]
  );
  // Visualizações/cliques por patrocinador e por dia (só dias com atividade).
  const dailySponsors = await query(
    `select s.id as sponsor_id, s.name as sponsor_name,
       to_char(date_trunc('day', e.created_at), 'YYYY-MM-DD') as date,
       count(*) filter (where e.kind = 'view')::int as views,
       count(*) filter (where e.kind like 'click_%')::int as clicks
     from sponsor_events e
     join sponsors s on s.id = e.sponsor_id
     where e.created_at >= now() - ($1 || ' days')::interval
     group by s.id, s.name, date_trunc('day', e.created_at)
     order by date, s.position`,
    [days]
  );
  return {
    totalVisits: visits.rows[0].total,
    sponsors: sponsors.rows,
    dailyVisits: dailyVisits.rows,
    dailySponsors: dailySponsors.rows,
  };
}

convictosRouter.get("/admin/sponsors/report", requirePermission("patrocinadores:view"), async (req, res, next) => {
  try {
    res.json(await buildSponsorsReport(reportDays(req)));
  } catch (e) {
    next(e);
  }
});

function csvField(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csvRow(fields) {
  return fields.map(csvField).join(",") + "\r\n";
}

convictosRouter.get("/admin/sponsors/report.csv", requirePermission("patrocinadores:view"), async (req, res, next) => {
  try {
    const days = reportDays(req);
    const report = await buildSponsorsReport(days);
    let csv = "﻿"; // BOM: acentos abrem certo no Excel.
    csv += csvRow(["Relatório de patrocinadores — Convictos"]);
    csv += csvRow([`Visitas totais ao site: ${report.totalVisits}`]);
    csv += csvRow([`Período da quebra diária: últimos ${days} dias`]);
    csv += "\r\n";
    csv += csvRow(["Patrocinador", "Views", "Cliques site", "Cliques WhatsApp", "Cliques telefone", "Cliques Instagram", "Cliques endereço"]);
    for (const s of report.sponsors) {
      csv += csvRow([s.name, s.views, s.clicks_site, s.clicks_whatsapp, s.clicks_phone, s.clicks_instagram, s.clicks_address]);
    }
    csv += "\r\n";
    csv += csvRow(["Visitas ao site por dia"]);
    csv += csvRow(["Data", "Visitas"]);
    for (const d of report.dailyVisits) csv += csvRow([d.date, d.visits]);
    csv += "\r\n";
    csv += csvRow(["Patrocinador por dia"]);
    csv += csvRow(["Data", "Patrocinador", "Views", "Cliques"]);
    for (const d of report.dailySponsors) csv += csvRow([d.date, d.sponsor_name, d.views, d.clicks]);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="patrocinadores-relatorio-${days}dias.csv"`);
    res.send(csv);
  } catch (e) {
    next(e);
  }
});

// Substitui a lista inteira de patrocinadores de forma atômica (mesma
// estratégia do replace_menu / admin/links: ids existentes são mantidos).
const SPONSOR_PLANS = ["ouro", "prata", "bronze"];
convictosRouter.put("/admin/sponsors", requirePermission("patrocinadores:manage"), async (req, res, next) => {
  try {
    const list = req.body;
    if (!Array.isArray(list)) return res.status(400).json({ error: "esperado um array de patrocinadores" });
    for (const s of list) {
      if (!s.name) return res.status(400).json({ error: "todo patrocinador precisa de nome" });
      if (!SPONSOR_PLANS.includes(s.plan)) return res.status(400).json({ error: "plano inválido" });
      if ((s.banner || "").length > MAX_BANNER_LEN) {
        return res.status(400).json({ error: `banner de "${s.name}" é grande demais — use uma imagem menor ou um link externo` });
      }
    }
    await withTransaction(async (client) => {
      const keep = [];
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        const id = asUuid(s.id);
        const exists = id
          ? (await client.query("select 1 from sponsors where id = $1", [id])).rows.length
          : 0;
        const values = [
          s.name, s.emoji || "", s.plan, s.url || "", s.banner || "",
          s.address || "", s.whatsapp || "", s.phone || "", s.instagram || "",
          s.visible !== false, i,
        ];
        if (exists) {
          await client.query(
            `update sponsors set name = $1, emoji = $2, plan = $3, url = $4, banner = $5,
               address = $6, whatsapp = $7, phone = $8, instagram = $9, visible = $10, position = $11
             where id = $12`,
            [...values, id]
          );
          keep.push(id);
        } else {
          const ins = await client.query(
            `insert into sponsors (name, emoji, plan, url, banner, address, whatsapp, phone, instagram, visible, position)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
            values
          );
          keep.push(ins.rows[0].id);
        }
      }
      await client.query("delete from sponsors where not (id = any($1::uuid[]))", [keep]);
    });
    const { rows } = await query(`select ${SPONSOR_FIELDS}, visible from sponsors order by position`);
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
