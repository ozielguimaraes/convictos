# HANDOFF

Estado: funcional e verificado localmente (2026-07-14).

## Como subir

```bash
npm run dev  # banco: container postgres-latest (porta 5432)
# ou produção: npm run build && npm start (porta 3001)
```

Admin: `microzapple@gmail.com` — senha definida localmente via
`npm run admin:create -- email senha` (não registrada aqui).

## Atenção

- Banco no container postgres-latest (PG18, :5432, volume nomeado). Se der
  ECONNREFUSED :5432, verifique se o container está de pé (docker ps).
- SMTP não configurado: OTP/link mágico saem no console do servidor.

## Próximos passos possíveis

- Configurar SMTP real no `.env`.
- Deploy: apontar convictos.querc.app e cardapio.querc.app para o mesmo
  serviço (reescrita por Host já implementada em server/index.js).
- Tela de pedidos no admin do cardápio (pendência herdada do cardapio-on).
