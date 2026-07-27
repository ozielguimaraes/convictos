import { query as dbQuery } from '../db.js'

const vendas = [
  // 23/07
  { produto: 'Camiseta Adulto', codigo: '6', data: '2026-07-23', qty: 24, valor: 1320.00 },
  { produto: 'Coxinha', codigo: '2', data: '2026-07-23', qty: 69, valor: 621.00 },
  { produto: 'Batata chips', codigo: '11', data: '2026-07-23', qty: 62, valor: 620.00 },
  { produto: 'Coca cola 2L', codigo: '24', data: '2026-07-23', qty: 47, valor: 564.00 },
  { produto: 'Refrigerante 20L', codigo: '9', data: '2026-07-23', qty: 156, valor: 468.00 },
  { produto: 'Mineiro 2L', codigo: '23', data: '2026-07-23', qty: 51, valor: 433.50 },
  { produto: 'Água sem gás', codigo: '21', data: '2026-07-23', qty: 50, valor: 125.00 },
  { produto: 'Suco 200ml', codigo: '20', data: '2026-07-23', qty: 33, valor: 115.50 },
  { produto: 'Camiseta Infant', codigo: '7', data: '2026-07-23', qty: 3, valor: 114.00 },
  { produto: 'Trident', codigo: '8', data: '2026-07-23', qty: 34, valor: 102.00 },
  { produto: 'Água COM gás', codigo: '22', data: '2026-07-23', qty: 28, valor: 84.00 },
  { produto: 'Bala', codigo: '25', data: '2026-07-23', qty: 26, valor: 5.20 },
  { produto: 'Kit kat', codigo: '28', data: '2026-07-23', qty: 19, valor: 85.50 },
  { produto: 'Mentos', codigo: '30', data: '2026-07-23', qty: 17, valor: 59.50 },
  { produto: 'nutella B-ready', codigo: '34', data: '2026-07-23', qty: 13, valor: 58.50 },
  { produto: 'Salsichão', codigo: '5', data: '2026-07-23', qty: 10, valor: 90.00 },
  { produto: 'Halls', codigo: '26', data: '2026-07-23', qty: 9, valor: 22.50 },
  { produto: 'Fruit-tella', codigo: '10', data: '2026-07-23', qty: 8, valor: 28.00 },
  { produto: 'Trento', codigo: '32', data: '2026-07-23', qty: 7, valor: 24.50 },
  { produto: 'Prestígio', codigo: '27', data: '2026-07-23', qty: 6, valor: 24.00 },
  { produto: 'Combo Hambúrg', codigo: '15', data: '2026-07-23', qty: 2, valor: 39.80 },

  // 24/07
  { produto: 'Combo Hambúrg', codigo: '15', data: '2026-07-24', qty: 201, valor: 3999.90 },
  { produto: 'Pastel', codigo: '12', data: '2026-07-24', qty: 143, valor: 2574.00 },
  { produto: 'Coxinha', codigo: '2', data: '2026-07-24', qty: 121, valor: 1075.00 },
  { produto: 'Refrigerante 20L', codigo: '9', data: '2026-07-24', qty: 278, valor: 834.00 },
  { produto: 'Espetinho', codigo: '16', data: '2026-07-24', qty: 68, valor: 816.00 },
  { produto: 'Churros', codigo: '38', data: '2026-07-24', qty: 59, valor: 767.00 },
  { produto: 'Botton', codigo: '36', data: '2026-07-24', qty: 99, valor: 693.00 },
  { produto: 'Camiseta Adulto', codigo: '6', data: '2026-07-24', qty: 11, valor: 605.00 },
  { produto: 'Macarrão', codigo: '14', data: '2026-07-24', qty: 23, valor: 483.00 },
  { produto: 'Batata frita', codigo: '17', data: '2026-07-24', qty: 29, valor: 464.00 },
  { produto: 'Amarena', codigo: '40', data: '2026-07-24', qty: 67, valor: 335.00 },
  { produto: 'Sorvete Amarena', codigo: '33', data: '2026-07-24', qty: 49, valor: 245.00 },
  { produto: 'Água sem gás', codigo: '21', data: '2026-07-24', qty: 47, valor: 117.50 },
  { produto: 'Salsichão', codigo: '5', data: '2026-07-24', qty: 43, valor: 387.00 },
  { produto: 'Água COM gás', codigo: '39', data: '2026-07-24', qty: 36, valor: 108.00 },
  { produto: 'Suco 200ml', codigo: '20', data: '2026-07-24', qty: 36, valor: 126.00 },
  { produto: 'Trident', codigo: '8', data: '2026-07-24', qty: 33, valor: 99.00 },
  { produto: 'Cachorro quente', codigo: '19', data: '2026-07-24', qty: 21, valor: 346.50 },
  { produto: 'Halls', codigo: '26', data: '2026-07-24', qty: 20, valor: 50.00 },
  { produto: 'nutella B-ready', codigo: '34', data: '2026-07-24', qty: 18, valor: 81.00 },
  { produto: 'Caldo 500ml', codigo: '4', data: '2026-07-24', qty: 17, valor: 272.00 },
  { produto: 'Pão com pernil', codigo: '18', data: '2026-07-24', qty: 14, valor: 364.00 },

  // 25/07
  { produto: 'Combo Hambúrg', codigo: '15', data: '2026-07-25', qty: 339, valor: 6746.10 },
  { produto: 'Pastel', codigo: '12', data: '2026-07-25', qty: 124, valor: 2232.00 },
  { produto: 'Refrigerante 20L', codigo: '9', data: '2026-07-25', qty: 404, valor: 1212.00 },
  { produto: 'Churros', codigo: '38', data: '2026-07-25', qty: 92, valor: 1196.00 },
  { produto: 'Coxinha', codigo: '2', data: '2026-07-25', qty: 107, valor: 963.00 },
  { produto: 'Sorvete Amarena', codigo: '33', data: '2026-07-25', qty: 155, valor: 775.00 },
  { produto: 'Espetinho', codigo: '16', data: '2026-07-25', qty: 64, valor: 768.00 },
  { produto: 'Batata frita', codigo: '17', data: '2026-07-25', qty: 43, valor: 688.00 },
  { produto: 'Camiseta Adulto', codigo: '6', data: '2026-07-25', qty: 11, valor: 605.00 },
  { produto: 'Macarrão', codigo: '14', data: '2026-07-25', qty: 23, valor: 483.00 },
  { produto: 'Botton', codigo: '36', data: '2026-07-25', qty: 62, valor: 434.00 },
  { produto: 'Água sem gás', codigo: '21', data: '2026-07-25', qty: 58, valor: 145.00 },
  { produto: 'Trident', codigo: '8', data: '2026-07-25', qty: 55, valor: 165.00 },
  { produto: 'Amarena', codigo: '40', data: '2026-07-25', qty: 48, valor: 240.00 },
  { produto: 'Suco 200ml', codigo: '20', data: '2026-07-25', qty: 44, valor: 154.00 },
  { produto: 'Salsichão', codigo: '5', data: '2026-07-25', qty: 40, valor: 360.00 },
  { produto: 'Água COM gás', codigo: '39', data: '2026-07-25', qty: 31, valor: 93.00 },
  { produto: 'Halls', codigo: '26', data: '2026-07-25', qty: 29, valor: 72.50 },
  { produto: 'Cachorro quente', codigo: '19', data: '2026-07-25', qty: 26, valor: 429.00 },
  { produto: 'Kit kat', codigo: '28', data: '2026-07-25', qty: 25, valor: 112.50 },
  { produto: 'Caldo 500ml', codigo: '4', data: '2026-07-25', qty: 25, valor: 400.00 },
  { produto: 'Mentos', codigo: '30', data: '2026-07-25', qty: 14, valor: 49.00 },

  // 26/07
  { produto: 'Combo Hambúrg', codigo: '15', data: '2026-07-26', qty: 336, valor: 6686.40 },
  { produto: 'Pastel', codigo: '12', data: '2026-07-26', qty: 147, valor: 2646.00 },
  { produto: 'Sorvete Amarena', codigo: '33', data: '2026-07-26', qty: 527, valor: 2635.00 },
  { produto: 'Churros', codigo: '38', data: '2026-07-26', qty: 103, valor: 1339.00 },
  { produto: 'Refrigerante 20L', codigo: '9', data: '2026-07-26', qty: 438, valor: 1314.00 },
  { produto: 'Coxinha', codigo: '2', data: '2026-07-26', qty: 115, valor: 1035.00 },
  { produto: 'Batata frita', codigo: '17', data: '2026-07-26', qty: 49, valor: 784.00 },
  { produto: 'Espetinho', codigo: '16', data: '2026-07-26', qty: 60, valor: 720.00 },
  { produto: 'Macarrão', codigo: '14', data: '2026-07-26', qty: 27, valor: 567.00 },
  { produto: 'Camiseta promo', codigo: '48', data: '2026-07-26', qty: 10, valor: 450.00 },
  { produto: 'Água sem gás', codigo: '21', data: '2026-07-26', qty: 98, valor: 245.00 },
  { produto: 'Trident', codigo: '8', data: '2026-07-26', qty: 56, valor: 168.00 },
  { produto: 'Água COM gás', codigo: '39', data: '2026-07-26', qty: 56, valor: 168.00 },
  { produto: 'Botton', codigo: '36', data: '2026-07-26', qty: 45, valor: 315.00 },
  { produto: 'Salsichão', codigo: '5', data: '2026-07-26', qty: 42, valor: 378.00 },
  { produto: 'Suco 200ml', codigo: '20', data: '2026-07-26', qty: 32, valor: 112.00 },
  { produto: 'Kit kat', codigo: '28', data: '2026-07-26', qty: 25, valor: 112.50 },
  { produto: 'Mentos', codigo: '30', data: '2026-07-26', qty: 19, valor: 66.50 },
  { produto: 'Cachorro quente', codigo: '19', data: '2026-07-26', qty: 18, valor: 297.00 },
  { produto: 'Fruit-tella', codigo: '10', data: '2026-07-26', qty: 18, valor: 63.00 },
  { produto: 'Halls', codigo: '26', data: '2026-07-26', qty: 17, valor: 42.50 },
  { produto: 'Batata chips', codigo: '11', data: '2026-07-26', qty: 12, valor: 120.00 },
]

async function seedVendas() {
  try {
    console.log('Buscando evento Congresso 2026...')
    const eventoResult = await dbQuery(
      'SELECT id FROM eventos WHERE name = $1',
      ['Congresso 2026']
    )

    if (eventoResult.rows.length === 0) {
      console.error('❌ Evento Congresso 2026 não encontrado. Execute "npm run db:schema" primeiro.')
      process.exit(1)
    }

    const eventoId = eventoResult.rows[0].id

    // Limpar dados anteriores (opcional)
    await dbQuery('DELETE FROM vendas_evento WHERE evento_id = $1', [eventoId])

    console.log(`✅ Evento encontrado: ${eventoId}`)
    console.log(`📊 Inserindo ${vendas.length} registros de vendas...`)

    let inserted = 0
    for (const v of vendas) {
      await dbQuery(
        `INSERT INTO vendas_evento (evento_id, product_code, product_name, data_venda, quantidade, valor_total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [eventoId, v.codigo, v.produto, v.data, v.qty, v.valor]
      )
      inserted++
    }

    console.log(`✅ ${inserted} registros inseridos com sucesso!`)

    // Mostrar resumo
    const summary = await dbQuery(`
      SELECT
        COUNT(DISTINCT product_name) as total_produtos,
        SUM(quantidade) as total_quantidade,
        SUM(valor_total) as total_valor
      FROM vendas_evento
      WHERE evento_id = $1
    `, [eventoId])

    const { total_produtos, total_quantidade, total_valor } = summary.rows[0]
    console.log(`\n📈 Resumo:`)
    console.log(`  • Produtos: ${total_produtos}`)
    console.log(`  • Quantidade total: ${total_quantidade}`)
    console.log(`  • Faturamento: R$ ${Number(total_valor).toFixed(2)}`)

    process.exit(0)
  } catch (error) {
    console.error('❌ Erro ao fazer seed:', error)
    process.exit(1)
  }
}

seedVendas()
