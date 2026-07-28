import { useState, useEffect } from 'react'
import './styles.css'

// Formatador de números em pt-BR
const formatNumber = (num) => {
  return Number(num || 0).toLocaleString('pt-BR')
}

export default function VendasCongresso2026() {
  const [vendas, setVendas] = useState([])
  const [filtros, setFiltros] = useState({
    dia: '', // '23_07', '24_07', '25_07', '26_07', ''
    produto: '',
    fornecedor: '',
    ordenar: 'total' // 'total', 'produto', '23_07', '24_07', '25_07', '26_07'
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const startTime = performance.now()
    console.log('[Vendas] Iniciando carregamento de dados...')

    fetch('/api/vendas/congresso-2026')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => {
        const loadTime = performance.now() - startTime
        console.log(`[Vendas] Dados carregados com sucesso em ${loadTime.toFixed(2)}ms`, {
          total_produtos: data.length,
          total_items: data.reduce((sum, v) => sum + (v.total || 0), 0)
        })
        setVendas(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('[Vendas] Erro ao carregar dados:', err)
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const produtosFiltrados = vendas.filter(v => {
    // Filtro por produto
    if (filtros.produto && !v.name.toLowerCase().includes(filtros.produto.toLowerCase())) {
      return false
    }
    // Filtro por fornecedor
    if (filtros.fornecedor && v.supplier !== filtros.fornecedor) {
      return false
    }
    return true
  })

  const produtosOrdenados = [...produtosFiltrados].sort((a, b) => {
    const campo = filtros.ordenar
    if (campo === 'produto') {
      return a.name.localeCompare(b.name)
    }
    return b[campo] - a[campo]
  })

  // Calcular totais por dia
  const totalPorDia = {
    '23_07': 0,
    '24_07': 0,
    '25_07': 0,
    '26_07': 0
  }

  produtosFiltrados.forEach(v => {
    totalPorDia['23_07'] += v['23_07'] || 0
    totalPorDia['24_07'] += v['24_07'] || 0
    totalPorDia['25_07'] += v['25_07'] || 0
    totalPorDia['26_07'] += v['26_07'] || 0
  })

  const totalGeral = produtosFiltrados.reduce((sum, v) => sum + v.total, 0)

  if (loading) {
    return (
      <div className="vendas-container">
        <h1>📊 Vendas Congresso 2026</h1>
        <div className="carregando">Carregando dados</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="vendas-container">
        <h1>📊 Vendas Congresso 2026</h1>
        <p className="error">❌ Erro ao carregar: {error}</p>
      </div>
    )
  }

  return (
    <div className="vendas-container">
      <h1>📊 Vendas Congresso 2026</h1>

      <div className="filtros">
        <div className="filtro-grupo">
          <label>🔍 Filtrar Produto:</label>
          <input
            type="text"
            placeholder="Ex: refrigerante, pastel..."
            value={filtros.produto}
            onChange={(e) => setFiltros({...filtros, produto: e.target.value})}
            className="filtro-input"
          />
        </div>

        <div className="filtro-grupo">
          <label>🏢 Fornecedor:</label>
          <select
            value={filtros.fornecedor}
            onChange={(e) => setFiltros({...filtros, fornecedor: e.target.value})}
            className="filtro-select"
          >
            <option value="">Todos</option>
            <option value="Convictos">Convictos</option>
            <option value="Magno">Magno</option>
            <option value="Elda">Elda</option>
            <option value="Paulinho">Paulinho</option>
            <option value="Raniel">Raniel</option>
            <option value="Ester">Ester</option>
            <option value="Amarena">Amarena</option>
          </select>
        </div>

        <div className="filtro-grupo">
          <label>📋 Ordenar por:</label>
          <select
            value={filtros.ordenar}
            onChange={(e) => setFiltros({...filtros, ordenar: e.target.value})}
            className="filtro-select"
          >
            <option value="total">Total (Maior → Menor)</option>
            <option value="produto">Nome do Produto (A → Z)</option>
            <option value="23_07">23/07 (Maior → Menor)</option>
            <option value="24_07">24/07 (Maior → Menor)</option>
            <option value="25_07">25/07 (Maior → Menor)</option>
            <option value="26_07">26/07 (Maior → Menor)</option>
          </select>
        </div>
      </div>

      <div className="resumo">
        <div className="resumo-card">
          <div className="resumo-label">23/07</div>
          <div className="resumo-valor">{totalPorDia['23_07'].toLocaleString('pt-BR')}</div>
        </div>
        <div className="resumo-card">
          <div className="resumo-label">24/07</div>
          <div className="resumo-valor">{totalPorDia['24_07'].toLocaleString('pt-BR')}</div>
        </div>
        <div className="resumo-card">
          <div className="resumo-label">25/07</div>
          <div className="resumo-valor">{totalPorDia['25_07'].toLocaleString('pt-BR')}</div>
        </div>
        <div className="resumo-card">
          <div className="resumo-label">26/07</div>
          <div className="resumo-valor">{totalPorDia['26_07'].toLocaleString('pt-BR')}</div>
        </div>
        <div className="resumo-card resumo-total">
          <div className="resumo-label">TOTAL</div>
          <div className="resumo-valor">{totalGeral.toLocaleString('pt-BR')}</div>
        </div>
      </div>

      <div className="tabela-container">
        <table className="tabela-vendas">
          <thead>
            <tr>
              <th>Produto</th>
              <th className="fornecedor">Fornecedor</th>
              <th className="numero">23/07</th>
              <th className="numero">24/07</th>
              <th className="numero">25/07</th>
              <th className="numero">26/07</th>
              <th className="numero total-col">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {produtosOrdenados.length > 0 ? (
              produtosOrdenados.map((venda, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'par' : 'impar'}>
                  <td className="produto-nome">{venda.name}</td>
                  <td className="fornecedor-cell">{venda.supplier || '-'}</td>
                  <td className="numero">{formatNumber(venda['23_07'] || 0)}</td>
                  <td className="numero">{formatNumber(venda['24_07'] || 0)}</td>
                  <td className="numero">{formatNumber(venda['25_07'] || 0)}</td>
                  <td className="numero">{formatNumber(venda['26_07'] || 0)}</td>
                  <td className="numero total-col"><strong>{formatNumber(venda.total)}</strong></td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="sem-dados">Nenhum produto encontrado</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rodape">
        <p>Total de produtos: <strong>{produtosFiltrados.length}</strong></p>
        <p>Quantidade total: <strong>{totalGeral.toLocaleString('pt-BR')}</strong> unidades</p>
      </div>
    </div>
  )
}
