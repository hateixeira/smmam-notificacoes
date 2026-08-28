# Guia de Publicação Segura — SMMAM Notificações

Este guia permite que você publique a versão final do sistema no seu Firebase pessoal sem compartilhar suas credenciais. Siga os passos abaixo no terminal do seu computador.

## 1. Preparação do Ambiente

Certifique-se de ter o **Node.js** instalado. Em seguida, instale a ferramenta do Firebase:

```bash
npm install -g firebase-tools
```

## 2. Autenticação

Faça login na sua conta Google que gerencia o projeto:

```bash
firebase login
```

## 3. Vinculação do Projeto

No diretório do projeto, vincule-o ao seu ID do Firebase (`smmam-fiscalizacao-tb`):

```bash
firebase use smmam-fiscalizacao-tb
```

## 4. Publicação (Deploy)

Execute os comandos abaixo na ordem indicada para garantir que todas as dependências e regras sejam aplicadas:

### A. Regras de Segurança e Índices
Aplica as novas restrições de imutabilidade e os índices necessários para a tramitação:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage:rules
```

### B. Cloud Functions
Publica as funções de backend que gerenciam a numeração atômica, auditoria e acompanhamento imutável:

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

### C. Interface Web (Frontend)
Publica a nova interface com o modelo de notificação atualizado e a prévia obrigatória:

```bash
firebase deploy --only hosting
```

## 5. Verificação Pós-Publicação

Após o deploy, acesse o sistema e verifique:
1. **Configurações:** Se os novos parâmetros (URM, Prazos, Textos) aparecem para administradores.
2. **Emissão:** Se a prévia obrigatória é exibida antes de salvar uma notificação.
3. **Acompanhamento:** Se a ação "Acompanhar" está disponível em notificações já emitidas.

---
**Importante:** Mantenha sempre um backup do seu banco de dados antes de realizar atualizações de regras ou funções em ambientes com dados reais.
