# Contrato de Mock — IEX (V0 -> V1)

A codebase atual foi gerada como um mock visual pela v0 e atua como **contrato de produto, design e navegação** absoluto.
A implementação funcional da V1 deve entrar como uma camada **por trás do mock**, não como substituição.

## O Que Deve Ser Preservado
* **Layout Geral**: sidebar, topbar, navegação principal.
* **Componentes Chave**: wizard de proposta (`wizard-stepper.tsx`), cards de dashboard (`stat-card.tsx`), tabelas, drawers/modais (`proposal-drawer.tsx`), badges de status (`status-badge.tsx`), preview visual (`document-preview.tsx`).
* **Design System**: Visual sóbrio e executivo, paleta de cores OKLCH definida em `globals.css`, espaçamentos, tipografia, componentes shadcn/ui já usados.
* **Mocks Essenciais**: Tom consultivo do copiloto de IA (`ai-copilot-panel.tsx`), assinatura discreta “Powered by YRM Strategy Lab” na sidebar.

## O Que NÃO Fazer
* **Não recrie** a aplicação do zero nem remova telas/componentes visuais existentes sem justificativa.
* **Não altere** drasticamente o design, nem o transforme em algo "high tech".
* **Não substitua** o wizard por um formulário simples ou o documento de proposta por um card resumido.
* **Não apague** dados mockados úteis de `lib/mock-data.ts`; adapte-os ou faça merge.
* **Não implemente** backend real, autenticação real ou IA real nesta fase (V1 funcional focada em frontend).
* **Não quebre** rotas existentes nem troque nomes públicos de componentes.

## Regra de Compatibilidade de Componentes
Sempre que precisar adicionar funcionalidade, siga a hierarquia:
1. Reaproveitar componente existente.
2. Estender componente existente com props ou estado.
3. Criar hook ou utilitário separado.
4. Criar novo componente apenas se não houver equivalente no mock.
5. Refatorar visual somente quando houver bug, duplicação grave ou necessidade clara.

## Contrato de Rotas (Mapeamento V0)
As rotas requeridas já existem na codebase em português. A V1 usará estritamente estas rotas existentes para evitar duplicidade:

| Rota Conceitual | Rota Existente na Codebase |
| :--- | :--- |
| `/dashboard` | `/` (`app/page.tsx`) |
| `/proposals` | `/propostas` |
| `/proposals/new` | `/propostas/nova` |
| `/proposals/[id]` | Mapeado via Drawer em `/propostas` (ou criar se necessário tela dedicada) |
| `/clients` | `/clientes` |
| `/registries` | `/cadastros` |
| `/history` | `/historico` |
| `/knowledge-base` | `/base-de-conhecimento` |
| `/settings` | `/configuracoes` |
| `/logs` | `/logs` |

## Contrato do Wizard de Propostas
O wizard visual do mock é a jornada principal. As etapas devem ser preservadas, mesmo se operando com estado local/mockado na V1:
1. Cliente
2. Empreendimento
3. Disciplinas
4. Complexidade
5. Sugestão da IA
6. Ajustes e negociação
7. Condições comerciais
8. Revisão final
9. Documento
10. Envio

## Contrato Visual da Proposta
O preview gerado (`document-preview.tsx`) deve continuar parecendo uma proposta comercial imprimível e completa, respeitando: cabeçalho institucional, cliente, obra, quadro de área, disciplinas numeradas, escopo, valores detalhados, investimento total, entregáveis, forma de pagamento, prazo, validade, encargos e assinatura.

## Contrato do Copiloto (IA Mockada)
O copiloto deve ser **visualmente discreto** e atuar como um motor local de recomendações. Ele deve explicar sugestões, sinalizar confiança e incentivar revisões humanas, mas **nunca** deve parecer um chatbot genérico, alterar valores sozinho sem ação do usuário, ou dominar a interface visual.

## Contrato de Dados
O `lib/mock-data.ts` contém clientes, propostas, disciplinas e métricas ricas. Na V1 funcional, esses dados atuarão como `seed data`. A aplicação sempre deve abrir populada e convincente.

## Comportamento Esperado & Aceite
A pergunta principal durante a implementação é: **“Como torno esta tela funcional sem destruir a experiência visual já aprovada?”**
A V1 deve ser uma evolução funcional do mock, passando pela verificação de que nenhuma tela foi removida, a interface continua consistente e madura, e o visual original está preservado.

---

## Adendo (Fase 2 — 19/06/2026): divergências autorizadas

A Fase 2 conectou o mock a um backend Supabase real. Divergências do contrato original, aprovadas pelo usuário:

- **Autenticação real (nova tela `/login`)**: o mock não previa login. Foi adicionada tela de login + `middleware.ts` de proteção de rotas, e o topbar passou a exibir o usuário autenticado real (tabela `usuarios`) com ação de Sair.
  - *Por quê*: beta multiusuário e atribuição correta dos logs de auditoria.
  - *Impacto visual*: nenhuma tela existente removida; apenas a tela de login foi adicionada (estilo sóbrio, alinhado ao design system).
- **Unificação de preços**: o cadastro de disciplinas (em `/cadastros`) passou a ser a fonte única, incluindo o **valor mínimo**. O "Rate-Card" de `/configuracoes` foi substituído pelo editor de **fatores de complexidade**.
- **Etapa de complexidade opcional** no wizard (toggle "pular complexidade").
- **Backend real nesta fase**: a regra original "não implementar backend real na V1" foi superada por decisão do usuário ("ir até o fim; só a IA fica para depois"). A IA permanece fora de escopo.

O restante do contrato (layout, wizard, preview do documento, copiloto discreto, assinatura YRM) permanece preservado.
