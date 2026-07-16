# VERIFY

## 2026-07-15 — ciclo de entrega dos blocos

- API (bloco de 10 × R$ 10): recém-pego → pendente 100; entregue com 6
  vendidos sem pagar → 60; parcial R$ 40 → 20; pago R$ 60 → 0.
- Navegador: pill "📦 Com o vendedor"/"✓ Entregue" por bloco; status
  "pagamento parcial" e "não pago" derivados; totais do vendedor e da ação
  somando pendente por bloco (100 + 30 = 130 no cenário de demonstração).

## 2026-07-15 — ações entre amigos + sidebar

- API via curl: criar ação (R$ 10 × 10), vendedor, bloco 1–10; bloco
  sobreposto → 409; sold_count 11 → 400; 7 vendidos + R$ 50 recebidos →
  agregado vendido 70 / recebido 50 / pendente 20.
- Navegador: sidebar renderiza (desktop fixa; mobile é o default do CSS,
  media query ≥900px verificada via getComputedStyle); seção Ações mostra
  card com totais e detalhe com edição de bloco recalculando ao vivo
  ("✓ acertado" ao zerar pendência); salvar bloco atualiza totais do
  vendedor e da ação.

## 2026-07-15 — usuários + fix assets do cardápio

- `npm run db:schema` — migração role ok (microzapple = super_admin).
- API via curl (build de produção em :3001):
  - GET /api/auth/me → inclui id e role.
  - POST/GET/PUT/DELETE /api/admin/users como super admin — ok.
  - Admin comum em /api/admin/users → 403 "acesso restrito".
  - DELETE do super admin / própria conta → 400 bloqueado.
  - `curl -H 'Host: cardapio.querc.app' :3001/assets/x.js` → 200 (antes 404).
- Navegador: /admin/ com super admin mostra aba Usuários (lista + criar +
  redefinir senha); login por link mágico ok.

## 2026-07-14

- `npm run build` — ok (5 entradas geradas em dist/).
- `npm run db:schema` + `npm run admin:create` — ok no convictos-pg.
- API via curl:
  - GET /api/profile, /api/avisos, /api/cardapio/menu — ok
  - POST /api/cardapio/orders — pedido nº 1 criado
  - GET /api/admin/links sem sessão — 401 (guarda ativa)
  - POST /api/auth/login (senha) — ok; GET /api/auth/me — ok
  - PUT /api/admin/profile (tema aurora), POST /api/admin/avisos, PUT /api/admin/links — ok
  - PUT /api/cardapio/menu — id do item preservado, preço atualizado (27.50)
  - OTP: send-code → código no console → verify-code — ok; token consumido retorna 401
  - Link mágico: 302 → /admin/ com cookie de sessão — ok
- Navegador (build servido pelo Express em :3001):
  - `/` renderiza tema aurora + 3 links; `/avisos/` mostra aviso fixado;
    `/cardapio/` mostra menu com preço editado; `/admin/` login por senha
    funciona e abas Links/Aparência renderizam.
- Pendente: envio real de e-mail (SMTP não configurado — modo console).
