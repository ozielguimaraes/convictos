/* Usuários: cria contas informando o perfil de acesso e permite conceder
   acessos extras além do perfil (por área, nos níveis Ver/Editar). Ninguém
   cria super admin; quem não é super admin não vê nem concede "perfis". */
import React, { useState, useEffect } from "react";
import { api } from "../../lib/api.js";
import PermissionPicker from "../PermissionPicker.jsx";

function UserCard({ me, areas, profiles, user, canManage, onSaved, onDeleted, showToast }) {
  const [draft, setDraft] = useState({ profile_id: user.profile_id, extra_permissions: user.extra_permissions || [] });
  const [saving, setSaving] = useState(false);
  const isSuper = user.role === "super_admin";

  const dirty = draft.profile_id !== user.profile_id
    || draft.extra_permissions.length !== (user.extra_permissions || []).length
    || draft.extra_permissions.some((k) => !(user.extra_permissions || []).includes(k));

  const save = async () => {
    setSaving(true);
    try {
      const saved = await api.put(`/api/admin/users/${user.id}`, { name: user.name, ...draft });
      onSaved(saved);
      showToast("✓ Acessos salvos!");
    } catch (e) {
      showToast("Erro: " + e.message, true);
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async () => {
    const password = prompt(`Nova senha para ${user.email} (mín. 6 caracteres):`);
    if (!password) return;
    try {
      const saved = await api.put(`/api/admin/users/${user.id}`, {
        name: user.name,
        password,
        profile_id: user.profile_id,
        extra_permissions: user.extra_permissions || [],
      });
      onSaved(saved);
      showToast("✓ Senha redefinida!");
    } catch (e) {
      showToast("Erro: " + e.message, true);
    }
  };

  const del = async () => {
    if (!confirm(`Excluir o usuário ${user.email}?`)) return;
    try {
      await api.del(`/api/admin/users/${user.id}`);
      onDeleted(user);
      showToast("✓ Usuário excluído!");
    } catch (e) {
      showToast("Erro ao excluir: " + e.message, true);
    }
  };

  return (
    <div className="aviso-row">
      <div>
        <b>{user.email}</b>{user.id === me.id ? " (você)" : ""}
        {isSuper && <span className="a-tag" style={{ marginLeft: 8 }}>Super Admin</span>}
      </div>
      <div className="aviso-meta">
        {user.name || "Sem nome"} · {user.has_password ? "senha definida" : "só código por e-mail"} ·
        criado em {new Date(user.created_at).toLocaleDateString("pt-BR")}
      </div>

      {isSuper ? (
        <div className="aviso-meta">Acesso total — perfis e extras não se aplicam.</div>
      ) : (
        <fieldset className="ro-fieldset" disabled={!canManage}>
          <div className="form-field" style={{ marginTop: 10 }}>
            <label>Perfil de acesso</label>
            <select className="perfil-select" value={draft.profile_id ?? ""}
              onChange={(e) => setDraft({ ...draft, profile_id: e.target.value === "" ? null : Number(e.target.value) })}>
              <option value="">Sem perfil</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Acessos extras (além do perfil)</label>
            <PermissionPicker areas={areas} selected={draft.extra_permissions} disabled={!canManage}
              onChange={(extra_permissions) => setDraft((d) => ({ ...d, extra_permissions }))} />
          </div>
        </fieldset>
      )}

      {canManage && (
        <div className="aviso-actions">
          <button className="btn-small-danger" style={{ marginLeft: 0 }} onClick={resetPassword}>Redefinir senha</button>
          {!isSuper && user.id !== me.id && (
            <button className="btn-small-danger" onClick={del}>Excluir</button>
          )}
          {!isSuper && (
            <button className="btn-small-save" style={{ marginLeft: "auto" }} onClick={save} disabled={!dirty || saving}>
              {saving ? "Salvando…" : dirty ? "Salvar acessos" : "Salvo ✓"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function UsuariosSection({ me, canManage, showToast }) {
  const [users, setUsers] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [profiles, setProfiles] = useState(null);
  const [draft, setDraft] = useState({ email: "", name: "", password: "", profile_id: null });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get("/api/admin/users"),
      api.get("/api/admin/permissions"),
      api.get("/api/admin/access-profiles"),
    ])
      .then(([u, perms, profs]) => { setUsers(u); setCatalog(perms); setProfiles(profs); })
      .catch((e) => showToast("Erro ao carregar: " + e.message, true));
  }, []);

  if (!users || !catalog || !profiles) return <div className="a-loading">Carregando usuários…</div>;

  // Quem não é super admin não concede "perfis": somem a área e os perfis que a contêm.
  const isSuper = me.role === "super_admin";
  const grantableAreas = isSuper ? catalog : catalog.filter((a) => a.key !== "perfis");
  const grantableProfiles = isSuper ? profiles : profiles.filter((p) => !p.permissions.some((k) => k.startsWith("perfis:")));

  const add = async () => {
    if (!draft.email.trim()) { showToast("E-mail obrigatório", true); return; }
    setSaving(true);
    try {
      const created = await api.post("/api/admin/users", { ...draft, extra_permissions: [] });
      setUsers((list) => [...list, created]);
      setDraft({ email: "", name: "", password: "", profile_id: null });
      showToast("✓ Usuário criado!");
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
        <h3>Novo usuário</h3>
        <div className="form-field">
          <label>E-mail</label>
          <input type="email" value={draft.email} placeholder="email@dominio.com" onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
        </div>
        <div className="form-field">
          <label>Nome (opcional)</label>
          <input type="text" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </div>
        <div className="form-field">
          <label>Senha (opcional — sem senha, entra por código no e-mail)</label>
          <input type="password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} />
        </div>
        <div className="form-field">
          <label>Perfil de acesso</label>
          <select className="perfil-select" value={draft.profile_id ?? ""}
            onChange={(e) => setDraft({ ...draft, profile_id: e.target.value === "" ? null : Number(e.target.value) })}>
            <option value="">Sem perfil</option>
            {grantableProfiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <button className="add-cat-btn" onClick={add} disabled={saving}>
          {saving ? "Criando…" : "+ Criar usuário"}
        </button>
      </div>
      )}

      <div className="form-block">
        <h3>Usuários</h3>
        {users.map((u) => (
          <UserCard key={u.id} me={me} areas={grantableAreas} profiles={grantableProfiles} user={u} canManage={canManage}
            onSaved={(saved) => setUsers((list) => list.map((x) => (x.id === saved.id ? saved : x)))}
            onDeleted={(deleted) => setUsers((list) => list.filter((x) => x.id !== deleted.id))}
            showToast={showToast} />
        ))}
      </div>
    </React.Fragment>
  );
}
