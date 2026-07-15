import React, { useState, useEffect } from "react";
import { api } from "../../lib/api.js";

export default function UsuariosSection({ me, showToast }) {
  const [users, setUsers] = useState(null);
  const [draft, setDraft] = useState({ email: "", name: "", password: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/api/admin/users").then(setUsers).catch((e) => showToast("Erro ao carregar: " + e.message, true));
  }, []);

  const add = async () => {
    if (!draft.email.trim()) { showToast("E-mail obrigatório", true); return; }
    setSaving(true);
    try {
      const created = await api.post("/api/admin/users", draft);
      setUsers((list) => [...list, created]);
      setDraft({ email: "", name: "", password: "" });
      showToast("✓ Usuário criado!");
    } catch (e) {
      showToast("Erro ao criar: " + e.message, true);
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async (u) => {
    const password = prompt(`Nova senha para ${u.email} (mín. 6 caracteres):`);
    if (!password) return;
    try {
      const saved = await api.put(`/api/admin/users/${u.id}`, { name: u.name, password });
      setUsers((list) => list.map((x) => (x.id === saved.id ? saved : x)));
      showToast("✓ Senha redefinida!");
    } catch (e) {
      showToast("Erro: " + e.message, true);
    }
  };

  const del = async (u) => {
    if (!confirm(`Excluir o usuário ${u.email}?`)) return;
    try {
      await api.del(`/api/admin/users/${u.id}`);
      setUsers((list) => list.filter((x) => x.id !== u.id));
      showToast("✓ Usuário excluído!");
    } catch (e) {
      showToast("Erro ao excluir: " + e.message, true);
    }
  };

  if (!users) return <div className="a-loading">Carregando usuários…</div>;

  return (
    <React.Fragment>
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
        <button className="add-cat-btn" onClick={add} disabled={saving}>
          {saving ? "Criando…" : "+ Criar usuário"}
        </button>
      </div>

      <div className="form-block">
        <h3>Usuários</h3>
        {users.map((u) => (
          <div className="aviso-row" key={u.id}>
            <div>
              <b>{u.email}</b>{u.id === me.id ? " (você)" : ""}
              {u.role === "super_admin" && <span className="a-tag" style={{ marginLeft: 8 }}>Super Admin</span>}
            </div>
            <div className="aviso-meta">
              {u.name || "Sem nome"} · {u.has_password ? "senha definida" : "só código por e-mail"} ·
              criado em {new Date(u.created_at).toLocaleDateString("pt-BR")}
            </div>
            <div className="aviso-actions">
              <button className="btn-small-save" onClick={() => resetPassword(u)}>Redefinir senha</button>
              {u.role !== "super_admin" && u.id !== me.id && (
                <button className="btn-small-danger" onClick={() => del(u)}>Excluir</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </React.Fragment>
  );
}
