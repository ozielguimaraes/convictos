/* ===== CARDÁPIO ON — admin (portado do cardapio-on p/ API própria) ===== */
import React, { useState, useEffect, useRef } from "react";
import { api } from "../../lib/api.js";
import { loadMenu, saveMenu, DEFAULT_MENU } from "../../lib/menu.js";
import { priceToStr, strToPrice } from "../../lib/format.js";
import Login from "../../components/Login.jsx";

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function uid() { return "item-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function Editor({ onLogout }) {
  const [draft, setDraft] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ msg: "", err: false });
  const toastTimer = useRef(null);

  useEffect(() => {
    loadMenu()
      .then((menu) => setDraft(menu.categorias.length ? menu : clone(DEFAULT_MENU)))
      .catch((e) => setLoadErr(e.message || String(e)));
  }, []);

  const showToast = (msg, isErr = false) => {
    setToast({ msg, err: isErr });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast({ msg: "", err: false }), 2400);
  };

  const update = (fn) => {
    setDraft((prev) => { const next = clone(prev); fn(next); return next; });
    setDirty(true);
  };

  const editItem = (ci, ii, field, value) => update((d) => { d.categorias[ci].itens[ii][field] = value; });
  const editPrice = (ci, ii, value) => update((d) => { d.categorias[ci].itens[ii].preco = strToPrice(value); });
  const delItem = (ci, ii) => update((d) => { d.categorias[ci].itens.splice(ii, 1); });
  const addItem = (ci) => update((d) => { d.categorias[ci].itens.push({ id: uid(), nome: "Novo item", desc: "", preco: 0 }); });
  const editCat = (ci, value) => update((d) => { d.categorias[ci].nome = value; });
  const delCat = (ci) => {
    if (!confirm("Remover esta categoria inteira e todos os seus itens?")) return;
    update((d) => { d.categorias.splice(ci, 1); });
  };
  const addCat = () => {
    const temas = ["verde-escuro", "laranja", "verde-claro"];
    update((d) => {
      d.categorias.push({
        id: "cat-" + Date.now().toString(36),
        nome: "Nova categoria",
        tema: temas[d.categorias.length % 3],
        itens: [],
      });
    });
  };

  const save = async () => {
    const cleaned = clone(draft);
    cleaned.categorias.forEach((c) => { c.itens = c.itens.filter((it) => it.nome && it.nome.trim()); });
    setSaving(true);
    try {
      await saveMenu(cleaned);
      setDraft(cleaned);
      setDirty(false);
      showToast("✓ Cardápio salvo!");
    } catch (e) {
      showToast("Erro ao salvar: " + (e.message || e), true);
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!confirm("Restaurar o cardápio para os preços originais? Suas alterações serão perdidas.")) return;
    setSaving(true);
    try {
      await saveMenu(DEFAULT_MENU);
      const menu = await loadMenu();
      setDraft(menu);
      setDirty(false);
      showToast("Cardápio restaurado ao original");
    } catch (e) {
      showToast("Erro ao restaurar: " + (e.message || e), true);
    } finally {
      setSaving(false);
    }
  };

  // avisa antes de sair com alterações não salvas
  useEffect(() => {
    const h = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  return (
    <React.Fragment>
      <header className="a-header">
        <span className="a-brand">Cardápio</span>
        <span className="a-tag">ON</span>
        <span className="a-title">Admin</span>
        <button className="a-logout" onClick={onLogout}>Sair</button>
      </header>

      <div className="a-body">
        <div className="a-note">
          <b>Como funciona:</b> tudo que você salvar aqui fica guardado <b>no servidor</b> e
          passa a aparecer <b>para todos os celulares</b> que abrirem o cardápio. As alterações
          valem na hora (o cardápio recarrega ao ser reaberto). Defina os preços <b>antes</b> de
          gerar o QR Code do evento.
        </div>

        {loadErr && <div className="a-note" style={{ background: "#fbe9e7", borderColor: "#f5c6cb", color: "#a02012" }}>Erro ao carregar: {loadErr}</div>}
        {!draft && !loadErr && <div className="a-loading">Carregando cardápio…</div>}

        {draft && draft.categorias.map((c, ci) => (
          <div className="cat-block" key={c.id}>
            <div className="cat-top">
              <span className={"cat-dot dot-" + c.tema}></span>
              <input className="cat-name-input" value={c.nome} onChange={(e) => editCat(ci, e.target.value)} />
              <button className="cat-del" onClick={() => delCat(ci)}>Remover</button>
            </div>

            {c.itens.map((it, ii) => (
              <div className="a-item" key={it.id}>
                <div className="names">
                  <input className="in-nome" value={it.nome} placeholder="Nome do item" onChange={(e) => editItem(ci, ii, "nome", e.target.value)} />
                  <input className="in-desc" value={it.desc || ""} placeholder="Descrição (opcional)" onChange={(e) => editItem(ci, ii, "desc", e.target.value)} />
                  <button
                    className={"soldout-toggle" + (it.esgotado ? " on" : "")}
                    onClick={() => editItem(ci, ii, "esgotado", !it.esgotado)}
                  >
                    {it.esgotado ? "✕ Esgotado" : "Marcar esgotado"}
                  </button>
                </div>
                <div className="price-wrap">
                  <span className="rs">R$</span>
                  <input
                    inputMode="decimal"
                    defaultValue={priceToStr(it.preco)}
                    key={it.id + "-" + it.preco}
                    onBlur={(e) => { editPrice(ci, ii, e.target.value); e.target.value = priceToStr(strToPrice(e.target.value)); }}
                    onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                  />
                </div>
                <button className="item-del" onClick={() => delItem(ci, ii)} aria-label="Remover item">🗑</button>
              </div>
            ))}

            <button className="add-item-btn" onClick={() => addItem(ci)}>+ Adicionar item em {c.nome || "categoria"}</button>
          </div>
        ))}

        {draft && <button className="add-cat-btn" onClick={addCat}>+ Adicionar nova categoria</button>}
      </div>

      {draft && (
        <div className="a-savebar">
          <button className="btn-reset" onClick={reset} disabled={saving}>Restaurar original</button>
          <button className={"btn-save" + (dirty ? "" : " saved")} onClick={save} disabled={!dirty || saving}>
            {saving ? "Salvando…" : dirty ? "Salvar alterações" : "Tudo salvo ✓"}
          </button>
        </div>
      )}

      <div className={"toast" + (toast.msg ? " show" : "") + (toast.err ? " err" : "")}>{toast.msg}</div>
    </React.Fragment>
  );
}

export default function Admin() {
  const [phase, setPhase] = useState("checking"); // checking | out | in

  useEffect(() => {
    api.get("/api/auth/me")
      .then(() => setPhase("in"))
      .catch(() => setPhase("out"));
  }, []);

  const logout = async () => {
    await api.post("/api/auth/logout");
    setPhase("out");
  };

  if (phase === "checking") return <div className="a-loading">Carregando…</div>;
  if (phase === "out") return <Login onOk={() => setPhase("in")} backHref="/cardapio/" backLabel="← Voltar ao cardápio" />;
  return <Editor onLogout={logout} />;
}
