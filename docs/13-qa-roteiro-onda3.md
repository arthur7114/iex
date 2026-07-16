# Roteiro de QA — Onda 3 (cenários ponta-a-ponta + revisão visual)

Checklist de verificação manual dos fluxos entregues nas Ondas 1 e 2. Rode em `pnpm dev`
com login real. Marque cada item; anote o que falhar na coluna de observações do final.

## Pré-condições

- [ ] `.env.local` preenchido (Supabase URL/anon/service-role).
- [ ] Migrations aplicadas: **0110, 0112, 0113, 0114** (ver `MIGRATIONS_ONDA_1_2.sql`).
      Confirme com: `select name from public._iex_migrations where name like '011%';` (4 linhas).
- [ ] Usuário de teste criado e login funcionando (`scripts/create-test-user.mjs` se precisar).
- [ ] `pnpm dev` no ar; app abre autenticado (sem redirecionar para `/login`).

**Modos de operação (esperados, não são bugs):**
- Sem `RESEND_API_KEY` → envio de e-mail fica **"simulado"** e **não** muda status para "Enviada".
- Sem `OPENAI_API_KEY` → copiloto responde com **"Heurística local"** (badge explícito no painel).

**Legenda:** ✅ passou · ⚠️ passou com ressalva · ❌ falhou.

---

## Cenário 1 — Criar cliente e obra
- [ ] Criar um cliente novo (razão social, e-mail, dados comerciais). Toast de sucesso.
- [ ] Abrir o cliente e criar uma **obra/empreendimento** vinculado.
- [ ] Recarregar a página: cliente e obra persistem (vieram do banco, não do mock).
- [ ] **Acessibilidade:** botão de editar obra (ícone) tem rótulo lido por leitor de tela.

## Cenário 2 — Criar proposta usando um modelo
- [ ] Iniciar "Nova proposta"; selecionar o cliente/obra do Cenário 1.
- [ ] Na etapa de condições comerciais, escolher um **modelo** de proposta.
- [ ] **Preview do modelo** mostra quais campos serão preenchidos **antes** de aplicar.
- [ ] Aplicar o modelo preenche só condições comerciais (forma de pagamento, prazo, validade,
      premissas, exclusões) — **nunca** preços de disciplina.
- [ ] Criar outra proposta **sem modelo** ("Sem modelo"): o wizard funciona 100% igual.
- [ ] **Autosave:** ao editar, aparece "Salvando rascunho…" → "Rascunho salvo há X".
- [ ] Sair e voltar para a Nova proposta: o rascunho é restaurado com o horário do último salvamento.
- [ ] "Descartar rascunho" pede confirmação e limpa o formulário.
- [ ] Tentar avançar de etapa com campo obrigatório vazio é **bloqueado** com mensagem clara.

## Cenário 3 — Consultar o copiloto
- [ ] Na etapa **Precificação**, acionar o copiloto.
- [ ] Estado de **carregando** aparece; depois o resultado.
- [ ] Badge indica a origem: **"Gerado por IA"** (com `OPENAI_API_KEY`) ou **"Heurística local"** (sem).
- [ ] Com chave inválida/fora do ar: painel mostra estado de indisponibilidade + **"Tentar novamente"**
      (ou cai para heurística, rotulada como tal — nunca erro silencioso).
- [ ] **Regra dura:** o copiloto **não altera nenhum preço** sozinho — a faixa sugerida é só exibição.

## Cenário 4 — Alterar preços e justificar
- [ ] Na etapa de ajustes, alterar o valor de uma ou mais disciplinas.
- [ ] Informar a **justificativa** do ajuste.
- [ ] O resumo de valores recalcula corretamente (total = soma das disciplinas + parcelas coerentes).
- [ ] Salvar/gerar a proposta.

## Cenário 5 — Gerar PDF e Word
- [ ] Gerar **PDF** e **Word** a partir do wizard.
- [ ] Ambos mostram **o mesmo conteúdo**: escopos por disciplina, parcelas salvas, contato do cliente,
      dados comerciais completos.
- [ ] Com branding configurado (após 0110 + form de empresa): logo, assinatura e **cores** aparecem
      no PDF **e** no Word.
- [ ] Proposta com muitas disciplinas/parcelas: documento pagina corretamente (várias páginas).
- [ ] **Paridade drawer×wizard:** abrir a mesma proposta no drawer da lista e baixar PDF/Word →
      conteúdo **idêntico** ao do wizard.

## Cenário 6 — Enviar por e-mail
- [ ] No drawer da lista **ou** no wizard, abrir o envio; conferir destinatário/assunto/corpo/anexo.
- [ ] **Sem `RESEND_API_KEY`:** resultado "**Envio simulado**"; status **não** vira "Enviada".
- [ ] **Com `RESEND_API_KEY`:** resultado "enviado"; status **vira "Enviada"**.
- [ ] Forçar uma falha (destinatário inválido): estado **"falhou"** com mensagem específica +
      **"Tentar novamente"** (reenvio) preservando o formulário. Nunca aparece como sucesso.

## Cenário 7 — Consultar o histórico
- [ ] Abrir o drawer da proposta → aba **Histórico** (timeline).
- [ ] Aparecem: versões geradas, alterações de preço **com justificativa**, envios de e-mail **com
      resultado** (enviado/simulado/falha).
- [ ] Alterações **comerciais** e mudanças de **status** são visualmente distintas.
- [ ] "Visualizar" abre o PDF de uma versão anterior; "Baixar" faz o download.
- [ ] Proposta sem eventos: estado vazio "Sem histórico ainda" (não quebra).
- [ ] Erro de carregamento do histórico: `AlertTriangle` + **"Tentar novamente"**.

## Cenário 8 — Alterar status
- [ ] No drawer, mudar o status manualmente (ex.: Enviada → Aprovada).
- [ ] Mudar para "Perdida" exige o **motivo**.
- [ ] A mudança registra evento no histórico (Cenário 7) e reflete na lista e no dashboard.

## Cenário 9 — Duplicar e editar a proposta
- [ ] Duplicar uma proposta pela lista (ação visível na linha).
- [ ] A cópia abre para edição; alterar algo e salvar.
- [ ] A original permanece intacta; a cópia é uma proposta independente.

## Cenário 10 — Importar propostas e repetir os fluxos
- [ ] Em Histórico/Importação, subir um CSV; ver **pré-visualização com validação por linha**
      (será criada / duplicada / com erro) e as disciplinas reconhecidas.
- [ ] Barra de **progresso real** durante o processamento.
- [ ] **Resumo do lote:** criadas / ignoradas / com erro.
- [ ] **Baixar relatório de erros** (CSV) das linhas que falharam.
- [ ] **Reimportar o mesmo arquivo:** nenhuma proposta nova é criada (todas marcadas como duplicadas).
- [ ] Abrir uma proposta **importada**: ela abre, edita, gera PDF/Word e envia **como uma normal**
      (tem disciplinas e valores, não é casca vazia).

## Cenário 11 — Criar, convidar e desativar um usuário
- [ ] Em **Configurações → Equipe** (não em Cadastros — foi unificado aqui).
- [ ] **Convidar** por e-mail (precisa de SMTP no Supabase; sem SMTP, mensagem de erro clara em pt-BR).
- [ ] **Reenviar** o convite; disparar **redefinição de senha**.
- [ ] Colunas mostram **situação do convite** (pendente/aceito) e **último acesso**.
- [ ] **Desativar** um usuário (com confirmação). Depois, tentar acessar o app com esse usuário:
      a sessão é encerrada e ele é bloqueado (`/login?bloqueado=1`). *[requer 0113 aplicada]*
- [ ] Reativar restaura o acesso.

## Extra — Busca, navegação e notificações (Onda 2·C)
- [ ] **Busca global** (⌘K / Ctrl+K ou botão na topbar): buscar por número, cliente, empreendimento.
- [ ] Resultado de proposta abre o drawer certo (`/propostas?open=…`); resultado de cliente vai a Clientes.
- [ ] No **dashboard**, clicar num card/funil leva à **lista já filtrada** (`/propostas?status=…`).
- [ ] Lista de propostas: **ordenação** por coluna, **paginação**, filtros **preservados** ao abrir/fechar
      o drawer, ações por linha (editar/duplicar/exportar/enviar), destaque de **"sem retorno"**.
- [ ] **Sino de notificações:** contagem de não lidas, lista, marcar como lida / marcar todas.
- [ ] **Configurações → Notificações:** alterar preferências e recarregar → persistem.

---

## Revisão visual (matriz)

Repetir os fluxos-chave (2, 5, 7, lista) em cada combinação:

| Dimensão | Verificar |
|---|---|
| **Desktop / Tablet / Celular** | Sem overflow horizontal; tabelas rolam no próprio container; ações da linha acessíveis (colapsam em menu no mobile). |
| **Tema claro / escuro** | Pills de status, números de destaque e ícones **legíveis nos dois temas** (contraste — foi corrigido na Onda 3). |
| **Proposta curta / longa** | Documento e drawer não quebram com muitos escopos/parcelas. |
| **Textos extensos** | Nomes/razão social longos truncam ou quebram, não estouram o layout. |
| **Listas vazias / volumosas** | Estado vazio contextual; paginação e performance ok com muitas linhas. |
| **Erro de conexão** | Skeleton no carregamento; em falha, `AlertTriangle` + "Tentar novamente" (não parece "lista vazia"). |
| **Ações repetidas rápido** | Botões desabilitam durante processamento; sem duplo-envio/duplo-registro. |
| **Loading / sucesso / falha** | Consistentes entre páginas (skeleton, toast de sucesso, mensagem de erro específica). |

---

## Sign-off

| Cenário | Resultado | Observações |
|---|---|---|
| 1 Cliente e obra | | |
| 2 Proposta com modelo | | |
| 3 Copiloto | | |
| 4 Preços e justificativa | | |
| 5 PDF e Word | | |
| 6 Envio por e-mail | | |
| 7 Histórico | | |
| 8 Status | | |
| 9 Duplicar/editar | | |
| 10 Importação | | |
| 11 Equipe | | |
| Busca/nav/notificações | | |
| Revisão visual | | |

**Pendências conhecidas (follow-up, não são bugs de QA):** convite completo precisa de SMTP +
rota `/auth/callback` de definir senha; download de versão anterior é só PDF; limiar "sem retorno"
fixo em 7 dias; leitura de notificações globais é compartilhada. Ver backlog P2 no fim da conversa.
