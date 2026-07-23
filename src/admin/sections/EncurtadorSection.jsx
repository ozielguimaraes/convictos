import React, { useState, useEffect } from "react";
import { api } from "../../lib/api.js";

const SHORT_DOMAIN = "url.querc.app";

export default function EncurtadorSection({ canManage, showToast }) {
  const [links, setLinks] = useState(null);
  const [targetUrl, setTargetUrl] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.get("/api/admin/encurtador").then(setLinks).catch((e) => showToast("Erro ao carregar: " + e.message, true));
  }, []);

  const create = async () => {
    if (!targetUrl.trim()) { showToast("Cole uma URL primeiro", true); return; }
    setCreating(true);
    try {
      const created = await api.post("/api/admin/encurtador", { target_url: targetUrl.trim() });
      setLinks((list) => [created, ...list]);
      setTargetUrl("");
      showToast("✓ Link encurtado!");
    } catch (e) {
      showToast("Erro ao encurtar: " + e.message, true);
    } finally {
      setCreating(false);
    }
  };

  const del = async (link) => {
    if (!confirm("Excluir este link encurtado?")) return;
    try {
      await api.del(`/api/admin/encurtador/${link.id}`);
      setLinks((list) => list.filter((l) => l.id !== link.id));
    } catch (e) {
      showToast("Erro ao excluir: " + e.message, true);
    }
  };

  const copy = async (link) => {
    const short = `https://${SHORT_DOMAIN}/${link.code}`;
    try {
      await navigator.clipboard.writeText(short);
      showToast("✓ Copiado!");
    } catch {
      showToast(short);
    }
  };

  if (!links) return <div className="a-loading">Carregando…</div>;

  return (
    <React.Fragment>
      <fieldset className="ro-fieldset" disabled={!canManage}>
        <div className="form-block">
          <h3>Encurtar uma URL</h3>
          <div className="form-field">
            <input
              type="text"
              value={targetUrl}
              placeholder="https://exemplo.com/pagina-longa"
              onChange={(e) => setTargetUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
            />
          </div>
          <button className="btn-small-save" onClick={create} disabled={creating}>
            {creating ? "Encurtando…" : "Encurtar"}
          </button>
        </div>
      </fieldset>

      {links.length === 0 && <div className="a-loading" style={{ marginTop: 16 }}>Nenhum link encurtado ainda.</div>}

      {links.map((link) => (
        <div className="aviso-row" key={link.id}>
          <div className="short-link-code">
            {SHORT_DOMAIN}/{link.code}
          </div>
          <div className="short-link-target" title={link.target_url}>{link.target_url}</div>
          <div className="aviso-actions">
            <span className="short-link-clicks">{link.click_count} clique{link.click_count === 1 ? "" : "s"}</span>
            <button className="btn-small-save" onClick={() => copy(link)}>Copiar</button>
            {canManage && <button className="btn-small-danger" onClick={() => del(link)}>Excluir</button>}
          </div>
          <div className="aviso-meta">Criado em {new Date(link.created_at).toLocaleDateString("pt-BR")}</div>
        </div>
      ))}
    </React.Fragment>
  );
}
