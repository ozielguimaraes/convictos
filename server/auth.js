import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { query } from "./db.js";
import { sendLoginEmail } from "./mail.js";
import { PERMISSION_KEYS, expandPermissions } from "./permissions.js";

const SESSION_COOKIE = "convictos_session";
const SESSION_DAYS = 30;
const TOKEN_MINUTES = 15;

const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || "");

async function createSession(res, userId) {
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const { rows } = await query(
    "insert into sessions (user_id, expires_at) values ($1, $2) returning token",
    [userId, expires]
  );
  res.cookie(SESSION_COOKIE, rows[0].token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires,
  });
}

/* Middleware: exige sessão válida de admin; anexa req.admin com as permissões
   efetivas (super admin = todas; demais = perfil ∪ extras). */
export async function requireAdmin(req, res, next) {
  try {
    const token = req.cookies[SESSION_COOKIE];
    if (!token) return res.status(401).json({ error: "não autenticado" });
    const { rows } = await query(
      `select u.id, u.email, u.name, u.role, u.profile_id, u.extra_permissions,
              p.name as profile_name, coalesce(p.permissions, '{}') as profile_permissions
       from sessions s
       join admin_users u on u.id = s.user_id
       left join access_profiles p on p.id = u.profile_id
       where s.token = $1 and s.expires_at > now()`,
      [token]
    );
    if (!rows.length) return res.status(401).json({ error: "sessão expirada" });
    const u = rows[0];
    const effective = u.role === "super_admin"
      ? PERMISSION_KEYS
      : expandPermissions(
          [...new Set([...(u.profile_permissions || []), ...(u.extra_permissions || [])])]
            .filter((k) => PERMISSION_KEYS.includes(k))
        );
    req.admin = {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      profile_id: u.profile_id,
      profile_name: u.profile_name,
      permissions: effective,
    };
    next();
  } catch (e) {
    next(e);
  }
}

/* Middleware: exige ao menos uma das permissões informadas. */
export function requirePermission(...keys) {
  return (req, res, next) => {
    requireAdmin(req, res, () => {
      if (keys.some((k) => req.admin.permissions.includes(k))) return next();
      res.status(403).json({ error: "acesso restrito" });
    });
  };
}

export const authRouter = Router();

// Cooldown em memória para não permitir rajada de e-mails por endereço.
const lastSend = new Map();

authRouter.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    const password = String(req.body.password || "");
    if (!emailOk(email) || !password) return res.status(400).json({ error: "e-mail e senha obrigatórios" });
    const { rows } = await query("select id, password_hash from admin_users where email = $1", [email]);
    if (!rows.length || !rows[0].password_hash || !bcrypt.compareSync(password, rows[0].password_hash)) {
      return res.status(401).json({ error: "e-mail ou senha incorretos" });
    }
    await createSession(res, rows[0].id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

authRouter.post("/send-code", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    if (!emailOk(email)) return res.status(400).json({ error: "e-mail inválido" });

    const last = lastSend.get(email) || 0;
    if (Date.now() - last < 30_000) return res.status(429).json({ error: "aguarde para reenviar" });

    const { rows } = await query("select id from admin_users where email = $1", [email]);
    // Resposta idêntica para e-mail desconhecido: não revela quem é admin.
    if (!rows.length) return res.json({ ok: true });

    lastSend.set(email, Date.now());
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    const expires = new Date(Date.now() + TOKEN_MINUTES * 60 * 1000);
    await query("update login_tokens set used = true where email = $1 and not used", [email]);
    const ins = await query(
      "insert into login_tokens (email, code, expires_at) values ($1, $2, $3) returning magic_token",
      [email, code, expires]
    );
    const appUrl = process.env.APP_URL || "http://localhost:5173";
    const magicLink = `${appUrl}/api/auth/magic?token=${ins.rows[0].magic_token}`;
    await sendLoginEmail(email, code, magicLink);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

async function consumeToken(where, params) {
  const { rows } = await query(
    `update login_tokens set used = true
     where ${where} and not used and expires_at > now()
     returning email`,
    params
  );
  if (!rows.length) return null;
  const user = await query("select id from admin_users where email = $1", [rows[0].email]);
  return user.rows[0] || null;
}

authRouter.post("/verify-code", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    const code = String(req.body.code || "").trim();
    const user = await consumeToken("email = $1 and code = $2", [email, code]);
    if (!user) return res.status(401).json({ error: "código incorreto ou expirado" });
    await createSession(res, user.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

authRouter.get("/magic", async (req, res, next) => {
  try {
    const token = String(req.query.token || "");
    if (!/^[0-9a-f-]{36}$/.test(token)) return res.status(400).send("Link inválido.");
    const user = await consumeToken("magic_token = $1", [token]);
    if (!user) return res.status(401).send("Link inválido ou expirado. Volte ao painel e peça um novo código.");
    await createSession(res, user.id);
    res.redirect("/admin/");
  } catch (e) {
    next(e);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const token = req.cookies[SESSION_COOKIE];
    if (token) await query("delete from sessions where token = $1", [token]);
    res.clearCookie(SESSION_COOKIE);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

authRouter.get("/me", requireAdmin, (req, res) => {
  res.json({
    id: req.admin.id,
    email: req.admin.email,
    name: req.admin.name,
    role: req.admin.role,
    profile: req.admin.profile_name || null,
    permissions: req.admin.permissions,
  });
});
