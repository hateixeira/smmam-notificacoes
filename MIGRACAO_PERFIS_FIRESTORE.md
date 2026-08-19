# Migração controlada de perfis para regras por setor

## Situação identificada

Há dois perfis institucionais aprovados na coleção de usuários. Um já atende ao esquema `setor + status + nível`; o outro utiliza um nível operacional legado e não possui setor persistido. A aplicação atual interpreta esse nível legado como acesso administrativo na interface, mas as regras restritivas exigem explicitamente `nivel = admin` e `setor` definido.

## Migração mínima proposta

| Perfil | Estado atual | Ajuste proposto | Efeito esperado |
| --- | --- | --- | --- |
| Perfil administrativo legado | Sem setor persistido; nível legado. | Definir `setor = SMMAM` e converter o nível para `admin`. | Preserva o acesso administrativo atual e o torna compatível com as regras por setor. |
| Perfil administrativo já normalizado | Setor, status e nível compatíveis. | Nenhuma alteração. | Mantém acesso administrativo setorial. |

## Sequência segura

1. Criar uma cópia do documento de perfil legado em backup administrativo.
2. Atualizar somente os campos de controle indicados, sem tocar em nome, contato, matrícula ou histórico.
3. Confirmar o login e a exibição de menus administrativos na sessão do perfil migrado.
4. Publicar as regras restritivas de Firestore.
5. Testar leitura, criação, atualização e tentativa de exclusão por perfil administrativo e por perfil não administrativo.
6. Em caso de falha, restaurar imediatamente o documento de perfil e reaplicar a versão anterior das regras pelo histórico do console.

## Limite desta etapa

Esta migração altera permissões institucionais. Ela só deve ser executada com confirmação explícita do administrador responsável e com a sessão administrativa ativa no console Firebase.
