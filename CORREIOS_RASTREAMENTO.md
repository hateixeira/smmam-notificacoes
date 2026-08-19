# Rastreamento de ARs — configuração operacional

## Motor atual

O sistema utiliza o plano **Basic** gratuito da API Pacote Vício para consultar o andamento dos ARs. A integração anterior com a BrasilAPI foi removida porque seu endpoint de rastreamento passou a responder `404`.

O plano Basic informado pelo fornecedor oferece até **1.000 consultas por mês** e exige atribuição ao Pacote Vício. A atribuição já está disponível no cartão **Integração Correios** dentro de Configurações.

## Configuração inicial

1. Acesse a página do [Pacote Vício](https://pacotevicio.dev/) e selecione o plano Basic gratuito.
2. Crie uma chave da API no painel RapidAPI indicado pelo fornecedor.
3. Entre no sistema de fiscalização com perfil administrativo.
4. Abra **Configurações do Setor → Integração Correios**.
5. Cole a chave no campo **Chave gratuita do Pacote Vício** e clique em **Salvar chave neste navegador**.
6. Utilize **Sincronizar ARs agora** para consultar os registros pendentes do setor.

## Proteção da chave

A chave é armazenada somente no navegador administrativo em que foi cadastrada. Ela não é gravada no Firestore, não acompanha exportações e não aparece nas notificações. Se for necessário trocar de computador, repita a configuração nesse computador e remova a chave anterior no painel do provedor.

## Contingências preservadas

| Situação | Procedimento |
| --- | --- |
| Cota mensal gratuita atingida ou chave inválida | Importe o CSV de retorno do VIPP. |
| Provedor temporariamente indisponível | Use o link **Consultar nos Correios** de cada registro. |
| AR não possui evento disponível | Mantenha o status atual e faça nova consulta posterior ou importe o retorno VIPP. |

Nenhuma notificação existente foi alterada durante a troca do motor. O primeiro teste operacional deve ser feito com um AR institucional cujo resultado seja conhecido, antes de sincronizar o lote completo.
