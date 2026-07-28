import express from 'express'
import { query as dbQuery } from '../db.js'

const router = express.Router()

// Obter evento por slug ou id
router.get('/eventos/:slug', async (req, res) => {
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

// Obter vendas de um evento por data (sem consolidação)
router.get('/eventos/:eventoId/vendas', async (req, res) => {
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
        CAST(SUM(CASE WHEN data_venda = '2026-07-23' THEN quantidade ELSE 0 END) AS INT) as "23_07",
        CAST(SUM(CASE WHEN data_venda = '2026-07-24' THEN quantidade ELSE 0 END) AS INT) as "24_07",
        CAST(SUM(CASE WHEN data_venda = '2026-07-25' THEN quantidade ELSE 0 END) AS INT) as "25_07",
        CAST(SUM(CASE WHEN data_venda = '2026-07-26' THEN quantidade ELSE 0 END) AS INT) as "26_07",
        CAST(SUM(quantidade) AS INT) as total
      FROM vendas_evento
      WHERE evento_id = $1
      GROUP BY product_code, product_name
      ORDER BY total DESC
    `, [eventoId])

    res.json(vendas.rows)
  } catch (error) {
    console.error('Erro ao buscar vendas do Congresso 2026:', error)
    res.status(500).json({ error: 'Erro ao buscar vendas' })
  }
})

export default router
