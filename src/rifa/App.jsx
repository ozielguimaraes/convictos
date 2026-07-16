/* ===== CONVICTOS — ranking público da ação entre amigos =====
   /rifa/?id=<acao> mostra pódio (top 3) + tabela dos demais. Por padrão só a
   posição; quantidade vendida aparece se a ação habilitar (valores em R$
   nunca são públicos). Sem id, lista as ações com ranking público. */
import React, { useState, useEffect } from "react";
import { api } from "../lib/api.js";
import { applyTheme } from "../lib/theme.js";

const MEDALS = ["🥇", "🥈", "🥉"];

function Podium({ top, showSold }) {
  // Ordem visual clássica: 2º à esquerda, 1º ao centro, 3º à direita.
  const slots = [top[1], top[0], top[2]].filter(Boolean);
  return (
    <div className="podium">
      {slots.map((s) => (
        <div key={s.name + s.rank} className={`podium-col podium-${s.rank <= 3 ? s.rank : 3}`}>
          <div className="podium-medal">{MEDALS[s.rank - 1] || "🏅"}</div>
          <div className="podium-name">{s.name}</div>
          {showSold && <div className="podium-sold">{s.sold_numbers} número{s.sold_numbers === 1 ? "" : "s"}</div>}
          <div className="podium-base">{s.rank}º</div>
        </div>
      ))}
    </div>
  );
}

function Ranking({ id }) {
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    api.get(`/api/acoes/${id}/ranking`)
      .then((data) => setState({ status: "ready", data }))
      .catch(() => setState({ status: "error" }));
  }, [id]);

  if (state.status === "loading") return <div className="state-msg">Carregando…</div>;
  if (state.status === "error") {
    return <div className="state-msg"><span className="e-emoji">🔒</span>Este ranking não está disponível.</div>;
  }

  const { data } = state;
  const showSold = !!data.show_sold_numbers;
  const top = data.ranking.slice(0, 3);
  const rest = data.ranking.slice(3);

  return (
    <React.Fragment>
      <div className="rifa-name">{data.name}</div>
      {data.ranking.length === 0 && (
        <div className="state-msg"><span className="e-emoji">🎟️</span>Ainda não há vendedores nesta ação.</div>
      )}
      {top.length > 0 && <Podium top={top} showSold={showSold} />}
      {rest.length > 0 && (
        <table className="rank-table">
          <thead>
            <tr><th>#</th><th>Vendedor</th>{showSold && <th className="num">Números</th>}</tr>
          </thead>
          <tbody>
            {rest.map((s) => (
              <tr key={s.name + s.rank}>
                <td className="rank-pos">{s.rank}º</td>
                <td>{s.name}</td>
                {showSold && <td className="num">{s.sold_numbers}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </React.Fragment>
  );
}

function PublicList() {
  const [state, setState] = useState({ status: "loading", acoes: [] });

  useEffect(() => {
    api.get("/api/acoes/public")
      .then((acoes) => setState({ status: "ready", acoes }))
      .catch(() => setState({ status: "error", acoes: [] }));
  }, []);

  if (state.status === "loading") return <div className="state-msg">Carregando…</div>;
  if (state.status === "error") {
    return <div className="state-msg"><span className="e-emoji">⚠️</span>Não foi possível carregar.</div>;
  }
  if (state.acoes.length === 0) {
    return <div className="state-msg"><span className="e-emoji">🎟️</span>Nenhum ranking público no momento.</div>;
  }
  return (
    <div className="links">
      {state.acoes.map((a) => (
        <a key={a.id} className="link-btn-card" href={`/rifa/${a.id}`}>
          <span className="link-emoji">🏆</span>
          <span className="link-label">{a.name}</span>
        </a>
      ))}
    </div>
  );
}

export default function App() {
  // URL RESTful: /rifa/<id>. O formato antigo (?id=) segue aceito para
  // não quebrar links já compartilhados.
  const id = location.pathname.match(/^\/rifa\/([0-9a-f-]{36})/i)?.[1]
    || new URLSearchParams(location.search).get("id");

  useEffect(() => {
    api.get("/api/profile").then((p) => applyTheme(p.theme)).catch(() => {});
  }, []);

  return (
    <div className="page">
      <div className="avisos-head">
        <a className="back-link" href="/">← Início</a>
        <h1>🏆 Ranking de vendas</h1>
      </div>
      {id ? <Ranking id={id} /> : <PublicList />}
    </div>
  );
}
