/* ===== CONVICTOS — painel administrativo (links, aparência, avisos) ===== */
import React, { useState, useEffect, useRef } from "react";
import { api } from "../lib/api.js";
import { SCENARIOS, resolveTheme } from "../lib/theme.js";
import Login from "../components/Login.jsx";

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function useToast() {
  const [toast, setToast] = useState({ msg: "", err: false });
  const timer = useRef(null);
  const show = (msg, isErr = false) => {
    setToast({ msg, err: isErr });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast({ msg: "", err: false }), 2400);
  };
  return [toast, show];
}

/* ---------- aba Links ---------- */

function LinksTab({ showToast }) {
  const [links, setLinks] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/api/admin/links").then(setLinks).catch((e) => showToast("Erro ao carregar: " + e.message, true));
  }, []);

  const update = (fn) => {
    setLinks((prev) => { const next = clone(prev); fn(next); return next; });
    setDirty(true);
  };
  const edit = (i, field, value) => update((l) => { l[i][field] = value; });
  const move = (i, dir) => update((l) => {
    const j = i + dir;
    if (j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]];
  });
  const del = (i) => update((l) => { l.splice(i, 1); });
  const add = () => update((l) => { l.push({ label: "Novo link", url: "https://", emoji: "🔗", visible: true }); });

  const save = async () => {
    setSaving(true);
    try {
      const saved = await api.put("/api/admin/links", links);
      setLinks(saved);
      setDirty(false);
      showToast("✓ Links salvos!");
    } catch (e) {
      showToast("Erro ao salvar: " + e.message, true);
    } finally {
      setSaving(false);
    }
  };

  if (!links) return <div className="a-loading">Carregando links…</div>;

  return (
    <React.Fragment>
      <div className="form-block">
        <h3>Links da página inicial</h3>
        {links.map((l, i) => (
          <div className="link-row" key={l.id || "new-" + i}>
            <input className="in-emoji" value={l.emoji} maxLength={4} onChange={(e) => edit(i, "emoji", e.target.value)} />
            <div className="fields">
              <input className="in-nome" value={l.label} placeholder="Nome do link" onChange={(e) => edit(i, "label", e.target.value)} />
              <input className="in-url" value={l.url} placeholder="https://…" onChange={(e) => edit(i, "url", e.target.value)} />
              <button className={"vis-toggle" + (l.visible ? "" : " off")} onClick={() => edit(i, "visible", !l.visible)}>
                {l.visible ? "👁 Visível" : "Oculto"}
              </button>
            </div>
            <div className="row-actions">
              <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir">↑</button>
              <button className="icon-btn" disabled={i === links.length - 1} onClick={() => move(i, 1)} aria-label="Descer">↓</button>
              <button className="icon-btn danger" onClick={() => del(i)} aria-label="Remover">🗑</button>
            </div>
          </div>
        ))}
        <button className="add-item-btn" onClick={add}>+ Adicionar link</button>
      </div>

      <div className="a-savebar">
        <button className={"btn-save" + (dirty ? "" : " saved")} onClick={save} disabled={!dirty || saving}>
          {saving ? "Salvando…" : dirty ? "Salvar alterações" : "Tudo salvo ✓"}
        </button>
      </div>
    </React.Fragment>
  );
}

/* ---------- aba Aparência ---------- */

function AparenciaTab({ showToast }) {
  const [profile, setProfile] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/api/profile")
      .then((p) => setProfile({ title: p.title, subtitle: p.subtitle, avatar_emoji: p.avatar_emoji, theme: p.theme || {} }))
      .catch((e) => showToast("Erro ao carregar: " + e.message, true));
  }, []);

  const edit = (field, value) => {
    setProfile((p) => ({ ...p, [field]: value }));
    setDirty(true);
  };
  const editTheme = (field, value) => {
    setProfile((p) => ({ ...p, theme: { ...p.theme, [field]: value } }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/api/admin/profile", profile);
      setDirty(false);
      showToast("✓ Aparência salva!");
    } catch (e) {
      showToast("Erro ao salvar: " + e.message, true);
    } finally {
      setSaving(false);
    }
  };

  if (!profile) return <div className="a-loading">Carregando…</div>;

  const t = resolveTheme(profile.theme);

  return (
    <React.Fragment>
      <div className="form-block">
        <h3>Identidade</h3>
        <div className="form-field">
          <label>Título</label>
          <input type="text" value={profile.title} onChange={(e) => edit("title", e.target.value)} />
        </div>
        <div className="form-field">
          <label>Subtítulo</label>
          <input type="text" value={profile.subtitle} onChange={(e) => edit("subtitle", e.target.value)} />
        </div>
        <div className="form-field">
          <label>Emoji do avatar</label>
          <input type="text" value={profile.avatar_emoji} maxLength={4} style={{ width: 90, textAlign: "center", fontSize: 22 }} onChange={(e) => edit("avatar_emoji", e.target.value)} />
        </div>
      </div>

      <div className="form-block">
        <h3>Cenário de fundo</h3>
        <div className="scenario-grid">
          {Object.entries(SCENARIOS).map(([key, s]) => (
            <button
              key={key}
              className={"scenario-swatch" + (t.scenario === key ? " active" : "")}
              style={{ background: s.bg }}
              onClick={() => editTheme("scenario", key)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="form-block">
        <h3>Cores (opcional — sobrepõe o cenário)</h3>
        {[
          ["text_color", "Cor do texto", t.text],
          ["button_color", "Cor dos botões", t.button],
          ["button_text_color", "Texto dos botões", t.buttonText],
        ].map(([field, label, current]) => (
          <div className="color-row" key={field}>
            <label>{label}</label>
            <input
              type="color"
              // input color só aceita hex; cores rgba() do padrão viram #000 até personalizar
              value={/^#[0-9a-f]{6}$/i.test(profile.theme[field] || "") ? profile.theme[field] : (/^#[0-9a-f]{6}$/i.test(current) ? current : "#000000")}
              onChange={(e) => editTheme(field, e.target.value)}
            />
            {profile.theme[field] ? (
              <button className="link-btn" onClick={() => editTheme(field, "")}>usar padrão</button>
            ) : null}
          </div>
        ))}
        <div className="preview-box" style={{ background: t.bg, color: t.text }}>
          <div className="pv-avatar" style={{ background: t.button }}>{profile.avatar_emoji}</div>
          <div className="pv-title">{profile.title}</div>
          <div className="pv-btn" style={{ background: t.button, color: t.buttonText }}>🔗 Exemplo de link</div>
        </div>
      </div>

      <div className="a-savebar">
        <button className={"btn-save" + (dirty ? "" : " saved")} onClick={save} disabled={!dirty || saving}>
          {saving ? "Salvando…" : dirty ? "Salvar alterações" : "Tudo salvo ✓"}
        </button>
      </div>
    </React.Fragment>
  );
}

/* ---------- aba Avisos ---------- */

function AvisoEditor({ aviso, onSaved, onDeleted, showToast }) {
  const [draft, setDraft] = useState(aviso);
  const [dirty, setDirty] = useState(!aviso.id);
  const [saving, setSaving] = useState(false);

  const edit = (field, value) => {
    setDraft((d) => ({ ...d, [field]: value }));
    setDirty(true);
  };

  const save = async () => {
    if (!draft.title.trim()) { showToast("Título obrigatório", true); return; }
    setSaving(true);
    try {
      const saved = draft.id
        ? await api.put(`/api/admin/avisos/${draft.id}`, draft)
        : await api.post("/api/admin/avisos", draft);
      setDraft(saved);
      setDirty(false);
      onSaved(saved, aviso);
      showToast("✓ Aviso salvo!");
    } catch (e) {
      showToast("Erro ao salvar: " + e.message, true);
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (draft.id && !confirm("Excluir este aviso?")) return;
    try {
      if (draft.id) await api.del(`/api/admin/avisos/${draft.id}`);
      onDeleted(aviso);
    } catch (e) {
      showToast("Erro ao excluir: " + e.message, true);
    }
  };

  return (
    <div className="aviso-row">
      <div className="form-field">
        <input type="text" value={draft.title} placeholder="Título do aviso" onChange={(e) => edit("title", e.target.value)} />
      </div>
      <div className="form-field">
        <textarea value={draft.body} placeholder="Texto do aviso (opcional)" onChange={(e) => edit("body", e.target.value)} />
      </div>
      <div className="aviso-actions">
        <button className={"pill-toggle" + (draft.pinned ? " on" : "")} onClick={() => edit("pinned", !draft.pinned)}>
          📌 Fixado
        </button>
        <button className={"pill-toggle" + (draft.published ? " on" : "")} onClick={() => edit("published", !draft.published)}>
          {draft.published ? "Publicado" : "Rascunho"}
        </button>
        <button className="btn-small-danger" onClick={del}>Excluir</button>
        <button className="btn-small-save" onClick={save} disabled={!dirty || saving}>
          {saving ? "Salvando…" : dirty ? "Salvar" : "Salvo ✓"}
        </button>
      </div>
      {draft.id ? (
        <div className="aviso-meta">
          Criado em {new Date(draft.created_at).toLocaleDateString("pt-BR")}
        </div>
      ) : null}
    </div>
  );
}

function AvisosTab({ showToast }) {
  const [avisos, setAvisos] = useState(null);

  useEffect(() => {
    api.get("/api/admin/avisos").then(setAvisos).catch((e) => showToast("Erro ao carregar: " + e.message, true));
  }, []);

  if (!avisos) return <div className="a-loading">Carregando avisos…</div>;

  const addNew = () => {
    setAvisos([{ title: "", body: "", pinned: false, published: true, _key: "new-" + Date.now() }, ...avisos]);
  };
  const onSaved = (saved, original) => {
    setAvisos((list) => list.map((a) => (a === original || a.id === saved.id ? saved : a)));
  };
  const onDeleted = (original) => {
    setAvisos((list) => list.filter((a) => a !== original && (original.id ? a.id !== original.id : true)));
  };

  return (
    <React.Fragment>
      <button className="add-cat-btn" style={{ marginBottom: 16 }} onClick={addNew}>+ Novo aviso</button>
      {avisos.length === 0 && <div className="a-loading">Nenhum aviso ainda.</div>}
      {avisos.map((a) => (
        <AvisoEditor key={a.id || a._key} aviso={a} onSaved={onSaved} onDeleted={onDeleted} showToast={showToast} />
      ))}
    </React.Fragment>
  );
}

/* ---------- shell ---------- */

function Panel({ onLogout }) {
  const [tab, setTab] = useState("links");
  const [toast, showToast] = useToast();

  return (
    <React.Fragment>
      <header className="a-header">
        <span className="a-brand">Convictos</span>
        <span className="a-title">Admin</span>
        <button className="a-logout" onClick={onLogout}>Sair</button>
      </header>

      <div className="tabs">
        {[["links", "Links"], ["aparencia", "Aparência"], ["avisos", "Avisos"]].map(([key, label]) => (
          <button key={key} className={"tab" + (tab === key ? " active" : "")} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      <div className="a-body">
        {tab === "links" && <LinksTab showToast={showToast} />}
        {tab === "aparencia" && <AparenciaTab showToast={showToast} />}
        {tab === "avisos" && <AvisosTab showToast={showToast} />}
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <a href="/cardapio/admin/" style={{ color: "#6f6b52", fontSize: 13, fontWeight: 600 }}>
            🍔 Gerenciar cardápio →
          </a>
        </div>
      </div>

      <div className={"toast" + (toast.msg ? " show" : "") + (toast.err ? " err" : "")}>{toast.msg}</div>
    </React.Fragment>
  );
}

export default function Admin() {
  const [phase, setPhase] = useState("checking"); // checking | out | in

  useEffect(() => {
    api.get("/api/auth/me")
      .then(() => setPhase("in"))
      .catch(() => setPhase("out"));
  }, []);

  const logout = async () => {
    await api.post("/api/auth/logout");
    setPhase("out");
  };

  if (phase === "checking") return <div className="a-loading">Carregando…</div>;
  if (phase === "out") return <Login onOk={() => setPhase("in")} backHref="/" backLabel="← Voltar à página inicial" />;
  return <Panel onLogout={logout} />;
}
