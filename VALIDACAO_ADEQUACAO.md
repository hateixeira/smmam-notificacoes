# Registro de validação — adequação institucional

**Data:** 19 de agosto de 2026

| Verificação | Resultado | Evidência |
| --- | --- | --- |
| Aviso de privacidade publicado | Aprovado | Página pública `https://smmam-fiscalizacao-tb.web.app/politica-privacidade` exibida e legível. |
| Navegação e fluxos críticos | Aprovado | `node scripts/smoke-test.mjs` executado com sucesso. |
| Sintaxe JavaScript | Aprovado | `node --check js/app.js` executado sem erro. |
| Formatação de mudanças | Aprovado | `git diff --check` executado sem erro. |
| Regras de Firestore/Storage em produção | Pendente | Console exigiu login institucional; nenhuma regra restritiva foi aplicada nesta etapa. |

## Verificação posterior de sessão

Após autenticação administrativa, a aplicação exibiu o ambiente interno com menu administrativo, listagem setorial e controles de gestão. A sessão confirma que há perfil administrativo aprovado e que a validação de acesso pode prosseguir. Nenhum dado de notificação, cadastro ou evidência foi modificado nesta verificação.

O console Firebase reconheceu a conta administrativa, porém o editor de regras não concluiu o carregamento durante a verificação. As regras de produção permanecem sem alteração até a confirmação por caminho alternativo e a revisão da compatibilidade com os perfis existentes.

Uma nova tentativa com a rota explícita do banco padrão confirmou o projeto autenticado, mas não carregou o conteúdo do editor. Não houve edição nem publicação de regra pelo console.

O painel geral do Firebase carregou sob a conta administrativa e confirmou que o projeto está no plano Blaze, possui Firestore ativo e registra histórico de implantações do Hosting. A abertura direta do editor de regras continua pendente de resolução de navegação do console.

## Achado crítico — regras ativas

O editor de regras foi carregado posteriormente e confirmou que as regras ativas permitem leitura e escrita a qualquer usuário autenticado nas coleções operacionais, incluindo notificações, usuários, auditoria, cadastro imobiliário e configurações. Essa configuração é mais permissiva que as regras restritivas versionadas no repositório e precisa ser substituída após uma conferência controlada dos perfis existentes.

Uma tentativa de navegar da tela de regras para a coleção de perfis não modificou a configuração ativa. O risco prioritário permanece a regra ampla que autoriza operações para qualquer conta autenticada.

## Compatibilidade de perfis

A inspeção de um perfil administrativo existente mostrou que os campos de controle não seguem integralmente o esquema exigido pelas regras restritivas versionadas: foi identificado perfil sem campo de setor e com nível operacional diferente de `admin`. Publicar as regras atuais do repositório neste momento poderia bloquear acessos legítimos. É necessária uma migração de perfis aprovada e reversível antes da implantação das permissões por setor.

A inspeção dos perfis existentes confirmou que somente o perfil legado precisa de migração de controle; o outro perfil já contém setor, status aprovado e nível administrativo compatíveis. Nenhum perfil foi alterado durante a avaliação.

Após confirmação administrativa, foi iniciado no console o preenchimento do campo de setor para o perfil legado. A alteração permanece limitada aos campos de controle previstos no plano de migração.

O campo de setor foi confirmado como persistido no perfil legado. A próxima alteração autorizada limita-se à normalização do nível administrativo antes da publicação das regras restritivas.

O editor do nível legado foi aberto e confirmou o valor atual, preservado como referência de reversão. Nenhum outro campo de perfil foi selecionado para alteração.

## Migração de perfil concluída

O perfil legado foi normalizado com setor institucional e nível administrativo. Os dois perfis existentes agora atendem aos campos mínimos requeridos pelas regras restritivas preparadas. Nenhuma informação cadastral, notificação, auto, evidência ou configuração operacional foi modificada nesta migração.

## Implantação das regras do Firestore

As regras restritivas versionadas foram compiladas e publicadas com sucesso no Cloud Firestore após a normalização dos perfis. A validação automática de interface retornou à tela de autenticação por ausência de sessão persistida no navegador de teste; por esse motivo, a confirmação final do fluxo autenticado deve ser realizada com login administrativo no sistema. As regras de Cloud Storage não foram aplicadas porque o serviço ainda não é usado como repositório operacional de backup.

Nenhuma notificação, auto, cadastro ou evidência foi alterado durante a publicação das melhorias seguras. A implantação de regras que possa restringir acesso depende da conferência dos perfis existentes e de teste controlado no console Firebase.
