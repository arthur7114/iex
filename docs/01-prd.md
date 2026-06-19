# Master PRD — IEX Gestor de Propostas (resumo executável)

> Fonte de verdade do escopo. A IA/copiloto (PRD 006) está **adiada** por decisão do usuário ("só a IA fica para um segundo momento"). Todo o restante do MVP deve estar completo.

## Visão
App web B2B interno para elaborar, precificar, revisar, gerar (Word/PDF), enviar (e-mail) e acompanhar propostas de engenharia. IA é **copiloto** (não decisor) — adiada. Princípios: rastreabilidade > automação; dados recentes (12m) priorizados; wizard guiado + revisão consolidada editável; documento padronizado mas editável.

## MVP obrigatório (6.2) — status
- [x] Login multiusuário + log de ações relevantes (login, criação, alteração de preço, geração, envio, mudança de status)
- [~] CRUD: clientes, tipos de empreendimento, disciplinas, variáveis de complexidade, origens, motivos de perda, formas de pagamento — *(falta editar/excluir cliente; campos completos)*
- [~] Configurações da empresa: **logomarca, cores, assinatura visual, e-mail padrão, dados bancários** — *(faltam uploads + wiring no documento)*
- [ ] Importação de histórico por planilha padrão (CSV) → `historico_importado` → validar → criar propostas
- [~] Base de conhecimento: CRUD de documentos + **upload de arquivos** (Storage) — *(registro pronto; falta upload)*
- [x] Wizard de criação de proposta (10 etapas; IA opcional/adiada)
- [x] Motor de precificação por m² com fatores de ajuste
- [ ] Registro de **ajuste de preço** (valor sugerido/final/variação/justificativa) em `ajustes_preco`
- [ ] **Versão da proposta** (snapshot) em `versoes_proposta`
- [x] Revisão final consolidada
- [ ] Geração de **Word** e **PDF** (com logomarca, assinatura, "Powered by YRM Strategy Lab")
- [x] Edição do texto da proposta antes de exportar (wizard)
- [ ] **Envio por e-mail** com cópias, texto editável, anexo Word/PDF → registra `envios_email` + status
- [x] Gestão de status (Em elaboração / Enviada / Aprovada / Perdida) + motivo na perda
- [~] Dashboard comercial — *(faltam: tipos de empreendimento, clientes por qtd/valor, motivos de perda, volume enviadas/aprovadas/perdidas, filtros)*
- [ ] **Edição/reabertura** de proposta existente (resume via `wizard_step`)
- [ ] **Modelos de proposta** (`modelos_proposta`) aplicáveis no wizard
- [ ] **Gestão de equipe** (criar/gerenciar logins `usuarios`, sem níveis de permissão)
- [ ] IA copiloto (PRD 006) — **ADIADO**

## Jornadas (7) e PRDs (001–011)
1. Acesso/login + log. 2. Config empresa (logo/cores/assinatura/e-mail). 3. Cadastros-base (incl. modelos + base conhecimento). 4. Importação de histórico (planilha padrão, validação, alertas). 5. Wizard (Cliente→Empreendimento→Disciplinas→Complexidade→[IA]→Ajustes→Condições→Revisão→Documento→Envio). 6. Sugestão IA (adiado). 7. Alteração de valor (registra ajuste). 8. Geração+envio (Word/PDF, logomarca/assinatura, e-mail). 9. Gestão de status. 10. Dashboard.

## Entidades-chave (já no banco Supabase)
Usuário(`usuarios`), Cliente(`clientes`), Proposta(`propostas`), itens(`proposta_itens`), eventos(`proposta_eventos`), Disciplina(`disciplinas`), Tipo(`tipos_empreendimento`), Variável complexidade(`variaveis_complexidade`), Sugestão IA(`sugestoes`-adiado), Ajuste(`ajustes_preco`), Histórico importado(`historico_importado`), Doc base conhecimento(`documentos`), Modelo(`modelos_proposta`), Versão(`versoes_proposta`), Motivo perda(`motivos_perda`), Origem(`origens_cliente`), Envio e-mail(`envios_email`), Log(`logs_uso`), Config empresa(`config_empresa`), Config precificação(`config_precificacao`), Forma pagamento(`formas_pagamento`).

## Documento (PRD 008) — estrutura
capa/identificação, cliente, obra, quadro de área, serviços, disciplinas + descrições, valores por disciplina, investimento total, premissas, exclusões, condições de pagamento, prazo, validade, encargos (contratante/contratada), observações, assinatura, "Powered by YRM Strategy Lab".

## Categorias iniciais (PRD 002)
Origens: indicação, **BNI**, redes sociais, site, cliente recorrente, arquiteto, evento, empresa parceira, outro. Motivos perda: preço alto, concorrente, cancelado, sem retorno, prazo, escopo mudou, sem orçamento, fora do perfil, outro. Tipos: hospital, hotel, loja, residencial, condomínio, indústria, escola, clínica, galpão, retrofit, misto.

## Fora de escopo (MVP)
CRM completo, permissões por papel, aprovação jurídica, integração financeira/ERP, tributário, leitura de plantas, transcrição, áudio, assinatura digital jurídica, aprovação automática de desconto, geração sem revisão humana, RAG avançado.

## Não-funcionais
Dados comerciais sensíveis; auth individual; logs de ações críticas; auditoria de valor sugerido/final/variação/usuário + versões + envio/status; exportações preservam formatação; e-mails registram sucesso/falha; importações validam antes de gravar.
