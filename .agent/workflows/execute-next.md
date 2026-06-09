# Workflow: Execute Next (IEX)

Usado para continuar a implementação a partir do roadmap de execução.

## Passos

1. Ler `docs/12-execution-roadmap.md` — identificar o próximo passo ou melhoria não implementada.
2. Ler `docs/02-mock-contract.md` — entender a especificação de UI/UX e os modelos de dados daquela funcionalidade.
3. Classificar o request como COMPLEX.
4. Planejar a implementação antes de codificar:
   - Quais componentes e páginas serão criados ou modificados.
   - Quais utilitários do mock data serão reutilizados.
   - Como será gerenciado o estado local/in-memory para simular a ação.
5. Implementar as mudanças.
6. Validar localmente rodando `pnpm lint && pnpm build`.
7. Atualizar `docs/12-execution-roadmap.md`:
   - Marcar o item correspondente como concluído.
   - Registrar decisões comerciais/técnicas e arquivos modificados.
   - Indicar o próximo passo.
8. Atualizar `docs/02-mock-contract.md` se houver alteração de interface ou estrutura de dados em relação ao planejado.
