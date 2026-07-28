/* Vendas de eventos (ex.: Congresso 2026): edição de quantidade por dia e de
   custo/preço de venda por produto, para conferir com a maquininha. */
import React, { useState, useEffect } from "react";
import { api } from "../../lib/api.js";

const DIAS = [
  { key: "2026-07-23", label: "23/07" },
  { key: "2026-07-24", label: "24/07" },
  { key: "2026-07-25", label: "25/07" },
  { key: "2026-07-26", label: "26/07" },
];

function groupByProduto(rows) {
  const byCode = new Map();
  for (const r of rows) {
    if (!byCode.has(r.product_code)) {
      byCode.set(r.product_code, {
        code: r.product_code,
        name: r.product_name,
        supplier: r.supplier_name,
        custo: Number(r.preco_custo),
        venda: Number(r.preco_venda),
        dias: {},
      });
    }
    byCode.get(r.product_code).dias[r.data_venda.slice(0, 10)] = r;
  }
  return [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export default function VendasSection({ canManage, showToast }) {
  const [eventoId, setEventoId] = useState(null);
  const [rows, setRows] = useState(null);
  const [loadErr, setLoadErr] = useState("");

  const load = () =>
    api.get("/api/vendas/eventos/congresso-2026")
      .then((evento) => {
        setEventoId(evento.id);
        return api.get(`/api/vendas/eventos/${evento.id}/vendas`);
      })
      .then(setRows)
      .catch((e) => setLoadErr(e.message || String(e)));

  useEffect(() => { load(); }, []);

  const produtos = rows ? groupByProduto(rows) : [];

  const saveQtd = async (row, value) => {
    const quantidade = Number(value);
    if (!Number.isFinite(quantidade) || quantidade < 0) return;
    try {
      const updated = await api.put(`/api/vendas/vendas/${row.id}`, { quantidade });
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
      showToast("✓ Quantidade salva");
    } catch (e) {
      showToast("Erro ao salvar: " + (e.message || e), true);
    }
  };

  const savePreco = async (produto, custo, venda) => {
    const preco_custo = Number(custo);
    const preco_venda = Number(venda);
    if (!Number.isFinite(preco_custo) || preco_custo < 0 || !Number.isFinite(preco_venda) || preco_venda < 0) return;
    try {
      const updated = await api.put(`/api/vendas/eventos/${eventoId}/produtos/${encodeURIComponent(produto.code)}/preco`, { preco_custo, preco_venda });
      const byId = new Map(updated.map((r) => [r.id, r]));
      setRows((prev) => prev.map((r) => byId.get(r.id) || r));
      showToast("✓ Preço salvo");
    } catch (e) {
      showToast("Erro ao salvar: " + (e.message || e), true);
    }
  };

  const removeLinha = async (row) => {
    if (!confirm(`Remover "${row.product_name}" do dia ${row.data_venda.slice(8, 10)}/${row.data_venda.slice(5, 7)}?`)) return;
    try {
      await api.del(`/api/vendas/vendas/${row.id}`);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      showToast("✓ Linha removida");
    } catch (e) {
      showToast("Erro ao remover: " + (e.message || e), true);
    }
  };

  if (loadErr) return <div className="a-note" style={{ background: "#fbe9e7", borderColor: "#f5c6cb", color: "#a02012" }}>Erro ao carregar: {loadErr}</div>;
  if (!rows) return <div className="a-loading">Carregando vendas…</div>;

  return (
    <React.Fragment>
      {canManage && (
        <div className="a-note">
          <b>Como funciona:</b> edite a quantidade de um dia ou o custo/preço de venda de um produto
          e o campo salva sozinho ao sair dele (Tab ou clique fora). Custo e venda valem para o
          produto inteiro (todos os dias). Use o 🗑 para remover uma linha — por exemplo, ao juntar
          duas linhas do mesmo produto vendido sob códigos diferentes na maquininha.
        </div>
      )}

      <fieldset disabled={!canManage} style={{ border: "none", padding: 0, margin: 0, minWidth: 0 }}>
        <div className="sp-report-table-wrap">
          <table className="sp-report-table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Fornecedor</th>
                {DIAS.map((d) => <th key={d.key}>{d.label}</th>)}
                <th>Total</th>
                <th>Custo unit.</th>
                <th>Venda unit.</th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((p) => {
                const total = DIAS.reduce((sum, d) => sum + Number(p.dias[d.key]?.quantidade || 0), 0);
                return (
                  <tr key={p.code}>
                    <td>{p.name}</td>
                    <td>{p.supplier || "-"}</td>
                    {DIAS.map((d) => {
                      const row = p.dias[d.key];
                      if (!row) return <td key={d.key}>–</td>;
                      return (
                        <td key={d.key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <input
                            type="number" min="0" step="1"
                            defaultValue={row.quantidade}
                            key={row.id + "-" + row.quantidade}
                            style={{ width: 64 }}
                            onBlur={(e) => { if (Number(e.target.value) !== row.quantidade) saveQtd(row, e.target.value); }}
                            onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                          />
                          {canManage && (
                            <button type="button" className="item-del" title="Remover esta linha" onClick={() => removeLinha(row)}>🗑</button>
                          )}
                        </td>
                      );
                    })}
                    <td><strong>{total}</strong></td>
                    <td>
                      R$ <input
                        type="number" min="0" step="0.01"
                        defaultValue={p.custo}
                        key={p.code + "-custo-" + p.custo}
                        style={{ width: 72 }}
                        onBlur={(e) => { if (Number(e.target.value) !== p.custo) savePreco(p, e.target.value, p.venda); }}
                        onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                      />
                    </td>
                    <td>
                      R$ <input
                        type="number" min="0" step="0.01"
                        defaultValue={p.venda}
                        key={p.code + "-venda-" + p.venda}
                        style={{ width: 72 }}
                        onBlur={(e) => { if (Number(e.target.value) !== p.venda) savePreco(p, p.custo, e.target.value); }}
                        onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                      />
                    </td>
                  </tr>
                );
              })}
              {produtos.length === 0 && (
                <tr><td colSpan={4 + DIAS.length}>Nenhuma venda cadastrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </fieldset>
    </React.Fragment>
  );
}
