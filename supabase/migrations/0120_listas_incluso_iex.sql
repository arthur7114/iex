-- 0120_listas_incluso_iex.sql
-- Listas de Incluso / Não incluso enviadas pela IEX na revisão do documento
-- Modelo A v2 (01/10/2026), aplicadas ao "Modelo padrão IEX".
--  * Só troca a lista que ainda é a padrão gravada pela 0115: se a IEX já editou
--    o modelo em Cadastros, a edição dela fica.
--  * Propostas já criadas não mudam (cada uma guarda a própria lista).
--  Idempotente: rodar de novo não altera nada.
begin;

update public.modelos_proposta
set premissas = E'Projeto executivo detalhado em REVIT, com esquemático das instalações.\nMemorial técnico descritivo e lista de materiais por disciplina.\nEntrega de ficheiros editáveis em suporte digital, nas versões DWG, PDF e IFC.\nFornecimento de ART (Anotação de Responsabilidade Técnica) junto ao CREA – CE.'
where nome = 'Modelo padrão IEX'
  and premissas = E'Projeto executivo detalhado, preferencialmente desenvolvido em Revit, quando aplicável.\nMemorial técnico descritivo e especificações de materiais.\nPlanilha quantitativa de materiais.\nEntrega de arquivos digitais nos formatos DWG, IFC e PDF, conforme o escopo contratado.\nFornecimento de ART junto ao CREA-CE para os serviços contratados.\nObservância das leis, dos regulamentos e das normas técnicas aplicáveis.\nManutenção do sigilo sobre dados e informações recebidos para o desenvolvimento dos serviços.';

update public.modelos_proposta
set exclusoes = E'Relatório de estudo do solo para desenvolvimento do projeto de cálculo estrutural.\nProjeto luminotécnico para desenvolvimento do projeto de instalações elétricas.\nTaxas e os processos de aprovação em órgãos fiscalizadores.\nAcompanhamento de obra e execução.'
where nome = 'Modelo padrão IEX'
  and exclusoes = E'Taxas e emolumentos de aprovação em órgãos fiscalizadores, salvo quando indicados expressamente.\nProjetos e serviços não listados no escopo desta proposta.\nAlterações de escopo posteriores à aprovação formal da proposta.\nLevantamentos, laudos e estudos complementares não descritos nesta proposta.\nPrazos internos de análise de concessionárias e órgãos públicos.';

insert into public._iex_migrations (name, applied_at)
select '0120_listas_incluso_iex.sql', now()
where not exists (select 1 from public._iex_migrations where name = '0120_listas_incluso_iex.sql');

commit;
