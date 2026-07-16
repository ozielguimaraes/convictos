/* Ações entre amigos: ação -> vendedores -> blocos de números.
   Valor vendido e pendente nunca são gravados — sempre calculados a partir de
   sold_count × number_price e received. */
import { Router } from "express";
import { query } from "../db.js";
import { requirePermission } from "../auth.js";

const requireAcoes = requirePermission("acoes");

export const acoesRouter = Router();

const ACAO_FIELDS = "id, name, number_price, block_size, public_ranking, show_sold_numbers, created_at";
const BLOCK_FIELDS = "id, seller_id, start_number, sold_count, received, returned";

const numAcao = (row) => ({ ...row, number_price: Number(row.number_price) });
const numBlock = (row) => ({ ...row, received: Number(row.received) });

async function getAcao(id) {
  const { rows } = await query(`select ${ACAO_FIELDS} from acoes where id = $1`, [id]);
  return rows.length ? numAcao(rows[0]) : null;
}

/* Blocos da mesma ação não podem se sobrepor: |startA − startB| < block_size. */
async function findOverlap(acaoId, start, blockSize, ignoreBlockId) {
  const { rows } = await query(
    `select start_number from acao_blocks
     where acao_id = $1 and id is distinct from $4
       and abs(start_number - $2) < $3
     limit 1`,
    [acaoId, start, blockSize, ignoreBlockId || null]
  );
  return rows[0] || null;
}

// ---------- ações ----------

acoesRouter.get("/admin/acoes", requireAcoes, async (req, res, next) => {
  try {
    // Pendente por bloco: sem entrega o vendedor deve o bloco inteiro; após a
    // entrega, deve o que vendeu — sempre descontando o recebido (mín. zero).
    const { rows } = await query(
      `select a.${ACAO_FIELDS.split(", ").join(", a.")},
              count(b.id)::int as blocks,
              coalesce(sum(b.sold_count), 0)::int as sold_numbers,
              coalesce(sum(b.received), 0) as received,
              coalesce(sum(greatest(
                (case when b.returned then b.sold_count else a.block_size end) * a.number_price - b.received,
                0
              )), 0) as pending
       from acoes a left join acao_blocks b on b.acao_id = a.id
       group by a.id order by a.created_at desc`
    );
    res.json(rows.map((r) => {
      const acao = numAcao(r);
      return {
        ...acao,
        received: Number(r.received),
        sold_value: acao.sold_numbers * acao.number_price,
        pending: Number(r.pending),
      };
    }));
  } catch (e) {
    next(e);
  }
});

function acaoInput(body) {
  const name = String(body.name || "").trim();
  const number_price = Number(body.number_price);
  const block_size = Number(body.block_size);
  const public_ranking = !!body.public_ranking;
  const show_sold_numbers = !!body.show_sold_numbers;
  if (!name) return { error: "nome obrigatório" };
  if (!(number_price > 0)) return { error: "valor do número deve ser maior que zero" };
  if (!Number.isInteger(block_size) || block_size < 1) return { error: "quantidade de números por bloco inválida" };
  return { name, number_price, block_size, public_ranking, show_sold_numbers };
}

acoesRouter.post("/admin/acoes", requireAcoes, async (req, res, next) => {
  try {
    const input = acaoInput(req.body);
    if (input.error) return res.status(400).json({ error: input.error });
    const { rows } = await query(
      `insert into acoes (name, number_price, block_size, public_ranking, show_sold_numbers)
       values ($1, $2, $3, $4, $5) returning ${ACAO_FIELDS}`,
      [input.name, input.number_price, input.block_size, input.public_ranking, input.show_sold_numbers]
    );
    res.status(201).json(numAcao(rows[0]));
  } catch (e) {
    next(e);
  }
});

acoesRouter.put("/admin/acoes/:id", requireAcoes, async (req, res, next) => {
  try {
    const input = acaoInput(req.body);
    if (input.error) return res.status(400).json({ error: input.error });
    const { rows } = await query(
      `update acoes set name = $1, number_price = $2, block_size = $3, public_ranking = $4, show_sold_numbers = $5
       where id = $6 returning ${ACAO_FIELDS}`,
      [input.name, input.number_price, input.block_size, input.public_ranking, input.show_sold_numbers, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "ação não encontrada" });
    res.json(numAcao(rows[0]));
  } catch (e) {
    next(e);
  }
});

acoesRouter.delete("/admin/acoes/:id", requireAcoes, async (req, res, next) => {
  try {
    const { rowCount } = await query("delete from acoes where id = $1", [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "ação não encontrada" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// Detalhe: ação + vendedores com seus blocos.
acoesRouter.get("/admin/acoes/:id", requireAcoes, async (req, res, next) => {
  try {
    const acao = await getAcao(req.params.id);
    if (!acao) return res.status(404).json({ error: "ação não encontrada" });
    const sellers = await query(
      "select id, name from acao_sellers where acao_id = $1 order by created_at",
      [acao.id]
    );
    const blocks = await query(
      `select ${BLOCK_FIELDS} from acao_blocks where acao_id = $1 order by start_number`,
      [acao.id]
    );
    const bySeller = new Map(sellers.rows.map((s) => [s.id, []]));
    for (const b of blocks.rows) bySeller.get(b.seller_id)?.push(numBlock(b));
    res.json({
      ...acao,
      sellers: sellers.rows.map((s) => ({ ...s, blocks: bySeller.get(s.id) })),
    });
  } catch (e) {
    next(e);
  }
});

// ---------- ranking público (sem auth; só expõe vendas, nunca pagamentos) ----------

acoesRouter.get("/acoes/public", async (req, res, next) => {
  try {
    const { rows } = await query(
      "select id, name from acoes where public_ranking order by created_at desc"
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

acoesRouter.get("/acoes/:id/ranking", async (req, res, next) => {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(404).json({ error: "ranking não encontrado" });
    const { rows } = await query(
      `select ${ACAO_FIELDS} from acoes where id = $1 and public_ranking`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "ranking não encontrado" });
    const acao = numAcao(rows[0]);
    const sellers = await query(
      `select s.name, coalesce(sum(b.sold_count), 0)::int as sold_numbers
       from acao_sellers s left join acao_blocks b on b.seller_id = s.id
       where s.acao_id = $1
       group by s.id order by sold_numbers desc, s.name`,
      [acao.id]
    );
    // Empates dividem a posição (1, 2, 2, 4...). Por padrão só a posição é
    // pública; a quantidade vendida sai apenas com show_sold_numbers — valores
    // em R$ nunca.
    let rank = 0;
    let prevSold = null;
    const ranking = sellers.rows.map((s, i) => {
      if (s.sold_numbers !== prevSold) {
        rank = i + 1;
        prevSold = s.sold_numbers;
      }
      const entry = { rank, name: s.name };
      if (acao.show_sold_numbers) entry.sold_numbers = s.sold_numbers;
      return entry;
    });
    res.json({ name: acao.name, show_sold_numbers: acao.show_sold_numbers, ranking });
  } catch (e) {
    next(e);
  }
});

// ---------- vendedores ----------

acoesRouter.post("/admin/acoes/:id/sellers", requireAcoes, async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ error: "nome obrigatório" });
    const acao = await getAcao(req.params.id);
    if (!acao) return res.status(404).json({ error: "ação não encontrada" });
    const { rows } = await query(
      "insert into acao_sellers (acao_id, name) values ($1, $2) returning id, name",
      [acao.id, name]
    );
    res.status(201).json({ ...rows[0], blocks: [] });
  } catch (e) {
    next(e);
  }
});

acoesRouter.put("/admin/sellers/:id", requireAcoes, async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ error: "nome obrigatório" });
    const { rows } = await query(
      "update acao_sellers set name = $1 where id = $2 returning id, name",
      [name, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "vendedor não encontrado" });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

acoesRouter.delete("/admin/sellers/:id", requireAcoes, async (req, res, next) => {
  try {
    const { rowCount } = await query("delete from acao_sellers where id = $1", [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "vendedor não encontrado" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ---------- blocos ----------

function blockInput(body, blockSize) {
  const start_number = Number(body.start_number);
  const sold_count = Number(body.sold_count ?? 0);
  const received = Number(body.received ?? 0);
  const returned = !!body.returned;
  if (!Number.isInteger(start_number) || start_number < 1) return { error: "número inicial inválido" };
  if (!Number.isInteger(sold_count) || sold_count < 0 || sold_count > blockSize) {
    return { error: `números vendidos deve ficar entre 0 e ${blockSize}` };
  }
  if (!(received >= 0)) return { error: "valor recebido inválido" };
  return { start_number, sold_count, received, returned };
}

acoesRouter.post("/admin/sellers/:id/blocks", requireAcoes, async (req, res, next) => {
  try {
    const seller = await query("select id, acao_id from acao_sellers where id = $1", [req.params.id]);
    if (!seller.rows.length) return res.status(404).json({ error: "vendedor não encontrado" });
    const acao = await getAcao(seller.rows[0].acao_id);
    const input = blockInput(req.body, acao.block_size);
    if (input.error) return res.status(400).json({ error: input.error });
    const clash = await findOverlap(acao.id, input.start_number, acao.block_size, null);
    if (clash) {
      return res.status(409).json({
        error: `conflita com o bloco ${clash.start_number}–${clash.start_number + acao.block_size - 1}`,
      });
    }
    const { rows } = await query(
      `insert into acao_blocks (acao_id, seller_id, start_number, sold_count, received)
       values ($1, $2, $3, $4, $5) returning ${BLOCK_FIELDS}`,
      [acao.id, seller.rows[0].id, input.start_number, input.sold_count, input.received]
    );
    res.status(201).json(numBlock(rows[0]));
  } catch (e) {
    next(e);
  }
});

acoesRouter.put("/admin/blocks/:id", requireAcoes, async (req, res, next) => {
  try {
    const cur = await query("select id, acao_id from acao_blocks where id = $1", [req.params.id]);
    if (!cur.rows.length) return res.status(404).json({ error: "bloco não encontrado" });
    const acao = await getAcao(cur.rows[0].acao_id);
    const input = blockInput(req.body, acao.block_size);
    if (input.error) return res.status(400).json({ error: input.error });
    const clash = await findOverlap(acao.id, input.start_number, acao.block_size, cur.rows[0].id);
    if (clash) {
      return res.status(409).json({
        error: `conflita com o bloco ${clash.start_number}–${clash.start_number + acao.block_size - 1}`,
      });
    }
    const { rows } = await query(
      `update acao_blocks set start_number = $1, sold_count = $2, received = $3, returned = $4
       where id = $5 returning ${BLOCK_FIELDS}`,
      [input.start_number, input.sold_count, input.received, input.returned, req.params.id]
    );
    res.json(numBlock(rows[0]));
  } catch (e) {
    next(e);
  }
});

acoesRouter.delete("/admin/blocks/:id", requireAcoes, async (req, res, next) => {
  try {
    const { rowCount } = await query("delete from acao_blocks where id = $1", [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "bloco não encontrado" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
