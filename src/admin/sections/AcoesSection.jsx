/* Ações entre amigos: cadastro de ações, vendedores e blocos de números.
   Ciclo do bloco: o vendedor pega (deve o bloco inteiro) → entrega e o acerto
   passa a ser sobre o vendido (pago, parcial ou não pago). Pendente é sempre
   calculado: (entregue ? vendidos : bloco inteiro) × valor − recebido. */
import React, { useState, useEffect } from "react";
import { api } from "../../lib/api.js";
import { fmt, strToPrice } from "../../lib/format.js";

const blockLabel = (b, size) => `${b.start_number}–${b.start_number + size - 1}`;

function blockPending(acao, returned, soldCount, received) {
  const owed = (returned ? soldCount : acao.block_size) * acao.number_price;
  return Math.max(0, owed - received);
}

function Totais({ sold, received, pending }) {
  return (
    <div className="stat-row">
      <div className="stat"><span className="stat-label">Vendido</span><b>{fmt(sold)}</b></div>
      <div className="stat"><span className="stat-label">Recebido</span><b>{fmt(received)}</b></div>
      <div className={"stat" + (pending > 0.004 ? " warn" : " ok")}>
        <span className="stat-label">Pendente</span>
        <b>{pending > 0.004 ? fmt(pending) : "✓ acertado"}</b>
      </div>
    </div>
  );
}

/* ---------- bloco (linha editável) ---------- */

function BlocoRow({ acao, block, onSaved, onDeleted, showToast }) {
  const [sold, setSold] = useState(String(block.sold_count));
  const [received, setReceived] = useState(block.received ? String(block.received).replace(".", ",") : "");
  const [returned, setReturned] = useState(block.returned);
  const [saving, setSaving] = useState(false);

  const soldN = Math.min(Math.max(parseInt(sold, 10) || 0, 0), acao.block_size);
  const receivedN = strToPrice(received);
  const dirty = soldN !== block.sold_count || returned !== block.returned || Math.abs(receivedN - block.received) > 0.004;
  const soldValue = soldN * acao.number_price;
  const pending = blockPending(acao, returned, soldN, receivedN);

  const payStatus = !returned
    ? null
    : receivedN <= 0.004
      ? "não pago"
      : pending > 0.004
        ? "pagamento parcial"
        : "pago ✓";

  const save = async () => {
    setSaving(true);
    try {
      const saved = await api.put(`/api/admin/blocks/${block.id}`, {
        start_number: block.start_number,
        sold_count: soldN,
        received: receivedN,
        returned,
      });
      onSaved(saved);
      showToast("✓ Bloco salvo!");
    } catch (e) {
      showToast("Erro ao salvar: " + e.message, true);
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!confirm(`Excluir o bloco ${blockLabel(block, acao.block_size)}?`)) return;
    try {
      await api.del(`/api/admin/blocks/${block.id}`);
      onDeleted(block);
    } catch (e) {
      showToast("Erro ao excluir: " + e.message, true);
    }
  };

  return (
    <div className="bloco-row">
      <div className="bloco-nums">
        <b>{blockLabel(block, acao.block_size)}</b>
        <button className={"pill-toggle" + (returned ? " on" : "")} onClick={() => setReturned(!returned)}>
          {returned ? "✓ Entregue" : "📦 Com o vendedor"}
        </button>
        <button className="icon-btn danger" onClick={del} aria-label="Excluir bloco">🗑</button>
      </div>
      <div className="bloco-fields">
        <label>
          Vendidos
          <input type="number" min={0} max={acao.block_size} inputMode="numeric" value={sold}
            onChange={(e) => setSold(e.target.value)} />
          <span className="bloco-hint">de {acao.block_size}</span>
        </label>
        <label>
          Recebido R$
          <input type="text" inputMode="decimal" placeholder="0,00" value={received}
            onChange={(e) => setReceived(e.target.value)} />
        </label>
      </div>
      <div className="bloco-calc">
        <span>Vendido: <b>{fmt(soldValue)}</b></span>
        {payStatus && <span className={payStatus === "pago ✓" ? "ok" : "pend"}>{payStatus}</span>}
        <span className={pending > 0.004 ? "pend" : "ok"}>
          {pending > 0.004
            ? <>Pendente: <b>{fmt(pending)}</b>{!returned && " (bloco com o vendedor)"}</>
            : "✓ acertado"}
        </span>
        <button className="btn-small-save" onClick={save} disabled={!dirty || saving}>
          {saving ? "Salvando…" : dirty ? "Salvar" : "Salvo ✓"}
        </button>
      </div>
    </div>
  );
}

/* ---------- vendedor ---------- */

function VendedorCard({ acao, seller, onChanged, showToast }) {
  const [adding, setAdding] = useState(false);

  const soldValue = seller.blocks.reduce((s, b) => s + b.sold_count * acao.number_price, 0);
  const received = seller.blocks.reduce((s, b) => s + b.received, 0);
  const pending = seller.blocks.reduce((s, b) => s + blockPending(acao, b.returned, b.sold_count, b.received), 0);

  // Sugere o próximo início livre: maior início da ação + tamanho do bloco.
  const addBlock = async () => {
    const allStarts = acao.sellers.flatMap((s) => s.blocks.map((b) => b.start_number));
    const suggested = allStarts.length ? Math.max(...allStarts) + acao.block_size : 1;
    const answer = prompt("Número inicial do bloco:", String(suggested));
    if (answer === null) return;
    const start = parseInt(answer, 10);
    if (!start || start < 1) { showToast("Número inicial inválido", true); return; }
    setAdding(true);
    try {
      const created = await api.post(`/api/admin/sellers/${seller.id}/blocks`, { start_number: start });
      onChanged((sellers) => sellers.map((s) => (s.id === seller.id ? { ...s, blocks: [...s.blocks, created].sort((a, b) => a.start_number - b.start_number) } : s)));
      showToast(`✓ Bloco ${start}–${start + acao.block_size - 1} adicionado!`);
    } catch (e) {
      showToast("Erro: " + e.message, true);
    } finally {
      setAdding(false);
    }
  };

  const rename = async () => {
    const name = prompt("Nome do vendedor:", seller.name);
    if (!name || name.trim() === seller.name) return;
    try {
      const saved = await api.put(`/api/admin/sellers/${seller.id}`, { name: name.trim() });
      onChanged((sellers) => sellers.map((s) => (s.id === seller.id ? { ...s, name: saved.name } : s)));
    } catch (e) {
      showToast("Erro: " + e.message, true);
    }
  };

  const del = async () => {
    if (!confirm(`Excluir ${seller.name} e todos os seus blocos?`)) return;
    try {
      await api.del(`/api/admin/sellers/${seller.id}`);
      onChanged((sellers) => sellers.filter((s) => s.id !== seller.id));
      showToast("✓ Vendedor excluído!");
    } catch (e) {
      showToast("Erro ao excluir: " + e.message, true);
    }
  };

  const onBlockSaved = (saved) => {
    onChanged((sellers) => sellers.map((s) => (s.id === seller.id ? { ...s, blocks: s.blocks.map((b) => (b.id === saved.id ? saved : b)) } : s)));
  };
  const onBlockDeleted = (deleted) => {
    onChanged((sellers) => sellers.map((s) => (s.id === seller.id ? { ...s, blocks: s.blocks.filter((b) => b.id !== deleted.id) } : s)));
  };

  return (
    <div className="form-block vendedor">
      <div className="vendedor-top">
        <h3 onClick={rename} title="Toque para renomear">{seller.name}</h3>
        <button className="cat-del" onClick={del}>Excluir</button>
      </div>
      <Totais sold={soldValue} received={received} pending={pending} />
      {seller.blocks.length === 0 && <div className="vendedor-empty">Nenhum bloco ainda.</div>}
      {seller.blocks.map((b) => (
        <BlocoRow key={b.id} acao={acao} block={b} onSaved={onBlockSaved} onDeleted={onBlockDeleted} showToast={showToast} />
      ))}
      <button className="add-item-btn" onClick={addBlock} disabled={adding}>
        {adding ? "Adicionando…" : `+ Adicionar bloco (${acao.block_size} números)`}
      </button>
    </div>
  );
}

/* ---------- detalhe da ação ---------- */

function AcaoDetail({ id, onBack, showToast }) {
  const [acao, setAcao] = useState(null);
  const [newSeller, setNewSeller] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    api.get(`/api/admin/acoes/${id}`).then(setAcao).catch((e) => showToast("Erro ao carregar: " + e.message, true));
  }, [id]);

  if (!acao) return <div className="a-loading">Carregando ação…</div>;

  const setSellers = (fn) => setAcao((a) => ({ ...a, sellers: fn(a.sellers) }));

  const addSeller = async () => {
    if (!newSeller.trim()) { showToast("Nome obrigatório", true); return; }
    setAdding(true);
    try {
      const created = await api.post(`/api/admin/acoes/${acao.id}/sellers`, { name: newSeller.trim() });
      setSellers((sellers) => [...sellers, created]);
      setNewSeller("");
      showToast("✓ Vendedor adicionado!");
    } catch (e) {
      showToast("Erro: " + e.message, true);
    } finally {
      setAdding(false);
    }
  };

  const allBlocks = acao.sellers.flatMap((s) => s.blocks);
  const sold = allBlocks.reduce((t, b) => t + b.sold_count * acao.number_price, 0);
  const received = allBlocks.reduce((t, b) => t + b.received, 0);
  const pending = allBlocks.reduce((t, b) => t + blockPending(acao, b.returned, b.sold_count, b.received), 0);

  const saveFlags = async (patch, msg) => {
    try {
      const saved = await api.put(`/api/admin/acoes/${acao.id}`, {
        name: acao.name,
        number_price: acao.number_price,
        block_size: acao.block_size,
        public_ranking: acao.public_ranking,
        show_sold_numbers: acao.show_sold_numbers,
        ...patch,
      });
      setAcao((a) => ({ ...a, public_ranking: saved.public_ranking, show_sold_numbers: saved.show_sold_numbers }));
      showToast(msg);
    } catch (e) {
      showToast("Erro: " + e.message, true);
    }
  };

  return (
    <React.Fragment>
      <button className="link-btn back-btn" onClick={onBack}>← Todas as ações</button>

      <div className="form-block">
        <h3>{acao.name}</h3>
        <div className="aviso-meta" style={{ marginTop: 0, marginBottom: 10 }}>
          Número a {fmt(acao.number_price)} · blocos de {acao.block_size} ({fmt(acao.number_price * acao.block_size)} por bloco)
        </div>
        <Totais sold={sold} received={received} pending={pending} />
        <div className="aviso-actions" style={{ marginTop: 0 }}>
          <button className={"pill-toggle" + (acao.public_ranking ? " on" : "")}
            onClick={() => saveFlags({ public_ranking: !acao.public_ranking },
              acao.public_ranking ? "✓ Ranking agora é privado." : "✓ Ranking público ativado!")}>
            🏆 Ranking público
          </button>
          {acao.public_ranking && (
            <button className={"pill-toggle" + (acao.show_sold_numbers ? " on" : "")}
              onClick={() => saveFlags({ show_sold_numbers: !acao.show_sold_numbers },
                acao.show_sold_numbers ? "✓ Ranking mostra só a posição." : "✓ Ranking mostra números vendidos.")}>
              🔢 Mostrar números vendidos
            </button>
          )}
          {acao.public_ranking && (
            <a className="ranking-link" href={`/rifa/?id=${acao.id}`} target="_blank" rel="noreferrer">
              Ver página do ranking ↗
            </a>
          )}
        </div>
      </div>

      {acao.sellers.map((s) => (
        <VendedorCard key={s.id} acao={acao} seller={s} onChanged={setSellers} showToast={showToast} />
      ))}

      <div className="form-block">
        <h3>Novo vendedor</h3>
        <div className="form-field">
          <input type="text" value={newSeller} placeholder="Nome de quem vai vender"
            onChange={(e) => setNewSeller(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSeller()} />
        </div>
        <button className="add-cat-btn" onClick={addSeller} disabled={adding}>
          {adding ? "Adicionando…" : "+ Adicionar vendedor"}
        </button>
      </div>
    </React.Fragment>
  );
}

/* ---------- lista de ações ---------- */

export default function AcoesSection({ showToast }) {
  const [acoes, setAcoes] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [draft, setDraft] = useState({ name: "", price: "", size: "10", publicRanking: false, showSold: false });
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/api/admin/acoes").then(setAcoes).catch((e) => showToast("Erro ao carregar: " + e.message, true));
  useEffect(() => { load(); }, []);

  if (openId) return <AcaoDetail id={openId} onBack={() => { setOpenId(null); load(); }} showToast={showToast} />;
  if (!acoes) return <div className="a-loading">Carregando ações…</div>;

  const create = async () => {
    const price = strToPrice(draft.price);
    const size = parseInt(draft.size, 10);
    setSaving(true);
    try {
      const created = await api.post("/api/admin/acoes", {
        name: draft.name.trim(),
        number_price: price,
        block_size: size,
        public_ranking: draft.publicRanking,
        show_sold_numbers: draft.publicRanking && draft.showSold,
      });
      setDraft({ name: "", price: "", size: "10", publicRanking: false, showSold: false });
      setAcoes((list) => [{ ...created, blocks: 0, sold_numbers: 0, sold_value: 0, received: 0, pending: 0 }, ...list]);
      showToast("✓ Ação criada!");
    } catch (e) {
      showToast("Erro ao criar: " + e.message, true);
    } finally {
      setSaving(false);
    }
  };

  const del = async (a) => {
    if (!confirm(`Excluir a ação "${a.name}" com todos os vendedores e blocos?`)) return;
    try {
      await api.del(`/api/admin/acoes/${a.id}`);
      setAcoes((list) => list.filter((x) => x.id !== a.id));
      showToast("✓ Ação excluída!");
    } catch (e) {
      showToast("Erro ao excluir: " + e.message, true);
    }
  };

  return (
    <React.Fragment>
      {acoes.length === 0 && <div className="a-loading">Nenhuma ação ainda. Crie a primeira abaixo.</div>}
      {acoes.map((a) => (
        <div className="form-block acao-card" key={a.id}>
          <div className="vendedor-top">
            <h3>{a.name}</h3>
            <button className="cat-del" onClick={() => del(a)}>Excluir</button>
          </div>
          <div className="aviso-meta" style={{ marginTop: 0, marginBottom: 10 }}>
            Número a {fmt(a.number_price)} · blocos de {a.block_size} · {a.blocks} bloco{a.blocks === 1 ? "" : "s"} · {a.sold_numbers} número{a.sold_numbers === 1 ? "" : "s"} vendido{a.sold_numbers === 1 ? "" : "s"}
            {a.public_ranking && " · 🏆 ranking público"}
          </div>
          <Totais sold={a.sold_value} received={a.received} pending={a.pending} />
          <button className="add-item-btn" onClick={() => setOpenId(a.id)}>Abrir vendedores e blocos →</button>
        </div>
      ))}

      <div className="form-block">
        <h3>Nova ação entre amigos</h3>
        <div className="form-field">
          <label>Nome</label>
          <input type="text" value={draft.name} placeholder="Ex.: Ação da reforma"
            onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </div>
        <div className="acao-grid">
          <div className="form-field">
            <label>Valor de cada número (R$)</label>
            <input type="text" inputMode="decimal" value={draft.price} placeholder="10,00"
              onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
          </div>
          <div className="form-field">
            <label>Números por bloco</label>
            <input type="text" inputMode="numeric" value={draft.size}
              onChange={(e) => setDraft({ ...draft, size: e.target.value })} />
          </div>
        </div>
        <div className="aviso-actions" style={{ marginTop: 0, marginBottom: 12 }}>
          <button className={"pill-toggle" + (draft.publicRanking ? " on" : "")}
            onClick={() => setDraft({ ...draft, publicRanking: !draft.publicRanking })}>
            🏆 Ranking público
          </button>
          {draft.publicRanking && (
            <button className={"pill-toggle" + (draft.showSold ? " on" : "")}
              onClick={() => setDraft({ ...draft, showSold: !draft.showSold })}>
              🔢 Mostrar números vendidos
            </button>
          )}
        </div>
        <button className="add-cat-btn" onClick={create} disabled={saving}>
          {saving ? "Criando…" : "+ Criar ação"}
        </button>
      </div>
    </React.Fragment>
  );
}
