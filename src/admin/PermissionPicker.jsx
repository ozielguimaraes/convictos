/* Seletor de acessos por área com dois níveis: Ver e Editar.
   Editar implica Ver (o chip Ver fica marcado e travado); desligar Editar
   rebaixa para Ver em vez de remover tudo. */
import React from "react";

export default function PermissionPicker({ areas, selected, onChange, disabled = false }) {
  const has = (k) => selected.includes(k);

  const toggleView = (area) => {
    const k = `${area}:view`;
    onChange(has(k) ? selected.filter((x) => x !== k) : [...selected, k]);
  };

  const toggleManage = (area) => {
    const manage = `${area}:manage`;
    const view = `${area}:view`;
    if (has(manage)) {
      // Rebaixa para "ver" em vez de remover o acesso à área.
      onChange([...selected.filter((x) => x !== manage && x !== view), view]);
    } else {
      onChange([...selected.filter((x) => x !== view), manage]);
    }
  };

  return (
    <div className="perm-table">
      {areas.map((a) => {
        const manage = has(`${a.key}:manage`);
        const view = manage || has(`${a.key}:view`);
        return (
          <div className="perm-row" key={a.key}>
            <span className="perm-label">{a.label}</span>
            <button
              className={"pill-toggle" + (view ? " on" : "")}
              disabled={disabled || manage}
              title={manage ? "Incluído no Editar" : ""}
              onClick={() => toggleView(a.key)}>
              👁 Ver
            </button>
            <button
              className={"pill-toggle" + (manage ? " on" : "")}
              disabled={disabled}
              onClick={() => toggleManage(a.key)}>
              ✏️ Editar
            </button>
          </div>
        );
      })}
    </div>
  );
}
