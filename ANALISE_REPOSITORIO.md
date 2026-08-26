# Análise do repositório — SMMAM Notificações

## Conclusão executiva

O **SMMAM Notificações** é uma aplicação interna de fiscalização que reúne emissão e acompanhamento de notificações, autos de infração, consulta cadastral imobiliária, rastreamento de AR, evidências fotográficas, relatórios e administração de usuários. Diferentemente do mapa territorial, ele já possui autenticação, persistência na nuvem, regras de acesso por setor e uma integração protegida para consulta de ARs.

O produto tem uma base funcional relevante, porém concentra grande parte da lógica em um único arquivo JavaScript e ainda apresenta riscos importantes de segurança, integridade e escalabilidade. A prioridade deve ser estabilizar os controles de dados pessoais e concorrência antes de ampliar os fluxos de tramitação.

## Arquitetura observada

| Camada | Implementação atual | Papel no sistema |
|---|---|---|
| Interface | SPA em HTML, CSS e JavaScript puro. | Telas de cadastro, consulta, relatórios e administração. |
| Identidade | Firebase Authentication. | Login, cadastro institucional, recuperação de senha e verificação de e-mail. |
| Dados | Cloud Firestore. | Notificações, autos, usuários, auditoria, infrações, configurações e cadastro imobiliário. |
| Arquivos | Evidências são gravadas em subcoleções do Firestore como base64; o Firebase Storage é usado para cópia auxiliar do IPTU. | Fotos e backup técnico da base cadastral. |
| Operação offline | Persistência IndexedDB do Firestore. | Continuidade limitada em navegador compatível. |
| Rastreamento de AR | Worker externo com Durable Object, segredo de provedor e token Firebase. | Consulta compartilhada e limitada de ARs pendentes. |
| Hospedagem e regras | Firebase Hosting, Firestore Rules e Storage Rules. | Entrega da SPA e autorização de acesso. |

## Funções disponíveis

| Módulo | O que faz |
|---|---|
| Autenticação e perfis | Cadastro com domínio institucional ou exceção aprovada, status pendente/aprovado/bloqueado e níveis leitor, operador e administrador. |
| Notificações | Cria, edita, arquiva, pesquisa, imprime e evita duplicidade de notificações por número e setor. Controla entrega presencial ou AR, prazos e situação documental. |
| Autos de infração | Registra autos, importa dados de uma notificação, associa infrações e calcula valor da multa por URM. |
| Infrações e legislação | Permite que administrador mantenha infrações, base legal, texto padrão e valor em URM por setor. |
| Consulta cadastral | Consulta cadastro imobiliário por lote, CPF/CNPJ, nome ou endereço e preenche o formulário da notificação a partir do imóvel selecionado. |
| Evidências | Recebe fotos, reduz resolução no navegador, mostra prévia e associa evidências ao documento. |
| Correios / AR | Exibe link oficial e, para perfil autorizado, executa sincronização compartilhada de até oito ARs por janela, com bloqueio concorrente e espaçamento entre chamadas. |
| Relatórios | Mostra gráficos de evolução, bairros, fiscais, situação, tipos e valor estimado de multas. |
| Administração | Gerencia usuários setoriais, exceções de e-mail, URM, infrações, importação delta do IPTU e auditoria. |
| Backup | Gera backup JSON setorial para administrador. |

## Objetivo de negócio atendido

O sistema busca **digitalizar a fiscalização ambiental e administrativa**, reduzindo o uso de controles paralelos. O fluxo atual permite identificar o imóvel, elaborar uma notificação ou um auto, anexar evidências, controlar retorno de AR e acompanhar um conjunto básico de indicadores. A separação por setor, a auditoria e o acesso institucional demonstram preocupação com governança.

## Pontos fortes

| Ponto | Avaliação |
|---|---|
| Separação por setor | Documentos operacionais carregam o setor e as regras versionadas restringem notificações e evidências ao setor do perfil. |
| Perfis institucionais | Há distinção entre leitor, operador e administrador, com aprovação de conta e bloqueio de acesso operacional. |
| Rastreio de AR protegido | O Worker usa token Firebase, valida o setor, mantém a chave do provedor fora do navegador, limita consultas e evita duplicidade por janela. |
| Auditoria imutável nas regras | A coleção de logs bloqueia atualização e exclusão pela regra versionada. |
| Continuidade operacional | Persistência local, backup setorial, link de contingência dos Correios e importação cadastral demonstram atenção a cenários de falha. |
| Teste mínimo existente | O repositório possui smoke test e verificações de sintaxe para os fluxos críticos. |

## Riscos e limitações identificados

| Prioridade | Achado | Consequência | Evidência |
|---|---|---|---|
| P0 | Alguns dados externos são inseridos em `innerHTML` sem escape consistente, incluindo nome de perfil, dados imobiliários e campos de documentos. | Possibilidade de XSS persistente, especialmente via importações ou dados cadastrais. | `js/app.js:705`, `840–846`, `877–906`, `1363` |
| P0 | A numeração sugerida é calculada no cliente e a checagem de duplicidade também é feita antes da gravação. | Dois operadores podem gerar o mesmo número simultaneamente. | `js/app.js:352–368`, `1198–1213` |
| P0 | Evidências fotográficas são salvas como base64 no Firestore, apesar de existir Storage. | Crescimento de custo, lentidão de leitura e risco de exceder limites de documento/consulta. | `js/app.js:1215–1218`, `1250–1252` |
| P0 | Toda conta aprovada pode ler `cadastro_imobiliario` e todas as configurações. | Exposição ampla de dados cadastrais e, possivelmente, da lista de exceções de e-mail. | `firestore.rules:43–50` |
| P1 | O log é criado pelo cliente e aceita dados textuais informados pela aplicação. | Uma conta aprovada pode registrar conteúdo de auditoria não confiável; não há garantia de identidade e horário emitidos pelo servidor. | `js/app.js:370–373`; `firestore.rules:37–41` |
| P1 | A aplicação traz cerca de 1.600 linhas em `app.js`, usa estado global em `window`, `onclick` inline e manipulação direta de DOM. | Testes, manutenção, revisão de segurança e evolução de módulos tornam-se difíceis. | `js/app.js` |
| P1 | O painel baixa todos os documentos do setor e calcula filtros, ordenação e gráficos no navegador. | Perda gradual de desempenho e custo maior conforme a base crescer. | `js/app.js:1136–1150`, `971–1033`, `1288+` |
| P1 | A importação delta do IPTU ocorre no navegador administrativo e lê/escreve base integral em Storage. | Processo pouco resiliente, sem fila, sem prévia robusta, sem trilha detalhada e com risco operacional para dado sensível. | `js/app.js:1063–1133` |
| P1 | A documentação de rastreamento descreve chave no navegador, mas o Worker utiliza segredo `RAPIDAPI_AR_KEY`. | Ambiguidade operacional e risco de configuração incorreta. | `CORREIOS_RASTREAMENTO.md:18–20`; `workers/ar-sync-worker.mjs:212` |
| P2 | A origem permitida do Worker é fixa em um único hostname. | Novo domínio, ambiente de homologação ou mudança de Hosting pode quebrar a integração. | `workers/ar-sync-worker.mjs:4–5`, `188` |
| P2 | Não há modelo formal de processo com etapas, SLA, responsável, transições controladas e documentos versionados. | O sistema controla documentos de fiscalização, mas não tramitação completa de licenciamento. | `js/app.js:1153–1233` |

## Observação sobre segurança em produção

O histórico de validação registra que as regras ativas foram inicialmente mais permissivas que as regras presentes no repositório. O documento também registra normalização dos perfis e publicação posterior das regras restritivas. Isso é positivo, mas exige uma verificação autenticada recorrente após cada implantação, pois a diferença entre regra versionada e regra efetivamente publicada é um risco relevante em sistemas com dados cadastrais e fiscais.

## Melhorias priorizadas

### P0 — Corrigir antes de ampliar o sistema

1. **Eliminar XSS persistente.** Substituir renderização de dados com `innerHTML` por criação de elementos e `textContent`, ou aplicar escape/sanitização sistemática. Não usar `onclick` inline para dados provenientes de Firestore, formulários ou importações.
2. **Tornar a numeração atômica.** Criar contador por `setor/ano/tipo` em transação Firestore ou função backend. A criação do documento e a reserva do número devem ocorrer na mesma operação.
3. **Mover fotos para Storage.** Armazenar a imagem em caminho controlado, por exemplo `setores/{setor}/notificacoes/{id}/evidencias/{uuid}`, e manter no Firestore apenas metadados, URL controlada, hash, tamanho e data de envio.
4. **Rever leitura de dados sensíveis.** Restringir `cadastro_imobiliario` ao mínimo necessário por função, setor e finalidade. Separar configurações públicas de configurações administrativas, especialmente a lista de exceções de domínio.
5. **Implementar matriz de testes de regras.** Testar, em emulador Firebase, leitura e escrita para leitor, operador, administrador, usuário pendente, usuário bloqueado e contas de outros setores.

### P1 — Melhorar confiabilidade e governança

1. **Registrar auditoria no backend.** Usar função server-side ou mecanismo equivalente para registrar UID, data do servidor, ação, setor e referência do documento. Impedir que o cliente defina livremente os campos de auditoria.
2. **Reorganizar a aplicação.** Separar autenticação, documentos, consultas cadastrais, evidências, AR, relatórios, usuários e exportações em módulos. Substituir estado global por módulos ou uma estrutura de estado controlada.
3. **Paginar e indexar consultas.** Criar listagem por páginas, filtros feitos no Firestore, ordenação indexada e agregados para painel, em vez de carregar todos os registros do setor.
4. **Profissionalizar importação do IPTU.** Mover a importação para job administrativo no backend com validação, prévia de alterações, log, retomada, relatório de erros e aprovação antes da gravação.
5. **Corrigir documentação de AR.** Definir um único modelo: chave mantida como segredo do Worker, procedimento de rotação, responsável institucional, limite mensal, contingência CSV e monitoramento de erro/cota.

### P2 — Evolução de produto

1. Criar módulo de tramitação com etapas, prazos, responsáveis, decisões, exigências, anexos e histórico imutável.
2. Integrar o mapa territorial ao cadastro de notificação e auto, sugerindo equipe responsável a partir de bairro ou distrito.
3. Criar relatórios exportáveis por período, equipe, fiscal, bairro, tipo de infração, prazo, AR e arrecadação projetada.
4. Criar notificações internas para prazo vencido, retorno de AR, documento sem evidência e fila parada.
5. Implantar ambientes separados de desenvolvimento, homologação e produção, com lista de origens do Worker configurada por ambiente.

## Roteiro de evolução recomendado

| Fase | Entrega | Critério de conclusão |
|---|---|---|
| 1. Segurança e integridade | XSS eliminado, Storage para evidências, numeração atômica, regras testadas em emulador. | Usuários de setores distintos não acessam dados indevidos e duas criações simultâneas não duplicam números. |
| 2. Sustentação | Refatoração em módulos, paginação, auditoria confiável e importação IPTU controlada. | Fluxos críticos cobertos por testes e painel opera sem carregar toda a coleção. |
| 3. Tramitação | Processo, etapas, SLA, responsáveis, documentos e fila operacional. | Cada documento possui histórico e prazo rastreável. |
| 4. Inteligência territorial | Associação com bairro/distrito/equipe e relatórios espaciais. | A gestão consegue ver demanda, prazo e produtividade por território. |

## Referências

[1] [Repositório SMMAM Notificações no GitHub](https://github.com/hateixeira/smmam-notificacoes)

[2] [`VALIDACAO_ADEQUACAO.md` do repositório](https://github.com/hateixeira/smmam-notificacoes/blob/main/VALIDACAO_ADEQUACAO.md)
