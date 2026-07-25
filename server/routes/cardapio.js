import { Router } from "express";
import { query, withTransaction } from "../db.js";
import { requirePermission } from "../auth.js";

export const cardapioRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const asUuid = (v) => (UUID_RE.test(String(v)) ? v : null);

// Cardápio no formato que o front espera: { categorias: [{id, nome, tema, itens}] }.
cardapioRouter.get("/menu", async (req, res, next) => {
  try {
    const cats = await query("select id, name, theme from categories order by position");
    const items = await query(
      "select id, category_id, name, description, price, sold_out from items order by position"
    );
    const byCat = new Map(cats.rows.map((c) => [c.id, []]));
    for (const it of items.rows) {
      byCat.get(it.category_id)?.push({
        id: it.id,
        nome: it.name,
        desc: it.description || "",
        preco: Number(it.price),
        esgotado: !!it.sold_out,
      });
    }
    res.json({
      categorias: cats.rows.map((c) => ({ id: c.id, nome: c.name, tema: c.theme, itens: byCat.get(c.id) })),
    });
  } catch (e) {
    next(e);
  }
});

// Grava o cardápio inteiro de forma atômica, ATUALIZANDO PELO ID (não apaga e
// recria) — porte da função replace_menu do cardapio-on. Itens que já existem
// mantêm o id, então mudar preço durante o evento não esvazia carrinhos abertos.
cardapioRouter.put("/menu", requirePermission("cardapio:manage"), async (req, res, next) => {
  try {
    const categorias = req.body?.categorias;
    if (!Array.isArray(categorias)) return res.status(400).json({ error: "esperado { categorias: [...] }" });

    await withTransaction(async (client) => {
      const keepCats = [];
      for (let ci = 0; ci < categorias.length; ci++) {
        const cat = categorias[ci];
        let catId = asUuid(cat.id);
        const exists = catId
          ? (await client.query("select 1 from categories where id = $1", [catId])).rows.length
          : 0;
        if (exists) {
          await client.query(
            "update categories set name = $1, theme = $2, position = $3 where id = $4",
            [cat.nome, cat.tema || "verde-escuro", ci, catId]
          );
        } else {
          const ins = await client.query(
            "insert into categories (name, theme, position) values ($1, $2, $3) returning id",
            [cat.nome, cat.tema || "verde-escuro", ci]
          );
          catId = ins.rows[0].id;
        }
        keepCats.push(catId);

        const keepItems = [];
        const itens = Array.isArray(cat.itens) ? cat.itens : [];
        for (let ii = 0; ii < itens.length; ii++) {
          const it = itens[ii];
          let itemId = asUuid(it.id);
          const itExists = itemId
            ? (await client.query("select 1 from items where id = $1 and category_id = $2", [itemId, catId])).rows.length
            : 0;
          const vals = [it.nome, it.desc || "", Number(it.preco) || 0, !!it.esgotado, ii];
          if (itExists) {
            await client.query(
              "update items set name = $1, description = $2, price = $3, sold_out = $4, position = $5 where id = $6",
              [...vals, itemId]
            );
          } else {
            const ins = await client.query(
              "insert into items (category_id, name, description, price, sold_out, position) values ($6, $1, $2, $3, $4, $5) returning id",
              [...vals, catId]
            );
            itemId = ins.rows[0].id;
          }
          keepItems.push(itemId);
        }
        await client.query(
          "delete from items where category_id = $1 and not (id = any($2::uuid[]))",
          [catId, keepItems]
        );
      }
      await client.query("delete from categories where not (id = any($1::uuid[]))", [keepCats]);
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// Cria um pedido com número único (sequence) e snapshot dos itens.
// Payload: { nome, email, telefone, total, itens: [{nome, preco, qty, sub}] }
cardapioRouter.post("/orders", async (req, res, next) => {
  try {
    const p = req.body || {};
    if (!String(p.nome || "").trim()) return res.status(400).json({ error: "nome obrigatório" });
    if (!Array.isArray(p.itens) || p.itens.length === 0) return res.status(400).json({ error: "pedido vazio" });

    const result = await withTransaction(async (client) => {
      const num = await client.query("select nextval('order_number_seq') as n");
      const number = Number(num.rows[0].n);
      const order = await client.query(
        `insert into orders (number, customer_name, customer_email, customer_phone, total)
         values ($1, $2, $3, $4, $5) returning id`,
        [number, p.nome.trim(), p.email || "", p.telefone || "", Number(p.total) || 0]
      );
      for (let i = 0; i < p.itens.length; i++) {
        const it = p.itens[i];
        await client.query(
          `insert into order_items (order_id, name, unit_price, quantity, subtotal, position)
           values ($1, $2, $3, $4, $5, $6)`,
          [order.rows[0].id, it.nome, Number(it.preco) || 0, Number(it.qty) || 1, Number(it.sub) || 0, i]
        );
      }
      return { number };
    });
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
});

const ORDER_SORTS = {
  numero_asc: "o.number asc",
  numero_desc: "o.number desc",
  data_asc: "o.created_at asc",
  data_desc: "o.created_at desc",
  valor_asc: "o.total asc",
  valor_desc: "o.total desc",
};
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Lista de pedidos para o admin: filtro opcional por dia (data local do
// pedido) e ordenação por número, data ou valor.
cardapioRouter.get("/orders", requirePermission("cardapio:view"), async (req, res, next) => {
  try {
    const orderBy = ORDER_SORTS[req.query.sort] || ORDER_SORTS.data_desc;
    const params = [];
    let where = "";
    if (DATE_RE.test(String(req.query.data || ""))) {
      params.push(req.query.data);
      where = `where o.created_at::date = $${params.length}::date`;
    }

    const orders = await query(
      `select o.id, o.number, o.customer_name, o.customer_email, o.customer_phone, o.total, o.status, o.created_at
       from orders o ${where} order by ${orderBy}`,
      params
    );

    const ids = orders.rows.map((o) => o.id);
    const itemsByOrder = new Map(ids.map((id) => [id, []]));
    if (ids.length) {
      const items = await query(
        `select order_id, name, unit_price, quantity, subtotal
         from order_items where order_id = any($1::uuid[]) order by position`,
        [ids]
      );
      for (const it of items.rows) itemsByOrder.get(it.order_id)?.push(it);
    }

    res.json({
      pedidos: orders.rows.map((o) => ({
        id: o.id,
        numero: o.number,
        nome: o.customer_name,
        email: o.customer_email,
        telefone: o.customer_phone,
        total: Number(o.total),
        status: o.status,
        criadoEm: o.created_at,
        itens: (itemsByOrder.get(o.id) || []).map((it) => ({
          nome: it.name,
          preco: Number(it.unit_price),
          qty: it.quantity,
          sub: Number(it.subtotal),
        })),
      })),
    });
  } catch (e) {
    next(e);
  }
});
