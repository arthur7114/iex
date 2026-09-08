# Roadmap de Execução — IEX

Fonte de verdade sobre o progresso de desenvolvimento do IEX.

---

## Estado Atual

- **Fase Atual**: Fase 3 — Inteligência Artificial (copiloto de precificação entregue no código; a tabela `sugestoes` já existia no banco e o código foi realinhado ao schema real; migration `0116` **aplicada e validada** (30/30) em 03/08/2026; verificação em navegador pendente)
- **Status**: Frontend conectado a um backend Supabase real. App protegido por login. Copiloto de precificação com sugestão por disciplina, perguntas, aprendizado com justificativas e métricas de aderência implementados, cobertos por testes unitários/lint/tsc/build, e com a migration `0116` aplicada e validada contra o schema real do banco — validação em navegador ainda não realizada neste ambiente.

---

## Descoberta importante (19/06/2026)

O projeto Supabase dedicado (`qkobmpdawjcbgumxzpzh`) **já continha um backend IEX completo**, construído em 15/06 (15 migrations versionadas em `_iex_migrations`): schema normalizado, seed (7 clientes, 8 propostas, 15 disciplinas, lookups, 5 usuários, 15 logs), views (`v_propostas`, `clientes_metricas`, `v_logs_uso`), RPCs (`fn_log_uso`, `fn_transicionar_status`) e RLS (`authenticated` full).

**Decisão**: adotar esse backend (não recriar). O trabalho desta fase foi **conectar o frontend mock a ele** + autenticação.

---

## Descoberta importante (03/08/2026) — `sugestoes` já existia

O plano do copiloto assumiu que `public.sugestoes` (PRD 14.2) **não existia** e a
migration `0116` a criava. Ela **já existia**, vinda daquele backend original de
15/06 — as migrations versionadas neste repo começam em `0105`; de `0001` a
`0104` foram aplicadas fora do repo e só constam em `_iex_migrations`.

**A armadilha**: `0116` usava `create table if not exists`. Aplicá-la seria um
**no-op silencioso** — a tabela ficaria com o schema original, a migração se
registraria como aplicada em `_iex_migrations` (dando a impressão de sucesso) e
todo INSERT de `registrarSugestoes` falharia por coluna inexistente. Como a
chamada é `.catch`-guardada na finalização (de propósito: auditoria não pode
derrubar a proposta), o erro não apareceria em lugar nenhum: zero linhas para
sempre e o card "Aderência ao copiloto" preso no estado vazio.

**Lição**: `create table if not exists` num banco que precede o versionamento não
é idempotência, é cegueira. Antes de escrever DDL aqui, conferir o schema real.

O código foi realinhado ao schema real (tabela com 0 linhas, nenhuma migração de
dados necessária). Nomes que mudaram: `fatores_considerados`→`fatores`,
`justificativa`→`explicacao`, `base_recente_qtd`→`base_recente`,
`base_antiga_qtd`→`base_antiga` (**contagem inteira**, não booleano — o booleano
"base antiga" agora é derivado: `base_recente === 0 && base_antiga > 0`);
`usuario_id` **não existe**; `disciplina_id` é **text** (ids como
`climatizacao-splits-vrf`), não uuid. Colunas do schema real que o plano ignorava
e que agora são preenchidas: `multiplicador`, `entrada` (snapshot do
`CopilotoInput`) e `modelo` (nome do modelo OpenAI, `null` na heurística).
A `0116` foi reescrita para apenas acrescentar o índice
`(proposta_id, disciplina_id)` e o guard de RLS.

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

### Fase 3: Inteligência Artificial — (em andamento)
- [x] **Copiloto de precificação** (PRD 006): server action `lib/actions/copiloto.ts` (OpenAI; modelo via `OPENAI_MODEL`, default `gpt-4o-mini`) que busca propostas comparáveis (mesmo tipo, últimos 12 meses, status Aprovada/Enviada), monta o resumo de R$/m² e devolve mensagens + confiança + faixa sugerida. **Fallback heurístico determinístico** quando não há `OPENAI_API_KEY` ou em erro/parsing — espelha o `simulado` do e-mail. Lógica pura testável em `lib/copiloto/analise.ts` (vitest). UI: painel `ai-copilot-panel.tsx` na etapa **Precificação** do wizard (`app/propostas/nova/page.tsx`), com botão "Analisar com o copiloto". **Consultivo: não aplica valores** (rastreabilidade > automação). Auditoria via `fn_log_uso` ("Análise de precificação (IA)").
- [x] **Comparáveis em duas janelas**: a busca de propostas comparáveis passou a considerar 0–12 meses como prioridade e 12–36 meses como referência secundária, por proposta e por disciplina — quando a janela recente é insuficiente, a análise declara que está usando dados mais antigos.
- [x] **Sugestão por disciplina** (`sugerirPorDisciplina`): valor unitário por m² por disciplina, derivado da mediana histórica daquela disciplina. Sem histórico, não há sugestão — nunca um valor inventado.
- [x] **Perguntas complementares** (`montarPerguntas`): até 3 perguntas objetivas quando informação crítica está faltando (padrão, fase, complexidade pulada).
- [x] **Aprendizado com justificativas**: justificativas de ajustes anteriores para o mesmo tipo de empreendimento alimentam o prompt do modelo — apenas `disciplina_nome`, `variacao_pct` e `justificativa` (sem PII de cliente).
- [x] **Painel do copiloto** (`ai-copilot-panel.tsx`): agora renderiza a lista de sugestões por disciplina, o bloco de perguntas e o badge "Base com mais de 12 meses".
- [x] **Persistência de sugestões**: `lib/db/sugestoes.ts::registrarSugestoes` grava as sugestões na finalização da proposta (delete-then-insert escopado à proposta, chaveado por `disciplina_id`); uma falha na gravação da auditoria nunca quebra a finalização. Mapeamento para o schema real: `fatores` (jsonb), `entrada` (snapshot do `CopilotoInput`), `explicacao`, `multiplicador`, `base_recente`/`base_antiga` (contagens), `modelo`. Sem `usuario_id` — a coluna não existe na tabela.
- [x] **Métricas do copiloto**: `lib/copiloto/metricas.ts::computeMetricasIA` + `getMetricasIA` + `components/metricas-ia-card.tsx`, card "Aderência ao copiloto" adicionado ao final da grade do dashboard (`app/page.tsx`). Tolerância de aderência: uma alteração de valor dentro de 2% conta como "manteve a sugestão".
- [x] Migration `supabase/migrations/0116_sugestoes_ia.sql` — **não cria tabela nenhuma**: só acrescenta o índice `idx_sugestoes_proposta_disciplina` e o guard de RLS sobre a `public.sugestoes` já existente. **Aplicada e validada em 03/08/2026** — `node scripts/validate-migration-0116.mjs` retornou 30/30 checagens ok (colunas do schema real presentes, colunas antigas do plano ausentes como esperado, tipos, índice, RLS, policy, registro em `_iex_migrations`).
- [ ] Ingestão da base de conhecimento / RAG: **futuro**.

#### Divergências declaradas do mock contract (Fase 3)

- **Painel do copiloto** ganhou lista de sugestões por disciplina e bloco de perguntas.
  *Por quê:* PRD 006 exige sugestão de valor unitário por disciplina e perguntas complementares — o painel de mensagens não comporta isso.
  *O que substitui:* o painel continua discreto, sem chat, dentro da etapa Precificação; nada é aplicado automaticamente.
  *Docs atualizados:* `docs/02-mock-contract.md` (Contrato do Copiloto), este roadmap.
- **Dashboard** ganhou o card "Aderência ao copiloto".
  *Por quê:* PRD 16.4 define métricas da IA e a hipótese 3.4 condiciona automação futura à aderência medida.
  *O que substitui:* adição ao final da grade; nenhum card existente foi removido ou reposicionado.
  *Docs atualizados:* este roadmap.

#### Próxima ação (Fase 3 — copiloto avançado, entregue nesta rodada)

1. **Verificação em navegador pendente**: sugestão por disciplina, perguntas complementares, badge "Base com mais de 12 meses" (Task 6), persistência de sugestões na finalização (Task 7) e o card "Aderência ao copiloto" (Task 8) foram implementados e passam em lint/tsc/test/build, e a migration `0116` (índice) já está aplicada e validada no banco — mas o fluxo **não foi verificado visualmente nem ponta-a-ponta** neste ambiente (faltam credenciais de login no Supabase). Fazer login real, rodar o fluxo completo do wizard e conferir o dashboard antes de considerar a entrega fechada.
2. **Débito técnico conhecido**: `getMetricasIA` (`lib/db/sugestoes.ts`) lê as tabelas `sugestoes` e `proposta_itens` inteiras no cliente a cada carregamento do dashboard, sem `limit` nem janela de data. Um `.limit()` ingênuo enviesaria a métrica silenciosamente; o correto é agregação no servidor (view ou RPC). Registrado como pendência, não como feito.

---

## Validação (19/06/2026)
- `pnpm lint` ✅ (0 erros) · `pnpm build` ✅ (12 rotas) · `tsc --noEmit` ✅.
- Middleware: `/` e `/propostas` sem sessão → 307 `/login`; `/login` → 200.
- RLS: cliente anônimo lê 0 propostas.
- Camada de dados: 16/16 checagens OK (embeds de itens/eventos, `clientes_metricas`, `v_logs_uso`, lookups, disciplinas, variáveis, configs) — `node scripts/validate-db.mjs`.

## Próxima ação
1. Verificar o login pela UI: rodar `node scripts/create-test-user.mjs` (cria usuário de teste) e fazer login em `/login`.
2. Criar logins reais da equipe quando os e-mails forem definidos.
3. **Copiloto de precificação entregue** (validação estática: lint/tsc/build ✅). Falta a validação fim-a-fim na UI: definir `OPENAI_API_KEY` em `.env.local`, abrir `/propostas/nova` → etapa Precificação → "Analisar com o copiloto" (com e sem chave) e conferir o log "Análise de precificação (IA)" em `/logs`. **Rotacionar** a chave colada no chat após o beta.
4. Próximos passos de IA: ingestão da base de conhecimento / RAG e persistência em `sugestoes`.

## Decisões / notas
- Conexão direta ao banco para migrations/admin via session pooler (host `db.*` é IPv6-only). Ver `scripts/lib-db.mjs`.
- Segredos só em `.env.local` (gitignored). **Rotacionar** chaves coladas no chat após o beta.
- Aviso do Next 16: `middleware` deprecado em favor de `proxy` — funcional hoje; migrar `middleware.ts` → `proxy.ts` em follow-up.

---

## Ciclo 27/07/2026 — Padronização e versionamento de propostas

### Progresso

- [x] Migration `0115_padronizacao_propostas.sql` criada de forma idempotente.
- [x] Numeração futura `AAAAMMDD-NN` por RPC e contador diário transacional em `America/Fortaleza`.
- [x] Finalização transacional por RPC: proposta, itens e snapshot são atômicos; `V1` nasce na primeira finalização e cada edição cria a próxima `Vn`.
- [x] Snapshots novos incluem documento + identidade visual; snapshots legados têm fallback compatível.
- [x] Arquivos, cabeçalhos, histórico e e-mail identificam a versão sem alterar o código-base.
- [x] Conteúdo padrão, títulos e escopos das disciplinas atualizados somente para propostas futuras.
- [x] “Modelo padrão IEX” neutro e “Modelo Condomínio” opcional materializados na migration.
- [x] Fases novas limitadas a `Executivo` e `As built`, com tratamento explícito de valor legado.
- [x] Preview, PDF e Word migrados para paginação adaptativa; assinatura alterada para `Diretor Comercial`.
- [x] Cadastros expõem título comercial, escopo, apresentação e observações padrão.
- [x] Callback e definição de senha implementados; reenvio de convite agora entrega o link via Resend.
- [x] Correção “Aledri” → “Alderi” incluída sem reenviar convite.
- [x] Fallback de escopo legado materializado antes da revisão do catálogo, sem alterar snapshots/códigos emitidos.
- [x] Testes automatizados de identificação, snapshot e precificação: 49 testes verdes.
- [x] QA visual: curto, longo e 18 disciplinas em PDF/Word; preview validado em desktop e 390 px.

### Validação local

- `pnpm test` ✅ — 6 arquivos / 49 testes.
- Migration PostgreSQL ✅ — sintaxe, idempotência, escopo legado e finalização V1/V2 atômica.
- Concorrência PostgreSQL ✅ — 80 códigos únicos e 80 snapshots concorrentes, sem colisões.
- `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build`, `node scripts/validate-db.mjs` e `.agent/scripts/checklist.py` ✅.
- `pnpm exec tsc --noEmit` ✅.
- PDF: 1 / 3 / 3 páginas nos casos curto / longo / 18 disciplinas, inspecionadas em PNG.
- Word: 1 / 3 / 3 páginas nos mesmos casos, inspecionadas em PNG.
- Preview: sem overflow horizontal; 18 itens em ordem e assinatura integrada ao fluxo.

### Implantação remota (28/07/2026)

- [x] Supabase CLI autenticado e repositório vinculado ao projeto `qkobmpdawjcbgumxzpzh`.
- [x] Histórico padrão do CLI reconciliado com as migrations legadas `0105` e `0106`.
- [x] Migrations `0110`, `0112`, `0113`, `0114` e `0115` aplicadas no banco remoto e conferidas em `public._iex_migrations`.
- [x] `0112` corrigida para usar uma representação imutável de `data_criacao` na coluna gerada `import_key`.
- [x] `0115` compatibilizada com o schema legado, no qual `modelos_proposta.nome` não possui restrição única.
- [x] Schema cache validado pela chamada direta de `fn_finalizar_proposta_versionada`: a RPC foi encontrada e rejeitou corretamente a chamada sem sessão com `P0001`.
- [x] Colunas de versão/conteúdo e os modelos “Modelo padrão IEX” e “Modelo Condomínio” confirmados pela API remota.
- [ ] Configurar/validar o domínio no Resend e o SMTP do Supabase conforme `docs/14-checklist-operacional-propostas.md`.

### Próxima ação

1. Fazer um smoke test autenticado de criação/edição de proposta na aplicação.
2. Executar os testes remotos de concorrência e os fluxos reais de e-mail/convite do roteiro de QA.
3. Obter o aceite manual da rodada de precificação.
