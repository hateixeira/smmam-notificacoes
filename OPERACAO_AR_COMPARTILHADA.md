# Operação da consulta compartilhada de AR

## Objetivo e limites

O sistema de fiscalização consulta o rastreamento de AR em uma camada gratuita protegida, sem manter a chave do provedor no navegador, no Firestore, no GitHub ou no CSV do VIPP. O arquivo CSV do VIPP continua sendo exclusivamente o fluxo original de expedição para os Correios; a consulta compartilhada não o lê, altera ou reenvia.

## Regra de execução

Em dias úteis, o primeiro acesso de um perfil **operador** ou **administrador** do setor, após 8h e após 13h, pode iniciar uma rodada. Cada rodada consulta até oito ARs pendentes e respeita uma pausa entre as chamadas ao provedor. Se dois usuários entrarem simultaneamente, um objeto de coordenação reserva a janela por cinco minutos e impede a duplicidade.

| Componente | Responsabilidade | Proteção aplicada |
| --- | --- | --- |
| Aplicação Firebase | Seleciona até oito notificações pendentes já visíveis ao usuário e aplica somente os retornos recebidos. | Firebase Authentication e regras Firestore por perfil e setor. |
| Worker gratuito | Confirma perfil/registro no Firestore, controla a janela e consulta a API de rastreamento. | Origem restrita ao Hosting, token Firebase obrigatório e limite por janela. |
| Segredo do Worker | Guarda a chave do Pacote Vício. | Segredo de plataforma; não retorna ao navegador. |
| CSV VIPP | Permanece o arquivo de expedição institucional. | Não é acessado pelo Worker. |

## Tela e contingências

A Tela Inicial mostra a última busca registrada, a janela correspondente, a quantidade consultada e os retornos obtidos. A sincronização manual é uma exceção exclusiva de administrador. Quando a API estiver indisponível, a interface mantém o link de consulta oficial dos Correios em cada registro.

## Operação administrativa

A chave deve ser rotacionada no RapidAPI quando houver suspeita de exposição. Após a rotação, ela deve ser atualizada apenas como segredo `RAPIDAPI_AR_KEY` do Worker. Nunca deve ser incluída em mensagem, captura de tela, arquivo de configuração, Firestore ou repositório.

Para uma conta Cloudflare completamente nova, a primeira publicação deve usar `AR_WORKER_INITIAL_DEPLOY=1` ao preparar a implantação, criando o objeto de coordenação. Atualizações posteriores devem omitir essa variável para preservar o objeto existente.

## Validação realizada

Foram validados a chave nova em ambiente protegido, a sintaxe do cliente e do Worker, a pré-validação CORS, a publicação do Hosting sem cache persistente e o carregamento funcional no endereço normal da fiscalização. A validação de feriados municipais e o monitoramento contínuo da cota do provedor permanecem como rotina operacional pendente.
