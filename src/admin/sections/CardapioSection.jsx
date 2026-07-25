/* Seção Cardápio do painel: o mesmo editor da página /cardapio/admin/,
   embutido na navegação lateral, com aba de pedidos. */
import React, { useState } from "react";
import MenuEditor from "../../cardapio/admin/MenuEditor.jsx";
import OrdersView from "../../cardapio/admin/OrdersView.jsx";

export default function CardapioSection({ canManage, showToast }) {
  const [tab, setTab] = useState("cardapio");
  return (
    <React.Fragment>
      <div className="sp-tabs">
        <button className={"sp-tab" + (tab === "cardapio" ? " active" : "")} onClick={() => setTab("cardapio")}>Cardápio</button>
        <button className={"sp-tab" + (tab === "pedidos" ? " active" : "")} onClick={() => setTab("pedidos")}>📋 Pedidos</button>
      </div>
      {tab === "cardapio"
        ? <MenuEditor canManage={canManage} showToast={showToast} />
        : <OrdersView showToast={showToast} />}
    </React.Fragment>
  );
}
