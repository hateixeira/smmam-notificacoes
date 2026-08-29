# Manual de desenvolvimento do SMMAM com Google Antigravity e Git

**Projeto:** Sistema de Fiscalização Municipal — SMMAM Notificações  
**Repositório oficial:** [github.com/hateixeira/smmam-notificacoes](https://github.com/hateixeira/smmam-notificacoes)  
**Branch principal:** `main`  
**Versão deste manual:** 1.0 — 29/08/2026  
**Objetivo:** permitir o desenvolvimento seguro em mais de um computador, usando o GitHub como fonte única de verdade e evitando perda de código, divergência entre máquinas e alterações acidentais na exportação VIPP.

> **Regra central:** nenhum computador é a versão oficial do sistema. A versão oficial é o commit que está no GitHub. Cada computador deve sincronizar antes de começar e publicar suas alterações no GitHub antes de ser trocado por outro.

## 1. Como o fluxo deve funcionar

O Google Antigravity deve ser utilizado como ambiente de desenvolvimento e assistência, não como local permanente da versão do sistema. Cada computador mantém uma cópia local do repositório. O Git registra o que foi alterado, o GitHub guarda a versão compartilhada e o Antigravity trabalha sobre a cópia local selecionada como projeto.

A documentação oficial do Antigravity informa que um projeto define as pastas e repositórios aos quais os agentes têm acesso e permite associar uma ou mais pastas ou repositórios locais. Ela também oferece o modo local e o modo com novo worktree, no qual o agente trabalha em um espaço Git isolado [1]. Para este projeto, o modo com **New Worktree** é preferível quando o agente for fazer alterações relevantes.

| Elemento | Função | Regra para este projeto |
|---|---|---|
| GitHub | Fonte compartilhada e histórico oficial | Tudo que for preservado deve estar em um commit enviado ao GitHub. |
| `main` | Base estável | Não desenvolver diretamente nela. |
| Branch de tarefa | Isola uma alteração | Uma tarefa por branch, por exemplo `fix/salvamento` ou `feat/qrcode-whatsapp`. |
| Google Antigravity | Editor e agente de desenvolvimento | Deve abrir o clone local correto e respeitar as instruções deste manual. |
| Codespace | Ambiente opcional na nuvem | Pode ser usado como outro computador, seguindo exatamente o mesmo fluxo Git. |
| Firebase | Backend, regras e eventualmente Hosting | Só publicar o escopo necessário, nunca fazer deploy geral sem revisão. |
| GitHub Pages | Possível hospedagem atual do frontend | Confirmar em GitHub → Settings → Pages qual é o destino oficial. |

## 2. Preparação de cada computador

A preparação deve ser feita uma única vez por computador. Instale o Google Antigravity pela página oficial, instale o Git e o Node.js LTS compatível com o projeto. As Functions deste repositório declaram Node.js 20; portanto, o computador usado para Functions deve utilizar Node.js 20 ou uma configuração compatível. Também instale o Firebase CLI somente nas máquinas autorizadas a publicar.

Não copie arquivos de credenciais entre computadores e não coloque senhas, tokens, chaves de serviço ou arquivos `.env` no Git. O repositório já ignora `functions/.env`, `functions/.runtimeconfig.json`, arquivos de debug do Firebase e os arquivos temporários de segredo do Worker. O login deve ser feito diretamente em cada computador institucional autorizado.

| Ferramenta | Verificação inicial |
|---|---|
| Git | `git --version` |
| Node.js | `node --version` |
| pnpm | `pnpm --version` |
| Firebase CLI | `firebase --version` |
| Conta GitHub | `gh auth status` ou autenticação pelo Antigravity/GitHub |
| Conta Firebase | `firebase login:list` |

### 2.1. Clonar o repositório no computador novo

Abra um terminal e execute:

```bash
git clone https://github.com/hateixeira/smmam-notificacoes.git
cd smmam-notificacoes
git switch main
git pull --ff-only origin main
```

Depois instale as dependências das Functions usando o gerenciador compatível com o lockfile do projeto:

```bash
cd functions
pnpm install
cd ..
```

O projeto possui `functions/pnpm-lock.yaml`. Por isso, não troque `pnpm install` por `npm install` durante o desenvolvimento normal. Alterar o gerenciador pode criar um `package-lock.json` e modificar dependências sem necessidade.

### 2.2. Abrir o projeto no Google Antigravity

No Antigravity, crie um projeto e associe a pasta local `smmam-notificacoes`. Não associe uma pasta acima dela contendo outros projetos, credenciais ou arquivos pessoais. Se o trabalho for feito com agente, escolha **New Worktree Mode** sempre que possível. Se escolher **Local Mode**, confirme primeiro que a branch mostrada pelo terminal é a branch da tarefa e não `main`.

Use o prompt inicial abaixo no Antigravity para reduzir alterações fora do escopo:

```text
Trabalhe somente no repositório SMMAM Notificações aberto neste projeto.
Antes de editar, leia README.md, CONTINUIDADE_E_RESTAURACAO.md,
GUIA_DE_PUBLICACAO_FIREBASE.md e os arquivos diretamente relacionados à tarefa.
Verifique a branch atual e não faça alterações diretamente em main.
Crie ou use uma branch de tarefa.
Não altere a exportação VIPP, os campos usados por ela, as regras de segurança,
os dados de produção ou os arquivos de credenciais sem autorização explícita.
Antes de concluir, execute os testes do projeto, mostre git diff e informe
quais arquivos foram alterados. Não faça deploy nem push sem autorização explícita.
```

O comando oficial `/grill-me` pode ser usado antes de uma implementação para obrigar o agente a esclarecer requisitos e riscos. O comando `/goal` deve ser reservado para tarefas muito bem delimitadas, porque permite que o agente continue até considerar o objetivo concluído [1].

## 3. Rotina obrigatória ao iniciar o trabalho

Antes de abrir o editor ou pedir qualquer alteração ao agente, sincronize o computador. Isso evita desenvolver sobre uma versão antiga e reduz conflitos quando outro computador já tiver enviado commits.

```bash
cd /caminho/para/smmam-notificacoes
git status -sb
git fetch origin
git switch main
git pull --ff-only origin main
git log --oneline -5
```

O resultado de `git status -sb` deve mostrar a branch e, idealmente, nenhuma alteração local pendente. Se aparecerem arquivos modificados ou não rastreados, não execute `pull` às cegas. Pare e escolha uma das opções da seção de recuperação deste manual.

| Situação ao iniciar | Conduta |
|---|---|
| `## main...origin/main` sem alterações | Criar uma branch de tarefa e começar. |
| `behind origin/main` | Executar `git pull --ff-only origin main`. |
| Arquivos modificados | Identificar se são alterações que devem ser salvas; não apagar automaticamente. |
| Branch diferente de `main` | Verificar se é uma tarefa em andamento antes de trocar de branch. |
| Branch local à frente do GitHub | Enviar a branch somente depois de revisar o diff. |

### 3.1. Criar uma branch para cada tarefa

Nunca desenvolva diretamente em `main`. Crie uma branch curta e descritiva:

```bash
git switch -c fix/salvamento-functions
```

Use os prefixos abaixo:

```text
feat/      nova funcionalidade
fix/       correção de defeito
refactor/  reorganização sem mudança de comportamento pretendida
docs/      documentação
test/      testes
chore/     manutenção de dependências ou configuração
```

O nome da branch deve descrever uma tarefa única. Não misture, por exemplo, alteração de PDF, exclusão de registros, atualização de regras e mudança de dependências na mesma branch sem aprovação.

## 4. Rotina durante o desenvolvimento

Salve o arquivo no Antigravity e revise as alterações pelo controle de versão antes de aceitar qualquer resultado do agente. O agente pode interpretar uma solicitação de modo mais amplo do que o desejado; por isso, a revisão humana do diff é obrigatória.

```bash
git status --short
git diff --stat
git diff --check
git diff -- caminho/do/arquivo
```

Faça commits pequenos e coerentes. Um commit deve explicar uma mudança que possa ser revisada e revertida isoladamente. Não use mensagens genéricas como `alterações`, `teste` ou `versão final`.

```bash
git add caminho/do/arquivo
git diff --cached --check
git commit -m "fix: corrige validação do formulário de notificação"
```

A documentação do GitHub recomenda o fluxo de criar uma branch, fazer as alterações, criar o commit e então enviar a branch ou abrir um pull request [2]. Mesmo quando houver apenas uma pessoa desenvolvendo, esse fluxo deixa o histórico seguro e permite comparar a tarefa antes de incorporá-la à versão principal.

| Antes de cada commit | Pergunta obrigatória |
|---|---|
| Escopo | O commit contém somente a tarefa descrita? |
| Dados | Alguma rotina grava, atualiza ou remove dados? Isso foi autorizado? |
| Segurança | Alguma regra ou permissão ficou mais ampla? |
| VIPP | Algum campo ou função de exportação foi alterado? |
| Testes | Os testes aplicáveis foram executados? |
| Reversão | É possível explicar como desfazer somente este commit? |

## 5. Rotina para trocar de computador

Antes de sair de um computador, deixe o trabalho em uma situação explícita. O melhor estado é uma branch com commit enviado ao GitHub. Não dependa de arquivos que ficaram apenas na pasta local ou no histórico de conversas do Antigravity.

```bash
git status -sb
git add -A
git diff --cached --check
git commit -m "wip: salva progresso da tarefa de salvamento"
git push -u origin fix/salvamento-functions
```

Se a alteração ainda não estiver pronta para revisão, use uma mensagem `wip` e mantenha-a na branch de tarefa. O importante é que ela esteja no GitHub. No outro computador:

```bash
git fetch origin
git switch fix/salvamento-functions
git pull --ff-only origin fix/salvamento-functions
```

Se a branch já tiver sido incorporada à `main`, não continue trabalhando nela. Crie uma nova branch a partir da `main` atualizada. Assim, cada computador começa de uma base conhecida.

## 6. Integração da tarefa na `main`

Quando a tarefa estiver pronta, execute todos os testes aplicáveis, envie a branch e abra um pull request no GitHub. O título do pull request deve explicar o resultado, e a descrição deve registrar o escopo, os testes e qualquer impacto em Firebase, PDF, Storage ou VIPP.

```bash
git push -u origin fix/salvamento-functions
```

Após a revisão e a aprovação, faça o merge no GitHub. Em seguida, em qualquer computador de desenvolvimento, atualize a base:

```bash
git switch main
git pull --ff-only origin main
git branch --merged
```

Não apague a branch de tarefa até confirmar que o pull request foi incorporado e que a `main` local contém o mesmo commit que `origin/main`.

## 7. Proteção obrigatória da exportação VIPP

A exportação VIPP é uma área protegida do sistema. Nenhuma alteração de interface, PDF, banco, Functions ou dependência deve modificar a rotina de exportação sem uma tarefa específica, teste comparativo e aprovação institucional.

Os campos que alimentam o VIPP devem continuar existindo e mantendo seu significado. Entre os campos sensíveis estão `nome`, `endereco`, `bairro`, `cep`, `cidade`, `uf`, `telefone`, `doc`, `tipoAR`, `codigoAR` e o número da notificação. O fato de um campo não aparecer no PDF não autoriza removê-lo do objeto de dados ou do exportador.

| Proibido sem aprovação | Procedimento correto |
|---|---|
| Renomear campos usados no CSV | Mapear impacto, testar CSV antes/depois e obter aprovação. |
| Alterar a ordem ou o cabeçalho do CSV | Criar teste de compatibilidade com o VIPP. |
| Remover `exportarVipp` ou substituir a rotina | Abrir tarefa específica de integração VIPP. |
| Misturar correção do PDF com mudança de exportação | Separar em branches e commits diferentes. |
| Fazer deploy geral para testar alteração visual | Publicar somente o escopo necessário. |

Antes do commit, confira o diff da exportação:

```bash
git diff -- js/app.js index.html css/style.css
git diff -- js/app.js | grep -n -i -E 'exportarVipp|VIPP|nome|endereco|bairro|cep|telefone|tipoAR|codigoAR|doc' || true
```

Se o diff tocar `exportarVipp`, o CSV, os nomes dos campos ou a montagem dos dados, pare o trabalho e faça uma revisão específica. A frase “não alterei o VIPP” só deve ser usada depois de conferir o diff e executar um teste de exportação.

## 8. Testes mínimos antes de enviar uma branch

O conjunto mínimo atual verifica a integridade do frontend, das Functions, do Worker e das regras de estilo. Execute na raiz do projeto:

```bash
node scripts/smoke-test.mjs
node scripts/domain-test.mjs
node --check js/app.js
node --check functions/index.js
node --check workers/ar-sync-worker.mjs
git diff --check
```

A validação deve ocorrer antes do commit final e novamente antes de qualquer publicação. Teste também manualmente, em homologação quando disponível, o login, a consulta, a criação de uma notificação de teste, a prévia/PDF, o QR Code, a exportação VIPP e o arquivamento. Não use um registro real para testar uma função destrutiva.

| Alteração | Testes adicionais obrigatórios |
|---|---|
| HTML/CSS/PDF | Abrir a prévia, gerar PDF e verificar uma página A4. |
| QR Code | Ler o QR Code com um celular e conferir número e mensagem. |
| Formulário | Criar e editar registro de teste; conferir Firestore. |
| Functions | Validar sintaxe, dependências e deploy direcionado. |
| Firestore/Storage | Testar perfis leitor, operador e administrador. |
| VIPP | Gerar CSV e comparar cabeçalho, ordem e campos com o formato homologado. |

## 9. Publicação: diferenciar frontend, backend e regras

Este repositório contém configuração do Firebase em `firebase.json`, mas o endereço visto no navegador pode estar sendo servido pelo GitHub Pages (`hateixeira.github.io`). Firebase Hosting e GitHub Pages são destinos diferentes. `firebase deploy --only hosting` não atualiza automaticamente um site servido pelo GitHub Pages.

Antes de publicar, confirme em GitHub → **Settings → Pages** qual branch e qual pasta são usadas pelo GitHub Pages. Se o destino oficial do frontend for GitHub Pages, a publicação do frontend ocorre após o merge na branch configurada e a conclusão da publicação do Pages. Se o destino for Firebase Hosting, use o comando de Hosting. Não publique nos dois destinos sem saber qual URL é oficialmente utilizada pelos servidores.

| Necessidade | Comando ou procedimento |
|---|---|
| Publicar frontend no Firebase Hosting | `firebase deploy --only hosting` |
| Publicar somente Functions específicas | `firebase deploy --only functions:nomeDaFunction` |
| Publicar duas Functions | `firebase deploy --only functions:createDocument,functions:updateDocument` |
| Publicar regras Firestore | `firebase deploy --only firestore:rules` |
| Publicar índices | `firebase deploy --only firestore:indexes` |
| Publicar regras Storage | `firebase deploy --only storage` ou o target confirmado pelo Firebase CLI |
| Publicar tudo | Evitar durante desenvolvimento; exige revisão e aprovação. |

Para Functions, use o lockfile do projeto e publique a partir de uma branch revisada ou de um commit conhecido. Não execute `firebase deploy --only functions` para testar uma alteração pequena se existirem Functions antigas ou incompatíveis no mesmo projeto. Publique somente a Function alterada.

Uma publicação deve ser registrada com o commit, horário, pessoa responsável, escopo e resultado. Antes de publicar uma alteração de produção, crie uma referência de recuperação:

```bash
git tag -a deploy-2026-08-29 -m "versão publicada em 29/08/2026"
git push origin deploy-2026-08-29
```

## 10. Recuperação e conflitos

O comando `git pull` combina a busca de alterações remotas com a integração delas na branch local; por isso, ele deve ser executado conscientemente e com a situação da árvore verificada [3]. Em uma árvore limpa, prefira `git pull --ff-only` para impedir que o Git crie um merge inesperado.

Quando houver alterações locais que ainda precisam ser preservadas, não use `reset --hard` e não apague arquivos. Salve o trabalho em um commit provisório ou em um stash identificado:

```bash
git status -sb
git stash push -u -m "SMMAM antes de sincronizar em 2026-08-29"
git pull --ff-only origin main
git stash list
git stash pop
```

Se surgir conflito, abra os arquivos marcados pelo Git, resolva apenas as partes necessárias, remova os marcadores `<<<<<<<`, `=======` e `>>>>>>>`, e execute os testes. Depois conclua:

```bash
git add arquivo-resolvido
git commit -m "merge: resolve conflito com main"
```

| Problema | Ação segura |
|---|---|
| Alteração local não rastreada | Fazer backup ou commit antes de trocar de branch. |
| Conflito no `pull` | Resolver manualmente; nunca apagar a versão do outro computador sem revisão. |
| Commit errado já enviado | Criar um novo commit de correção ou usar `git revert`; não reescrever `main`. |
| Arquivo sensível apareceu no status | Remover do staging, verificar `.gitignore` e não enviar credenciais. |
| Produção apresentou defeito | Identificar o commit publicado e preparar rollback controlado. |
| `main` local divergente | Fazer backup da branch e pedir revisão antes de qualquer reset. |

### 10.1. Comandos perigosos

Os comandos abaixo podem apagar trabalho local ou reescrever histórico. Não os use durante a rotina normal:

```bash
git reset --hard
git clean -fd
git push --force
git checkout -- .
```

Se algum desses comandos parecer necessário, pare, faça uma cópia da pasta ou crie uma branch de segurança e confirme a consequência. Para desfazer um commit já publicado, prefira `git revert`, que registra a reversão sem apagar o histórico compartilhado.

## 11. Regras de trabalho com o agente do Antigravity

O agente deve ser tratado como um colaborador técnico que precisa receber escopo, restrições e critérios de aceite. Não peça “melhore o sistema” sem indicar arquivos, comportamento esperado e o que não pode mudar. Solicite primeiro a análise e o plano; somente depois autorize a edição.

Use a instrução abaixo como padrão para tarefas do SMMAM:

```text
Objetivo: [descreva uma única alteração].

Escopo permitido:
- [arquivos ou módulo permitido]
- [comportamento esperado]

Não alterar:
- exportação VIPP nem seus campos;
- regras ou dados de produção;
- credenciais e segredos;
- módulos fora do escopo;
- deploy, merge ou push sem minha autorização.

Critérios de aceite:
- [resultado funcional]
- testes executados e respectivos resultados;
- git diff revisado;
- lista dos arquivos modificados;
- riscos e plano de reversão.

Antes de editar, faça perguntas se houver ambiguidade e confirme a branch atual.
```

Ao finalizar uma tarefa, peça ao agente uma síntese, mas confira pessoalmente o diff, os testes e o estado do Git. O agente não deve ser autorizado a publicar uma alteração só porque informou que os testes passaram.

## 12. Checklist rápido para uso diário

O roteiro abaixo é a versão curta para colar no terminal. Ele deve ser executado no início e no fim de cada sessão de desenvolvimento.

### Início

```bash
cd /caminho/para/smmam-notificacoes
git status -sb
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c tipo/nome-da-tarefa
```

### Antes do commit

```bash
git status --short
git diff --stat
git diff --check
node scripts/smoke-test.mjs
node scripts/domain-test.mjs
node --check js/app.js
node --check functions/index.js
git diff -- js/app.js index.html css/style.css
```

### Final da sessão

```bash
git add -A
git diff --cached --check
git commit -m "tipo: descreve a alteração"
git push -u origin tipo/nome-da-tarefa
git status -sb
```

### Troca de computador

```bash
git fetch origin
git switch nome-da-branch
git pull --ff-only origin nome-da-branch
```

## 13. Critério de sucesso do processo

O processo está funcionando corretamente quando qualquer computador autorizado consegue clonar o repositório, atualizar a `main`, abrir a mesma versão no Antigravity, continuar uma branch de tarefa a partir do GitHub, executar os testes e recuperar o trabalho de outro computador sem depender de arquivos locais, mensagens antigas ou memória de quem fez a alteração.

A versão publicada deve sempre ser rastreável a um commit. A exportação VIPP deve permanecer comprovadamente compatível. Alterações de frontend, Functions, regras e infraestrutura devem ser publicadas separadamente quando possível. Em caso de dúvida, a conduta correta é parar, preservar o estado atual e pedir revisão — não executar comandos destrutivos ou um deploy geral.

## Referências

[1] [Google Antigravity Docs — Getting Started with Antigravity 2.0](https://antigravity.google/docs/getting-started/)

[2] [GitHub Docs — Using source control in your codespace](https://docs.github.com/en/codespaces/developing-in-a-codespace/using-source-control-in-your-codespace)

[3] [Git Documentation — git-pull](https://git-scm.com/docs/git-pull)
