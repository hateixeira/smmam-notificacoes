# Registro de validação — adequação institucional

**Data:** 19 de agosto de 2026

| Verificação | Resultado | Evidência |
| --- | --- | --- |
| Aviso de privacidade publicado | Aprovado | Página pública `https://smmam-fiscalizacao-tb.web.app/politica-privacidade` exibida e legível. |
| Navegação e fluxos críticos | Aprovado | `node scripts/smoke-test.mjs` executado com sucesso. |
| Sintaxe JavaScript | Aprovado | `node --check js/app.js` executado sem erro. |
| Formatação de mudanças | Aprovado | `git diff --check` executado sem erro. |
| Regras de Firestore/Storage em produção | Pendente | Console exigiu login institucional; nenhuma regra restritiva foi aplicada nesta etapa. |

Nenhuma notificação, auto, cadastro ou evidência foi alterado durante a publicação das melhorias seguras. A implantação de regras que possa restringir acesso depende da conferência dos perfis existentes e de teste controlado no console Firebase.
