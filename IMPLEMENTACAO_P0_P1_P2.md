# Implementação P0, P1 e P2

Este documento registra as mudanças entregues no código e as ações necessárias para habilitá-las em homologação e produção. Nenhuma migração, regra, função ou configuração de produção foi publicada automaticamente.

## P0 — Segurança e integridade

| Entrega | Implementação incluída | Ação de infraestrutura pendente |
|---|---|---|
| Neutralização de XSS | Dados de perfil, consulta cadastral, espelho imobiliário, painel operacional, infrações e impressão passam por escape ou são construídos com nós DOM. | Executar testes com cargas maliciosas em homologação. |
| Numeração atômica | A função `reserveDocumentNumber` e a criação `createDocument` reservam sequências por setor, ano e tipo em transação. | Implantar Cloud Functions e publicar regras. |
| Evidências no Storage | Novas evidências são enviadas para `evidencias/{setor}/{documento}/{uuid}`; Firestore guarda metadados. A função `migrateLegacyEvidenceBatch` migra legados em lotes. | Executar migração em homologação e depois por lotes em produção com backup. |
| Menor privilégio | Regras restringem criação direta de documento, auditoria por cliente, acesso cadastral de leitor e caminhos de Storage. | Publicar regras somente após matriz de testes em emulador. |

## P1 — Sustentação e governança

| Entrega | Implementação incluída | Ação de infraestrutura pendente |
|---|---|---|
| Modularização | Funções de sanitização, workflow, território, evidências e relatórios foram extraídas para `js/core/` e `js/services/`. | Evoluir gradualmente outros fluxos legados para módulos nas próximas PRs. |
| Auditoria confiável | `recordAuditEvent`, `createDocument` e `moveProcessStage` gravam eventos no backend com UID e horário do servidor. | Implantar Cloud Functions. |
| Paginação | A lista carrega até 50 documentos por vez e apresenta `Carregar mais documentos`. | Publicar índices adicionais. |
| Importação IPTU | A interface envia JSON para `iptu_imports/` e cria job em `iptu_import_jobs`; `processIptuImport` processa em backend. | Implantar Function, Storage Rules e verificar teto do job. |

## P2 — Tramitação e relatórios

| Entrega | Implementação incluída | Ação de infraestrutura pendente |
|---|---|---|
| Tramitação | Etapas configuradas: recebido, triagem, análise técnica, vistoria, aguardando complementação, parecer, decisão, deferido, indeferido e arquivado. | Validar as etapas e prazos com a chefia antes da publicação. |
| SLA | Função diária `refreshSlaStatus` atualiza situação de prazo; interface mostra etapa e situação de SLA. | Habilitar Scheduler na conta de produção. |
| Território | O bairro é associado à Equipe 1, Equipe 2 ou distrito pela referência territorial vigente. | Publicar a configuração territorial validada quando houver mudança de divisão. |
| Relatórios | Exportação CSV de relatório gerencial por etapa, SLA, bairro, equipe, fiscal e situação. | Validar modelo institucional de relatório e política de exportação de dados pessoais. |

## Sequência segura de publicação

1. Criar projeto Firebase de homologação e configurar contas de teste aprovadas para pelo menos dois setores.
2. Instalar dependências em `functions/` e implantar apenas no ambiente de homologação.
3. Publicar `firestore.rules`, `storage.rules` e `firestore.indexes.json` em homologação.
4. Testar criação concorrente de pelo menos cem documentos e confirmar números únicos.
5. Testar upload, edição, remoção e leitura de evidências por leitor, operador, admin e outro setor.
6. Rodar migração de evidências em lote pequeno, comparar metadados e validar recuperação de imagem.
7. Testar tramitação, justificativa, histórico, SLA e exportação de relatório.
8. Executar backup recuperável, anexar os relatórios de teste e solicitar aprovação institucional para produção.

## Comandos de validação local

```bash
node --check js/app.js
node --check functions/index.js
node scripts/smoke-test.mjs
git diff --check
```

Para Cloud Functions, instale as dependências a partir de `functions/` e valide o carregamento do módulo antes de implantar. O ambiente de desenvolvimento pode usar Node 22, mas a configuração de Functions permanece em Node 20 para compatibilidade de runtime.

## Limites conscientes

O código não publica regras, Cloud Functions, jobs, dados ou segredos em produção. Essas operações dependem da conta institucional, projeto Firebase correto, habilitação de cobrança/Cloud Scheduler quando exigido e aprovação dos portões previstos no plano autônomo. A automação e os testes estão preparados para reduzir intervenção humana, mas não substituem a autorização de segurança e negócio.
