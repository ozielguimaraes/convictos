/* ===== CONVICTOS — resposta pública de pesquisa de satisfação =====
   /pesquisa/<id> mostra o formulário (widget por tipo de pergunta) enquanto a
   pesquisa está ativa e dentro da janela de datas. Sem id, lista as pesquisas
   abertas. Consentimento (LGPD/GDPR) só aparece quando a pesquisa identifica
   o respondente; anônima não coleta nome/e-mail nem pede consentimento. */
import React, { useState, useEffect } from "react";
import { api } from "../lib/api.js";
import { applyTheme } from "../lib/theme.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STORAGE_PREFIX = "pesquisa_respondida_";

function extractId() {
  return location.pathname.match(/^\/pesquisa\/([0-9a-f-]{36})/i)?.[1] || null;
}

function isAnswered(pergunta, answer) {
  if (!answer) return false;
  if (pergunta.type === "opcoes") return Array.isArray(answer.option_ids) && answer.option_ids.length > 0;
  if (pergunta.type === "texto") return String(answer.text_value || "").trim().length > 0;
  return answer.numeric_value !== undefined && answer.numeric_value !== null;
}

function StarsInput({ value, onChange }) {
  return (
    <div className="pq-stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" className={"pq-star" + (value >= n ? " on" : "")}
          onClick={() => onChange(n)} aria-label={`${n} estrela${n === 1 ? "" : "s"}`}>
          {value >= n ? "★" : "☆"}
        </button>
      ))}
    </div>
  );
}

function ScaleInput({ max, value, onChange, minLabel, maxLabel }) {
  const nums = Array.from({ length: max + 1 }, (_, i) => i);
  return (
    <div>
      <div className="pq-scale">
        {nums.map((n) => (
          <button key={n} type="button" className={"pq-scale-btn" + (value === n ? " on" : "")} onClick={() => onChange(n)}>{n}</button>
        ))}
      </div>
      {(minLabel || maxLabel) && (
        <div className="pq-scale-labels"><span>{minLabel}</span><span>{maxLabel}</span></div>
      )}
    </div>
  );
}

function OptionsInput({ pergunta, value, onChange }) {
  const selected = Array.isArray(value) ? value : [];
  const toggle = (id) => {
    if (pergunta.multi) onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
    else onChange([id]);
  };
  return (
    <div className="pq-options">
      {pergunta.options.map((o) => (
        <label key={o.id} className={"pq-option" + (selected.includes(o.id) ? " on" : "")}>
          <input type={pergunta.multi ? "checkbox" : "radio"} name={pergunta.id}
            checked={selected.includes(o.id)} onChange={() => toggle(o.id)} />
          {o.text}
        </label>
      ))}
    </div>
  );
}

function Question({ pergunta, answer, onAnswer, invalid }) {
  return (
    <div className={"pq-question" + (invalid ? " invalid" : "")}>
      <div className="pq-question-text">{pergunta.text}{pergunta.required && <span className="pq-required">*</span>}</div>
      {pergunta.type === "estrelas5" && <StarsInput value={answer?.numeric_value || 0} onChange={(n) => onAnswer({ numeric_value: n })} />}
      {pergunta.type === "nota0a10" && <ScaleInput max={10} value={answer?.numeric_value} onChange={(n) => onAnswer({ numeric_value: n })} minLabel={pergunta.min_label} maxLabel={pergunta.max_label} />}
      {pergunta.type === "nota0a5" && <ScaleInput max={5} value={answer?.numeric_value} onChange={(n) => onAnswer({ numeric_value: n })} minLabel={pergunta.min_label} maxLabel={pergunta.max_label} />}
      {pergunta.type === "opcoes" && <OptionsInput pergunta={pergunta} value={answer?.option_ids} onChange={(ids) => onAnswer({ option_ids: ids })} />}
      {pergunta.type === "texto" && (
        <textarea className="pq-textarea" value={answer?.text_value || ""} onChange={(e) => onAnswer({ text_value: e.target.value })} placeholder="Escreva sua resposta…" />
      )}
      {invalid && <div className="pq-field-err">Resposta obrigatória</div>}
    </div>
  );
}

function Form({ pesquisa, onDone }) {
  const [answers, setAnswers] = useState({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const setAnswer = (perguntaId, patch) => setAnswers((a) => ({ ...a, [perguntaId]: { ...a[perguntaId], ...patch } }));

  const nameOk = pesquisa.identity_mode !== "obrigatorio" || name.trim().length > 0;
  const emailOk = pesquisa.identity_mode === "anonimo"
    ? true
    : pesquisa.identity_mode === "obrigatorio"
      ? EMAIL_RE.test(email.trim())
      : email.trim() === "" || EMAIL_RE.test(email.trim());
  const consentOk = pesquisa.identity_mode === "anonimo" || consent;
  const missingQuestions = pesquisa.perguntas.filter((p) => p.required && !isAnswered(p, answers[p.id]));
  const formOk = nameOk && emailOk && consentOk && missingQuestions.length === 0;

  const submit = async () => {
    setTouched(true);
    setError("");
    if (!formOk || submitting) return;
    setSubmitting(true);
    try {
      await api.post(`/api/pesquisas/${pesquisa.id}/responder`, {
        respondent_name: name.trim(),
        respondent_email: email.trim(),
        consent_given: consent,
        website,
        answers: pesquisa.perguntas.map((p) => ({ pergunta_id: p.id, ...answers[p.id] })),
      });
      try { localStorage.setItem(STORAGE_PREFIX + pesquisa.id, "1"); } catch (e) {}
      onDone();
    } catch (e) {
      setError(e.message || "Não foi possível enviar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <React.Fragment>
      <div className="title">{pesquisa.title}</div>
      {pesquisa.description && <p className="pq-desc">{pesquisa.description}</p>}

      {pesquisa.perguntas.map((p) => (
        <Question key={p.id} pergunta={p} answer={answers[p.id]}
          onAnswer={(patch) => setAnswer(p.id, patch)}
          invalid={touched && p.required && !isAnswered(p, answers[p.id])} />
      ))}

      {pesquisa.identity_mode !== "anonimo" && (
        <div className="pq-identity">
          <div className="pq-field">
            <label>Nome {pesquisa.identity_mode === "obrigatorio" && "*"}</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className={touched && !nameOk ? "pq-invalid" : ""} />
          </div>
          <div className="pq-field">
            <label>E-mail {pesquisa.identity_mode === "obrigatorio" && "*"}</label>
            <input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className={touched && !emailOk ? "pq-invalid" : ""} />
          </div>
          <label className="pq-consent">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              {pesquisa.privacy_notice || "Seus dados serão usados apenas para esta pesquisa."}
              {pesquisa.privacy_policy_url && <React.Fragment> — <a href={pesquisa.privacy_policy_url} target="_blank" rel="noreferrer">política de privacidade</a></React.Fragment>}
            </span>
          </label>
          {touched && !consentOk && <div className="pq-field-err">É necessário aceitar para enviar</div>}
        </div>
      )}
      {pesquisa.identity_mode === "anonimo" && (
        <p className="pq-anon-note">🔒 Esta resposta é anônima — nenhum dado pessoal é coletado.</p>
      )}

      <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)}
        className="pq-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" />

      {error && <div className="pq-field-err">{error}</div>}
      <button className="pq-submit" onClick={submit} disabled={submitting}>
        {submitting ? "Enviando…" : "Enviar resposta"}
      </button>
    </React.Fragment>
  );
}

function PesquisaPage({ id }) {
  const [state, setState] = useState({ status: "loading" });
  const [done, setDone] = useState(() => {
    try { return localStorage.getItem(STORAGE_PREFIX + id) === "1"; } catch (e) { return false; }
  });

  useEffect(() => {
    api.get(`/api/pesquisas/${id}`)
      .then((data) => setState({ status: "ready", data }))
      .catch(() => setState({ status: "error" }));
  }, [id]);

  if (state.status === "loading") return <div className="state-msg">Carregando…</div>;
  if (state.status === "error") {
    return <div className="state-msg"><span className="e-emoji">🔒</span>Esta pesquisa não está disponível no momento.</div>;
  }
  if (done) {
    return (
      <React.Fragment>
        <div className="state-msg"><span className="e-emoji">✅</span>{state.data.thank_you_message || "Obrigado por responder!"}</div>
        <button className="back-link pq-again" onClick={() => {
          try { localStorage.removeItem(STORAGE_PREFIX + id); } catch (e) {}
          setDone(false);
        }}>
          Responder novamente
        </button>
      </React.Fragment>
    );
  }
  return <Form pesquisa={state.data} onDone={() => setDone(true)} />;
}

function PublicList() {
  const [state, setState] = useState({ status: "loading", pesquisas: [] });

  useEffect(() => {
    api.get("/api/pesquisas/public")
      .then((pesquisas) => setState({ status: "ready", pesquisas }))
      .catch(() => setState({ status: "error", pesquisas: [] }));
  }, []);

  if (state.status === "loading") return <div className="state-msg">Carregando…</div>;
  if (state.status === "error") return <div className="state-msg"><span className="e-emoji">⚠️</span>Não foi possível carregar.</div>;
  if (state.pesquisas.length === 0) return <div className="state-msg"><span className="e-emoji">📋</span>Nenhuma pesquisa disponível no momento.</div>;
  return (
    <div className="links">
      {state.pesquisas.map((p) => (
        <a key={p.id} className="link-btn-card" href={`/pesquisa/${p.id}`}>
          <span className="link-emoji">📋</span>
          <span className="link-label">{p.title}</span>
        </a>
      ))}
    </div>
  );
}

export default function App() {
  const id = extractId();

  useEffect(() => {
    api.get("/api/profile").then((p) => applyTheme(p.theme)).catch(() => {});
  }, []);

  return (
    <div className="page">
      <div className="avisos-head">
        <a className="back-link" href="/">← Início</a>
        <h1>📋 Pesquisa</h1>
      </div>
      {id ? <PesquisaPage id={id} /> : <PublicList />}
    </div>
  );
}
