# E-mail da proposta personalizável — design

Data: 2026-09-23 · Status: aprovado

## Problema

O e-mail de envio da proposta nasce com assunto e corpo fixos no código
(`components/email-composer.tsx`), com "IEX Engenharia" escrito à mão e sem
assinatura. Não há como a empresa definir o texto padrão nem como cada pessoa
assinar os próprios envios.

## Objetivo

1. Um **modelo padrão** (assunto + corpo) definido nas Configurações, com
   variáveis da proposta, da empresa e de quem envia.
2. Uma **assinatura por usuário**, sempre de quem envia, em dois modos: HTML
   montado a partir de campos (foto, nome, cargo, contatos) ou imagem PNG.
3. O compositor abre pré-preenchido com o modelo renderizado e continua
   editável antes do envio.

Fora de escopo: vários modelos, editor com formatação (rich text), assinatura
editável por envio.

## 1. Modelo do e-mail

**Onde:** Configurações › nova aba **E-mail** (depois de "Notificações"). Só
administrador pode salvar, como as demais abas de configuração.

**Campos:** `Assunto` (input) e `Corpo` (textarea, texto puro). Ao lado, uma
lista de botões de variável que insere o token na posição do cursor do último
campo focado.

**Variáveis** (sintaxe `{{nome}}`, case-sensitive, espaços internos tolerados:
`{{ cliente }}`):

| Token | Origem | Exemplo |
|---|---|---|
| `{{cliente}}` | `PropostaDoc.cliente` | Construtora Alfa |
| `{{contato}}` | `PropostaDoc.contato` | Maria Souza |
| `{{empreendimento}}` | `PropostaDoc.empreendimento` | Residencial Aurora |
| `{{numero}}` | `identificacaoDocumento(numero, versao)` | P-0123 v2 |
| `{{cidade}}` | `PropostaDoc.cidade` | Recife |
| `{{uf}}` | `PropostaDoc.uf` | PE |
| `{{valor_total}}` | `PropostaDoc.total`, formatado em BRL | R$ 48.500,00 |
| `{{validade}}` | `PropostaDoc.validade` | 30 dias |
| `{{prazo}}` | `PropostaDoc.prazoExecucao` | 60 dias |
| `{{empresa}}` | `config_empresa.razao_social` | IEX Engenharia |
| `{{remetente_nome}}` | usuário da sessão | Arthur Brito |
| `{{remetente_cargo}}` | `usuarios.cargo` (fallback vazio) | Diretor Comercial |

**Regras de renderização:**
- Variável conhecida sem valor → string vazia.
- Variável desconhecida → mantida literalmente (`{{xyz}}`); a prévia da aba
  lista os tokens desconhecidos como aviso, sem bloquear o salvamento.
- Modelo vazio (coluna nula ou só espaços) → usa o texto padrão atual
  (`MODELO_PADRAO` em `lib/email/modelo.ts`, reescrito com variáveis:
  `{{empreendimento}}`, `{{empresa}}`). Nada muda para quem não configurar.
- Limites: assunto até 200 caracteres, corpo até 5.000.

**Prévia:** abaixo dos campos, o e-mail renderizado com dados de exemplo fixos
e a assinatura real do usuário logado.

## 2. Assinatura por usuário

**Onde:** diálogo **Meu perfil** (`components/perfil-dialog.tsx`), nova seção
"Assinatura de e-mail". Cada pessoa edita só a própria (mesma regra de
`atualizarMeuPerfil`: filtra por `auth_user_id` da sessão).

**Modo:** seletor `HTML` | `Imagem`.

- **HTML:** foto (upload, opcional), nome e cargo (campos já existentes),
  telefone e e-mail de contato (padrão: e-mail do login, editável). Logo e cor
  primária vêm de `config_empresa` automaticamente. Layout fixo em tabela
  (compatível com Outlook): foto à esquerda; nome em negrito, cargo, telefone,
  e-mail; linha na cor primária; logo abaixo.
- **Imagem:** upload de PNG ou JPG até 500 KB, exibido inteiro no fim do
  e-mail, largura máxima 600px.

**Sem configuração:** modo HTML com o que houver (nome sempre existe).
Modo Imagem sem arquivo → cai para HTML.

**Armazenamento das imagens:** bucket `branding`, caminho
`assinaturas/<usuario_id>/{foto|imagem}-<timestamp>.<ext>`, pela action de
upload existente (`lib/actions/uploads.ts`) estendida para validar tipo e
tamanho.

## 3. Envio

**Compositor (`EmailComposer`):** recebe `assuntoInicial`, `corpoInicial` e a
prévia da assinatura (HTML) já resolvidos. Os dois call sites
(`app/propostas/nova/page.tsx`, `app/propostas/page.tsx`) obtêm isso de uma
server action nova `prepararEmailProposta(propostaId, versao)` que lê o modelo,
o perfil da sessão e o documento, e devolve `{ assunto, corpo, assinaturaHtml }`.
A assinatura aparece como prévia somente-leitura abaixo do corpo.

**Server (`enviarProposta`):**
- Resolve a assinatura pela **sessão** (nunca do cliente).
- Monta `text` = corpo + `\n\n--\n` + assinatura em texto; `html` = corpo
  escapado com `\n` → `<br>` + assinatura HTML.
- Imagens (foto, logo, PNG) vão como **anexos inline CID**, baixadas do storage
  no servidor. Falha ao baixar uma imagem → envia sem ela (não bloqueia o
  envio) e registra no detalhe do log.
- `replyTo` = e-mail de contato de quem envia. `from` inalterado (o Titan
  rejeita remetente diferente da caixa autenticada).
- `envios_email.corpo` continua guardando o texto puro enviado.

**`lib/email/smtp.ts`:** `MensagemEmail` ganha `html?`, `replyTo?` e anexos com
`cid?` opcional.

## 4. Dados

Migração `supabase/migrations/0119_email_modelo_assinatura.sql`, aditiva e
idempotente, no estilo de 0110/0118:

```sql
alter table public.config_empresa
  add column if not exists email_assunto_modelo text,
  add column if not exists email_corpo_modelo text;

alter table public.usuarios
  add column if not exists assinatura_modo text
    check (assinatura_modo in ('html','imagem')),
  add column if not exists assinatura_telefone text,
  add column if not exists assinatura_email text,
  add column if not exists assinatura_foto_path text,
  add column if not exists assinatura_imagem_path text;
```

Sem backfill: nulo = comportamento padrão.

## 5. Unidades de código

| Arquivo | Responsabilidade |
|---|---|
| `lib/email/modelo.ts` | `VARIAVEIS`, `MODELO_PADRAO`, `renderizarModelo(texto, vars)`, `tokensDesconhecidos(texto)`, `variaveisDaProposta(doc, empresa, remetente)`. Puro. |
| `lib/email/assinatura.ts` | `montarAssinatura(perfil, empresa, urls)` → `{ html, texto, imagens: {cid, path}[] }`. Puro (recebe paths, não baixa). |
| `lib/email/smtp.ts` | Suporte a `html`, `replyTo`, anexos inline. |
| `lib/db/config.ts` | Leitura/escrita dos dois campos de modelo. |
| `lib/actions/perfil.ts` | Campos de assinatura em `atualizarMeuPerfil` + leitura. |
| `lib/actions/email.ts` | `prepararEmailProposta`; `enviarProposta` monta HTML, inline e replyTo. |
| `app/configuracoes/page.tsx` | Aba "E-mail" (extrair para `components/config-email-modelo.tsx` para não inchar a página de 1.366 linhas). |
| `components/perfil-dialog.tsx` | Seção de assinatura (extrair para `components/assinatura-email-form.tsx`). |
| `components/email-composer.tsx` | Props de conteúdo inicial + prévia da assinatura. |

## 6. Erros e segurança

- Todo valor interpolado no HTML passa por escape (`& < > " '`), inclusive
  variáveis e o corpo inteiro. O corpo nunca é tratado como HTML.
- Salvar modelo exige admin (`exigirAdmin`); assinatura exige sessão e só
  altera o próprio registro.
- Upload valida MIME (`image/png`, `image/jpeg`) e tamanho no servidor.

## 7. Testes (vitest)

- `renderizarModelo`: substituição, espaços internos, conhecida vazia,
  desconhecida mantida, formatação BRL, `MODELO_PADRAO` quando vazio.
- `montarAssinatura`: modo HTML completo/parcial, modo imagem, imagem ausente
  cai para HTML, escape de HTML nos campos, CIDs corretos.
- `enviarProposta`: `html`, `replyTo` e anexos inline chegam ao `enviarEmail`
  (mock do smtp).

## 8. Contrato do mock (divergência declarada)

- **Diverge:** texto fixo do compositor; ausência de assinatura; aba nova em
  Configurações; seção nova no perfil.
- **Por quê:** o texto precisa ser da empresa, não do código, e o destinatário
  precisa saber quem enviou e como responder.
- **Substitui por:** modelo configurável com variáveis + assinatura por
  usuário (HTML ou imagem) + Reply-To de quem envia.
- **Docs a atualizar:** `docs/02-mock-contract.md`,
  `docs/12-execution-roadmap.md`, `docs/14-checklist-operacional-propostas.md`.
