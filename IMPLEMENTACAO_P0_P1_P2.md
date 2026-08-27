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

## Complemento legal — LC Municipal nº 6/1996

| Fluxo | Implementação incluída | Homologação institucional obrigatória |
|---|---|---|
| Notificação | O campo de prazo manual foi substituído por **regularização em 60 dias corridos** a partir da data de recebimento; a data-limite e a situação são calculadas no backend. | Confirmar a redação vigente do Art. 25, a prova válida de recebimento e a regra aplicável a cada modalidade de ciência. |
| Auto de Infração | O Auto passou a registrar a **data de ciência** e a calcular **defesa escrita em 8 dias corridos**, com alerta em formulário, listagem, impressão e relatórios. | Confirmar o marco de ciência, inclusive em intimação postal, recusa, edital ou certidão, conforme o procedimento municipal. |

A fonte consultada é a compilação vigente da LC Municipal nº 6/1996 no SAPL da Câmara Municipal de Bento Gonçalves. A regra implantada conta dias corridos a partir do dia seguinte à data de recebimento ou ciência informada. O Art. 29, §1º, que trata de pagamento após ciência de decisão que mantém a penalidade, está registrado em `BASE_LEGAL_PRAZOS_DEFESA.md`, mas não foi automatizado nesta entrega, pois exige modelagem própria da fase decisória e confirmação jurídica. [1]

## Novo modelo de notificação e parâmetros

O modelo de notificação foi adaptado para incluir RG/CNH, motivo específico, orientações, texto de apresentação e uma prévia obrigatória antes da gravação. Administradores podem definir, por setor, o prazo de regularização, o prazo de defesa, textos padrão e endereço de apresentação; o valor de URM é atualizado juntamente com esses parâmetros. O backend grava uma cópia em cada nova emissão para preservar a forma e o conteúdo documental vigentes naquele momento.

Antes da produção, validar em homologação: a configuração por cada setor autorizado, a restrição de operador/leitor, a prévia sem gravação, a confirmação que gera numeração atômica, a impressão em A4/PDF e o CSV VIPP. O CSV VIPP deve continuar contendo nome, endereço, número, complemento, bairro, cidade, UF, CEP, telefone, CPF/CNPJ, modalidade de AR e identificador da notificação.

## Sequência segura de publicação

1. Criar projeto Firebase de homologação e configurar contas de teste aprovadas para pelo menos dois setores.
2. Instalar dependências em `functions/` e implantar apenas no ambiente de homologação.
3. Publicar `firestore.rules`, `storage.rules` e `firestore.indexes.json` em homologação.
4. Testar criação concorrente de pelo menos cem documentos e confirmar números únicos.
5. Testar upload, edição, remoção e leitura de evidências por leitor, operador, admin e outro setor.
6. Rodar migração de evidências em lote pequeno, comparar metadados e validar recuperação de imagem.
7. Testar tramitação, justificativa, histórico, SLA, prazo de regularização, defesa escrita e exportação de relatório.
8. Validar, com jurídico e chefia, ao menos os cenários de recebimento presencial, AR entregue, recusa, ausência de ciência e intimação da decisão.
9. Executar backup recuperável, anexar os relatórios de teste e solicitar aprovação institucional para produção.

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

## Referência

[1] [Câmara Municipal de Bento Gonçalves — Lei Complementar nº 6/1996, texto atual](https://sapl.camarabento.rs.gov.br/norma/4045)
