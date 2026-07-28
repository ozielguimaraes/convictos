import express from 'express'
import { query as dbQuery } from '../db.js'
import { requirePermission } from '../auth.js'

const router = express.Router()

// Obter evento por slug ou id
router.get('/eventos/:slug', requirePermission('vendas:view'), async (req, res) => {
  try {
    const { slug } = req.params

    // Procurar pelo nome (convertido para slug) ou id
    const slugNormalizado = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-')

    const result = await dbQuery(
      'SELECT * FROM eventos WHERE lower(replace(name, \' \', \'-\')) LIKE $1 OR id::text = $2 LIMIT 1',
      [`%${slugNormalizado}%`, slug]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Evento não encontrado' })
    }

    res.json(result.rows[0])
  } catch (error) {
    console.error('Erro ao buscar evento:', error)
    res.status(500).json({ error: 'Erro ao buscar evento' })
  }
})

// Obter vendas de um evento consolidadas por produto
router.get('/eventos/:eventoId/vendas/consolidado', async (req, res) => {
  try {
    const { eventoId } = req.params

    const result = await dbQuery(`
      SELECT
        product_code,
        product_name,
        SUM(CASE WHEN data_venda = '2026-07-23' THEN quantidade ELSE 0 END) as "23_07",
        SUM(CASE WHEN data_venda = '2026-07-24' THEN quantidade ELSE 0 END) as "24_07",
        SUM(CASE WHEN data_venda = '2026-07-25' THEN quantidade ELSE 0 END) as "25_07",
        SUM(CASE WHEN data_venda = '2026-07-26' THEN quantidade ELSE 0 END) as "26_07",
        SUM(quantidade) as total
      FROM vendas_evento
      WHERE evento_id = $1
      GROUP BY product_code, product_name
      ORDER BY total DESC
    `, [eventoId])

    res.json(result.rows)
  } catch (error) {
    console.error('Erro ao buscar vendas consolidadas:', error)
    res.status(500).json({ error: 'Erro ao buscar vendas' })
  }
})

// Obter vendas de um evento por data (sem consolidação) — usado pela edição no admin
router.get('/eventos/:eventoId/vendas', requirePermission('vendas:view'), async (req, res) => {
  try {
    const { eventoId } = req.params

    const result = await dbQuery(
      `SELECT * FROM vendas_evento
       WHERE evento_id = $1
       ORDER BY data_venda, product_name`,
      [eventoId]
    )

    res.json(result.rows)
  } catch (error) {
    console.error('Erro ao buscar vendas:', error)
    res.status(500).json({ error: 'Erro ao buscar vendas' })
  }
})

// Atalho: obter vendas consolidadas do Congresso 2026 (por slug)
router.get('/congresso-2026', async (req, res) => {
  try {
    // Buscar o evento Congresso 2026
    const eventoResult = await dbQuery(
      'SELECT id FROM eventos WHERE name = $1 LIMIT 1',
      ['Congresso 2026']
    )

    if (eventoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Evento Congresso 2026 não encontrado' })
    }

    const eventoId = eventoResult.rows[0].id

    // Buscar vendas consolidadas
    const vendas = await dbQuery(`
      SELECT
        product_code as code,
        product_name as name,
        supplier_name as supplier,
        preco_custo::numeric(10,2) as custo,
        preco_venda::numeric(10,2) as venda,
        CAST(SUM(CASE WHEN data_venda = '2026-07-23' THEN quantidade ELSE 0 END) AS INT) as "23_07",
        CAST(SUM(CASE WHEN data_venda = '2026-07-24' THEN quantidade ELSE 0 END) AS INT) as "24_07",
        CAST(SUM(CASE WHEN data_venda = '2026-07-25' THEN quantidade ELSE 0 END) AS INT) as "25_07",
        CAST(SUM(CASE WHEN data_venda = '2026-07-26' THEN quantidade ELSE 0 END) AS INT) as "26_07",
        CAST(SUM(quantidade) AS INT) as total,
        CAST(SUM(quantidade * preco_venda) AS numeric(12, 2)) as faturamento,
        CAST(SUM(quantidade * preco_custo) AS numeric(12, 2)) as custo_total
      FROM vendas_evento
      WHERE evento_id = $1
      GROUP BY product_code, product_name, supplier_name, preco_custo, preco_venda
      ORDER BY total DESC
    `, [eventoId])

    res.json(vendas.rows)
  } catch (error) {
    console.error('Erro ao buscar vendas do Congresso 2026:', error)
    res.status(500).json({ error: 'Erro ao buscar vendas' })
  }
})

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Edita a quantidade de um dia/produto específico (uma linha de vendas_evento).
router.put('/vendas/:id', requirePermission('vendas:manage'), async (req, res) => {
  try {
    const { id } = req.params
    if (!UUID_RE.test(id)) return res.status(400).json({ error: 'id inválido' })

    const quantidade = Number(req.body?.quantidade)
    if (!Number.isFinite(quantidade) || quantidade < 0) {
      return res.status(400).json({ error: 'quantidade inválida' })
    }

    const result = await dbQuery(
      `UPDATE vendas_evento
         SET quantidade = $1, valor_total = $1 * preco_venda
       WHERE id = $2
       RETURNING *`,
      [quantidade, id]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'venda não encontrada' })
    res.json(result.rows[0])
  } catch (error) {
    console.error('Erro ao editar quantidade:', error)
    res.status(500).json({ error: 'Erro ao editar quantidade' })
  }
})

// Edita custo/venda de um produto — aplica a todas as linhas (todos os dias)
// desse product_code no evento, já que custo e preço são do item, não do dia.
router.put('/eventos/:eventoId/produtos/:productCode/preco', requirePermission('vendas:manage'), async (req, res) => {
  try {
    const { eventoId, productCode } = req.params
    const precoCusto = Number(req.body?.preco_custo)
    const precoVenda = Number(req.body?.preco_venda)
    if (!Number.isFinite(precoCusto) || precoCusto < 0 || !Number.isFinite(precoVenda) || precoVenda < 0) {
      return res.status(400).json({ error: 'preco_custo/preco_venda inválidos' })
    }

    const result = await dbQuery(
      `UPDATE vendas_evento
         SET preco_custo = $1, preco_venda = $2, valor_total = quantidade * $2
       WHERE evento_id = $3 AND product_code = $4
       RETURNING *`,
      [precoCusto, precoVenda, eventoId, productCode]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Erro ao editar preço do produto:', error)
    res.status(500).json({ error: 'Erro ao editar preço do produto' })
  }
})

// Remove uma linha (dia/produto) — usado para consolidar duplicidades,
// ex.: mesmo item vendido sob dois códigos na maquininha.
router.delete('/vendas/:id', requirePermission('vendas:manage'), async (req, res) => {
  try {
    const { id } = req.params
    if (!UUID_RE.test(id)) return res.status(400).json({ error: 'id inválido' })

    const result = await dbQuery('DELETE FROM vendas_evento WHERE id = $1 RETURNING id', [id])
    if (result.rows.length === 0) return res.status(404).json({ error: 'venda não encontrada' })
    res.json({ ok: true })
  } catch (error) {
    console.error('Erro ao remover venda:', error)
    res.status(500).json({ error: 'Erro ao remover venda' })
  }
})

export default router
