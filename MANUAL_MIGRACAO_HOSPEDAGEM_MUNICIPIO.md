# Manual de migração e hospedagem no ambiente municipal

## Finalidade

Este manual orienta a transferência controlada do SMMAM Notificações para infraestrutura e domínio oficiais do Município. Ele foi escrito para TI municipal, responsáveis pelo sistema e empresa contratada. O procedimento evita expor dados, interromper a fiscalização ou alterar produção sem retorno possível.

> **Atenção:** o sistema atual depende de Firebase Authentication, Firestore, Storage e de um Worker de AR. Copiar apenas `index.html`, `css/` e `js/` para um servidor municipal não transfere o backend, a identidade, as regras, os dados nem o rastreamento de AR.

## Modelos viáveis de hospedagem

| Abordagem | Como funciona | Vantagens | Limitações | Complexidade |
|---|---|---|---|---|
| A. Domínio municipal com serviços gerenciados atuais | O site usa um subdomínio oficial, mas mantém Firebase e Worker como serviços de aplicação. | Menor risco, menor prazo, preserva autenticação/dados atuais. | Dados continuam em provedor externo; exige contrato e governança adequados. | Baixa a média. |
| B. Frontend em servidor municipal, dados gerenciados atuais | Nginx/IIS municipal hospeda a SPA; Firebase e Worker permanecem temporariamente. | Site passa a ser servido por infraestrutura municipal; migração gradual. | Ainda depende de Firebase/Worker; exige ajustar origens autorizadas. | Média. |
| C. Migração integral para ambiente municipal | Frontend, API, identidade, banco, arquivos, jobs e AR passam para infraestrutura municipal. | Maior soberania e controle de dados. | Requer reescrever integrações Firebase, migrar dados, operar backup/monitoramento e manter equipe. | Alta. |

**Recomendação:** adotar **A ou B** como primeira etapa. A opção C deve ser um projeto próprio, com homologação, plano de dados, requisitos de segurança e operação contínua. Para um sistema web comum, a hospedagem gerenciada é mais simples; uma infraestrutura própria só é indicada quando a Prefeitura exigir controle de sistema operacional, rede, banco e dados ou houver política que impeça uso de serviços gerenciados externos.

## Pré-requisitos institucionais

| Item | Responsável sugerido | Evidência exigida |
|---|---|---|
| Subdomínio oficial | Comunicação/TI municipal | Ex.: `fiscalizacao.bentogoncalves.rs.gov.br`, ou nome aprovado. |
| DNS e certificados | TI municipal | Acesso ao DNS, definição de responsáveis e janela de alteração. |
| Dados pessoais | DPO/Encarregado + SMMAM | Registro de finalidade, acesso mínimo e retenção. |
| Contas de serviço | TI municipal | Usuários nominais, MFA e princípio do menor privilégio. |
| Backup | TI municipal | Backup restaurável de banco, arquivos, regras e configuração. |
| Homologação | SMMAM + TI | Ambiente separado da produção. |
| Suporte | Gestor do contrato/sistema | Matriz de incidentes, contatos e tempo de atendimento. |

## Fase 0 — Inventário e backup

1. Criar tag Git da versão atual e gerar pacote de release com hash.
2. Exportar Firestore, regras, índices, configuração do Hosting e configuração do Worker. O backup deve ser restaurado em projeto isolado antes de qualquer corte.
3. Inventariar dados: quantidade de usuários, notificações, autos, evidências, cadastro imobiliário, tamanho de Storage e janelas de AR.
4. Documentar as contas atuais, sem registrar tokens, senhas ou chaves no repositório.
5. Definir RPO/RTO, responsáveis por incidente e política de retenção de documentos e evidências.

## Fase 1 — Ambiente de homologação municipal

Crie um ambiente de homologação com domínio distinto, por exemplo `fiscalizacao-hml.bentogoncalves.rs.gov.br`. Não use a base de produção para testes. Configure contas de teste, dados anonimizados ou cópia autorizada com controles equivalentes.

Os controles que precisam ser validados são: login, recuperação de senha, criação e edição de notificação, auto, consulta de imóvel, anexos, impressão, relatórios, perfis, auditoria, backup, AR e bloqueio de acesso entre setores.

### Configuração para opções A e B

1. Adicionar o domínio de homologação aos domínios autorizados da identidade.
2. Adicionar a origem de homologação à lista de origens permitidas do serviço de AR; nunca utilizar coringa (`*`) para aplicação que acessa dados operacionais.
3. Publicar regras e índices somente no projeto de homologação.
4. Executar testes de perfil: visitante, pendente, bloqueado, leitor, operador e administrador, sempre para mais de um setor.
5. Registrar evidências de teste e corrigir antes de seguir.

## Fase 2 — Publicação no domínio oficial

### Opção A — Domínio municipal no Firebase Hosting

1. No projeto de produção, abrir a configuração de Hosting e adicionar o subdomínio oficial.
2. TI municipal cria o registro TXT de validação no DNS e o mantém ativo.
3. Após validação de propriedade, configurar os registros solicitados pelo assistente de domínio e aguardar o certificado TLS.
4. Configurar redirecionamento entre raiz e `www` quando aplicável; para sistema interno, priorize um único endereço canônico.
5. Confirmar que o certificado apresenta o domínio correto e que login, AR e links de impressão funcionam no endereço oficial.

O Firebase permite associar domínio próprio, exige comprovação DNS e provisiona certificado TLS para o domínio conectado. Para domínio que já recebe tráfego, o fluxo avançado ajuda a reduzir indisponibilidade durante a troca. [1]

### Opção B — Frontend em Nginx/IIS municipal e serviços atuais preservados

1. Publicar uma cópia versionada dos arquivos estáticos em diretório imutável do servidor, por exemplo `/var/www/smmam-notificacoes/releases/<versao>/`.
2. Configurar Nginx ou IIS para servir somente HTTPS, redirecionar HTTP para HTTPS e aplicar cabeçalhos de segurança. O servidor não deve registrar conteúdo de formulários, tokens ou dados pessoais em logs de acesso.
3. Ajustar o frontend para apontar somente ao projeto Firebase autorizado e ao endpoint oficial do serviço de AR.
4. Incluir o novo domínio municipal em Firebase Authentication e em `ALLOWED_ORIGIN` do Worker antes de liberar usuários.
5. Manter temporariamente o endereço anterior disponível em modo somente leitura ou com redirecionamento controlado até a validação de produção.
6. Executar o roteiro de aceite com usuários reais autorizados, mas sem criar dados fictícios de produção.

### Cabeçalhos mínimos para a SPA

Configurar pelo menos: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` e uma `Content-Security-Policy` compatível com Firebase, gráficos e o serviço de AR. A política deve ser validada em homologação antes de ser imposta em produção, pois bloqueios indevidos podem impedir login ou carregamento de módulos.

## Fase 3 — Migração integral para servidores municipais

Escolha esta fase apenas quando a Prefeitura exigir que dados e serviços deixem os provedores atuais. É uma **evolução arquitetural**, não uma cópia de arquivos.

| Componente atual | Substituto municipal possível | Ação necessária |
|---|---|---|
| Firebase Authentication | Provedor institucional OIDC/Keycloak/AD/SSO | Implementar login, MFA, grupos e ciclo de vida de contas. |
| Firestore | PostgreSQL com API institucional | Modelar tabelas, auditoria, transações, índices e migração de dados. |
| Firebase Storage | Storage S3 compatível/MinIO | Migrar evidências, hashes, metadados e regras de acesso por caminho. |
| Firebase Hosting | Nginx/IIS/CDN municipal | Servir SPA com TLS, cache e política de segurança. |
| Worker de AR | Serviço de backend com fila/agendamento | Manter segredo, autorização, limite, log, monitoramento e idempotência. |
| Regras Firebase | Autorização no backend + políticas de banco/arquivo | Reimplementar RBAC por setor e testes de acesso. |

### Sequência segura de migração integral

1. Criar banco e arquivos em homologação municipal; aplicar migrações vazias e testes de acesso.
2. Construir API com endpoints compatíveis com o frontend ou migrar o frontend por módulos.
3. Migrar primeiro dados sem evidências; validar totais, chaves, setores e documentos por amostragem.
4. Migrar evidências para Storage municipal, validando hash, tamanho e vínculo com o documento.
5. Rodar período de dupla leitura controlada, com fonte oficial definida para cada entidade.
6. Congelar gravações na origem durante janela aprovada, executar delta final e validar contagens.
7. Alterar DNS/proxy, monitorar erros e manter rollback para a origem até o aceite formal.
8. Revogar credenciais legadas somente após cópia de segurança, retenção obrigatória e termo de aceite.

## Segurança e privacidade

As regras atuais devem evoluir para acesso por perfil, setor, finalidade e caminho de arquivo. Em Cloud Firestore, toda solicitação cliente é avaliada pelas regras; uma regra permissiva pode expor toda a coleção. [2] Em armazenamento de arquivos, é possível validar autorização por caminho, tipo e tamanho do arquivo. [3]

Para a implantação municipal, mantenha um inventário de tratamentos de dados, registro de operadores, política de retenção, procedimento de incidente e revogação de acesso. O cadastro imobiliário deve ser acessível apenas a funções autorizadas e apenas pelo tempo necessário à atividade de fiscalização.

## Aceite de produção

| Teste | Resultado obrigatório |
|---|---|
| DNS/TLS | Domínio oficial resolve, certificado válido e HTTPS obrigatório. |
| Login | Perfis autorizados entram; contas pendentes, bloqueadas e externas são recusadas. |
| Setorização | Usuários não leem ou alteram documentos de outro setor. |
| Operação | Notificação, auto, impressão, evidência e AR funcionam. |
| Dados | Totais e amostras conferem entre origem e destino. |
| Backup | Recuperação testada e documentada. |
| Monitoramento | Erros de frontend, backend, AR e banco possuem canal de alerta. |
| Reversão | Roteiro de retorno foi testado em homologação. |

## Operação após o corte

Nas primeiras 72 horas, monitore login, erros de autorização, latência de consulta, falhas de AR, gravação de evidências, jobs de importação e consumo de armazenamento. Estabeleça uma janela diária de revisão com SMMAM e TI municipal até que os indicadores se estabilizem.

## Referências

[1] [Firebase — Conectar domínio próprio ao Hosting](https://firebase.google.com/docs/hosting/custom-domain)

[2] [Firebase — Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)

[3] [Firebase — Cloud Storage Security Rules](https://firebase.google.com/docs/storage/security)
