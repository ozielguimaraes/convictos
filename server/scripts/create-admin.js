/* Cria (ou atualiza a senha de) um admin.
   Uso: npm run admin:create -- email@dominio.com senha [Nome] */
import bcrypt from "bcryptjs";
import { pool } from "../db.js";

const [email, password, name = ""] = process.argv.slice(2);

if (!email || !password) {
  console.error("Uso: npm run admin:create -- email@dominio.com senha [Nome]");
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);

try {
  await pool.query(
    `insert into admin_users (email, name, password_hash) values ($1, $2, $3)
     on conflict (email) do update set password_hash = $3, name = coalesce(nullif($2, ''), admin_users.name)`,
    [email.toLowerCase().trim(), name, hash]
  );
  console.log(`Admin ${email} criado/atualizado.`);
} finally {
  await pool.end();
}
