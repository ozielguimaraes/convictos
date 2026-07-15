/* Login compartilhado dos painéis admin (convictos e cardápio).
   Três caminhos: senha, código OTP por e-mail e link mágico (chega no mesmo
   e-mail do código e autentica via /api/auth/magic). */
import React, { useState, useEffect } from "react";
import { api } from "../lib/api.js";

export default function Login({ onOk, backHref = "/", backLabel = "← Voltar" }) {
  const [mode, setMode] = useState("password"); // password | code
  const [step, setStep] = useState("email"); // (mode code) email | verify
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const run = async (fn) => {
    setBusy(true);
    setErr("");
    try {
      await fn();
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const loginPassword = () =>
    run(async () => {
      if (!emailOk) throw new Error("Digite um e-mail válido");
      if (!password) throw new Error("Digite a senha");
      await api.post("/api/auth/login", { email: email.trim(), password });
      onOk();
    });

  const sendCode = () =>
    run(async () => {
      if (!emailOk) throw new Error("Digite um e-mail válido");
      await api.post("/api/auth/send-code", { email: email.trim() });
      setStep("verify");
      setCooldown(30);
    });

  const verifyCode = () =>
    run(async () => {
      if (code.trim().length !== 6) throw new Error("Digite os 6 dígitos");
      await api.post("/api/auth/verify-code", { email: email.trim(), code: code.trim() });
      onOk();
    });

  return (
    <div className="gate">
      <div className="lock">🔒</div>
      <h1>Área administrativa</h1>

      {mode === "password" && (
        <React.Fragment>
          <p>Entre com seu e-mail e senha.</p>
          <input
            type="email"
            inputMode="email"
            className="gate-email"
            value={email}
            autoFocus
            placeholder="seu@email.com"
            onChange={(e) => { setEmail(e.target.value); setErr(""); }}
          />
          <input
            type="password"
            className="gate-email"
            value={password}
            placeholder="senha"
            onChange={(e) => { setPassword(e.target.value); setErr(""); }}
            onKeyDown={(e) => e.key === "Enter" && loginPassword()}
          />
          <div className="err">{err}</div>
          <button onClick={loginPassword} disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
          <button className="link-btn" onClick={() => { setMode("code"); setStep("email"); setErr(""); }}>
            Entrar com código por e-mail
          </button>
        </React.Fragment>
      )}

      {mode === "code" && step === "email" && (
        <React.Fragment>
          <p>Você receberá um e-mail com o código de 6 dígitos e um link mágico para entrar.</p>
          <input
            type="email"
            inputMode="email"
            className="gate-email"
            value={email}
            autoFocus
            placeholder="seu@email.com"
            onChange={(e) => { setEmail(e.target.value); setErr(""); }}
            onKeyDown={(e) => e.key === "Enter" && sendCode()}
          />
          <div className="err">{err}</div>
          <button onClick={sendCode} disabled={busy}>{busy ? "Enviando…" : "Enviar código"}</button>
          <button className="link-btn" onClick={() => { setMode("password"); setErr(""); }}>
            Entrar com senha
          </button>
        </React.Fragment>
      )}

      {mode === "code" && step === "verify" && (
        <React.Fragment>
          <p>
            Enviado para <b>{email.trim().toLowerCase()}</b>.<br />
            Digite o código ou clique no link mágico do e-mail.
          </p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            className="gate-code"
            value={code}
            autoFocus
            placeholder="000000"
            onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setErr(""); }}
            onKeyDown={(e) => e.key === "Enter" && verifyCode()}
          />
          <div className="err">{err}</div>
          <button onClick={verifyCode} disabled={busy}>{busy ? "Verificando…" : "Entrar"}</button>
          <button className="link-btn" disabled={cooldown > 0 || busy} onClick={sendCode}>
            {cooldown > 0 ? `Reenviar código em ${cooldown}s` : "Reenviar código"}
          </button>
          <button className="link-btn" onClick={() => { setStep("email"); setCode(""); setErr(""); }}>
            Trocar e-mail
          </button>
        </React.Fragment>
      )}

      <a className="back" href={backHref}>{backLabel}</a>
    </div>
  );
}
