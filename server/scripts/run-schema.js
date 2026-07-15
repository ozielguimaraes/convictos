/* Roda o server/schema.sql no banco do DATABASE_URL. Idempotente. */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { pool } from "../db.js";

const sql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "schema.sql"), "utf8");

try {
  await pool.query(sql);
  console.log("Schema aplicado com sucesso.");
} finally {
  await pool.end();
}
