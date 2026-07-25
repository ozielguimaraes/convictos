/* Lista de pedidos do cardápio: filtro por dia e ordenação por número,
   data/hora ou valor. Compartilhado entre /cardapio/admin/ e a seção
   Cardápio do painel do convictos. */
import React, { useState, useEffect } from "react";
import { api } from "../../lib/api.js";
import { fmt } from "../../lib/format.js";

const SORT_OPTIONS = [
  { value: "data_desc", label: "Mais recentes primeiro" },
  { value: "data_asc", label: "Mais antigos primeiro" },
  { value: "numero_asc", label: "Número (menor primeiro)" },
  { value: "numero_desc", label: "Número (maior primeiro)" },
  { value: "valor_desc", label: "Maior valor primeiro" },
  { value: "valor_asc", label: "Menor valor primeiro" },
];

function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function OrdersView({ showToast }) {
  const [data, setData] = useState(todayStr());
  const [sort, setSort] = useState("data_desc");
  const [pedidos, setPedidos] = useState(null);
  const [abertos, setAbertos] = useState(() => new Set());

  const load = () => {
    setPedidos(null);
    const params = new URLSearchParams({ sort });
    if (data) params.set("data", data);
    api.get(`/api/cardapio/orders?${params}`)
      .then((r) => setPedidos(r.pedidos))
      .catch((e) => showToast("Erro ao carregar pedidos: " + e.message, true));
  };
  useEffect(load, [data, sort]);

  const toggle = (id) => setAbertos((s) => {
    const next = new Set(s);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const total = (pedidos || []).reduce((acc, p) => acc + p.total, 0);

  return (
    <React.Fragment>
      <div className="pq-resp-filters">
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        {data && <button className="btn-export" onClick={() => setData(todayStr())}>Hoje</button>}
        {data && <button className="btn-export" onClick={() => setData("")}>Ver todos os dias</button>}
        <select className="perfil-select" value={sort} onChange={(e) => setSort(e.target.value)}>
          {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {!pedidos ? (
        <div className="a-loading">Carregando pedidos…</div>
      ) : pedidos.length === 0 ? (
        <p>{data ? "Nenhum pedido nesse dia." : "Nenhum pedido ainda."}</p>
      ) : (
        <React.Fragment>
          <p className="sp-report-total">
            📋 <strong>{pedidos.length}</strong> pedido{pedidos.length === 1 ? "" : "s"} · Total: <strong>{fmt(total)}</strong>
          </p>
          <div className="sp-report-table-wrap">
            <table className="sp-report-table">
              <thead>
                <tr>
                  <th>Nº</th><th>Data/hora</th><th>Cliente</th><th>Contato</th><th>Itens</th><th>Total</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p) => (
                  <React.Fragment key={p.id}>
                    <tr className="pd-row" onClick={() => toggle(p.id)}>
                      <td>#{p.numero}</td>
                      <td>{new Date(p.criadoEm).toLocaleString("pt-BR")}</td>
                      <td>{p.nome}</td>
                      <td>{p.email || p.telefone || "—"}</td>
                      <td>{p.itens.length}</td>
                      <td>{fmt(p.total)}</td>
                      <td>{p.status}</td>
                    </tr>
                    {abertos.has(p.id) && (
                      <tr className="pd-detail-row">
                        <td colSpan={7}>
                          <ul className="pd-itens">
                            {p.itens.map((it, i) => (
                              <li key={i}>{it.qty}× {it.nome} — {fmt(it.sub)}</li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </React.Fragment>
      )}
    </React.Fragment>
  );
}
