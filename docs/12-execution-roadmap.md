# Roadmap de Execução — IEX

Fonte de verdade sobre o progresso de desenvolvimento do IEX.

---

## Estado Atual

- **Fase Atual**: Fase 2 — Integração e Persistência (CONCLUÍDA, exceto IA)
- **Status**: Frontend conectado a um backend Supabase real. App protegido por login. IA (Fase 3) adiada.

---

## Descoberta importante (19/06/2026)

O projeto Supabase dedicado (`qkobmpdawjcbgumxzpzh`) **já continha um backend IEX completo**, construído em 15/06 (15 migrations versionadas em `_iex_migrations`): schema normalizado, seed (7 clientes, 8 propostas, 15 disciplinas, lookups, 5 usuários, 15 logs), views (`v_propostas`, `clientes_metricas`, `v_logs_uso`), RPCs (`fn_log_uso`, `fn_transicionar_status`) e RLS (`authenticated` full).

**Decisão**: adotar esse backend (não recriar). O trabalho desta fase foi **conectar o frontend mock a ele** + autenticação.

---

## Roadmap

### Fase 1: Configuração & Alinhamento — ✅
- [x] Mock extraído, docs base, regras de agente, build validado.

### Fase 2: Integração e Persistência — ✅ (exceto IA)
- [x] Clientes Supabase (`@supabase/ssr`): browser, server, middleware.
- [x] **Autenticação real** (Supabase Auth) + tela `/login` + `middleware.ts` protegendo rotas. Logout no topbar com usuário real (`usuarios`).
- [x] Camada de dados `lib/db/*` (client-side, RLS + RPCs): `propostas`, `clientes`, `disciplinas`, `lookups`, `complexidade`, `config`, `logs`, `documentos`, `dashboard`, `usuarios`.
- [x] **Páginas conectadas ao banco**: dashboard (métricas/gráficos reais), propostas (lista + drawer com troca de status via `fn_transicionar_status`), nova proposta (wizard grava no banco; **etapa de complexidade opcional**; fatores vindos de `variaveis_complexidade`), clientes (CRUD + métricas via view), cadastros (disciplinas unificadas com **valor mínimo** + listas editáveis), configurações (empresa + precificação + **editor de fatores de complexidade**), logs (auditoria real), base de conhecimento (registro de documentos).
- [x] `lib/storage.ts` reduzido apenas ao rascunho do wizard (localStorage). Propostas persistem no Supabase.
- [ ] **Logins da equipe** (Ricardo, Patrícia, Eduardo, Camila): adiado — beta usa a conta do Arthur (já existe). Script `scripts/create-test-user.mjs` pronto para criar usuários via service role.
- [ ] Import de propostas antigas (tabela `historico_importado` existe): adiado.
- [ ] Envio de e-mail real / upload de arquivos (Storage): adiado (mantido print-to-PDF; registro de documentos persistido).

### Fase 3: Inteligência Artificial — (futuro)
- [ ] Copiloto de precificação, ingestão da base de conhecimento, sugestões (`sugestoes`).

---

## Validação (19/06/2026)
- `pnpm lint` ✅ (0 erros) · `pnpm build` ✅ (12 rotas) · `tsc --noEmit` ✅.
- Middleware: `/` e `/propostas` sem sessão → 307 `/login`; `/login` → 200.
- RLS: cliente anônimo lê 0 propostas.
- Camada de dados: 16/16 checagens OK (embeds de itens/eventos, `clientes_metricas`, `v_logs_uso`, lookups, disciplinas, variáveis, configs) — `node scripts/validate-db.mjs`.

## Próxima ação
1. Verificar o login pela UI: rodar `node scripts/create-test-user.mjs` (cria usuário de teste) e fazer login em `/login`.
2. Criar logins reais da equipe quando os e-mails forem definidos.
3. Iniciar Fase 3 (IA).

## Decisões / notas
- Conexão direta ao banco para migrations/admin via session pooler (host `db.*` é IPv6-only). Ver `scripts/lib-db.mjs`.
- Segredos só em `.env.local` (gitignored). **Rotacionar** chaves coladas no chat após o beta.
- Aviso do Next 16: `middleware` deprecado em favor de `proxy` — funcional hoje; migrar `middleware.ts` → `proxy.ts` em follow-up.
