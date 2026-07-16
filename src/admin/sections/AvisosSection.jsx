import React, { useState, useEffect } from "react";
import { api } from "../../lib/api.js";

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

export default function AvisosSection({ canManage, showToast }) {
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
      {canManage && <button className="add-cat-btn" style={{ marginBottom: 16 }} onClick={addNew}>+ Novo aviso</button>}
      {avisos.length === 0 && <div className="a-loading">Nenhum aviso ainda.</div>}
      <fieldset className="ro-fieldset" disabled={!canManage}>
        {avisos.map((a) => (
          <AvisoEditor key={a.id || a._key} aviso={a} onSaved={onSaved} onDeleted={onDeleted} showToast={showToast} />
        ))}
      </fieldset>
    </React.Fragment>
  );
}
