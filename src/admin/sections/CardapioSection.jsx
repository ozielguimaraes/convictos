/* Seção Cardápio do painel: o mesmo editor da página /cardapio/admin/,
   embutido na navegação lateral. */
import React from "react";
import MenuEditor from "../../cardapio/admin/MenuEditor.jsx";

export default function CardapioSection({ canManage, showToast }) {
  return <MenuEditor canManage={canManage} showToast={showToast} />;
}
