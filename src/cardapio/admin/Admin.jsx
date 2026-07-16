/* ===== CARDÁPIO ON — admin standalone (/cardapio/admin/, também servido no
   domínio cardapio.*). O editor em si vive em MenuEditor.jsx, compartilhado
   com a seção Cardápio do painel do convictos. */
import React, { useState, useEffect, useRef } from "react";
import { api } from "../../lib/api.js";
import Login from "../../components/Login.jsx";
import MenuEditor from "./MenuEditor.jsx";

function Page({ canManage, onLogout }) {
  const [toast, setToast] = useState({ msg: "", err: false });
  const toastTimer = useRef(null);

  const showToast = (msg, isErr = false) => {
    setToast({ msg, err: isErr });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast({ msg: "", err: false }), 2400);
  };

  return (
    <React.Fragment>
      <header className="a-header">
        <span className="a-brand">Cardápio</span>
        <span className="a-tag">ON</span>
        <span className="a-title">Admin</span>
        <button className="a-logout" onClick={onLogout}>Sair</button>
      </header>

      <div className="a-body">
        {!canManage && <div className="a-note">👁 Você tem acesso somente de visualização do cardápio.</div>}
        <MenuEditor canManage={canManage} showToast={showToast} />
      </div>

      <div className={"toast" + (toast.msg ? " show" : "") + (toast.err ? " err" : "")}>{toast.msg}</div>
    </React.Fragment>
  );
}

export default function Admin() {
  const [phase, setPhase] = useState("checking"); // checking | out | denied | in
  const [canManage, setCanManage] = useState(false);

  const check = () =>
    api.get("/api/auth/me")
      .then((me) => {
        setCanManage(me.permissions.includes("cardapio:manage"));
        setPhase(me.permissions.includes("cardapio:view") ? "in" : "denied");
      })
      .catch(() => setPhase("out"));

  useEffect(() => { check(); }, []);

  const logout = async () => {
    await api.post("/api/auth/logout");
    setPhase("out");
  };

  if (phase === "checking") return <div className="a-loading">Carregando…</div>;
  if (phase === "out") return <Login onOk={check} backHref="/cardapio/" backLabel="← Voltar ao cardápio" />;
  if (phase === "denied") {
    return (
      <div className="gate">
        <div className="lock">🔒</div>
        <h1>Sem acesso ao cardápio</h1>
        <p>Sua conta não tem a permissão "Cardápio". Fale com o administrador.</p>
        <a className="back" href="/cardapio/">← Voltar ao cardápio</a>
      </div>
    );
  }
  return <Page canManage={canManage} onLogout={logout} />;
}
