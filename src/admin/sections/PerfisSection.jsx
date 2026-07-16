/* Perfis de acesso: cria/edita perfis e marca as permissões de cada um por
   área, nos níveis Ver/Editar. Visível para quem tem a permissão "perfis". */
import React, { useState, useEffect } from "react";
import { api } from "../../lib/api.js";
import PermissionPicker from "../PermissionPicker.jsx";

function PerfilCard({ catalog, profile, canManage, onSaved, onDeleted, showToast }) {
  const [draft, setDraft] = useState({ name: profile.name, permissions: profile.permissions });
  const [saving, setSaving] = useState(false);

  const dirty = draft.name !== profile.name
    || draft.permissions.length !== profile.permissions.length
    || draft.permissions.some((k) => !profile.permissions.includes(k));

  const save = async () => {
    setSaving(true);
    try {
      const saved = await api.put(`/api/admin/access-profiles/${profile.id}`, draft);
      onSaved({ ...profile, ...saved });
      showToast("✓ Perfil salvo!");
    } catch (e) {
      showToast("Erro ao salvar: " + e.message, true);
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    const aviso = profile.users_count
      ? `Excluir o perfil "${profile.name}"? ${profile.users_count} usuário(s) ficarão sem perfil.`
      : `Excluir o perfil "${profile.name}"?`;
    if (!confirm(aviso)) return;
    try {
      await api.del(`/api/admin/access-profiles/${profile.id}`);
      onDeleted(profile);
      showToast("✓ Perfil excluído!");
    } catch (e) {
      showToast("Erro ao excluir: " + e.message, true);
    }
  };

  return (
    <div className="aviso-row">
      <fieldset className="ro-fieldset" disabled={!canManage}>
        <div className="vendedor-top">
          <input type="text" className="perfil-name" value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          {canManage && <button className="cat-del" onClick={del}>Excluir</button>}
        </div>
        <PermissionPicker areas={catalog} selected={draft.permissions} disabled={!canManage}
          onChange={(permissions) => setDraft((d) => ({ ...d, permissions }))} />
      </fieldset>
      <div className="aviso-actions">
        <span className="aviso-meta" style={{ marginTop: 0 }}>
          {profile.users_count} usuário{profile.users_count === 1 ? "" : "s"} com este perfil
        </span>
        {canManage && (
          <button className="btn-small-save" style={{ marginLeft: "auto" }} onClick={save} disabled={!dirty || saving}>
            {saving ? "Salvando…" : dirty ? "Salvar" : "Salvo ✓"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function PerfisSection({ canManage, showToast }) {
  const [catalog, setCatalog] = useState(null);
  const [profiles, setProfiles] = useState(null);
  const [draft, setDraft] = useState({ name: "", permissions: [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.get("/api/admin/permissions"), api.get("/api/admin/access-profiles")])
      .then(([perms, profs]) => { setCatalog(perms); setProfiles(profs); })
      .catch((e) => showToast("Erro ao carregar: " + e.message, true));
  }, []);

  if (!catalog || !profiles) return <div className="a-loading">Carregando perfis…</div>;

  const create = async () => {
    if (!draft.name.trim()) { showToast("Nome obrigatório", true); return; }
    setSaving(true);
    try {
      const created = await api.post("/api/admin/access-profiles", { name: draft.name.trim(), permissions: draft.permissions });
      setProfiles((list) => [...list, created].sort((a, b) => a.name.localeCompare(b.name)));
      setDraft({ name: "", permissions: [] });
      showToast("✓ Perfil criado!");
    } catch (e) {
      showToast("Erro ao criar: " + e.message, true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <React.Fragment>
      {canManage && (
      <div className="form-block">
        <h3>Novo perfil</h3>
        <div className="form-field">
          <label>Nome</label>
          <input type="text" value={draft.name} placeholder="Ex.: Editor de avisos"
            onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </div>
        <div className="form-field">
          <label>Acessos do perfil</label>
          <PermissionPicker areas={catalog} selected={draft.permissions}
            onChange={(permissions) => setDraft((d) => ({ ...d, permissions }))} />
        </div>
        <button className="add-cat-btn" onClick={create} disabled={saving}>
          {saving ? "Criando…" : "+ Criar perfil"}
        </button>
      </div>
      )}

      <div className="form-block">
        <h3>Perfis existentes</h3>
        {profiles.length === 0 && <div className="vendedor-empty">Nenhum perfil ainda.</div>}
        {profiles.map((p) => (
          <PerfilCard key={p.id} catalog={catalog} profile={p} canManage={canManage}
            onSaved={(saved) => setProfiles((list) => list.map((x) => (x.id === saved.id ? saved : x)))}
            onDeleted={(deleted) => setProfiles((list) => list.filter((x) => x.id !== deleted.id))}
            showToast={showToast} />
        ))}
      </div>
    </React.Fragment>
  );
}
