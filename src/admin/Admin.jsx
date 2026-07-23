/* ===== CONVICTOS — painel administrativo =====
   Shell com navegação lateral; cada seção vive em sections/. */
import React, { useState, useEffect } from "react";
import { api } from "../lib/api.js";
import Login from "../components/Login.jsx";
import { useToast } from "./useToast.js";
import LinksSection from "./sections/LinksSection.jsx";
import PatrocinadoresSection from "./sections/PatrocinadoresSection.jsx";
import AparenciaSection from "./sections/AparenciaSection.jsx";
import AvisosSection from "./sections/AvisosSection.jsx";
import AcoesSection from "./sections/AcoesSection.jsx";
import UsuariosSection from "./sections/UsuariosSection.jsx";
import PerfisSection from "./sections/PerfisSection.jsx";
import CardapioSection from "./sections/CardapioSection.jsx";
import EncurtadorSection from "./sections/EncurtadorSection.jsx";

// Cada seção corresponde a uma área do catálogo do servidor, com níveis
// "<area>:view" (entra no menu) e "<area>:manage" (pode alterar).
const SECTIONS = [
  { key: "links", label: "Links", emoji: "🔗" },
  { key: "patrocinadores", label: "Patrocinadores", emoji: "🤝" },
  { key: "aparencia", label: "Aparência", emoji: "🎨" },
  { key: "avisos", label: "Avisos", emoji: "📢" },
  { key: "acoes", label: "Ações entre amigos", emoji: "🎟️" },
  { key: "cardapio", label: "Cardápio", emoji: "🍔" },
  { key: "encurtador", label: "Encurtador", emoji: "✂️" },
  { key: "usuarios", label: "Usuários", emoji: "👥" },
  { key: "perfis", label: "Perfis de acesso", emoji: "🛡️" },
];

function Panel({ me, onLogout }) {
  const sections = SECTIONS.filter((s) => me.permissions.includes(s.key + ":view"));
  const [section, setSection] = useState(sections[0]?.key || "");
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, showToast] = useToast();

  const current = sections.find((s) => s.key === section);
  const canManage = (key) => me.permissions.includes(key + ":manage");

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
          {sections.length === 0 && (
            <div className="a-loading">Sua conta ainda não tem acesso a nenhuma seção.<br />Fale com o administrador.</div>
          )}
          {current && !canManage(current.key) && (
            <div className="ro-note">👁 Você tem acesso somente de visualização nesta seção.</div>
          )}
          {section === "links" && <LinksSection canManage={canManage("links")} showToast={showToast} />}
          {section === "patrocinadores" && <PatrocinadoresSection canManage={canManage("patrocinadores")} showToast={showToast} />}
          {section === "aparencia" && <AparenciaSection canManage={canManage("aparencia")} showToast={showToast} />}
          {section === "avisos" && <AvisosSection canManage={canManage("avisos")} showToast={showToast} />}
          {section === "acoes" && <AcoesSection canManage={canManage("acoes")} showToast={showToast} />}
          {section === "cardapio" && <CardapioSection canManage={canManage("cardapio")} showToast={showToast} />}
          {section === "encurtador" && <EncurtadorSection canManage={canManage("encurtador")} showToast={showToast} />}
          {section === "usuarios" && <UsuariosSection me={me} canManage={canManage("usuarios")} showToast={showToast} />}
          {section === "perfis" && <PerfisSection canManage={canManage("perfis")} showToast={showToast} />}
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
