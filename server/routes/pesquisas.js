/* Pesquisas de satisfação: pesquisa -> perguntas (com opções) -> respostas
   (com itens). Trava estrutural: depois da 1ª resposta não dá pra mudar
   tipo/opções nem excluir pergunta (mantém o relatório íntegro, mesma
   filosofia do snapshot de orders); "Duplicar pesquisa" (client-side) é a
   saída. LGPD/GDPR: consentimento só é exigido quando identity_mode !=
   'anonimo'; a resposta nunca grava IP nem user-agent. */
import { Router } from "express";
import { query, withTransaction } from "../db.js";
import { requirePermission } from "../auth.js";

const viewPesquisas = requirePermission("pesquisas:view");
const managePesquisas = requirePermission("pesquisas:manage");

export const pesquisasRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUSES = ["rascunho", "ativa", "encerrada"];
const IDENTITY_MODES = ["anonimo", "opcional", "obrigatorio"];
const QUESTION_TYPES = ["estrelas5", "nota0a10", "nota0a5", "opcoes", "texto"];
const SCALE_TYPES = ["estrelas5", "nota0a10", "nota0a5"];
const SCALE_RANGES = { estrelas5: [1, 5], nota0a10: [0, 10], nota0a5: [0, 5] };

const PESQUISA_FIELDS = `id, title, description, status, identity_mode, one_response_per_email,
  starts_at, ends_at, thank_you_message, privacy_notice, privacy_policy_url, retention_days,
  created_at, updated_at`;
const PERGUNTA_FIELDS = "id, pesquisa_id, text, type, required, multi, min_label, max_label, min_chars, max_chars, position";
const OPCAO_FIELDS = "id, pergunta_id, text, position";

// dias exibidos na quebra diária do relatório (padrão 30, teto 90) — mesmo critério do relatório de patrocinadores.
function reportDays(req) {
  const n = parseInt(req.query.days, 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), 90) : 30;
}

function csvField(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csvRow(fields) {
  return fields.map(csvField).join(",") + "\r\n";
}

async function getPesquisa(id) {
  const { rows } = await query(`select ${PESQUISA_FIELDS} from pesquisas where id = $1`, [id]);
  if (!rows.length) return null;
  const pesquisa = rows[0];
  const perguntas = await query(
    `select ${PERGUNTA_FIELDS} from pesquisa_perguntas where pesquisa_id = $1 order by position`,
    [id]
  );
  const opcoes = perguntas.rows.length
    ? await query(
        `select ${OPCAO_FIELDS} from pesquisa_opcoes where pergunta_id = any($1::uuid[]) order by position`,
        [perguntas.rows.map((p) => p.id)]
      )
    : { rows: [] };
  const byPergunta = new Map(perguntas.rows.map((p) => [p.id, []]));
  for (const o of opcoes.rows) byPergunta.get(o.pergunta_id)?.push(o);
  return { ...pesquisa, perguntas: perguntas.rows.map((p) => ({ ...p, options: byPergunta.get(p.id) })) };
}

async function hasResponses(pesquisaId) {
  const { rows } = await query("select 1 from pesquisa_respostas where pesquisa_id = $1 limit 1", [pesquisaId]);
  return rows.length > 0;
}

function optionsEqual(current, input) {
  if (current.length !== input.length) return false;
  return current.every((c, i) => c.text === input[i].text);
}

// ---------- admin: pesquisas ----------

pesquisasRouter.get("/admin/pesquisas", viewPesquisas, async (req, res, next) => {
  try {
    const { rows } = await query(
      `select p.${PESQUISA_FIELDS.split(/,\s*/).join(", p.")},
              count(distinct q.id)::int as question_count,
              count(distinct r.id)::int as response_count
       from pesquisas p
       left join pesquisa_perguntas q on q.pesquisa_id = p.id
       left join pesquisa_respostas r on r.pesquisa_id = p.id
       group by p.id order by p.created_at desc`
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

function pesquisaInput(body) {
  const title = String(body.title || "").trim();
  const description = String(body.description || "");
  const status = String(body.status || "rascunho");
  const identity_mode = String(body.identity_mode || "anonimo");
  const one_response_per_email = !!body.one_response_per_email;
  const thank_you_message = String(body.thank_you_message || "");
  const privacy_notice = String(body.privacy_notice || "");
  const privacy_policy_url = String(body.privacy_policy_url || "");
  const retention_days = body.retention_days === null || body.retention_days === undefined || body.retention_days === ""
    ? null
    : Number(body.retention_days);
  const starts_at = body.starts_at ? new Date(body.starts_at) : null;
  const ends_at = body.ends_at ? new Date(body.ends_at) : null;

  if (!title) return { error: "título obrigatório" };
  if (!STATUSES.includes(status)) return { error: "status inválido" };
  if (!IDENTITY_MODES.includes(identity_mode)) return { error: "modo de identificação inválido" };
  if (starts_at && isNaN(starts_at.getTime())) return { error: "data de início inválida" };
  if (ends_at && isNaN(ends_at.getTime())) return { error: "data de término inválida" };
  if (starts_at && ends_at && ends_at < starts_at) return { error: "data de término deve ser depois do início" };
  if (retention_days !== null && (!Number.isInteger(retention_days) || retention_days < 1)) {
    return { error: "retenção em dias inválida" };
  }
  return {
    title, description, status, identity_mode, one_response_per_email, starts_at, ends_at,
    thank_you_message, privacy_notice, privacy_policy_url, retention_days,
  };
}

pesquisasRouter.post("/admin/pesquisas", managePesquisas, async (req, res, next) => {
  try {
    const input = pesquisaInput(req.body);
    if (input.error) return res.status(400).json({ error: input.error });
    const { rows } = await query(
      `insert into pesquisas (title, description, status, identity_mode, one_response_per_email,
         starts_at, ends_at, thank_you_message, privacy_notice, privacy_policy_url, retention_days, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       returning ${PESQUISA_FIELDS}`,
      [input.title, input.description, input.status, input.identity_mode, input.one_response_per_email,
        input.starts_at, input.ends_at, input.thank_you_message, input.privacy_notice,
        input.privacy_policy_url, input.retention_days, req.admin.id]
    );
    res.status(201).json({ ...rows[0], question_count: 0, response_count: 0 });
  } catch (e) {
    next(e);
  }
});

// Título/descrição/status/datas/mensagem/config de privacidade sempre editáveis,
// mesmo com respostas — a trava estrutural vale só para perguntas/opções.
pesquisasRouter.put("/admin/pesquisas/:id", managePesquisas, async (req, res, next) => {
  try {
    const input = pesquisaInput(req.body);
    if (input.error) return res.status(400).json({ error: input.error });
    const { rows } = await query(
      `update pesquisas set title = $1, description = $2, status = $3, identity_mode = $4,
         one_response_per_email = $5, starts_at = $6, ends_at = $7, thank_you_message = $8,
         privacy_notice = $9, privacy_policy_url = $10, retention_days = $11, updated_at = now()
       where id = $12 returning ${PESQUISA_FIELDS}`,
      [input.title, input.description, input.status, input.identity_mode, input.one_response_per_email,
        input.starts_at, input.ends_at, input.thank_you_message, input.privacy_notice,
        input.privacy_policy_url, input.retention_days, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "pesquisa não encontrada" });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

pesquisasRouter.delete("/admin/pesquisas/:id", managePesquisas, async (req, res, next) => {
  try {
    const { rowCount } = await query("delete from pesquisas where id = $1", [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "pesquisa não encontrada" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

pesquisasRouter.get("/admin/pesquisas/:id", viewPesquisas, async (req, res, next) => {
  try {
    const pesquisa = await getPesquisa(req.params.id);
    if (!pesquisa) return res.status(404).json({ error: "pesquisa não encontrada" });
    const count = await query("select count(*)::int as c from pesquisa_respostas where pesquisa_id = $1", [pesquisa.id]);
    res.json({ ...pesquisa, response_count: count.rows[0].c });
  } catch (e) {
    next(e);
  }
});

// ---------- admin: perguntas ----------

// null = sem limite; undefined = valor inválido (não é inteiro).
function parseOptionalInt(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : undefined;
}

function perguntaInput(body) {
  const text = String(body.text || "").trim();
  const type = String(body.type || "");
  const required = !!body.required;
  const min_label = String(body.min_label || "");
  const max_label = String(body.max_label || "");
  if (!text) return { error: "texto da pergunta obrigatório" };
  if (!QUESTION_TYPES.includes(type)) return { error: "tipo de pergunta inválido" };
  if (type === "opcoes") {
    const options = (Array.isArray(body.options) ? body.options : [])
      .map((o) => ({ id: UUID_RE.test(o?.id) ? o.id : null, text: String(o?.text || "").trim() }))
      .filter((o) => o.text);
    if (options.length < 2) return { error: "pergunta de opções precisa de ao menos 2 opções" };
    return { text, type, required, multi: !!body.multi, min_label: "", max_label: "", min_chars: null, max_chars: null, options };
  }
  if (type === "texto") {
    const min_chars = parseOptionalInt(body.min_chars);
    const max_chars = parseOptionalInt(body.max_chars);
    if (min_chars === undefined || (min_chars !== null && min_chars < 0)) return { error: "mínimo de caracteres inválido" };
    if (max_chars === undefined || (max_chars !== null && max_chars < 1)) return { error: "máximo de caracteres inválido" };
    if (min_chars !== null && max_chars !== null && min_chars > max_chars) {
      return { error: "mínimo de caracteres não pode ser maior que o máximo" };
    }
    return { text, type, required, multi: false, min_label: "", max_label: "", min_chars, max_chars, options: [] };
  }
  return { text, type, required, multi: false, min_label, max_label, min_chars: null, max_chars: null, options: [] };
}

async function replaceOptions(client, perguntaId, options) {
  const keep = [];
  for (let i = 0; i < options.length; i++) {
    const o = options[i];
    const exists = o.id
      ? (await client.query("select 1 from pesquisa_opcoes where id = $1 and pergunta_id = $2", [o.id, perguntaId])).rows.length
      : 0;
    if (exists) {
      await client.query("update pesquisa_opcoes set text = $1, position = $2 where id = $3", [o.text, i, o.id]);
      keep.push(o.id);
    } else {
      const ins = await client.query(
        "insert into pesquisa_opcoes (pergunta_id, text, position) values ($1, $2, $3) returning id",
        [perguntaId, o.text, i]
      );
      keep.push(ins.rows[0].id);
    }
  }
  await client.query("delete from pesquisa_opcoes where pergunta_id = $1 and not (id = any($2::uuid[]))", [perguntaId, keep]);
}

async function getPergunta(id) {
  const { rows } = await query(`select ${PERGUNTA_FIELDS} from pesquisa_perguntas where id = $1`, [id]);
  if (!rows.length) return null;
  const opcoes = await query(`select ${OPCAO_FIELDS} from pesquisa_opcoes where pergunta_id = $1 order by position`, [id]);
  return { ...rows[0], options: opcoes.rows };
}

pesquisasRouter.post("/admin/pesquisas/:id/perguntas", managePesquisas, async (req, res, next) => {
  try {
    const pesquisa = await query("select id from pesquisas where id = $1", [req.params.id]);
    if (!pesquisa.rows.length) return res.status(404).json({ error: "pesquisa não encontrada" });
    const input = perguntaInput(req.body);
    if (input.error) return res.status(400).json({ error: input.error });
    const pos = await query("select coalesce(max(position) + 1, 0) as next from pesquisa_perguntas where pesquisa_id = $1", [req.params.id]);
    const pergunta = await withTransaction(async (client) => {
      const ins = await client.query(
        `insert into pesquisa_perguntas (pesquisa_id, text, type, required, multi, min_label, max_label, min_chars, max_chars, position)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning ${PERGUNTA_FIELDS}`,
        [req.params.id, input.text, input.type, input.required, input.multi, input.min_label, input.max_label,
          input.min_chars, input.max_chars, pos.rows[0].next]
      );
      const row = ins.rows[0];
      if (input.type === "opcoes") await replaceOptions(client, row.id, input.options);
      return row;
    });
    res.status(201).json(await getPergunta(pergunta.id));
  } catch (e) {
    next(e);
  }
});

pesquisasRouter.put("/admin/perguntas/:id", managePesquisas, async (req, res, next) => {
  try {
    const current = await getPergunta(req.params.id);
    if (!current) return res.status(404).json({ error: "pergunta não encontrada" });
    const input = perguntaInput(req.body);
    if (input.error) return res.status(400).json({ error: input.error });

    const locked = await hasResponses(current.pesquisa_id);
    if (locked) {
      if (input.type !== current.type) {
        return res.status(400).json({ error: "pesquisa já tem respostas — não é possível mudar o tipo desta pergunta (duplique a pesquisa para uma nova versão)" });
      }
      if (current.type === "opcoes" && !optionsEqual(current.options, input.options)) {
        return res.status(400).json({ error: "pesquisa já tem respostas — não é possível alterar as opções desta pergunta (duplique a pesquisa para uma nova versão)" });
      }
    }

    await withTransaction(async (client) => {
      await client.query(
        `update pesquisa_perguntas set text = $1, type = $2, required = $3, multi = $4, min_label = $5, max_label = $6,
           min_chars = $7, max_chars = $8
         where id = $9`,
        [input.text, input.type, input.required, input.multi, input.min_label, input.max_label,
          input.min_chars, input.max_chars, req.params.id]
      );
      if (input.type === "opcoes") await replaceOptions(client, req.params.id, input.options);
      else await client.query("delete from pesquisa_opcoes where pergunta_id = $1", [req.params.id]);
    });
    res.json(await getPergunta(req.params.id));
  } catch (e) {
    next(e);
  }
});

pesquisasRouter.delete("/admin/perguntas/:id", managePesquisas, async (req, res, next) => {
  try {
    const current = await query("select pesquisa_id from pesquisa_perguntas where id = $1", [req.params.id]);
    if (!current.rows.length) return res.status(404).json({ error: "pergunta não encontrada" });
    if (await hasResponses(current.rows[0].pesquisa_id)) {
      return res.status(400).json({ error: "pesquisa já tem respostas — não é possível excluir perguntas (duplique a pesquisa para uma nova versão)" });
    }
    await query("delete from pesquisa_perguntas where id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

pesquisasRouter.put("/admin/pesquisas/:id/perguntas/reorder", managePesquisas, async (req, res, next) => {
  try {
    const ids = req.body;
    if (!Array.isArray(ids) || !ids.every((id) => UUID_RE.test(id))) {
      return res.status(400).json({ error: "esperado um array de ids de pergunta" });
    }
    await withTransaction(async (client) => {
      for (let i = 0; i < ids.length; i++) {
        await client.query("update pesquisa_perguntas set position = $1 where id = $2 and pesquisa_id = $3", [i, ids[i], req.params.id]);
      }
    });
    const { rows } = await query(`select ${PERGUNTA_FIELDS} from pesquisa_perguntas where pesquisa_id = $1 order by position`, [req.params.id]);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// ---------- admin: relatório ----------

async function dailyResponses(pesquisaId, days) {
  const { rows } = await query(
    `select to_char(d::date, 'YYYY-MM-DD') as date, coalesce(v.c, 0)::int as responses
     from generate_series(current_date - ($2::int - 1), current_date, interval '1 day') d
     left join (
       select date_trunc('day', submitted_at)::date as day, count(*) as c
       from pesquisa_respostas
       where pesquisa_id = $1 and submitted_at >= now() - ($2 || ' days')::interval
       group by 1
     ) v on v.day = d::date
     order by d`,
    [pesquisaId, days]
  );
  return rows;
}

async function buildPesquisaReport(pesquisa, days) {
  const totalRow = await query("select count(*)::int as total from pesquisa_respostas where pesquisa_id = $1", [pesquisa.id]);
  const total = totalRow.rows[0].total;

  const questions = [];
  for (const p of pesquisa.perguntas) {
    if (p.type === "texto") {
      const answers = await query(
        `select ri.text_value, r.submitted_at from pesquisa_resposta_itens ri
         join pesquisa_respostas r on r.id = ri.resposta_id
         where ri.pergunta_id = $1 and ri.text_value <> ''
         order by r.submitted_at`,
        [p.id]
      );
      questions.push({ ...p, answered: answers.rows.length, completion_rate: total ? answers.rows.length / total : 0, answers: answers.rows });
    } else if (p.type === "opcoes") {
      const counts = await query(
        `select o.id, o.text,
           count(*) filter (where ri.option_ids @> array[o.id])::int as count
         from pesquisa_opcoes o
         left join pesquisa_resposta_itens ri on ri.pergunta_id = $1
         where o.pergunta_id = $1
         group by o.id, o.text order by o.position`,
        [p.id]
      );
      const answered = await query(
        "select count(*)::int as c from pesquisa_resposta_itens where pergunta_id = $1 and array_length(option_ids, 1) > 0",
        [p.id]
      );
      questions.push({ ...p, answered: answered.rows[0].c, completion_rate: total ? answered.rows[0].c / total : 0, options: counts.rows });
    } else {
      const stats = await query(
        `select count(*)::int as answered, avg(numeric_value)::float as avg,
           count(*) filter (where numeric_value >= 9)::int as promoters,
           count(*) filter (where numeric_value between 7 and 8)::int as passives,
           count(*) filter (where numeric_value <= 6)::int as detractors
         from pesquisa_resposta_itens where pergunta_id = $1`,
        [p.id]
      );
      const dist = await query(
        `select numeric_value, count(*)::int as count from pesquisa_resposta_itens
         where pergunta_id = $1 group by numeric_value order by numeric_value`,
        [p.id]
      );
      const s = stats.rows[0];
      const q = { ...p, answered: s.answered, completion_rate: total ? s.answered / total : 0, average: s.avg, distribution: dist.rows };
      if (p.type === "nota0a10") {
        q.nps = {
          promoters: s.promoters, passives: s.passives, detractors: s.detractors,
          score: s.answered ? Math.round(((s.promoters - s.detractors) / s.answered) * 100) : null,
        };
      }
      questions.push(q);
    }
  }

  return { totalResponses: total, questions, dailyResponses: await dailyResponses(pesquisa.id, days) };
}

pesquisasRouter.get("/admin/pesquisas/:id/report", viewPesquisas, async (req, res, next) => {
  try {
    const pesquisa = await getPesquisa(req.params.id);
    if (!pesquisa) return res.status(404).json({ error: "pesquisa não encontrada" });
    res.json(await buildPesquisaReport(pesquisa, reportDays(req)));
  } catch (e) {
    next(e);
  }
});

pesquisasRouter.get("/admin/pesquisas/:id/report.csv", viewPesquisas, async (req, res, next) => {
  try {
    const pesquisa = await getPesquisa(req.params.id);
    if (!pesquisa) return res.status(404).json({ error: "pesquisa não encontrada" });
    const respostas = await query(
      "select id, respondent_name, respondent_email, submitted_at from pesquisa_respostas where pesquisa_id = $1 order by submitted_at",
      [pesquisa.id]
    );
    const ids = respostas.rows.map((r) => r.id);
    const items = ids.length
      ? await query(
          "select resposta_id, pergunta_id, numeric_value, text_value, option_texts from pesquisa_resposta_itens where resposta_id = any($1::uuid[])",
          [ids]
        )
      : { rows: [] };
    const byResposta = new Map(ids.map((id) => [id, new Map()]));
    for (const it of items.rows) byResposta.get(it.resposta_id)?.set(it.pergunta_id, it);

    let csv = "﻿";
    csv += csvRow([`Relatório de respostas — ${pesquisa.title}`]);
    csv += csvRow([`Total de respostas: ${respostas.rows.length}`]);
    csv += "\r\n";
    csv += csvRow(["Data/hora", "Nome", "E-mail", ...pesquisa.perguntas.map((p) => p.text)]);
    for (const r of respostas.rows) {
      const itemsMap = byResposta.get(r.id);
      const cols = pesquisa.perguntas.map((p) => {
        const it = itemsMap.get(p.id);
        if (!it) return "";
        if (p.type === "opcoes") return (it.option_texts || []).join("; ");
        if (p.type === "texto") return it.text_value || "";
        return it.numeric_value ?? "";
      });
      csv += csvRow([r.submitted_at.toISOString(), r.respondent_name, r.respondent_email, ...cols]);
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="pesquisa-respostas.csv"`);
    res.send(csv);
  } catch (e) {
    next(e);
  }
});

// Respostas individuais ordenáveis: whitelist de "sort" evita SQL injection no
// order by. Para "nota_*" usa uma pergunta de escala (param "pergunta" ou a
// primeira numérica da pesquisa); sem valor pra ela, a resposta vai ao fim.
const SORT_CLAUSES = {
  data_asc: "r.submitted_at asc",
  data_desc: "r.submitted_at desc",
  nome_asc: "(r.respondent_name = '') desc, r.respondent_name asc",
  nome_desc: "(r.respondent_name = '') desc, r.respondent_name desc",
  nota_desc: "ri.numeric_value desc nulls last",
  nota_asc: "ri.numeric_value asc nulls last",
};

async function defaultScalePerguntaId(pesquisaId) {
  const { rows } = await query(
    `select id from pesquisa_perguntas where pesquisa_id = $1 and type = any($2) order by position limit 1`,
    [pesquisaId, SCALE_TYPES]
  );
  return rows[0]?.id || null;
}

pesquisasRouter.get("/admin/pesquisas/:id/respostas", viewPesquisas, async (req, res, next) => {
  try {
    const sort = SORT_CLAUSES[req.query.sort] ? req.query.sort : "data_asc";
    let orderSql = SORT_CLAUSES[sort];
    const params = [req.params.id];
    let joinSql = "";
    if (sort === "nota_desc" || sort === "nota_asc") {
      const pergId = UUID_RE.test(req.query.pergunta || "") ? req.query.pergunta : await defaultScalePerguntaId(req.params.id);
      if (pergId) {
        params.push(pergId);
        joinSql = `left join pesquisa_resposta_itens ri on ri.resposta_id = r.id and ri.pergunta_id = $${params.length}`;
      } else {
        orderSql = SORT_CLAUSES.data_asc;
      }
    }
    const email = req.query.email ? String(req.query.email).trim() : "";
    let emailSql = "";
    if (email) {
      params.push(`%${email}%`);
      emailSql = `and r.respondent_email ilike $${params.length}`;
    }
    const { rows } = await query(
      `select r.id, r.respondent_name, r.respondent_email, r.submitted_at
       from pesquisa_respostas r ${joinSql}
       where r.pesquisa_id = $1 ${emailSql}
       order by ${orderSql}`,
      params
    );
    const ids = rows.map((r) => r.id);
    const items = ids.length
      ? await query(
          "select resposta_id, pergunta_id, numeric_value, text_value, option_texts from pesquisa_resposta_itens where resposta_id = any($1::uuid[])",
          [ids]
        )
      : { rows: [] };
    const byResposta = new Map(ids.map((id) => [id, []]));
    for (const it of items.rows) byResposta.get(it.resposta_id)?.push(it);
    res.json(rows.map((r) => ({ ...r, items: byResposta.get(r.id) })));
  } catch (e) {
    next(e);
  }
});

// ---------- direitos do titular (LGPD art. 18 / GDPR arts. 15–17) ----------

pesquisasRouter.delete("/admin/respostas/:id", managePesquisas, async (req, res, next) => {
  try {
    const { rowCount } = await query("delete from pesquisa_respostas where id = $1", [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "resposta não encontrada" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

pesquisasRouter.post("/admin/pesquisas/:id/expurgar", managePesquisas, async (req, res, next) => {
  try {
    const pesquisa = await query("select retention_days from pesquisas where id = $1", [req.params.id]);
    if (!pesquisa.rows.length) return res.status(404).json({ error: "pesquisa não encontrada" });
    const days = Number(req.body?.days ?? pesquisa.rows[0].retention_days);
    if (!Number.isInteger(days) || days < 1) return res.status(400).json({ error: "quantidade de dias inválida" });
    const { rowCount } = await query(
      "delete from pesquisa_respostas where pesquisa_id = $1 and submitted_at < now() - ($2 || ' days')::interval",
      [req.params.id, days]
    );
    res.json({ ok: true, deleted: rowCount });
  } catch (e) {
    next(e);
  }
});

// ---------- público (sem auth) ----------

pesquisasRouter.get("/pesquisas/public", async (req, res, next) => {
  try {
    const { rows } = await query(
      `select id, title, description from pesquisas
       where status = 'ativa' and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now())
       order by created_at desc`
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

async function getOpenPesquisa(id) {
  const { rows } = await query(
    `select id, title, description, identity_mode, one_response_per_email, thank_you_message, privacy_notice, privacy_policy_url
     from pesquisas
     where id = $1 and status = 'ativa'
       and (starts_at is null or starts_at <= now())
       and (ends_at is null or ends_at >= now())`,
    [id]
  );
  return rows[0] || null;
}

pesquisasRouter.get("/pesquisas/:id", async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: "pesquisa não encontrada" });
    const pesquisa = await getOpenPesquisa(req.params.id);
    if (!pesquisa) return res.status(404).json({ error: "pesquisa indisponível" });
    const perguntas = await query(
      "select id, text, type, required, multi, min_label, max_label, min_chars, max_chars, position from pesquisa_perguntas where pesquisa_id = $1 order by position",
      [pesquisa.id]
    );
    const opcoes = perguntas.rows.length
      ? await query(
          "select id, pergunta_id, text, position from pesquisa_opcoes where pergunta_id = any($1::uuid[]) order by position",
          [perguntas.rows.map((p) => p.id)]
        )
      : { rows: [] };
    const byPergunta = new Map(perguntas.rows.map((p) => [p.id, []]));
    for (const o of opcoes.rows) byPergunta.get(o.pergunta_id)?.push({ id: o.id, text: o.text });
    if (pesquisa.identity_mode === "anonimo") {
      delete pesquisa.privacy_notice;
      delete pesquisa.privacy_policy_url;
    }
    res.json({ ...pesquisa, perguntas: perguntas.rows.map((p) => ({ ...p, options: byPergunta.get(p.id) })) });
  } catch (e) {
    next(e);
  }
});

function validateNumeric(type, value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const [min, max] = SCALE_RANGES[type];
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

pesquisasRouter.post("/pesquisas/:id/responder", async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: "pesquisa não encontrada" });
    // Honeypot: campo escondido que só um bot preenche. Finge sucesso sem gravar nada.
    if (String(req.body?.website || "").trim()) return res.status(201).json({ ok: true });

    const pesquisa = await getOpenPesquisa(req.params.id);
    if (!pesquisa) return res.status(404).json({ error: "pesquisa indisponível" });

    const perguntas = await query(
      "select id, type, required, multi, min_chars, max_chars from pesquisa_perguntas where pesquisa_id = $1",
      [pesquisa.id]
    );
    const opcoesByPergunta = new Map();
    if (perguntas.rows.length) {
      const opcoesRows = await query(
        "select id, pergunta_id, text from pesquisa_opcoes where pergunta_id = any($1::uuid[])",
        [perguntas.rows.map((p) => p.id)]
      );
      for (const o of opcoesRows.rows) {
        if (!opcoesByPergunta.has(o.pergunta_id)) opcoesByPergunta.set(o.pergunta_id, []);
        opcoesByPergunta.get(o.pergunta_id).push(o);
      }
    }

    const answersIn = Array.isArray(req.body?.answers) ? req.body.answers : [];
    const answerByPergunta = new Map(answersIn.map((a) => [a?.pergunta_id, a]));

    const items = [];
    for (const p of perguntas.rows) {
      const answer = answerByPergunta.get(p.id);
      if (p.type === "opcoes") {
        const ids = Array.isArray(answer?.option_ids) ? answer.option_ids.filter(Boolean) : [];
        const validOptions = opcoesByPergunta.get(p.id) || [];
        const chosen = validOptions.filter((o) => ids.includes(o.id));
        if (chosen.length === 0) {
          if (p.required) return res.status(400).json({ error: "há uma pergunta obrigatória sem resposta" });
          continue;
        }
        if (!p.multi && chosen.length > 1) return res.status(400).json({ error: "essa pergunta aceita só uma opção" });
        items.push({ pergunta_id: p.id, numeric_value: null, text_value: "", option_ids: chosen.map((o) => o.id), option_texts: chosen.map((o) => o.text) });
      } else if (p.type === "texto") {
        const text = String(answer?.text_value || "").trim();
        if (!text) {
          if (p.required) return res.status(400).json({ error: "há uma pergunta obrigatória sem resposta" });
          continue;
        }
        if (p.min_chars != null && text.length < p.min_chars) {
          return res.status(400).json({ error: `resposta muito curta (mínimo de ${p.min_chars} caracteres)` });
        }
        if (p.max_chars != null && text.length > p.max_chars) {
          return res.status(400).json({ error: `resposta muito longa (máximo de ${p.max_chars} caracteres)` });
        }
        items.push({ pergunta_id: p.id, numeric_value: null, text_value: text, option_ids: [], option_texts: [] });
      } else {
        if (answer?.numeric_value === undefined || answer?.numeric_value === null || answer?.numeric_value === "") {
          if (p.required) return res.status(400).json({ error: "há uma pergunta obrigatória sem resposta" });
          continue;
        }
        const n = validateNumeric(p.type, answer.numeric_value);
        if (n === null) return res.status(400).json({ error: "valor de nota inválido" });
        items.push({ pergunta_id: p.id, numeric_value: n, text_value: "", option_ids: [], option_texts: [] });
      }
    }

    const name = String(req.body?.respondent_name || "").trim();
    const email = String(req.body?.respondent_email || "").trim().toLowerCase();
    if (pesquisa.identity_mode === "obrigatorio") {
      if (!name) return res.status(400).json({ error: "nome obrigatório" });
      if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "e-mail obrigatório e válido" });
    } else if (pesquisa.identity_mode === "opcional" && email && !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: "e-mail inválido" });
    }
    const respondentName = pesquisa.identity_mode === "anonimo" ? "" : name;
    const respondentEmail = pesquisa.identity_mode === "anonimo" ? "" : email;

    let consentGiven = false;
    let consentText = "";
    let consentAt = null;
    if (pesquisa.identity_mode !== "anonimo") {
      if (!req.body?.consent_given) return res.status(400).json({ error: "é necessário aceitar o aviso de privacidade para enviar a resposta" });
      consentGiven = true;
      consentText = pesquisa.privacy_notice || "";
      consentAt = new Date();
    }

    if (pesquisa.one_response_per_email && respondentEmail) {
      const dup = await query(
        "select 1 from pesquisa_respostas where pesquisa_id = $1 and lower(respondent_email) = $2 limit 1",
        [pesquisa.id, respondentEmail]
      );
      if (dup.rows.length) return res.status(409).json({ error: "você já respondeu esta pesquisa com este e-mail" });
    }

    await withTransaction(async (client) => {
      const ins = await client.query(
        `insert into pesquisa_respostas (pesquisa_id, respondent_name, respondent_email, consent_given, consent_text, consent_at)
         values ($1, $2, $3, $4, $5, $6) returning id`,
        [pesquisa.id, respondentName, respondentEmail, consentGiven, consentText, consentAt]
      );
      const respostaId = ins.rows[0].id;
      for (const it of items) {
        await client.query(
          `insert into pesquisa_resposta_itens (resposta_id, pergunta_id, numeric_value, text_value, option_ids, option_texts)
           values ($1, $2, $3, $4, $5, $6)`,
          [respostaId, it.pergunta_id, it.numeric_value, it.text_value, it.option_ids, it.option_texts]
        );
      }
    });

    res.status(201).json({ ok: true });
  } catch (e) {
    next(e);
  }
});
