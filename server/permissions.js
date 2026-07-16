/* Catálogo canônico de acessos do painel. A UI monta o menu a partir do que
   /api/auth/me devolver; o servidor valida perfis e extras contra estas keys. */
export const PERMISSIONS = [
  { key: "links", label: "Links da página inicial" },
  { key: "aparencia", label: "Aparência" },
  { key: "avisos", label: "Avisos" },
  { key: "acoes", label: "Ações entre amigos" },
  { key: "cardapio", label: "Cardápio" },
  { key: "usuarios", label: "Usuários" },
  { key: "perfis", label: "Perfis de acesso" },
];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

export const isValidPermissionList = (list) =>
  Array.isArray(list) && list.every((k) => PERMISSION_KEYS.includes(k));
