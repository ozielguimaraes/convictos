/* ===== CONVICTOS — painel administrativo =====
   Shell com navegação lateral; cada seção vive em sections/. */
import React, { useState, useEffect } from "react";
import { api } from "../lib/api.js";
import Login from "../components/Login.jsx";
import { useToast } from "./useToast.js";
import LinksSection from "./sections/LinksSection.jsx";
import AparenciaSection from "./sections/AparenciaSection.jsx";
import AvisosSection from "./sections/AvisosSection.jsx";
import AcoesSection from "./sections/AcoesSection.jsx";
import UsuariosSection from "./sections/UsuariosSection.jsx";

const SECTIONS = [
  { key: "links", label: "Links", emoji: "🔗" },
  { key: "aparencia", label: "Aparência", emoji: "🎨" },
  { key: "avisos", label: "Avisos", emoji: "📢" },
  { key: "acoes", label: "Ações entre amigos", emoji: "🎟️" },
];

function Panel({ me, onLogout }) {
  const [section, setSection] = useState("links");
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, showToast] = useToast();

  const sections = me.role === "super_admin"
    ? [...SECTIONS, { key: "usuarios", label: "Usuários", emoji: "👥" }]
    : SECTIONS;
  const current = sections.find((s) => s.key === section);

  const pick = (key) => {
    setSection(key);
    setMenuOpen(false);
  };

  return (
    <div className="layout">
      <div className={"backdrop" + (menuOpen ? " show" : "")} onClick={() => setMenuOpen(false)} />

      <aside className={"sidebar" + (menuOpen ? " open" : "")}>
        <div className="sb-brand">Convictos<span className="sb-admin">admin</span></div>
        <nav className="sb-nav">
          {sections.map((s) => (
            <button key={s.key} className={"nav-item" + (section === s.key ? " active" : "")} onClick={() => pick(s.key)}>
              <span className="nav-emoji">{s.emoji}</span>{s.label}
            </button>
          ))}
          <a className="nav-item" href="/cardapio/admin/">
            <span className="nav-emoji">🍔</span>Cardápio<span className="nav-ext">↗</span>
          </a>
        </nav>
        <div className="sb-foot">
          <div className="sb-user" title={me.email}>{me.name || me.email}</div>
          <button className="a-logout" onClick={onLogout}>Sair</button>
        </div>
      </aside>

      <div className="content">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setMenuOpen(true)} aria-label="Abrir menu">☰</button>
          <span className="topbar-title">{current?.label}</span>
        </header>
        <div className="a-body">
          {section === "links" && <LinksSection showToast={showToast} />}
          {section === "aparencia" && <AparenciaSection showToast={showToast} />}
          {section === "avisos" && <AvisosSection showToast={showToast} />}
          {section === "acoes" && <AcoesSection showToast={showToast} />}
          {section === "usuarios" && me.role === "super_admin" && <UsuariosSection me={me} showToast={showToast} />}
        </div>
      </div>

      <div className={"toast" + (toast.msg ? " show" : "") + (toast.err ? " err" : "")}>{toast.msg}</div>
    </div>
  );
}

export default function Admin() {
  const [phase, setPhase] = useState("checking"); // checking | out | in
  const [me, setMe] = useState(null);

  const loadMe = () =>
    api.get("/api/auth/me")
      .then((m) => { setMe(m); setPhase("in"); })
      .catch(() => setPhase("out"));

  useEffect(() => { loadMe(); }, []);

  const logout = async () => {
    await api.post("/api/auth/logout");
    setMe(null);
    setPhase("out");
  };

  if (phase === "checking") return <div className="a-loading">Carregando…</div>;
  if (phase === "out") return <Login onOk={loadMe} backHref="/" backLabel="← Voltar à página inicial" />;
  return <Panel me={me} onLogout={logout} />;
}
