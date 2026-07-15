# VERIFY

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
