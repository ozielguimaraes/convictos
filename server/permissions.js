/* Catálogo canônico de acessos do painel, por área e nível.
   Cada área tem "<area>:view" (ver) e "<area>:manage" (editar); manage
   implica view — a expansão acontece em expandPermissions, então no banco
   basta guardar o manage. A UI monta o menu a partir de /api/auth/me. */
export const AREAS = [
  { key: "links", label: "Links da página inicial" },
  { key: "patrocinadores", label: "Patrocinadores" },
  { key: "aparencia", label: "Aparência" },
  { key: "avisos", label: "Avisos" },
  { key: "acoes", label: "Ações entre amigos" },
  { key: "cardapio", label: "Cardápio" },
  { key: "usuarios", label: "Usuários" },
  { key: "perfis", label: "Perfis de acesso" },
];

export const PERMISSION_KEYS = AREAS.flatMap((a) => [`${a.key}:view`, `${a.key}:manage`]);

export const isValidPermissionList = (list) =>
  Array.isArray(list) && list.every((k) => PERMISSION_KEYS.includes(k));

export const expandPermissions = (list) => [
  ...new Set(list.flatMap((k) => (k.endsWith(":manage") ? [k, k.replace(":manage", ":view")] : [k]))),
];
