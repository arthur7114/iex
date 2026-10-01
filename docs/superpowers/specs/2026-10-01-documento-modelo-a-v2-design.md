# Documento da proposta no layout "Modelo A v2" — design

Data: 2026-10-01 · Status: aprovado em conversa, aguardando revisão da spec

## Problema

O PDF, o Word e a prévia da proposta têm um layout funcional, mas simples. A
IEX pediu um documento "dentro da identidade visual da IEX, com imagens de
engenharia e elementos gráficos modernos". Três modelos foram apresentados em
PDF; a IEX escolheu o **Modelo A** com dois ajustes:

1. capa no design do Modelo C (bloco navy diagonal + faixa dourada);
2. apresentação com foto dos sócios (Alderi e João Paulo), mapa do Brasil e
   números de impacto.

Depois, o Alderi pediu a marca completa "IEX PROJETOS" (já aplicada no app em
`ad00bce` e `d4d75dc`). O resultado aprovado é o **Modelo A v2**, montado como
HTML fora do repositório e usado aqui como referência visual.

## Objetivo

PDF, prévia na tela e Word passam a seguir o Modelo A v2, com o mesmo conteúdo
dinâmico de hoje.

Fora de escopo: conteúdo institucional editável em Configurações, layouts
alternativos por proposta, geração no servidor.

## Decisões

| Tema | Decisão | Motivo |
|---|---|---|
| Escopo | PDF + prévia + Word | Pedido do Arthur; Word aceito com aproximações |
| Motor do PDF | jsPDF no navegador, reescrito | Sem mudar a infra do Easypanel; texto selecionável |
| Conteúdo institucional | Fixo no código | App é só da IEX; trocar número exige deploy |
| Paleta | Fixa da marca | Layout depende do navy/dourado; `corPrimaria` deixa de afetar o documento |
| Rodapé YRM | Mantido | Contrato do mock (`docs/02`) |

## 1. Arquitetura

### `lib/document/layout-a.ts` (novo)

Fonte única do layout, sem dependência de jsPDF, docx ou React:

- **Paleta:** navy `#0f1c33` (capa) e `#1f3152` (cabeçalhos/total), painel da
  foto `#172b4d`, dourado `#c09a55`, azul-claro `#75c2e3`, tinta `#1d2433`,
  cinza `#6b7486`, linha `#e3e7ee`, faixa `#f4f6fa`.
- **Conteúdo fixo:** texto "Quem somos", os 3 números (+1.400 projetos
  aprovados; 32 hospitais e clínicas; +600 lojas em 36 shopping centers),
  4 especialidades com itens, 3 diferenciais (BIM, quantitativos, aprovações
  CAGECE/ENEL/Bombeiros) e 4 etapas genéricas (Levantamento, Anteprojeto,
  Compatibilização, Executivo).
- **Funções puras:**
  - `tituloCapa(empreendimento)` → `[linha1, linha2?]`, quebrando em " — ".
  - `subtituloCapa(itens)` → "Projetos executivos de: elétrica, hidráulica e SPDA".
  - `iconeDisciplina(nome)` → chave de ícone por palavra-chave (elétric,
    hidr, sanit, incênd, clima/ar-cond, spda, cftv/dados/telecom, gás,
    estrut, fotovolt); `"generico"` quando nada casa.
  - `percentual(valor, total)` → número com uma casa.
  - `fichaEmpreendimento(doc)` → pares rótulo/valor sem os vazios.
  - `paginar(blocos, alturaUtil)` → distribui blocos com altura conhecida
    em páginas, sem partir um bloco indivisível (disciplina, linha de lista,
    título + primeiro item).

### Imagens e fonte (`public/documento/`, `public/fonts/`)

PNG gerados uma vez a partir dos arquivos do modelo e do folder oficial da IEX
(jsPDF e docx não leem SVG com segurança):

- `logo-branco.png`: logo IEX PROJETOS branco;
- `socios.png`: foto dos sócios, fundo `#172b4d`;
- `mapa-brasil.png`: mapa;
- `predio-blueprint.png`: prédio da página de metodologia;
- `capa-rede.png`: desenho técnico da capa;
- `capa-word.png`: capa inteira para o Word;
- `quem-somos.png`: painel inteiro para o Word;
- ícones das disciplinas.

Fonte Manrope (400/600/700/800) em TTF, embutida no PDF.

### PDF: `lib/document/pdf.ts` reescrito

- `gerarPdf(doc, empresa): Promise<Blob>`, agora **assíncrono**: carrega a
  fonte e as imagens, com cache em memória após a primeira vez. As chamadas em
  `app/propostas/page.tsx`, `app/propostas/nova/page.tsx` e
  `components/proposal-drawer.tsx` recebem `await`.
- Capa desenhada com polígonos (bloco diagonal e faixa), não como imagem.
- Páginas internas com cabeçalho navy (logo, título da seção, `numero · Vn`) e
  rodapé (razão social, endereço e telefone de `EmpresaDoc`, "Powered by YRM
  Strategy Lab" e `NN / TT`). O total de páginas é preenchido depois de
  desenhar tudo.
- Escopo e condições paginam com `paginar`; o cabeçalho se repete na
  continuação.

### Prévia: `components/document-preview.tsx` reescrita

Componente React com as mesmas seções, em "folhas" A4 empilhadas (largura
fixa, sombra), usando a paleta e o conteúdo de `layout-a.ts` e as mesmas
imagens. Não pagina por altura: escopo e condições crescem dentro da folha.
`DocumentData` não muda.

### Word: `lib/document/word.ts` reescrito

- **Capa:** `capa-word.png` atrás do texto, com título, subtítulo e dados
  editáveis por cima.
- **Quem somos:** `quem-somos.png` como imagem; os dados do empreendimento são
  tabela editável.
- **Restante:** cabeçalho e rodapé do Word com o mesmo conteúdo do PDF;
  disciplinas, total, parcelas e listas em tabelas com sombreamento.
- **Fonte:** Manrope declarada; sem embutir. Onde não houver a fonte, o Word
  troca por outra.

## 2. Conteúdo por página

| Página | Conteúdo | Origem |
|---|---|---|
| Capa | Título | `empreendimento` via `tituloCapa` |
| | Subtítulo | `itens` via `subtituloCapa` |
| | Cliente / A/C | `cliente`, `contato` (A/C some se vazio) |
| | Proposta | `identificacaoDocumento(numero, versao)` |
| | Emitida em / validade | data da geração; `validade` |
| 2 · Apresentação | Texto | `apresentacao`, ou o texto padrão atual |
| | Quem somos | fixo |
| | Dados do empreendimento | `fichaEmpreendimento`: cliente, contato, tipo, cidade/UF, área, nº de disciplinas |
| 3 · Metodologia | BIM, diferenciais, especialidades, etapas | fixo |
| 4+ · Escopo | Por disciplina: ícone, nome, escopo, valor | `itens` |
| | Investimento total | `total` |
| Última · Condições | Parcelas com % | `parcelas` (só `formaPagamento` quando não há parcelas) |
| | Prazo, validade | `prazoExecucao`, `validade` |
| | Dados bancários | `empresa.dadosBancarios` (bloco some se vazio) |
| | Incluso / Não incluso | `premissas` / `exclusoes` (coluna some se vazia) |
| | Observações | `observacoes` (bloco novo, só se houver) |
| | Aceite | `empresa.assinaturaDataUrl` acima da linha; `assinaturaDoDocumento` (regra atual); linha do cliente com `contato` ou `cliente` |

Valores sempre com centavos (`brl`). Versões já emitidas, ao serem baixadas de
novo, usam os dados congelados do snapshot no layout novo.

## 3. Erros e casos-limite

- **Imagem ou fonte que não carrega:** o PDF sai mesmo assim, com Helvetica
  ou sem aquela imagem, sem lançar erro. Mesmo comportamento atual do logo
  (`try/catch` em `addImage`).
- **Nome de empreendimento longo:** a quebra automática fica limitada a 3
  linhas na capa.
- **Disciplina com escopo maior que uma página:** é a única que pode ser
  partida, por linha de escopo.
- **Proposta sem itens:** a página de escopo mostra só o total.

## 4. Validação

**Testes (vitest)**
- **`layout-a.ts`:** todas as funções puras.
- **`paginar`:** proposta curta (5 páginas); 12 disciplinas (escopo em 2+
  páginas, sem partir disciplina); proposta sem parcelas, premissas ou
  observações.
- **PDF gerado no teste:** nº de páginas; texto contém valores com centavos,
  "IEX Projetos" e "Powered by YRM Strategy Lab".
- **Word gerado no teste:** o mesmo, lendo o XML interno do .docx.

**Visual**
- **PDF:** renderizado no Chrome e no PDFKit do macOS (mesmo motor do iPhone),
  comparado lado a lado com o Modelo A v2.
- **Prévia:** página temporária local com dados de exemplo, fora do commit,
  porque a tela real exige login.
- **Word:** convertido para PDF pelo LibreOffice, se disponível; senão o .docx
  vai ao Arthur.

## 5. Entrega

Um commit por etapa:

1. Imagens, fonte, `layout-a.ts` e testes.
2. PDF. **Ponto de parada:** PDF de exemplo gerado pelo app enviado ao Arthur
   para aprovação.
3. Prévia.
4. Word.
5. Docs:
   - adendo em `docs/02-mock-contract.md`: o que diverge, por quê, o que
     substitui e o que se preserva (conteúdo completo, hierarquia, rodapé YRM,
     jornada do wizard);
   - `docs/12-execution-roadmap.md`;
   - estrutura do documento em `docs/01-prd.md`.

Nada vai para a `main` sem ordem explícita.

## Ajustes do plano (2026-10-01)

- **Quem somos no Word:** tabela nativa (foto, mapa e números em texto), no
  lugar de imagem única. Fica editável e não duplica os números.
  `quem-somos.png` não existe.
- **Metodologia:** foto, degradê e cantos vêm prontos em
  `public/documento/metodologia.png` (gerado por
  `scripts/documento/rasterizar.mjs`); não há `predio-blueprint.png` em
  `public/`.
- **Prévia:** `DocumentData` não traz dados da empresa. O rodapé usa
  `EMPRESA_PADRAO`, e a prévia não mostra a imagem de assinatura nem os dados
  bancários.
- **Middleware:** `.ttf`, `.woff` e `.woff2` saem do matcher, para a fonte
  carregar como estático.
- **Medidas:** área útil das páginas internas de 27 mm a 276 mm do topo.
- **Revisão da IEX (01/10/2026):** "Quem somos" com o texto institucional da
  IEX abaixo do painel (sem título nem resumo no painel); ordem Capa → Quem
  somos → Metodologia (Como trabalhamos, Nossas especialidades) →
  Apresentação + Dados + Escopo → Condições; "Etapas deste projeto" removida.
