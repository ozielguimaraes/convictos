import React, { useState, useEffect } from "react";
import { api } from "../../lib/api.js";
import { SCENARIOS, resolveTheme } from "../../lib/theme.js";

export default function AparenciaSection({ canManage, showToast }) {
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
      <fieldset className="ro-fieldset" disabled={!canManage}>
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
