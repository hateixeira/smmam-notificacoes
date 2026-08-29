# Roteiro para o Google Antigravity — erros de salvamento e exclusão

**Projeto:** SMMAM Notificações  
**Repositório:** [github.com/hateixeira/smmam-notificacoes](https://github.com/hateixeira/smmam-notificacoes)  
**Branch de produção do código:** `main`  
**Projeto Firebase:** `smmam-fiscalizacao-tb`  
**Região das Functions:** `southamerica-east1`  
**Data do roteiro:** 29/08/2026

Este documento possui duas partes. A primeira contém um texto pronto para colar no Google Antigravity. A segunda explica, de forma transparente, o que foi tentado anteriormente, o que foi confirmado e o que não resolveu o problema.

## 1. Como abrir o trabalho no Antigravity

Abra no Google Antigravity a pasta clonada do repositório `smmam-notificacoes`. Confirme no terminal que o projeto correto está aberto:

```bash
git remote -v
git status -sb
git log --oneline -8
```

O remoto deve apontar para `hateixeira/smmam-notificacoes`. O Antigravity recomenda organizar o trabalho dentro de um Project e permite trabalhar em modo local ou em um novo worktree isolado [1]. Para este diagnóstico, use **New Worktree Mode** se estiver disponível. Assim, a investigação não altera diretamente a `main`.

Não peça ao Antigravity para fazer deploy ou push na primeira etapa. Primeiro obtenha o diagnóstico e o plano de correção.

## 2. Prompt de diagnóstico — copiar e colar primeiro

Copie o texto abaixo integralmente para o Antigravity:

```text
Você está trabalhando no repositório SMMAM Notificações, da Secretaria Municipal do Meio Ambiente.

REPOSITÓRIO E AMBIENTE
- Repositório GitHub: https://github.com/hateixeira/smmam-notificacoes
- Projeto Firebase: smmam-fiscalizacao-tb
- Região das Cloud Functions: southamerica-east1
- URL que o usuário utiliza no navegador: https://hateixeira.github.io/smmam-notificacoes/
- A URL acima é GitHub Pages. Não presuma que firebase deploy --only hosting atualiza essa URL.
- A configuração firebase.json do repositório também contém Firebase Hosting e Functions.

PROBLEMAS ATUAIS
1. Ao salvar uma notificação ou auto, o navegador mostra:
   "Erro ao salvar. functions/internal — internal"
2. A exclusão de registros também não funciona e já mostrou:
   "Não foi possível excluir. Detalhe técnico: functions/internal — internal"
3. O sistema deve continuar funcionando com o QR Code, o novo modelo de notificação, os dados existentes e a exportação VIPP.

OBJETIVO
Diagnosticar e corrigir os dois problemas com evidência técnica, sem tentativas cegas e sem alterar a exportação VIPP.

REGRAS OBRIGATÓRIAS
- Não edite diretamente a branch main. Crie uma branch de tarefa ou use um novo worktree.
- Não faça deploy, push, merge, exclusão de dados, alteração de regras ou alteração de configuração de produção sem minha autorização explícita.
- Não execute git reset --hard, git clean -fd ou git push --force.
- Não altere a função exportarVipp, o formato do CSV VIPP, os campos usados pelo VIPP ou a ordem das colunas.
- Não altere dados do Firestore ou arquivos do Storage para testar.
- Não remova o botão de exclusão para esconder o defeito. Se a exclusão precisar ser desabilitada temporariamente, explique a razão e implemente uma mensagem clara sem apagar dados.
- Não publique uma correção apenas porque o código passou em node --check.
- Se precisar de logs do Firebase, mostre a consulta e leia os registros; não invente a causa.

PRIMEIRA ETAPA: SOMENTE INVESTIGAÇÃO
Não edite arquivos ainda. Faça o seguinte:
1. Confirme a branch, o commit atual e o remoto Git.
2. Leia README.md, firebase.json, firestore.rules, storage.rules, functions/package.json, functions/pnpm-lock.yaml, functions/index.js e o fluxo de salvar/excluir em js/app.js.
3. Mapeie todas as chamadas feitas por salvarDocumento e excluirSelecionadas.
4. Identifique se o erro de salvamento ocorre em createDocument, updateDocument, recordAuditEvent, moveProcessStage, Storage, Firestore direto ou no recarregamento da lista.
5. Verifique o endpoint efetivamente chamado pelo navegador, a região, o projeto Firebase, o status HTTP, o preflight OPTIONS/CORS e os logs de execução da Function.
6. Verifique se createDocument e updateDocument estão implantadas e se o Cloud Run associado está saudável.
7. Verifique se deleteDocuments existe no código e no Firebase e em que versão foi implantada.
8. Compare o código do repositório com a versão publicada no GitHub Pages, levando em conta cache e a origem correta do site.
9. Confira se a mensagem functions/internal é uma resposta real da Function ou uma conversão genérica feita pelo Firebase SDK.
10. Diga qual é a primeira operação que falha e apresente a evidência: log, status HTTP, trecho de código ou reprodução controlada.

Ao terminar, responda apenas com:
A. diagnóstico comprovado;
B. hipótese ainda não comprovada, se houver;
C. arquivos que precisariam ser alterados;
D. Functions que precisariam ser publicadas;
E. testes necessários;
F. plano de reversão;
G. confirmação explícita de que o VIPP não será alterado.

Não implemente nada nesta primeira etapa.
```

### O que esperar do primeiro resultado

O Antigravity deve apontar **qual etapa falha**, e não apenas repetir `functions/internal`. O resultado ideal deve diferenciar pelo menos estas etapas:

| Etapa | Evidência esperada |
|---|---|
| `createDocument` | Requisição e resposta da Function; log de execução. |
| `updateDocument` | Requisição e resposta da Function; log de execução. |
| `recordAuditEvent` | Se é chamado e se seu erro é absorvido pelo cliente. |
| Storage | Código HTTP ou erro `storage/unauthorized`, se houver foto. |
| Firestore de evidências | Código HTTP ou erro de regra, se houver foto. |
| Recarregamento | Se o documento foi salvo e somente `carregarDadosNuvem` falhou. |
| GitHub Pages | Se o navegador está usando o `app.js` atual. |

Se o agente afirmar apenas “é CORS”, peça o registro da requisição `OPTIONS`, seu status HTTP e a configuração implantada da Function. Se afirmar apenas “é autenticação”, peça a evidência de `request.auth` e do perfil `usuarios/{uid}`. Não aceite uma hipótese como causa comprovada.

## 3. Prompt de implementação — copiar somente depois do diagnóstico

Depois de ler o diagnóstico do Antigravity e confirmar que a causa está correta, use este segundo prompt, ajustando os nomes das Functions se o diagnóstico encontrar algo diferente:

```text
Agora implemente a correção aprovada para os erros de salvamento e exclusão.

Antes de editar:
1. Crie uma branch de tarefa com nome descritivo, por exemplo:
   fix/functions-salvar-excluir
2. Mostre a lista de arquivos que serão alterados.
3. Explique por que cada arquivo é necessário.
4. Confirme que exportarVipp, o CSV VIPP e os campos de exportação permanecerão intocados.

IMPLEMENTAÇÃO
- Corrija somente a causa comprovada no diagnóstico.
- Preserve a autenticação institucional dentro da Function. Se for necessário permitir a entrada HTTP pública para uma callable, isso deve servir apenas para permitir o transporte da requisição; a Function deve continuar validando request.auth, o perfil aprovado, o nível e o setor antes de operar.
- Preserve a separação por setor e as regras de autorização.
- Preserve a numeração atômica e os documentos existentes.
- A exclusão, se for corrigida, deve exigir perfil autorizado, confirmar a ação e registrar auditoria. Não faça exclusões em lote de dados reais para testar.
- O cliente deve mostrar a etapa que falhou e o código técnico real, sem afirmar que o documento não foi criado se a chamada já tiver criado o documento.
- Se houver risco de uma etapa posterior falhar depois da criação, torne o fluxo idempotente ou deixe explícito como o usuário deve verificar o registro para não duplicá-lo.

VALIDAÇÃO LOCAL
Execute, no mínimo:
- node scripts/smoke-test.mjs
- node scripts/domain-test.mjs
- node --check js/app.js
- node --check functions/index.js
- git diff --check

Faça uma verificação específica do VIPP:
- git diff -- js/app.js index.html css/style.css
- confira que exportarVipp não mudou;
- confira que os campos nome, endereco, bairro, cep, cidade, uf, telefone, doc, tipoAR, codigoAR e número do documento continuam presentes e com o mesmo significado.

DEPLOY
Não publique automaticamente. Informe exatamente:
- quais Functions precisam de deploy;
- se hosting precisa de deploy;
- se GitHub Pages é o destino do frontend;
- se regras ou índices precisam de deploy;
- quais comandos serão usados;
- como reverter.

Ao final, mostre:
- git diff --stat;
- git diff;
- resultado de todos os testes;
- commit criado;
- branch criada;
- Functions que ainda não foram publicadas.
```

## 4. Como publicar depois da revisão

O Antigravity deve primeiro criar o commit e enviar a branch, não a `main` diretamente:

```bash
git add arquivos-revisados
git diff --cached --check
git commit -m "fix: corrige erro comprovado no fluxo de salvamento"
git push -u origin fix/functions-salvar-excluir
```

Depois da revisão no GitHub, faça o merge. Só então publique o escopo aprovado. Se forem realmente `createDocument`, `updateDocument` e `deleteDocuments`, o comando deve ser explicitamente direcionado:

```bash
firebase use smmam-fiscalizacao-tb
firebase deploy --only functions:createDocument,functions:updateDocument,functions:deleteDocuments
```

Se o diagnóstico comprovar que somente `createDocument` e `updateDocument` precisam ser publicados, não publique `deleteDocuments`. Se houver conflito com uma Function antiga, não apague uma Function de produção sem registrar o nome, a região, o tipo atual e o plano de recriação.

Para um frontend servido pelo GitHub Pages, confirme primeiro a configuração em **GitHub → Settings → Pages**. O comando `firebase deploy --only hosting` só atualiza o Firebase Hosting; ele não atualiza automaticamente `hateixeira.github.io`.

## 5. Histórico transparente das tentativas anteriores

As tentativas abaixo foram feitas antes deste roteiro. Elas são registradas para que o Antigravity não repita os mesmos caminhos sem verificar a evidência.

### 5.1. QR Code do WhatsApp

Foi implementado um bloco no documento impresso com QR Code para o WhatsApp `54 3055-7211`. A mensagem padrão usa o número da notificação, por exemplo: “Olá, estou entrando em contato sobre a notificação 0538B/2026.” A biblioteca QR Code foi mantida localmente em `js/vendor/qrcode.min.js` para não depender de rede durante a geração do documento.

Essa parte foi considerada funcional na prévia do PDF e foi preservada no commit `2e667af`. O QR Code, o novo modelo de notificação e o PDF não são a causa comprovada do erro atual de salvamento.

O que foi inadequado: foram feitas muitas tentativas consecutivas de recortar e decodificar o QR Code renderizado em imagens de teste. Isso consumiu tempo e recursos sem aumentar a certeza sobre o erro de salvamento. A validação correta deveria ter sido um teste único do conteúdo do QR Code e, depois, um teste com celular.

### 5.2. Primeira implementação da exclusão

Foi restaurado o botão “Excluir Selecionadas” e criada uma Cloud Function `deleteDocuments`, restrita a administrador, com tentativa de remover documento, subcoleções, evidências e arquivos do Storage, registrando auditoria. O cliente passou a chamá-la por `httpsCallable`.

O que não funcionou: a função dependia de operações no Storage e retornava `functions/internal`. A causa não foi comprovada naquele momento por logs da execução. A dependência do Storage foi removida depois, mas isso não resolveu o problema de implantação nem comprovou o problema do salvamento.

### 5.3. Conflito com `processIptuImport`

Ao tentar publicar todas as Functions, o Firebase informou:

```text
Changing from an HTTPS function to a background triggered function is not allowed.
Please delete your function and create a new one instead.
```

Esse erro dizia respeito à Function antiga `processIptuImport`, cujo tipo implantado era diferente do tipo presente no código atual. Foi sugerido remover e recriar essa Function. Isso não era necessário para resolver o salvamento e introduzia risco em uma Function já existente. Não deve ser repetido sem inventário e autorização.

### 5.4. Erro do Functions Framework no build

O log de deploy mostrou a causa exata de uma falha de build da `deleteDocuments`:

```text
This project is using pnpm but you have not included the Functions Framework in your dependencies.
Please add it by running: pnpm add @google-cloud/functions-framework
```

O projeto possui `functions/pnpm-lock.yaml`. Foi adicionada a dependência `@google-cloud/functions-framework` e o commit correspondente foi `f629864`.

O que isso resolveu: corrigiu a causa de build da `deleteDocuments`.  
O que isso não resolveu: não corrigiu o erro de salvamento do usuário, porque salvar usa principalmente `createDocument` e `updateDocument`, e o erro posterior era de requisição/execução dessas Functions.

### 5.5. Restauração da versão estável com QR Code

Para recuperar o sistema, a árvore do repositório foi restaurada para o estado do commit `2e667af`, que continha QR Code e o modelo de notificação. Foi criado o commit de reversão `6e0ffd8`.

O que não funcionou como recuperação completa: o frontend foi tratado como se fosse publicado pelo Firebase Hosting, mas a URL usada pelo usuário é `hateixeira.github.io`, que corresponde ao GitHub Pages. Firebase Hosting e GitHub Pages são destinos diferentes. Além disso, o estado das Functions implantadas permaneceu independente da árvore restaurada. Assim, restaurar o frontend não corrigiu Functions quebradas.

### 5.6. Primeira hipótese sobre o salvamento: auditoria com valor indefinido

O código do salvamento chamava:

```javascript
await registrarLog(editId ? `Editou ${tipoDoc}` : `Criou ${tipoDoc}`, dados.numNotif);
```

O objeto `dados` não continha `numNotif`; o número era gerado pelo backend e ficava em `numeroOriginal` ou no retorno da criação. Isso podia fazer `recordAuditEvent` receber um alvo vazio e falhar.

Foi corrigido para:

```javascript
await registrarLog(
  editId ? `Editou ${tipoDoc}` : `Criou ${tipoDoc}`,
  numeroOriginal || idDoDoc
);
```

Também foi adicionada a exibição do código e da mensagem técnica no alerta. Essa correção foi enviada no commit `dce12d7`.

O que não funcionou como solução completa: a auditoria já possui tratamento interno que absorve a falha em vários caminhos, e o usuário continuou recebendo `functions/internal`. Portanto, essa hipótese era plausível, mas não foi a causa única comprovada do erro atual.

### 5.7. Deploy direcionado de `createDocument` e `updateDocument`

Foi executado no Codespace:

```bash
firebase deploy --only functions:createDocument,functions:updateDocument
```

O Firebase respondeu:

```text
functions[createDocument(southamerica-east1)] Successful update operation.
functions[updateDocument(southamerica-east1)] Successful update operation.
Deploy complete!
```

O log do Firebase depois mostrou uma evidência importante:

```text
2026-08-29 09:13:57.633 OPTIONS 403 0 ms Chrome 146.0.0.0
https://southamerica-east1-smmam-fiscalizacao-tb.cloudfunctions.net/updateDocument
```

Esse registro confirma que uma requisição preflight `OPTIONS` recebeu `403` antes de a Function executar. Foi adicionada a opção `invoker: "public"` às declarações `onCall` no commit `823bf58`, mantendo a verificação interna de autenticação e autorização.

O que permaneceu sem confirmação: não houve validação conclusiva, por logs posteriores, de que a permissão de invocação corrigiu o preflight em produção. O usuário continuou vendo `functions/internal`. Por isso, o próximo agente deve consultar os logs depois de uma única tentativa controlada e verificar o status HTTP real, em vez de assumir que o problema foi resolvido.

### 5.8. Tentativas de correção da exclusão e situação final

Depois da falha da exclusão, foram criados commits para remover a dependência do Storage, adicionar o Functions Framework e restaurar a versão com QR Code. Esses commits resolveram problemas pontuais de código ou build, mas não produziram uma exclusão funcional confirmada em produção.

A restauração para o commit estável também removeu o botão de exclusão do frontend, mas isso foi uma medida de recuperação, não uma correção do backend. A Function `deleteDocuments` pode continuar existindo no Firebase, em estado que precisa ser auditado pelo Antigravity. O agente não deve presumir que o botão, a Function e a versão publicada estão alinhados.

## 6. Resumo do estado conhecido

| Item | Estado conhecido |
|---|---|
| QR Code e modelo do PDF | Preservados no commit estável `2e667af`. |
| Exportação VIPP | Deve permanecer intocada; qualquer diff nela exige bloqueio e revisão. |
| URL usada pelo usuário | GitHub Pages: `hateixeira.github.io/smmam-notificacoes`. |
| Firebase Hosting | Existe no `firebase.json`, mas não é automaticamente a URL acima. |
| `createDocument` | Foi implantada com sucesso em 29/08/2026 e tinha URL Cloud Run ativa; ainda houve erro no fluxo do usuário. |
| `updateDocument` | Foi implantada com sucesso em 29/08/2026; houve registro `OPTIONS 403` antes da execução. |
| `deleteDocuments` | Houve falhas de build e de execução; estado atual precisa ser conferido. |
| `processIptuImport` | Function antiga com conflito de tipo; não remover sem inventário e autorização. |
| Erro atual | `functions/internal`; a etapa exata ainda precisa ser comprovada pelos logs atuais. |

## 7. O que o Antigravity não deve fazer

Não deve começar pelo botão de excluir, apagar Functions antigas, publicar todas as Functions, alterar regras do Firestore, trocar o projeto Firebase, remover o QR Code ou reescrever o formulário inteiro. Também não deve concluir que o erro foi resolvido apenas porque o comando de deploy terminou com `Deploy complete!`.

A sequência correta é: identificar a requisição que falha, comprovar a causa, corrigir em branch, executar testes, revisar o diff, verificar o VIPP, abrir pull request, publicar somente o escopo aprovado e testar uma operação controlada.

## Referências

[1] [Google Antigravity Docs — Getting Started with Antigravity 2.0](https://antigravity.google/docs/getting-started/)

[2] [GitHub Docs — Using source control in your codespace](https://docs.github.com/en/codespaces/developing-in-a-codespace/using-source-control-in-your-codespace)

[3] [Repositório oficial do projeto SMMAM Notificações](https://github.com/hateixeira/smmam-notificacoes)
