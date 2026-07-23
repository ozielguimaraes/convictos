/* Pesquisas de satisfação: pesquisa -> perguntas (com opções) -> respostas.
   Trava estrutural: com respostas, tipo/opções da pergunta e sua exclusão
   ficam bloqueados (o servidor recusa); "Duplicar pesquisa" é a saída. */
import React, { useState, useEffect } from "react";
import { api } from "../../lib/api.js";

const STATUS_LABELS = { rascunho: "Rascunho", ativa: "Ativa", encerrada: "Encerrada" };
const IDENTITY_LABELS = { anonimo: "Anônima", opcional: "Identificação opcional", obrigatorio: "Identificação obrigatória" };
const QUESTION_TYPES = [
  { value: "estrelas5", label: "⭐ Estrelas (1 a 5)" },
  { value: "nota0a10", label: "🔢 Nota de 0 a 10" },
  { value: "nota0a5", label: "🔢 Nota de 0 a 5" },
  { value: "opcoes", label: "☑️ Opções" },
  { value: "texto", label: "📝 Texto livre" },
];
const SCALE_TYPES = ["estrelas5", "nota0a10", "nota0a5"];
const DAYS_OPTIONS = [7, 14, 30, 90];
const SORT_OPTIONS = [
  { value: "data_desc", label: "Mais recentes primeiro" },
  { value: "data_asc", label: "Mais antigas primeiro" },
  { value: "nome_asc", label: "Nome A–Z" },
  { value: "nome_desc", label: "Nome Z–A" },
  { value: "nota_desc", label: "Maior nota primeiro" },
  { value: "nota_asc", label: "Menor nota primeiro" },
];

function toDatetimeLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function copyToClipboard(text, showToast) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("✓ Link copiado!");
  } catch (e) {
    showToast("Não foi possível copiar — copie manualmente: " + text, true);
  }
}

/* ---------- construtor de perguntas ---------- */

function PerguntaEditor({ pergunta, index, total, locked, canManage, onMove, onSaved, onDeleted, showToast }) {
  const [text, setText] = useState(pergunta.text);
  const [type, setType] = useState(pergunta.type);
  const [required, setRequired] = useState(pergunta.required);
  const [multi, setMulti] = useState(pergunta.multi);
  const [minLabel, setMinLabel] = useState(pergunta.min_label);
  const [maxLabel, setMaxLabel] = useState(pergunta.max_label);
  const [options, setOptions] = useState(() => {
    if (pergunta.type !== "opcoes") return [];
    return pergunta.options.length ? pergunta.options.map((o) => ({ ...o })) : [{ text: "" }, { text: "" }];
  });
  const [saving, setSaving] = useState(false);

  const changeType = (nextType) => {
    setType(nextType);
    if (nextType === "opcoes" && options.length === 0) setOptions([{ text: "" }, { text: "" }]);
  };

  const dirty = text !== pergunta.text || type !== pergunta.type || required !== pergunta.required
    || multi !== pergunta.multi || minLabel !== pergunta.min_label || maxLabel !== pergunta.max_label
    || JSON.stringify(options.map((o) => o.text)) !== JSON.stringify(pergunta.options.map((o) => o.text));

  const save = async () => {
    setSaving(true);
    try {
      const saved = await api.put(`/api/admin/perguntas/${pergunta.id}`, {
        text, type, required, multi, min_label: minLabel, max_label: maxLabel, options,
      });
      onSaved(saved);
      showToast("✓ Pergunta salva!");
    } catch (e) {
      showToast("Erro: " + e.message, true);
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!confirm(`Excluir a pergunta "${pergunta.text}"?`)) return;
    try {
      await api.del(`/api/admin/perguntas/${pergunta.id}`);
      onDeleted(pergunta);
    } catch (e) {
      showToast("Erro ao excluir: " + e.message, true);
    }
  };

  const addOption = () => setOptions((o) => [...o, { text: "" }]);
  const editOption = (i, v) => setOptions((o) => o.map((x, j) => (j === i ? { ...x, text: v } : x)));
  const delOption = (i) => setOptions((o) => o.filter((_, j) => j !== i));

  return (
    <div className="form-block">
      <div className="vendedor-top">
        <input className="in-nome pq-question-input" value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Texto da pergunta" disabled={!canManage} />
        {canManage && (
          <div className="row-actions pq-row-actions">
            <button className="icon-btn" disabled={index === 0} onClick={() => onMove(index, -1)} aria-label="Subir">↑</button>
            <button className="icon-btn" disabled={index === total - 1} onClick={() => onMove(index, 1)} aria-label="Descer">↓</button>
            {!locked && <button className="icon-btn danger" onClick={del} aria-label="Excluir pergunta">🗑</button>}
          </div>
        )}
      </div>
      <div className="pq-admin-row">
        <select className="perfil-select" value={type} onChange={(e) => changeType(e.target.value)} disabled={!canManage || locked}>
          {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button className={"pill-toggle" + (required ? " on" : "")} disabled={!canManage} onClick={() => setRequired(!required)}>
          {required ? "✓ Obrigatória" : "Opcional"}
        </button>
        {type === "opcoes" && (
          <button className={"pill-toggle" + (multi ? " on" : "")} disabled={!canManage} onClick={() => setMulti(!multi)}>
            {multi ? "☑️ Múltipla escolha" : "◉ Escolha única"}
          </button>
        )}
      </div>
      {SCALE_TYPES.includes(type) && (
        <div className="acao-grid" style={{ marginTop: 10 }}>
          <div className="form-field">
            <label>Rótulo do mínimo (opcional)</label>
            <input type="text" value={minLabel} onChange={(e) => setMinLabel(e.target.value)} disabled={!canManage} />
          </div>
          <div className="form-field">
            <label>Rótulo do máximo (opcional)</label>
            <input type="text" value={maxLabel} onChange={(e) => setMaxLabel(e.target.value)} disabled={!canManage} />
          </div>
        </div>
      )}
      {type === "opcoes" && (
        <div className="pq-admin-options">
          {options.map((o, i) => (
            <div key={o.id || "new-" + i} className="pq-admin-option-row">
              <input type="text" value={o.text} onChange={(e) => editOption(i, e.target.value)}
                placeholder={`Opção ${i + 1}`} disabled={!canManage || locked} />
              {canManage && !locked && options.length > 2 && (
                <button className="icon-btn danger" onClick={() => delOption(i)} aria-label="Remover opção">🗑</button>
              )}
            </div>
          ))}
          {canManage && !locked && <button className="add-item-btn" onClick={addOption}>+ Adicionar opção</button>}
        </div>
      )}
      {canManage && (
        <div className="pq-admin-actions">
          <button className="btn-small-save" onClick={save} disabled={!dirty || saving}>
            {saving ? "Salvando…" : dirty ? "Salvar" : "Salvo ✓"}
          </button>
        </div>
      )}
    </div>
  );
}

function NewPerguntaForm({ pesquisaId, onAdded, showToast }) {
  const [text, setText] = useState("");
  const [type, setType] = useState("estrelas5");
  const [required, setRequired] = useState(false);
  const [multi, setMulti] = useState(false);
  const [minLabel, setMinLabel] = useState("");
  const [maxLabel, setMaxLabel] = useState("");
  const [options, setOptions] = useState([{ text: "" }, { text: "" }]);
  const [adding, setAdding] = useState(false);

  const addOption = () => setOptions((o) => [...o, { text: "" }]);
  const editOption = (i, v) => setOptions((o) => o.map((x, j) => (j === i ? { text: v } : x)));
  const delOption = (i) => setOptions((o) => o.filter((_, j) => j !== i));

  const add = async () => {
    if (!text.trim()) { showToast("Texto da pergunta obrigatório", true); return; }
    setAdding(true);
    try {
      const created = await api.post(`/api/admin/pesquisas/${pesquisaId}/perguntas`, {
        text: text.trim(), type, required, multi, min_label: minLabel, max_label: maxLabel, options,
      });
      onAdded(created);
      setText(""); setType("estrelas5"); setRequired(false); setMulti(false);
      setMinLabel(""); setMaxLabel(""); setOptions([{ text: "" }, { text: "" }]);
      showToast("✓ Pergunta adicionada!");
    } catch (e) {
      showToast("Erro: " + e.message, true);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="form-block">
      <h3>Nova pergunta</h3>
      <div className="form-field">
        <input type="text" value={text} placeholder="Texto da pergunta" onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="pq-admin-row">
        <select className="perfil-select" value={type} onChange={(e) => setType(e.target.value)}>
          {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button className={"pill-toggle" + (required ? " on" : "")} onClick={() => setRequired(!required)}>
          {required ? "✓ Obrigatória" : "Opcional"}
        </button>
        {type === "opcoes" && (
          <button className={"pill-toggle" + (multi ? " on" : "")} onClick={() => setMulti(!multi)}>
            {multi ? "☑️ Múltipla escolha" : "◉ Escolha única"}
          </button>
        )}
      </div>
      {SCALE_TYPES.includes(type) && (
        <div className="acao-grid" style={{ marginTop: 10 }}>
          <div className="form-field">
            <label>Rótulo do mínimo (opcional)</label>
            <input type="text" value={minLabel} onChange={(e) => setMinLabel(e.target.value)} />
          </div>
          <div className="form-field">
            <label>Rótulo do máximo (opcional)</label>
            <input type="text" value={maxLabel} onChange={(e) => setMaxLabel(e.target.value)} />
          </div>
        </div>
      )}
      {type === "opcoes" && (
        <div className="pq-admin-options">
          {options.map((o, i) => (
            <div key={i} className="pq-admin-option-row">
              <input type="text" value={o.text} onChange={(e) => editOption(i, e.target.value)} placeholder={`Opção ${i + 1}`} />
              {options.length > 2 && <button className="icon-btn danger" onClick={() => delOption(i)} aria-label="Remover opção">🗑</button>}
            </div>
          ))}
          <button className="add-item-btn" onClick={addOption}>+ Adicionar opção</button>
        </div>
      )}
      <button className="add-cat-btn" onClick={add} disabled={adding} style={{ marginTop: 12 }}>
        {adding ? "Adicionando…" : "+ Adicionar pergunta"}
      </button>
    </div>
  );
}

/* ---------- formulário da pesquisa (meta) ---------- */

function toFormState(p) {
  return {
    title: p.title, description: p.description, status: p.status, identity_mode: p.identity_mode,
    one_response_per_email: p.one_response_per_email,
    starts_at: toDatetimeLocal(p.starts_at), ends_at: toDatetimeLocal(p.ends_at),
    thank_you_message: p.thank_you_message, privacy_notice: p.privacy_notice,
    privacy_policy_url: p.privacy_policy_url, retention_days: p.retention_days ?? "",
  };
}

function MetaForm({ pesquisa, canManage, onSaved, showToast }) {
  const [form, setForm] = useState(() => toFormState(pesquisa));
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(toFormState(pesquisa)); }, [pesquisa.id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = JSON.stringify(form) !== JSON.stringify(toFormState(pesquisa));

  const save = async () => {
    setSaving(true);
    try {
      const saved = await api.put(`/api/admin/pesquisas/${pesquisa.id}`, {
        ...form,
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
        retention_days: form.retention_days === "" ? null : Number(form.retention_days),
      });
      onSaved(saved);
      showToast("✓ Pesquisa salva!");
    } catch (e) {
      showToast("Erro: " + e.message, true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="form-block">
      <fieldset className="ro-fieldset" disabled={!canManage}>
        <div className="form-field">
          <label>Título</label>
          <input type="text" value={form.title} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div className="form-field">
          <label>Descrição</label>
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        <div className="acao-grid">
          <div className="form-field">
            <label>Status</label>
            <select className="perfil-select" value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="rascunho">Rascunho</option>
              <option value="ativa">Ativa</option>
              <option value="encerrada">Encerrada</option>
            </select>
          </div>
          <div className="form-field">
            <label>Identificação</label>
            <select className="perfil-select" value={form.identity_mode} onChange={(e) => set("identity_mode", e.target.value)}>
              <option value="anonimo">Anônima</option>
              <option value="opcional">Opcional</option>
              <option value="obrigatorio">Obrigatória</option>
            </select>
          </div>
        </div>
        {form.identity_mode !== "anonimo" && (
          <button className={"pill-toggle" + (form.one_response_per_email ? " on" : "")} style={{ marginBottom: 12 }}
            onClick={() => set("one_response_per_email", !form.one_response_per_email)}>
            {form.one_response_per_email ? "✓ Uma resposta por e-mail" : "Permitir várias respostas por e-mail"}
          </button>
        )}
        <div className="acao-grid">
          <div className="form-field">
            <label>Início (opcional)</label>
            <input type="datetime-local" value={form.starts_at} onChange={(e) => set("starts_at", e.target.value)} />
          </div>
          <div className="form-field">
            <label>Término (opcional)</label>
            <input type="datetime-local" value={form.ends_at} onChange={(e) => set("ends_at", e.target.value)} />
          </div>
        </div>
        <div className="form-field">
          <label>Mensagem de agradecimento</label>
          <textarea value={form.thank_you_message} onChange={(e) => set("thank_you_message", e.target.value)} />
        </div>
        {form.identity_mode !== "anonimo" && (
          <React.Fragment>
            <div className="a-note">
              ⚠️ Como esta pesquisa identifica o respondente, ela coleta dado pessoal (LGPD/GDPR). O
              aviso de privacidade é mostrado no ponto de coleta e precisa ser aceito antes do envio.
            </div>
            <div className="form-field">
              <label>Aviso de privacidade (finalidade do uso dos dados)</label>
              <textarea value={form.privacy_notice} onChange={(e) => set("privacy_notice", e.target.value)} />
            </div>
            <div className="form-field">
              <label>Link da política de privacidade (opcional)</label>
              <input type="text" value={form.privacy_policy_url} onChange={(e) => set("privacy_policy_url", e.target.value)} />
            </div>
            <div className="form-field">
              <label>Retenção — excluir respostas após quantos dias (opcional)</label>
              <input type="text" inputMode="numeric" value={form.retention_days}
                onChange={(e) => set("retention_days", e.target.value.replace(/\D/g, ""))} />
            </div>
          </React.Fragment>
        )}
      </fieldset>
      {canManage && (
        <button className="btn-small-save" onClick={save} disabled={!dirty || saving} style={{ marginTop: 4 }}>
          {saving ? "Salvando…" : dirty ? "Salvar" : "Salvo ✓"}
        </button>
      )}
    </div>
  );
}

/* ---------- relatório ---------- */

function QuestionReport({ q }) {
  return (
    <div className="pq-report-question">
      <div className="pq-report-question-head">
        <b>{q.text}</b>
        <span className="pq-report-completion">{q.answered} resposta{q.answered === 1 ? "" : "s"} · {Math.round(q.completion_rate * 100)}% de conclusão</span>
      </div>
      {SCALE_TYPES.includes(q.type) && (
        <React.Fragment>
          <div className="pq-report-avg">Média: <b>{q.average != null ? q.average.toFixed(2) : "—"}</b></div>
          <div className="pq-dist">
            {q.distribution.map((d) => (
              <div key={d.numeric_value} className="pq-dist-row">
                <span className="pq-dist-label">{d.numeric_value}</span>
                <div className="pq-dist-bar"><div className="pq-dist-fill" style={{ width: `${q.answered ? (d.count / q.answered) * 100 : 0}%` }} /></div>
                <span className="pq-dist-count">{d.count}</span>
              </div>
            ))}
          </div>
          {q.nps && (
            <div className="pq-nps">
              <span>NPS: <b>{q.nps.score ?? "—"}</b></span>
              <span className="pq-nps-detail">Promotores {q.nps.promoters} · Neutros {q.nps.passives} · Detratores {q.nps.detractors}</span>
            </div>
          )}
        </React.Fragment>
      )}
      {q.type === "opcoes" && (
        <div className="pq-dist">
          {q.options.map((o) => (
            <div key={o.id} className="pq-dist-row">
              <span className="pq-dist-label">{o.text}</span>
              <div className="pq-dist-bar"><div className="pq-dist-fill" style={{ width: `${q.answered ? (o.count / q.answered) * 100 : 0}%` }} /></div>
              <span className="pq-dist-count">{o.count}</span>
            </div>
          ))}
        </div>
      )}
      {q.type === "texto" && (
        q.answers.length === 0 ? (
          <p className="pq-report-empty">Nenhuma resposta de texto ainda.</p>
        ) : (
          <div className="pq-text-answers">
            {q.answers.map((a, i) => (
              <div key={i} className="pq-text-answer">
                <span>{a.text_value}</span>
                <span className="pq-text-answer-date">{new Date(a.submitted_at).toLocaleString("pt-BR")}</span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function ReportTab({ pesquisa, showToast }) {
  const [days, setDays] = useState(30);
  const [report, setReport] = useState(null);
  const [sort, setSort] = useState("data_desc");
  const [email, setEmail] = useState("");
  const [respostas, setRespostas] = useState(null);
  const [purging, setPurging] = useState(false);

  useEffect(() => {
    setReport(null);
    api.get(`/api/admin/pesquisas/${pesquisa.id}/report?days=${days}`).then(setReport)
      .catch((e) => showToast("Erro ao carregar relatório: " + e.message, true));
  }, [days, pesquisa.id]);

  const loadRespostas = () => {
    const params = new URLSearchParams({ sort });
    if (email.trim()) params.set("email", email.trim());
    api.get(`/api/admin/pesquisas/${pesquisa.id}/respostas?${params}`).then(setRespostas)
      .catch((e) => showToast("Erro ao carregar respostas: " + e.message, true));
  };
  useEffect(loadRespostas, [sort, pesquisa.id]);

  const delResposta = async (r) => {
    if (!confirm("Excluir esta resposta? Não pode ser desfeito.")) return;
    try {
      await api.del(`/api/admin/respostas/${r.id}`);
      setRespostas((list) => list.filter((x) => x.id !== r.id));
      showToast("✓ Resposta excluída!");
    } catch (e) {
      showToast("Erro: " + e.message, true);
    }
  };

  const purge = async () => {
    const suggested = pesquisa.retention_days || 90;
    const answer = prompt("Excluir respostas mais antigas que quantos dias?", String(suggested));
    if (answer === null) return;
    const purgeDays = parseInt(answer, 10);
    if (!purgeDays || purgeDays < 1) { showToast("Quantidade de dias inválida", true); return; }
    setPurging(true);
    try {
      const res = await api.post(`/api/admin/pesquisas/${pesquisa.id}/expurgar`, { days: purgeDays });
      showToast(`✓ ${res.deleted} resposta(s) removida(s).`);
      loadRespostas();
    } catch (e) {
      showToast("Erro: " + e.message, true);
    } finally {
      setPurging(false);
    }
  };

  return (
    <React.Fragment>
      <div className="form-block">
        <div className="sp-report-head">
          <h3>Métricas</h3>
          <div className="sp-report-actions">
            <select className="perfil-select sp-days-select" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {DAYS_OPTIONS.map((d) => <option key={d} value={d}>Últimos {d} dias</option>)}
            </select>
            <a className="btn-export" href={`/api/admin/pesquisas/${pesquisa.id}/report.csv`}>⬇️ Exportar CSV</a>
          </div>
        </div>

        {!report ? (
          <div className="a-loading">Carregando métricas…</div>
        ) : (
          <React.Fragment>
            <p className="sp-report-total">📋 <strong>{report.totalResponses}</strong> resposta{report.totalResponses === 1 ? "" : "s"} no total</p>

            {report.questions.length === 0 ? (
              <p>Nenhuma pergunta cadastrada ainda.</p>
            ) : (
              report.questions.map((q) => <QuestionReport key={q.id} q={q} />)
            )}

            <h3 className="sp-report-subhead">Respostas por dia</h3>
            <div className="sp-report-table-wrap sp-daily-visits">
              {report.dailyResponses.map((d) => (
                <div key={d.date} className="sp-day-bar" title={`${d.date}: ${d.responses} resposta(s)`}>
                  <div className="sp-day-bar-fill" style={{ height: `${Math.min(100, d.responses * 12 + (d.responses > 0 ? 8 : 2))}%` }} />
                  <span className="sp-day-bar-label">{d.date.slice(8)}</span>
                </div>
              ))}
            </div>
          </React.Fragment>
        )}
      </div>

      <div className="form-block">
        <div className="sp-report-head">
          <h3>Respostas individuais</h3>
          <div className="sp-report-actions">
            <button className="btn-small-save" onClick={purge} disabled={purging}>
              {purging ? "Expurgando…" : "🗑 Expurgar por retenção"}
            </button>
          </div>
        </div>
        <div className="pq-resp-filters">
          <select className="perfil-select" value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <input type="text" placeholder="Buscar por e-mail…" value={email} onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadRespostas()} />
          <button className="btn-small-save" onClick={loadRespostas}>Buscar</button>
        </div>
        {!respostas ? (
          <div className="a-loading">Carregando respostas…</div>
        ) : respostas.length === 0 ? (
          <p>Nenhuma resposta encontrada.</p>
        ) : (
          <div className="sp-report-table-wrap">
            <table className="sp-report-table">
              <thead>
                <tr>
                  <th>Data/hora</th><th>Nome</th><th>E-mail</th>
                  {pesquisa.perguntas.map((p) => <th key={p.id}>{p.text}</th>)}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {respostas.map((r) => (
                  <tr key={r.id}>
                    <td>{new Date(r.submitted_at).toLocaleString("pt-BR")}</td>
                    <td>{r.respondent_name || "—"}</td>
                    <td>{r.respondent_email || "—"}</td>
                    {pesquisa.perguntas.map((p) => {
                      const it = r.items.find((x) => x.pergunta_id === p.id);
                      const val = !it ? "—" : p.type === "opcoes" ? (it.option_texts || []).join("; ") : p.type === "texto" ? it.text_value : it.numeric_value;
                      return <td key={p.id}>{val}</td>;
                    })}
                    <td><button className="icon-btn danger" onClick={() => delResposta(r)} aria-label="Excluir resposta">🗑</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </React.Fragment>
  );
}

/* ---------- detalhe da pesquisa ---------- */

function PesquisaDetail({ id, canManage, onBack, showToast }) {
  const [pesquisa, setPesquisa] = useState(null);
  const [tab, setTab] = useState("editar");
  const [duplicating, setDuplicating] = useState(false);

  const load = () => api.get(`/api/admin/pesquisas/${id}`).then(setPesquisa).catch((e) => showToast("Erro ao carregar: " + e.message, true));
  useEffect(() => { load(); }, [id]);

  if (!pesquisa) return <div className="a-loading">Carregando pesquisa…</div>;

  const locked = pesquisa.response_count > 0;
  const publicUrl = `${location.origin}/pesquisa/${pesquisa.id}`;
  const setPerguntas = (fn) => setPesquisa((p) => ({ ...p, perguntas: fn(p.perguntas) }));

  const movePergunta = async (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= pesquisa.perguntas.length) return;
    const reordered = [...pesquisa.perguntas];
    [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
    setPerguntas(() => reordered);
    try {
      await api.put(`/api/admin/pesquisas/${pesquisa.id}/perguntas/reorder`, reordered.map((p) => p.id));
    } catch (e) {
      showToast("Erro ao reordenar: " + e.message, true);
    }
  };

  const duplicate = async () => {
    setDuplicating(true);
    try {
      const created = await api.post("/api/admin/pesquisas", {
        title: pesquisa.title + " (cópia)", description: pesquisa.description, status: "rascunho",
        identity_mode: pesquisa.identity_mode, one_response_per_email: pesquisa.one_response_per_email,
        starts_at: null, ends_at: null, thank_you_message: pesquisa.thank_you_message,
        privacy_notice: pesquisa.privacy_notice, privacy_policy_url: pesquisa.privacy_policy_url,
        retention_days: pesquisa.retention_days,
      });
      for (const p of pesquisa.perguntas) {
        await api.post(`/api/admin/pesquisas/${created.id}/perguntas`, {
          text: p.text, type: p.type, required: p.required, multi: p.multi,
          min_label: p.min_label, max_label: p.max_label, options: p.options,
        });
      }
      showToast("✓ Pesquisa duplicada como rascunho!");
      onBack();
    } catch (e) {
      showToast("Erro ao duplicar: " + e.message, true);
    } finally {
      setDuplicating(false);
    }
  };

  return (
    <React.Fragment>
      <button className="link-btn back-btn" onClick={onBack}>← Todas as pesquisas</button>

      <div className="pq-link-bar">
        <button className="btn-export" onClick={() => copyToClipboard(publicUrl, showToast)}>🔗 Copiar link</button>
        <a className="btn-export" href={`/pesquisa/${pesquisa.id}`} target="_blank" rel="noreferrer">👁 Pré-visualizar</a>
      </div>

      <div className="sp-tabs">
        <button className={"sp-tab" + (tab === "editar" ? " active" : "")} onClick={() => setTab("editar")}>Editar</button>
        <button className={"sp-tab" + (tab === "relatorio" ? " active" : "")} onClick={() => setTab("relatorio")}>📊 Relatório</button>
      </div>

      {tab === "relatorio" ? (
        <ReportTab pesquisa={pesquisa} showToast={showToast} />
      ) : (
        <React.Fragment>
          <MetaForm pesquisa={pesquisa} canManage={canManage} showToast={showToast}
            onSaved={(saved) => setPesquisa((p) => ({ ...p, ...saved }))} />

          {locked && (
            <div className="ro-note">
              🔒 Esta pesquisa já tem respostas — tipo/opções das perguntas e a exclusão de perguntas
              ficam travados para manter o relatório íntegro.
              {canManage && (
                <button className="btn-small-save pq-dup-btn" onClick={duplicate} disabled={duplicating}>
                  {duplicating ? "Duplicando…" : "Duplicar pesquisa"}
                </button>
              )}
            </div>
          )}

          {pesquisa.perguntas.map((p, i) => (
            <PerguntaEditor key={p.id} pergunta={p} index={i} total={pesquisa.perguntas.length}
              locked={locked} canManage={canManage} onMove={movePergunta}
              onSaved={(saved) => setPerguntas((list) => list.map((x) => (x.id === saved.id ? saved : x)))}
              onDeleted={(deleted) => setPerguntas((list) => list.filter((x) => x.id !== deleted.id))}
              showToast={showToast} />
          ))}

          {canManage && (
            <NewPerguntaForm pesquisaId={pesquisa.id}
              onAdded={(created) => setPerguntas((list) => [...list, created])}
              showToast={showToast} />
          )}
        </React.Fragment>
      )}
    </React.Fragment>
  );
}

/* ---------- lista de pesquisas ---------- */

const emptyDraft = () => ({
  title: "", description: "", identity_mode: "anonimo", one_response_per_email: false,
  starts_at: "", ends_at: "", thank_you_message: "Obrigado por responder!",
  privacy_notice: "", privacy_policy_url: "", retention_days: "",
});

export default function PesquisasSection({ canManage, showToast }) {
  const [pesquisas, setPesquisas] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/api/admin/pesquisas").then(setPesquisas).catch((e) => showToast("Erro ao carregar: " + e.message, true));
  useEffect(() => { load(); }, []);

  if (openId) return <PesquisaDetail id={openId} canManage={canManage} onBack={() => { setOpenId(null); load(); }} showToast={showToast} />;
  if (!pesquisas) return <div className="a-loading">Carregando pesquisas…</div>;

  const create = async () => {
    if (!draft.title.trim()) { showToast("Título obrigatório", true); return; }
    setSaving(true);
    try {
      const created = await api.post("/api/admin/pesquisas", {
        ...draft,
        starts_at: draft.starts_at || null,
        ends_at: draft.ends_at || null,
        retention_days: draft.retention_days === "" ? null : Number(draft.retention_days),
      });
      setDraft(emptyDraft());
      setPesquisas((list) => [created, ...list]);
      showToast("✓ Pesquisa criada!");
    } catch (e) {
      showToast("Erro ao criar: " + e.message, true);
    } finally {
      setSaving(false);
    }
  };

  const del = async (p) => {
    if (!confirm(`Excluir a pesquisa "${p.title}" e todas as respostas?`)) return;
    try {
      await api.del(`/api/admin/pesquisas/${p.id}`);
      setPesquisas((list) => list.filter((x) => x.id !== p.id));
      showToast("✓ Pesquisa excluída!");
    } catch (e) {
      showToast("Erro ao excluir: " + e.message, true);
    }
  };

  return (
    <React.Fragment>
      {pesquisas.length === 0 && <div className="a-loading">Nenhuma pesquisa ainda. Crie a primeira abaixo.</div>}
      {pesquisas.map((p) => (
        <div className="form-block acao-card" key={p.id}>
          <div className="vendedor-top">
            <h3>{p.title} <span className={"pq-status pq-status-" + p.status}>{STATUS_LABELS[p.status]}</span></h3>
            {canManage && <button className="cat-del" onClick={() => del(p)}>Excluir</button>}
          </div>
          <div className="aviso-meta" style={{ marginTop: 0, marginBottom: 10 }}>
            {p.question_count} pergunta{p.question_count === 1 ? "" : "s"} · {p.response_count} resposta{p.response_count === 1 ? "" : "s"} · {IDENTITY_LABELS[p.identity_mode]}
          </div>
          <div className="aviso-actions" style={{ marginTop: 0 }}>
            <button className="add-item-btn pq-open-btn" onClick={() => setOpenId(p.id)}>Abrir →</button>
            <button className="btn-export" onClick={() => copyToClipboard(`${location.origin}/pesquisa/${p.id}`, showToast)}>🔗 Copiar link</button>
          </div>
        </div>
      ))}

      {canManage && (
        <div className="form-block">
          <h3>Nova pesquisa</h3>
          <div className="form-field">
            <label>Título</label>
            <input type="text" value={draft.title} placeholder="Ex.: Pesquisa de satisfação do evento"
              onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </div>
          <div className="form-field">
            <label>Descrição (opcional)</label>
            <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>
          <div className="form-field">
            <label>Identificação do respondente</label>
            <select className="perfil-select" value={draft.identity_mode} onChange={(e) => setDraft({ ...draft, identity_mode: e.target.value })}>
              <option value="anonimo">Anônima</option>
              <option value="opcional">Opcional</option>
              <option value="obrigatorio">Obrigatória</option>
            </select>
          </div>
          {draft.identity_mode !== "anonimo" && (
            <button className={"pill-toggle" + (draft.one_response_per_email ? " on" : "")} style={{ marginBottom: 12 }}
              onClick={() => setDraft({ ...draft, one_response_per_email: !draft.one_response_per_email })}>
              {draft.one_response_per_email ? "✓ Uma resposta por e-mail" : "Permitir várias respostas por e-mail"}
            </button>
          )}
          <div className="acao-grid">
            <div className="form-field">
              <label>Início (opcional)</label>
              <input type="datetime-local" value={draft.starts_at} onChange={(e) => setDraft({ ...draft, starts_at: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Término (opcional)</label>
              <input type="datetime-local" value={draft.ends_at} onChange={(e) => setDraft({ ...draft, ends_at: e.target.value })} />
            </div>
          </div>
          <div className="form-field">
            <label>Mensagem de agradecimento</label>
            <textarea value={draft.thank_you_message} onChange={(e) => setDraft({ ...draft, thank_you_message: e.target.value })} />
          </div>
          {draft.identity_mode !== "anonimo" && (
            <React.Fragment>
              <div className="a-note">
                ⚠️ Como esta pesquisa identifica o respondente, ela coleta dado pessoal (LGPD/GDPR).
                Descreva a finalidade no aviso de privacidade — ele é mostrado no ponto de coleta e o
                respondente precisa aceitar antes de enviar.
              </div>
              <div className="form-field">
                <label>Aviso de privacidade (finalidade do uso dos dados)</label>
                <textarea value={draft.privacy_notice} onChange={(e) => setDraft({ ...draft, privacy_notice: e.target.value })} />
              </div>
              <div className="form-field">
                <label>Link da política de privacidade (opcional)</label>
                <input type="text" value={draft.privacy_policy_url} onChange={(e) => setDraft({ ...draft, privacy_policy_url: e.target.value })} />
              </div>
              <div className="form-field">
                <label>Retenção — excluir respostas após quantos dias (opcional)</label>
                <input type="text" inputMode="numeric" value={draft.retention_days}
                  onChange={(e) => setDraft({ ...draft, retention_days: e.target.value.replace(/\D/g, "") })} />
              </div>
            </React.Fragment>
          )}
          <button className="add-cat-btn" onClick={create} disabled={saving}>
            {saving ? "Criando…" : "+ Criar pesquisa"}
          </button>
        </div>
      )}
    </React.Fragment>
  );
}
