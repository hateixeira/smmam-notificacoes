# Plano estruturado e autônomo — P0, P1 e P2

## Objetivo

Executar a evolução do SMMAM Notificações em entregas pequenas, reversíveis e verificáveis, com o máximo de automação e o mínimo de intervenção humana. O plano não pressupõe que uma pessoa aprove alterações de código uma a uma; a intervenção humana fica limitada a decisões que podem afetar dados de produção, segurança, domínio, orçamento ou continuidade do serviço.

> **Princípio operacional:** automação pode preparar, testar, criar migrações, publicar em homologação e produzir relatórios. Produção só avança quando houver backup, evidência de teste e autorização explícita do gestor responsável.

## Papéis mínimos

| Papel | Responsabilidade | Presença necessária |
|---|---|---|
| Executor técnico | Implementa alterações, abre pull requests, executa testes e atualiza documentos. | Automatizável na maior parte do ciclo. |
| Gestor funcional | Valida fluxos de fiscalização, textos legais, etapas e indicadores. | Somente nos portões de aceite. |
| TI municipal / DPO | Autoriza dados, identidade, domínio, firewall, LGPD e produção. | Somente em migrações, DNS, segredos e publicação. |
| Administrador de produção | Aciona a publicação aprovada e confirma monitoramento. | Pode ser TI municipal ou pipeline institucional. |

## Portões humanos obrigatórios

| Portão | Motivo | Decisão esperada |
|---|---|---|
| G1 — Backup e escopo | Há dados pessoais, imobiliários e fiscais. | Confirmar backup recuperável e escopo da mudança. |
| G2 — Regras e migração | Regras podem bloquear acesso legítimo ou expor dados. | Aprovar execução em produção após testes de perfil. |
| G3 — DNS, certificado e domínio | Mudanças de domínio dependem da infraestrutura municipal. | Autorizar registros DNS e janela de corte. |
| G4 — Publicação | A versão afeta operação diária. | Autorizar a promoção de homologação para produção. |

## Automação transversal

| Capacidade | Implementação recomendada | Resultado automático |
|---|---|---|
| Qualidade de código | Pipeline de CI em cada pull request. | Sintaxe, formatação, análise estática e smoke test. |
| Segurança de regras | Testes de emulador com matriz de perfis e setores. | Relatório de permissões permitidas/negadas. |
| Dependências | Atualização automatizada com aprovação por PR. | Correções de segurança rastreáveis. |
| Dados | Migrações idempotentes com modo `dry-run`. | Prévia, contagem e relatório de exceções. |
| Publicação | Pipeline com ambiente de homologação e promoção por tag. | Artefato versionado e rollback imediato. |
| Observabilidade | Logs centralizados, alerta de erro e teste sintético de login. | Evidência de disponibilidade e falhas. |

## P0 — Segurança e integridade

### Objetivo da fase

Eliminar riscos de execução de script, colisão de numeração, armazenamento inadequado de evidências e acesso excessivo a dados cadastrais. Esta fase deve ser concluída antes de acrescentar novas funções de tramitação.

| Item | Execução autônoma | Entrega | Critério de aceite |
|---|---|---|---|
| P0.1 — Baseline | Criar tag de versão, exportar configurações e rodar testes atuais em homologação. | Inventário e checksum de backup. | Backup restaurável testado em ambiente isolado. |
| P0.2 — XSS | Substituir inserção de dados por `textContent`/nós DOM; banir `onclick` inline; criar testes com payloads maliciosos. | PR de saneamento de renderização. | Nenhum dado de Firestore/formulário é interpretado como HTML. |
| P0.3 — Numeração atômica | Criar serviço transacional para contador por `setor/ano/tipo`; impedir criação direta sem número reservado. | Contador e testes de concorrência. | Cem solicitações concorrentes não geram duplicidade. |
| P0.4 — Evidências no Storage | Criar estrutura de arquivos por setor/documento, metadados no Firestore e migração com leitura compatível de registros antigos. | Upload novo e migrador idempotente. | Fotos não são mais gravadas como base64 em novos registros; amostra migrada confere hash e contagem. |
| P0.5 — Menor privilégio | Separar leitura cadastral e configurações administrativas; testar matriz de perfis, setores e documentos. | Regras revisadas e testes de emulador. | Leitor, operador, admin e usuários externos só acessam o necessário. |

### Sequência operacional P0

1. Criar branch `release/p0-seguranca-integridade` e tag da produção atual.
2. Executar backup lógico de Firestore, Storage e regras; testar restauração em projeto isolado.
3. Implementar P0.2 e P0.3 sem alterar dados existentes; publicar automaticamente em homologação.
4. Executar testes de interface, regras, concorrência e regressão de impressão/AR.
5. Implementar P0.4 em modo leitura dupla: novos uploads usam Storage; evidências antigas continuam legíveis.
6. Executar migração de evidências em lotes pequenos, com `dry-run`, relatório e retomada segura.
7. Aplicar P0.5 em homologação e executar a matriz completa de permissões.
8. Gerar relatório de aceite, solicitar G1 e G2, e só então promover para produção.

### Reversão P0

Cada mudança deve possuir feature flag. A migração de imagens nunca apaga a evidência original durante a primeira publicação. A reversão retorna o frontend à tag anterior, restaura regras publicadas anteriormente e desativa gravações novas no caminho de Storage. Somente após período de estabilidade e backup validado as evidências base64 podem ser eliminadas por processo separado e aprovado.

## P1 — Sustentação, desempenho e governança

### Objetivo da fase

Tornar o sistema sustentável para crescimento de usuários e volume de documentos, reduzindo dependência de estado global e operações pesadas no navegador.

| Item | Execução autônoma | Entrega | Critério de aceite |
|---|---|---|---|
| P1.1 — Modularização | Dividir a aplicação em módulos de autenticação, documentos, AR, evidências, consulta, relatórios, administração e UI. | Estrutura de módulos e testes unitários. | Nenhum módulo crítico depende de estado global não documentado. |
| P1.2 — Auditoria confiável | Criar endpoint/backend que grava UID, horário do servidor, setor, ação e referência. | Eventos imutáveis de auditoria. | O cliente não define livremente autor ou data do log. |
| P1.3 — Listagens escaláveis | Adicionar paginação por cursor, filtros indexados e agregados de painel. | Listagem paginada e índices. | Painel não baixa todos os documentos do setor. |
| P1.4 — Importação IPTU | Mover importação a job administrativo com arquivo temporário, prévia, validação e relatório. | Processo de importação com fila. | Falha parcial não corrompe base; operação pode retomar. |
| P1.5 — Operação AR | Unificar documentação, rotação de segredo, monitoramento de cota e alertas de erro. | Runbook e painel de saúde. | Chave não aparece no navegador e falhas são rastreáveis. |

### Execução por ondas

**Onda 1:** modularização sem alterar contratos de dados. **Onda 2:** consultas paginadas e índices. **Onda 3:** auditoria de backend e job de importação. **Onda 4:** observabilidade e documentação de AR. Cada onda abre pull request, executa homologação automática, mede tempo de resposta e só avança quando não houver regressão.

## P2 — Tramitação, território e inteligência gerencial

### Objetivo da fase

Converter a aplicação de cadastro de documentos em plataforma de tramitação rastreável, conectada à divisão territorial e capaz de emitir relatórios institucionais.

| Item | Execução autônoma | Entrega | Critério de aceite |
|---|---|---|---|
| P2.1 — Processo e etapas | Criar entidades de processo, etapa, movimentação, responsável, prazo e decisão. | Fluxo configurável e histórico imutável. | Toda alteração de etapa tem autor, data, motivo e referência. |
| P2.2 — SLA | Calcular prazo por tipo/etapa e gerar alertas internos. | Fila de vencidos e próximos do vencimento. | Testes cobrem fins de semana, exceções e reabertura. |
| P2.3 — Integração territorial | Associar bairro/distrito/equipe, reutilizando a base territorial validada. | Fila e mapa por responsabilidade. | Novo processo sugere equipe e permite correção auditada. |
| P2.4 — Relatórios | Gerar indicadores por período, equipe, bairro, tipo, etapa, prazo e fiscal. | Painel e exportação CSV/XLSX. | Filtros e totais conferem com dados fonte. |
| P2.5 — Notificações internas | Alertar por vencimento, AR, pendência e fila parada. | Central de alertas e preferências. | Alertas não duplicam e respeitam permissões. |

### Decisões humanas necessárias em P2

As etapas processuais, prazos legais, tipos de licenciamento, modelos de documento, regras de arquivamento e indicadores oficiais precisam de aprovação funcional. A automação pode estruturar o modelo e apresentar uma prévia, mas não deve inventar regras administrativas ou legais.

## Cadência recomendada

| Fase | Duração técnica estimada | Autonomia | Aprovação mínima |
|---|---|---|---|
| P0 | 3 a 5 sprints curtos | Alta em desenvolvimento e homologação. | G1 e G2. |
| P1 | 4 a 6 sprints curtos | Alta por ondas. | G2 para auditoria/importação. |
| P2 | 6 a 10 sprints curtos | Média; regras de negócio exigem validação. | G2 e G4 por módulo. |

Os prazos são estimativas de planejamento e devem ser recalibrados após a primeira linha de base de testes e o volume real de dados.

## Definition of Done comum

Uma entrega só é considerada concluída quando possui código revisado, teste automatizado, documentação atualizada, migração reversível quando aplicável, evidência de homologação, análise de segurança e plano de rollback. Para produção, soma-se aprovação do portão correspondente e monitoramento de estabilidade após a publicação.

## Referências

[1] [Firebase — Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)

[2] [Firebase — Cloud Storage Security Rules](https://firebase.google.com/docs/storage/security)
