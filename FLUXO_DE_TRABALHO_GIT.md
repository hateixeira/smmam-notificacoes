# Fluxo de Trabalho — Mudanças sempre via Git

Este documento define o processo oficial de evolução do sistema SMMAM Notificações. **Toda alteração passa pelo GitHub** e o deploy é feito a partir do repositório, nunca por upload manual de arquivos.

## Visão geral do fluxo

```
Manus (desenvolvimento) → GitHub (main) → Codespaces ou máquina local → firebase deploy → Produção
```

1. **Desenvolvimento**: as mudanças são implementadas e testadas no sandbox do Manus, com evidências (prévia em PDF, testes de domínio).
2. **Versionamento**: cada entrega vira um commit na branch `main` do repositório `hateixeira/smmam-notificacoes`, com mensagem descritiva.
3. **Deploy**: você abre um **Codespace** no GitHub (ou usa sua máquina local) e publica com `firebase deploy`. O envio é cloud-to-cloud, sem usar sua internet local.

## Passo a passo do deploy (Codespaces)

1. No repositório do GitHub, clique em **Code → Codespaces → Create codespace on main**.
2. Aguarde o ambiente carregar (Node.js já vem pronto).
3. No terminal do Codespace:

```bash
npm install -g firebase-tools
firebase login --no-localhost
firebase use smmam-fiscalizacao-tb
```

4. Publique conforme o escopo da mudança:

| Mudança | Comando |
|---|---|
| Só telas/layout/PDF (index.html, css, js) | `firebase deploy --only hosting` |
| Lógica de backend (functions/index.js) | `firebase deploy --only functions` |
| Regras de segurança ou índices | `firebase deploy --only firestore:rules,firestore:indexes,storage:rules` |
| Tudo de uma vez | `firebase deploy` |

## Regras de proteção do trabalho

- **Nunca editar arquivos direto no GitHub** (botão Edit do site) nem no Firebase Console; isso quebra a sincronia com o repositório.
- **Um commit por entrega**, com mensagem começando por `feat:`, `fix:` ou `docs:`.
- A **exportação VIPP** (`exportarVipp` no `js/app.js`) e os campos que a alimentam são intocáveis sem autorização expressa.
- A exclusão definitiva de registros existe apenas para a fase de desenvolvimento/homologação e é restrita a administradores via Cloud Function `deleteDocuments`, com registro em auditoria. Antes da entrada em operação real, avaliar desativá-la novamente.

## Histórico de entregas recentes

| Data | Commit | Entrega |
|---|---|---|
| 28/08/2026 | `4769c4d` | Novo modelo oficial de notificação (NOVOMODELO.docx) no PDF |
| 28/08/2026 | `2e667af` | QR Code de WhatsApp único por notificação no documento impresso |
