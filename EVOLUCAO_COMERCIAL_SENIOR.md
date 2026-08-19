# Avaliação técnica sênior — evolução para produto institucional

**Sistema:** SMMAM Fiscalização & Notificações  
**Atualização:** 19 de agosto de 2026  
**Classificação:** uso interno restrito

## 1. Conclusão executiva

O sistema já possui uma base funcional importante para o setor: autenticação, segmentação de dados por setor, perfis aprovados, documentos de notificação e auto, rastreamento de AR, cadastro imobiliário, exportações, trilha de auditoria e publicação independente. As regras do Firestore agora restringem os dados por perfil, status e setor; a gestão de usuários passou a ser uma função administrativa visível e a auditoria ganhou ordenação cronológica.

Entretanto, a aplicação ainda é uma **SPA estática com regras de segurança e regras de negócio executadas predominantemente no navegador**. Esse desenho é adequado para um piloto controlado e uma operação interna de baixo risco, mas não é a arquitetura final recomendada para um produto comercial institucional que manipule dados pessoais, processos administrativos, evidências e decisões com efeitos operacionais.

> A recomendação é evoluir por camadas: primeiro consolidar controles, testes e monitoramento; em seguida deslocar operações privilegiadas para um serviço confiável; por fim, estruturar ambientes, continuidade e governança de produto. Isso preserva a solução atual e evita uma reescrita prematura.

| Posição atual | Decisão recomendada |
| --- | --- |
| Piloto com dados operacionais segregados | Pode continuar com usuários aprovados e administração setorial. |
| Produção institucional ampliada | Condicionar à conclusão das prioridades P0 e P1. |
| Produto comercial/contratável | Condicionar a arquitetura de backend confiável, identidade corporativa, testes de segurança, operação monitorada e continuidade comprovada. |

## 2. Diagnóstico técnico atual

| Camada | Estado atual | Mérito | Limite para padrão comercial |
| --- | --- | --- | --- |
| **Interface** | SPA Vanilla JS hospedada no Firebase Hosting. | Simples, rápida e de baixo custo operacional. | Regras de negócio e parte da administração ficam expostas ao cliente. |
| **Identidade** | Firebase Authentication por e-mail e senha, com perfis no Firestore. | Permite conta individual e recuperação de senha. | Falta MFA, integração institucional, convite confiável e ciclo formal de desligamento. |
| **Autorização** | Firestore Rules com usuário aprovado, nível e setor. | Implementa privilégio mínimo e separação setorial no banco. | Mudanças privilegiadas ainda são disparadas diretamente pelo navegador. |
| **Auditoria** | Logs imutáveis por regras de banco e consulta setorial. | Rastreia ações administrativas e operacionais. | Horário, nome e descrição podem ser fornecidos pelo cliente; falta origem confiável, retenção e correlação. |
| **Documentos/evidências** | Formulários, relatórios e referências de evidência. | Suporta o fluxo cotidiano do setor. | Falta repositório de anexos com regras efetivas, classificação, retenção e trilha de acesso. |
| **Operação** | Firebase Hosting, Firestore e repositório Git. | Implantação simples e versionada. | Faltam ambientes separados, CI/CD, métricas, alertas e plano de recuperação executado. |

As regras de segurança devem ser tratadas como parte do esquema de dados e testadas a cada mudança; a própria orientação do Firebase recomenda políticas de negação por padrão, testes com Emulator Suite e integração desses testes à esteira de entrega.[1] A base atual já evoluiu nessa direção, mas ainda não dispõe de testes automatizados de autorização contra emuladores.

## 3. Melhorias priorizadas

### P0 — obrigatórias antes de ampliar fortemente o uso

| Entrega | Problema que resolve | Implementação recomendada | Critério de aceite |
| --- | --- | --- | --- |
| **Testes de regras no Emulator Suite + CI** | Regressão de permissões ao alterar tela, coleção ou regra. | Casos de leitura, criação, alteração e exclusão para leitor, operador, admin, pendente, bloqueado e outro setor. Executar no GitHub Actions a cada alteração. | Um usuário de outro setor não acessa nem infere dados; uma falha bloqueia o merge. |
| **Gestão de identidades em serviço confiável** | Aprovação, bloqueio, nível e convites ainda dependem de chamada do cliente. | Criar API administrativa com Firebase Admin SDK em Cloud Run ou Functions, protegida por token administrativo e validação de setor. | A interface não pode elevar níveis nem aprovar perfis sem o serviço validar o operador e registrar a decisão. |
| **Convite institucional substituindo a lista VIP global** | Exceções de domínio são úteis, mas não comprovam vínculo nem têm expiração. | Convite individual com setor, função prevista, responsável, prazo e uso único. Bloquear autoatribuição de setor no cadastro. | Convite expira, é auditado e somente cria perfil pendente no setor autorizado. |
| **Autenticação reforçada** | Senha isolada oferece menor garantia para função administrativa. | Priorizar SSO/OIDC institucional; enquanto não houver, e-mail verificado, proteção contra enumeração/brute force e MFA para administradores. | Todo administrador usa fator adicional ou identidade corporativa aprovada. |
| **Auditoria confiável** | Logs atuais são imutáveis, mas parcialmente informados pelo cliente. | O backend grava `auth.uid`, identificador do perfil, horário de servidor, IP/atestado quando disponível, ação, alvo, resultado e resumo de campos alterados. | Nenhum usuário consegue forjar sua autoria ou horário na trilha privilegiada. |
| **Proteção de aplicação e monitoramento** | Regras restringem usuários, mas não atestam que as chamadas vêm do app legítimo. | Habilitar App Check em modo de observação, analisar impacto e aplicar exigência gradualmente; criar alertas de erro, custo, acessos negados e picos. | Painel de saúde e alertas são testados; acesso sem atestado é bloqueado após período de observação. |

O App Check complementa a autenticação: ele atesta a origem da aplicação/dispositivo e pode rejeitar chamadas sem token válido, mas não elimina todos os vetores de abuso.[2] Por isso, deve complementar — e não substituir — regras, autenticação e monitoramento. O Firebase também recomenda alertas de uso e App Check nos serviços suportados.[1]

### P1 — necessárias para operação profissional previsível

| Entrega | Benefício operacional | Diretriz de implementação |
| --- | --- | --- |
| **Ambientes separados** | Evita testar com dados reais e reduz risco de publicação acidental. | Projetos independentes para desenvolvimento, homologação e produção; dados sintéticos nos dois primeiros. |
| **CI/CD com revisão** | Toda alteração fica rastreável e reproduzível. | Pull request obrigatório, lint/smoke tests, testes de regras, análise de dependências e deploy somente de `main` aprovado. |
| **Gestão documental** | Preserva evidências e elimina anexos dispersos. | Cloud Storage ou repositório institucional com metadados, regras por documento/setor, hash, versão, classificação, prazo de retenção e registro de download. |
| **Fluxo de processo configurável** | Evita status contraditórios e define responsabilidade por etapa. | Máquina de estados: minuta → revisão → assinatura/autorização → expedição → AR → prazo → defesa → decisão → encerramento; transições com permissão explícita. |
| **Busca e relatórios de produção** | Reduz retrabalho e suporta gestão. | Índices planejados, paginação, filtros salvos, exportação com finalidade e marca d'água de uso interno. |
| **Observabilidade** | Permite detectar degradação antes que o usuário relate. | Indicadores de latência, erros, acessos negados, falhas de AR, uso de cota e jobs pendentes; alertas para responsáveis. |
| **Continuidade comprovada** | Torna recuperação praticável, não apenas documentada. | Backup automatizado, retenção definida, cópia em conta/ambiente separado e teste de restauração semestral com evidência. |

As orientações do Firebase recomendam projetos separados para desenvolvimento, homologação e produção, além de limitar o acesso à produção por IAM.[1] Essa separação é uma das mudanças de maior retorno para reduzir falhas operacionais.

### P2 — diferenciais de produto e escala

| Entrega | Resultado esperado |
| --- | --- |
| **Gestão de SLA e prazos** | Alertas de vencimento, fila de pendências e indicadores por responsável. |
| **Assinatura e expedição integradas** | Documentos emitidos com modelo versionado, QR de consulta e integração formal apenas após análise jurídica. |
| **Portal externo limitado** | Consulta de interessado mediante protocolo/código e divulgação estritamente necessária, sem expor dados de fiscalização. |
| **Integrações por API** | Conectores versionados para cadastro imobiliário, protocolo, correio oficial/VIPP e transparência, sempre por backend. |
| **Rastreabilidade de evidência** | Hash, cadeia de custódia, permissões de download e armazenamento imutável quando aplicável. |
| **Métricas gerenciais** | Dashboard de produtividade, prazos, reincidência, efetividade de AR e transparência agregada. |

## 4. Arquitetura-alvo recomendada

```text
Usuário institucional
        │ SSO/OIDC + MFA
        ▼
Firebase Hosting + App Check
        │
        ├── Interface operacional (sem privilégios ocultos)
        │
        ▼
API de domínio confiável (Cloud Run ou Cloud Functions)
        ├── valida perfil, setor, fluxo e segregação de funções
        ├── registra auditoria com hora do servidor
        ├── aplica convites, aprovações e mudanças de nível
        ├── integra AR, VIPP, protocolo e cadastro
        └── aciona tarefas assíncronas e alertas
        │
        ├── Cloud Firestore com regras restritivas e índices
        ├── Storage com evidências, metadados, hash e retenção
        └── Monitoramento, backup, alertas e registros centralizados
```

O ponto decisivo é manter a interface como canal de trabalho, mas concentrar **decisões de alto impacto** no serviço de domínio. Aprovar conta, elevar a administrador, alterar setor, gerar exportação sensível, registrar envio e administrar exceções de e-mail são operações que devem ser verificadas e auditadas por um ambiente confiável, não somente por JavaScript entregue ao navegador.

## 5. Governança de usuários: como operar a tela atual

A seção **Gestão de Servidores (Do Seu Setor)** é, de fato, o local correto para gerir os perfis do setor. Ela agora mostra todos os usuários cuja ficha possui o mesmo setor do administrador conectado. O administrador pode aprovar um perfil pendente, bloquear um perfil e definir o nível de **leitor**, **operador** ou **administrador**. O próprio administrador conectado não pode bloquear a si mesmo nem alterar seu próprio nível pela tela, reduzindo o risco de perda acidental de administração.

| Nível | Pode fazer | Não deve fazer |
| --- | --- | --- |
| **Leitor** | Consultar somente os dados permitidos ao setor. | Criar, alterar ou excluir documentos operacionais. |
| **Operador** | Criar e atualizar registros operacionais do setor. | Gerir contas, configurar o setor ou excluir registros. |
| **Administrador** | Gerir perfis do próprio setor, configurações, auditoria e exclusões autorizadas. | Administrar perfis de outros setores ou conceder acesso fora do próprio setor. |

O bloqueio interrompe o acesso ao sistema porque as regras exigem status `aprovado`; ele não exclui a conta de autenticação nem apaga os dados relacionados. A exclusão de uma conta de autenticação, quando for necessária, deve virar processo administrativo de desligamento via serviço confiável, com retenção de evidência e validação da chefia.

## 6. Roteiro de execução sugerido

| Horizonte | Entregas | Resultado mensurável |
| --- | --- | --- |
| **0–30 dias** | Testes de regras, CI, índice de auditoria, gestão de perfis, cabeçalhos de segurança, inventário de dados e App Check em observação. | Nenhuma alteração de regra é publicada sem teste; perfis e auditoria funcionam por setor. |
| **31–90 dias** | Backend administrativo, convite com prazo, auditoria de servidor, ambientes separados, alertas e backup automatizado. | Operações privilegiadas deixam de ser decididas pelo navegador. |
| **3–6 meses** | Gestão documental, fluxo de processo, integração institucional de identidade e restauração testada. | Processo completo é rastreável da abertura ao encerramento. |
| **6–12 meses** | Portal externo, integrações formais, SLA, métricas, teste externo de segurança e certificação de acessibilidade. | Plataforma apta a ser especificada com critérios objetivos de contratação e operação. |

## 7. Critério de maturidade para futura contratação

Uma contratação futura deve especificar resultados verificáveis, e não apenas listar tecnologias. O OWASP ASVS é uma base pública para avaliar controles técnicos de aplicações e pode servir como referência de requisitos e aceites de segurança em contratos.[3] Para a solução em questão, o conjunto mínimo de aceites deve incluir testes de autorização multi-setor, trilha de auditoria confiável, MFA/SSO, evidências com controle de acesso, testes de restauração, monitoração e relatórios de acessibilidade.

A gestão de logs deve abranger infraestrutura e processo de manutenção, e não só uma tabela de eventos na aplicação; o NIST destaca a necessidade de práticas de gestão de logs em toda a organização.[4] Por esse motivo, a atual auditoria deve evoluir de uma ferramenta de consulta para uma fonte confiável de investigação e prestação de contas.

## Referências

[1] [Firebase Security Checklist](https://firebase.google.com/support/guides/security-checklist) — Firebase/Google.

[2] [Firebase App Check](https://firebase.google.com/docs/app-check) — Firebase/Google.

[3] [OWASP Application Security Verification Standard, versão 5.0.0](https://owasp.org/www-project-application-security-verification-standard/) — OWASP.

[4] [NIST SP 800-92 — Guide to Computer Security Log Management](https://csrc.nist.gov/pubs/sp/800/92/final) — NIST.
