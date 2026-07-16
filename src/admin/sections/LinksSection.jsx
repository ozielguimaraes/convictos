import React, { useState, useEffect } from "react";
import { api } from "../../lib/api.js";

function clone(o) { return JSON.parse(JSON.stringify(o)); }

export default function LinksSection({ canManage, showToast }) {
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
      <fieldset className="ro-fieldset" disabled={!canManage}>
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
        {canManage && <button className="add-item-btn" onClick={add}>+ Adicionar link</button>}
      </div>
      </fieldset>

      {canManage && (
        <div className="a-savebar">
          <button className={"btn-save" + (dirty ? "" : " saved")} onClick={save} disabled={!dirty || saving}>
            {saving ? "Salvando…" : dirty ? "Salvar alterações" : "Tudo salvo ✓"}
          </button>
        </div>
      )}
    </React.Fragment>
  );
}
