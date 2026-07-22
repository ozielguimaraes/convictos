import React, { useState, useEffect } from "react";
import { api } from "../../lib/api.js";

function clone(o) { return JSON.parse(JSON.stringify(o)); }

const PLANS = [
  { value: "ouro", label: "🥇 Ouro" },
  { value: "prata", label: "🥈 Prata" },
  { value: "bronze", label: "🥉 Bronze" },
];

// ~1.1MB de arquivo vira ~1.5MB em base64 — mesmo teto validado no servidor.
const MAX_BANNER_BYTES = 1_100_000;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Máscara progressiva de telefone BR: DDD + 8 dígitos (fixo) ou 9 dígitos (celular).
function formatPhoneBR(value) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  if (digits.length <= 10) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}

const DAYS_OPTIONS = [7, 14, 30, 90];

function SponsorsReport({ showToast }) {
  const [report, setReport] = useState(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setReport(null);
    api.get(`/api/admin/sponsors/report?days=${days}`).then(setReport).catch((e) => showToast("Erro ao carregar métricas: " + e.message, true));
  }, [days]);

  return (
    <div className="form-block">
      <div className="sp-report-head">
        <h3>Métricas</h3>
        <div className="sp-report-actions">
          <select className="perfil-select sp-days-select" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {DAYS_OPTIONS.map((d) => <option key={d} value={d}>Últimos {d} dias</option>)}
          </select>
          <a className="btn-export" href={`/api/admin/sponsors/report.csv?days=${days}`}>⬇️ Exportar CSV</a>
        </div>
      </div>

      {!report ? (
        <div className="a-loading">Carregando métricas…</div>
      ) : (
        <React.Fragment>
          <p className="sp-report-total">👀 <strong>{report.totalVisits}</strong> visitas ao site (total acumulado)</p>

          {report.sponsors.length === 0 ? (
            <p>Nenhum patrocinador cadastrado ainda.</p>
          ) : (
            <div className="sp-report-table-wrap">
              <table className="sp-report-table">
                <thead>
                  <tr>
                    <th>Patrocinador</th>
                    <th>Views</th>
                    <th>🌐 Site</th>
                    <th>💬 WhatsApp</th>
                    <th>☎️ Telefone</th>
                    <th>📷 Instagram</th>
                    <th>📍 Endereço</th>
                  </tr>
                </thead>
                <tbody>
                  {report.sponsors.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>{s.views}</td>
                      <td>{s.clicks_site}</td>
                      <td>{s.clicks_whatsapp}</td>
                      <td>{s.clicks_phone}</td>
                      <td>{s.clicks_instagram}</td>
                      <td>{s.clicks_address}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3 className="sp-report-subhead">Visitas por dia</h3>
          <div className="sp-report-table-wrap sp-daily-visits">
            {report.dailyVisits.map((d) => (
              <div key={d.date} className="sp-day-bar" title={`${d.date}: ${d.visits} visita(s)`}>
                <div className="sp-day-bar-fill" style={{ height: `${Math.min(100, d.visits * 12 + (d.visits > 0 ? 8 : 2))}%` }} />
                <span className="sp-day-bar-label">{d.date.slice(8)}</span>
              </div>
            ))}
          </div>

          <h3 className="sp-report-subhead">Patrocinador por dia</h3>
          {report.dailySponsors.length === 0 ? (
            <p>Sem atividade registrada no período.</p>
          ) : (
            <div className="sp-report-table-wrap">
              <table className="sp-report-table">
                <thead>
                  <tr><th>Data</th><th>Patrocinador</th><th>Views</th><th>Cliques</th></tr>
                </thead>
                <tbody>
                  {report.dailySponsors.map((d, i) => (
                    <tr key={d.date + d.sponsor_id + i}>
                      <td>{d.date}</td>
                      <td>{d.sponsor_name}</td>
                      <td>{d.views}</td>
                      <td>{d.clicks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </React.Fragment>
      )}
    </div>
  );
}

export default function PatrocinadoresSection({ canManage, showToast }) {
  const [tab, setTab] = useState("editar");
  const [sponsors, setSponsors] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(null);

  useEffect(() => {
    api.get("/api/admin/sponsors").then(setSponsors).catch((e) => showToast("Erro ao carregar: " + e.message, true));
  }, []);

  const update = (fn) => {
    setSponsors((prev) => { const next = clone(prev); fn(next); return next; });
    setDirty(true);
  };
  const edit = (i, field, value) => update((s) => { s[i][field] = value; });
  const move = (i, dir) => update((s) => {
    const j = i + dir;
    if (j < 0 || j >= s.length) return;
    [s[i], s[j]] = [s[j], s[i]];
  });
  const del = (i) => update((s) => { s.splice(i, 1); });
  const add = () => update((s) => {
    s.push({ name: "Novo patrocinador", emoji: "🏢", plan: "bronze", url: "", banner: "", address: "", whatsapp: "", phone: "", instagram: "", visible: true });
  });

  const handleBannerFile = async (i, file) => {
    if (!file) return;
    if (file.size > MAX_BANNER_BYTES) {
      showToast("Imagem grande demais (máx. ~1MB) — use uma menor ou cole uma URL", true);
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    edit(i, "banner", dataUrl);
  };

  const save = async () => {
    setSaving(true);
    try {
      const saved = await api.put("/api/admin/sponsors", sponsors);
      setSponsors(saved);
      setDirty(false);
      showToast("✓ Patrocinadores salvos!");
    } catch (e) {
      showToast("Erro ao salvar: " + e.message, true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <React.Fragment>
      <div className="sp-tabs">
        <button className={"sp-tab" + (tab === "editar" ? " active" : "")} onClick={() => setTab("editar")}>Editar</button>
        <button className={"sp-tab" + (tab === "metricas" ? " active" : "")} onClick={() => setTab("metricas")}>📊 Métricas</button>
      </div>

      {tab === "metricas" ? (
        <SponsorsReport showToast={showToast} />
      ) : !sponsors ? (
        <div className="a-loading">Carregando patrocinadores…</div>
      ) : (
        <React.Fragment>
          <fieldset className="ro-fieldset" disabled={!canManage}>
          <div className="form-block">
            <h3>Patrocinadores</h3>
            {sponsors.map((s, i) => (
              <div className="link-row sp-row" key={s.id || "new-" + i}>
                <input className="in-emoji" value={s.emoji} maxLength={4} onChange={(e) => edit(i, "emoji", e.target.value)} />
                <div className="fields">
                  <input className="in-nome" value={s.name} placeholder="Nome do patrocinador" onChange={(e) => edit(i, "name", e.target.value)} />
                  <select className="perfil-select" value={s.plan} onChange={(e) => edit(i, "plan", e.target.value)}>
                    {PLANS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>

                  <label
                    className={"sp-drop" + (dragOver === i ? " drag" : "")}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(i); }}
                    onDragLeave={() => setDragOver((cur) => (cur === i ? null : cur))}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(null);
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleBannerFile(i, file);
                    }}
                  >
                    {s.banner ? (
                      <img className="sp-banner-preview" src={s.banner} alt="" />
                    ) : (
                      <span className="sp-drop-hint">🖼️ Arraste ou clique para escolher a imagem do banner</span>
                    )}
                    <input type="file" accept="image/*" className="sp-banner-file-input" onChange={(e) => handleBannerFile(i, e.target.files[0])} />
                  </label>
                  <div className="sp-input-icon">
                    <span className="sp-field-glyph">🔗</span>
                    <input className="in-url" value={s.banner} placeholder="…ou cole uma URL de imagem" onChange={(e) => edit(i, "banner", e.target.value)} />
                  </div>

                  <div className="sp-input-icon">
                    <span className="sp-field-glyph">🌐</span>
                    <input className="in-url" value={s.url} placeholder="Site (https://…)" onChange={(e) => edit(i, "url", e.target.value)} />
                  </div>
                  <div className="sp-input-icon">
                    <span className="sp-field-glyph">💬</span>
                    <input className="in-url" value={s.whatsapp} placeholder="WhatsApp (DDD + número)" onChange={(e) => edit(i, "whatsapp", formatPhoneBR(e.target.value))} />
                  </div>
                  <div className="sp-input-icon">
                    <span className="sp-field-glyph">☎️</span>
                    <input className="in-url" value={s.phone} placeholder="Telefone" onChange={(e) => edit(i, "phone", formatPhoneBR(e.target.value))} />
                  </div>
                  <div className="sp-input-icon">
                    <span className="sp-field-glyph">📷</span>
                    <input className="in-url" value={s.instagram} placeholder="Instagram (@usuario)" onChange={(e) => edit(i, "instagram", e.target.value)} />
                  </div>
                  <div className="sp-input-icon">
                    <span className="sp-field-glyph">📍</span>
                    <input className="in-url" value={s.address} placeholder="Endereço" onChange={(e) => edit(i, "address", e.target.value)} />
                  </div>

                  <button className={"vis-toggle" + (s.visible ? "" : " off")} onClick={() => edit(i, "visible", !s.visible)}>
                    {s.visible ? "👁 Visível" : "Oculto"}
                  </button>
                </div>
                <div className="row-actions">
                  <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir">↑</button>
                  <button className="icon-btn" disabled={i === sponsors.length - 1} onClick={() => move(i, 1)} aria-label="Descer">↓</button>
                  <button className="icon-btn danger" onClick={() => del(i)} aria-label="Remover">🗑</button>
                </div>
              </div>
            ))}
            {canManage && <button className="add-item-btn" onClick={add}>+ Adicionar patrocinador</button>}
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
      )}
    </React.Fragment>
  );
}
