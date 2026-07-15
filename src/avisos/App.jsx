/* ===== CONVICTOS — mural de avisos ===== */
import React, { useState, useEffect } from "react";
import { api } from "../lib/api.js";
import { applyTheme } from "../lib/theme.js";

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

export default function App() {
  const [state, setState] = useState({ status: "loading", avisos: [] });

  useEffect(() => {
    Promise.all([api.get("/api/profile"), api.get("/api/avisos")])
      .then(([profile, avisos]) => {
        applyTheme(profile.theme);
        setState({ status: "ready", avisos });
      })
      .catch(() => setState({ status: "error", avisos: [] }));
  }, []);

  return (
    <div className="page">
      <div className="avisos-head">
        <a className="back-link" href="/">← Início</a>
        <h1>📢 Avisos</h1>
      </div>

      {state.status === "loading" && <div className="state-msg">Carregando…</div>}
      {state.status === "error" && (
        <div className="state-msg"><span className="e-emoji">⚠️</span>Não foi possível carregar os avisos.</div>
      )}
      {state.status === "ready" && state.avisos.length === 0 && (
        <div className="state-msg"><span className="e-emoji">🕊️</span>Nenhum aviso por enquanto.</div>
      )}

      {state.avisos.map((a) => (
        <div key={a.id} className="aviso-card">
          <div className="aviso-title">
            {a.pinned ? <span className="aviso-pin">📌</span> : null}
            {a.title}
          </div>
          {a.body ? <div className="aviso-body">{a.body}</div> : null}
          <div className="aviso-date">{fmtDate(a.created_at)}</div>
        </div>
      ))}
    </div>
  );
}
