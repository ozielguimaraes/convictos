/* Perfis de acesso dinâmicos. Gerenciar perfis exige a permissão "perfis"
   (na prática, o super admin); listar também é permitido a quem gerencia
   usuários, para atribuir perfil ao criar/editar. */
import { Router } from "express";
import { query } from "../db.js";
import { requirePermission } from "../auth.js";
import { PERMISSIONS, isValidPermissionList } from "../permissions.js";

export const accessProfilesRouter = Router();

const PROFILE_FIELDS = "id, name, permissions, created_at";

accessProfilesRouter.get("/admin/permissions", requirePermission("usuarios", "perfis"), (req, res) => {
  res.json(PERMISSIONS);
});

accessProfilesRouter.get("/admin/access-profiles", requirePermission("usuarios", "perfis"), async (req, res, next) => {
  try {
    const { rows } = await query(
      `select p.${PROFILE_FIELDS.split(", ").join(", p.")}, count(u.id)::int as users_count
       from access_profiles p left join admin_users u on u.profile_id = p.id
       group by p.id order by p.name`
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

function profileInput(body) {
  const name = String(body.name || "").trim();
  const permissions = body.permissions ?? [];
  if (!name) return { error: "nome obrigatório" };
  if (!isValidPermissionList(permissions)) return { error: "lista de acessos inválida" };
  return { name, permissions };
}

accessProfilesRouter.post("/admin/access-profiles", requirePermission("perfis"), async (req, res, next) => {
  try {
    const input = profileInput(req.body);
    if (input.error) return res.status(400).json({ error: input.error });
    const { rows } = await query(
      `insert into access_profiles (name, permissions) values ($1, $2)
       on conflict (name) do nothing returning ${PROFILE_FIELDS}`,
      [input.name, input.permissions]
    );
    if (!rows.length) return res.status(409).json({ error: "já existe um perfil com esse nome" });
    res.status(201).json({ ...rows[0], users_count: 0 });
  } catch (e) {
    next(e);
  }
});

accessProfilesRouter.put("/admin/access-profiles/:id", requirePermission("perfis"), async (req, res, next) => {
  try {
    const input = profileInput(req.body);
    if (input.error) return res.status(400).json({ error: input.error });
    const { rows } = await query(
      `update access_profiles set name = $1, permissions = $2 where id = $3 returning ${PROFILE_FIELDS}`,
      [input.name, input.permissions, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "perfil não encontrado" });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

// Usuários do perfil ficam sem perfil (profile_id vira null via FK).
accessProfilesRouter.delete("/admin/access-profiles/:id", requirePermission("perfis"), async (req, res, next) => {
  try {
    const { rowCount } = await query("delete from access_profiles where id = $1", [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "perfil não encontrado" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
