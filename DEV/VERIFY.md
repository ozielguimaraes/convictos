# VERIFY

## 2026-07-23 — Pesquisas de satisfação

- `npm run db:schema` — rodado 2x seguidas, idempotente (cria as 5 tabelas +
  migração `pesquisas:manage` no Gestor sem erro na segunda execução).
- `npm run build` — ok, entrada `pesquisa` gerada em `dist/pesquisa/`.
- API via curl (build de produção em :3001, sessão simulada via insert
  direto em `sessions` do super admin):
  - CRUD de pesquisa/pergunta (estrelas5, nota0a10, nota0a5, opções única,
    texto) — 200/201 esperados.
  - `GET /api/pesquisas/:id` (pública, anônima) — não expõe
    `privacy_notice`/`privacy_policy_url`; `GET /api/pesquisas/public` lista
    só a aberta.
  - `POST /api/pesquisas/:id/responder`: obrigatória faltando → 400;
    honeypot preenchido → 201 "fake" mas **não grava** (confirmado
    `count(*)=1` no banco após 2 envios, um deles com honeypot); resposta
    válida com todos os tipos → 201; nota fora do range (11 em 0–10) → 400.
  - Relatório: média 5/9, NPS 100 (1 promotor), % por opção, distribuição —
    conferido no JSON. CSV com BOM, uma linha por submissão, coluna por
    pergunta.
  - Trava estrutural: `PUT /admin/perguntas/:id` mudando tipo de pergunta
    com resposta → 400; `DELETE` da mesma → 400; editar só o texto → 200
    (permitido mesmo com resposta).
  - Pesquisa `obrigatorio` + `one_response_per_email`: sem `consent_given` →
    400; sem nome/e-mail → 400; resposta válida → 201, grava `consent_at`
    (não nulo) e **sem** colunas de IP/user-agent na tabela (`\d
    pesquisa_respostas` confirmado); reenvio com mesmo e-mail → 409.
  - Pesquisa `rascunho` → `GET` público 404 "pesquisa indisponível".
  - Direitos do titular: buscar respostas por e-mail (mesmo endpoint de
    listagem com `?email=`) — ok; `DELETE /admin/respostas/:id` — 200;
    `POST /admin/pesquisas/:id/expurgar` com `days=0` → 400, com `days=365`
    → `{deleted:0}` (nada fora da retenção).
- Navegador (`npm run dev`, login por OTP via console): seção "Pesquisas" no
  menu; criar pesquisa com identificação obrigatória mostra os campos LGPD
  (aviso de privacidade, link da política, retenção) só quando
  `identity_mode != anonimo`; construtor de perguntas cria estrelas e opções
  (editor de opções aparece só pro tipo certo); publicar (`status: ativa`) e
  abrir `/pesquisa/<id>`: formulário renderiza os widgets certos (estrelas
  clicáveis, radio de opções, campos nome/e-mail obrigatórios, checkbox de
  consentimento não pré-marcado); enviar sem marcar consentimento é
  bloqueado com a mensagem certa; após marcar e enviar, mostra a tela de
  agradecimento e o reload preserva o estado "já respondido"
  (`localStorage`); aba Relatório do admin reflete a resposta real (média,
  barra de distribuição, tabela de respostas individuais).
- Bug achado e corrigido nesta rodada (ver `DEV/WORKLOG.md`): ambiguidade de
  `created_at` no `GET /admin/pesquisas` e falso "dirty" no botão Salvar do
  editor de pergunta.
- Dados de teste (pesquisas, perguntas, respostas, sessão simulada) removidos
  do banco ao final.

## 2026-07-23 — Encurtador: editar URL + código customizado

- `npm run build` — ok.
- API via curl (build de produção em :3001, sessão simulada):
  - PUT /api/admin/encurtador/:id com nova target_url → 200, código
    permanece o mesmo; URL inválida → 400; id inexistente → 404.
  - POST com `code: "promo"` → 201 com esse código exato; repetir o mesmo
    código → 409; código com espaço → 400 (só alfanumérico); redirect
    `Host: url.querc.app` `/promo` → 302 correto; sem `code` → continua
    gerando automático (7 chars).
- Dados de teste limpos, servidor local encerrado.

## 2026-07-22 — Encurtador de URLs (url.querc.app)

- `npm run build` — ok. `npm run db:schema` — cria `short_links` e migra
  `encurtador:manage` no perfil Gestor, idempotente.
- API via curl (build de produção em :3001, sessão simulada via insert
  direto em `sessions`):
  - POST /api/admin/encurtador `{target_url: "https://claude.ai/teste"}` →
    201, código de 7 chars gerado (ex: `x2v7ffm`).
  - POST com `target_url: "nao-e-url"` → 400 "URL inválida".
  - GET /api/admin/encurtador → lista o link criado.
  - DELETE /api/admin/encurtador/:id → 200, some da listagem.
  - `curl -H 'Host: url.querc.app' :3001/<code>` → 302 pro target_url,
    click_count incrementado (verificado no banco).
  - `curl -H 'Host: url.querc.app' :3001/naoexiste` → 404.
  - `curl -H 'Host: url.querc.app' :3001/` → 302 pra convictos.querc.app.
  - `curl -H 'Host: convictos.querc.app' :3001/<code>` → não interceptado
    (cai no 404 normal do SPA), confirma que o middleware é isolado por Host.
- Coolify: domínio `https://url.querc.app` adicionado ao app "Landing page"
  via UI (settings salvos com sucesso).
- Pendente verificar em produção após deploy: certificado SSL emitido e
  `npm run db:schema` rodado no container.

## 2026-07-16 — permissões granulares

- Perfil "Observador de ações" (acoes:view): lista e detalhe de ações 200;
  criar ação/vendedor 403; links e avisos 403; /me = ["acoes:view"].
- Extra acoes:manage: /me expande para manage+view; GET 200 e POST 201.
- Migração: Gestor virou {…:manage} automaticamente ao rodar o schema.
- Navegador: observador vê só "Ações entre amigos" com banner de leitura,
  totais visíveis, sem botões de criar/excluir e toggles desabilitados;
  super admin vê o picker Ver/Editar por área nos Perfis.

## 2026-07-16 — RBAC

- Matriz via curl: gestora (perfil Gestor) lista/cria usuários (200/201),
  cria/edita perfil → 403, extra "perfis" → 400, editar/excluir super admin
  → 403/400, acessa ações/links → 200.
- Usuário sem perfil: 403 em tudo; após extra "avisos" concedido pela
  gestora → 200 em avisos, 403 no resto; /me lista só ["avisos"].
- Navegador: super admin vê menu completo (+ Perfis de acesso); gestora via
  link mágico vê tudo menos Perfis, e o chip "perfis" some na tela dela.
- Gestor semeado com {links,aparencia,avisos,acoes,cardapio,usuarios}.

## 2026-07-15 — ranking público

- API sem auth: /api/acoes/public lista só ações públicas; ranking com
  empate correto (Maria 9 → 1º; Ana/João 7 → ambos 2º; Pedro → 4º);
  ação privada → 404.
- Navegador: /rifa/?id= mostra pódio (1º central mais alto, medalhas,
  bordas ouro/prata/bronze) + tabela com 4º e 5º; tema do perfil aplicado.
- Admin: pill "🏆 Ranking público" na criação e no detalhe (salva na hora),
  link "Ver página do ranking" quando ativo.

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
