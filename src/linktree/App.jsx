/* ===== CONVICTOS — página inicial estilo linktree ===== */
import React, { useState, useEffect } from "react";
import { api } from "../lib/api.js";
import { applyTheme } from "../lib/theme.js";

export default function App() {
  const [state, setState] = useState({ status: "loading", data: null });

  useEffect(() => {
    api.get("/api/profile")
      .then((data) => {
        applyTheme(data.theme);
        document.title = data.title;
        setState({ status: "ready", data });
      })
      .catch(() => setState({ status: "error", data: null }));
  }, []);

  if (state.status === "loading") {
    return <div className="page"><div className="state-msg">Carregando…</div></div>;
  }
  if (state.status === "error") {
    return (
      <div className="page">
        <div className="state-msg"><span className="e-emoji">⚠️</span>Não foi possível carregar a página.</div>
      </div>
    );
  }

  const { title, subtitle, avatar_emoji, links } = state.data;
  return (
    <div className="page">
      <div className="avatar">{avatar_emoji}</div>
      <h1 className="title">{title}</h1>
      {subtitle ? <p className="subtitle">{subtitle}</p> : null}
      <div className="links">
        {links.map((l) => (
          <a
            key={l.id}
            className="link-btn-card"
            href={l.url}
            target={l.url.startsWith("http") ? "_blank" : undefined}
            rel="noreferrer"
          >
            <span className="link-emoji">{l.emoji}</span>
            <span className="link-label">{l.label}</span>
          </a>
        ))}
        {links.length === 0 && (
          <div className="state-msg"><span className="e-emoji">🔗</span>Nenhum link configurado ainda.</div>
        )}
      </div>
      <div className="foot"><a href="/admin/">⚙︎ Área administrativa</a></div>
    </div>
  );
}
