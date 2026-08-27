# Acompanhamento imutável das notificações

## Princípio de preservação

Depois de emitida, a notificação deixa de ser editável no formulário. Nome, CPF/CNPJ, RG/CNH, endereço, cadastro imobiliário, motivo, infrações, parâmetro documental e texto impresso permanecem como registro da emissão. O acompanhamento ocorre por eventos auditáveis, sem reabrir ou reemitir o documento.

## Ciclo de AR

| Marco | Etapa operacional | Registro necessário |
|---|---|---|
| Emissão por AR | `aguardando_postagem_ar` | Aguardando despacho físico. |
| Postagem | `ar_postado` | Código de AR, data de postagem e observação. |
| Trânsito | `ar_em_transito` | Atualização de rastreio ou registro manual. |
| Entrega | `ar_entregue_pendente_ciencia` | Retorno entregue, ainda sem presumir ciência jurídica. |
| Devolução | `ar_devolvido` | Motivo/observação e encaminhamento para nova tentativa ou outra forma de ciência. |
| Ciência certificada | `prazo_regularizacao` | Data de ciência/recebimento que inicia o prazo legal. |

## Eventos posteriores

O atendimento deve registrar pedido de prorrogação com data e justificativa. A decisão pode ser pendente, deferida ou indeferida; somente o deferimento com quantidade de dias permitida produz uma nova data-limite derivada da data original. A vistoria de retorno pode confirmar limpeza ou manter a pendência. A confirmação de limpeza encerra a regularização sem alterar o conteúdo da notificação emitida.

## Imutabilidade e auditoria

Cada evento é escrito pela função institucional `recordNotificationFollowUp`, gera entrada na subcoleção `acompanhamentos` e na auditoria central, e atualiza apenas campos de acompanhamento, situação e tramitação. Nenhum evento aceita ou altera o payload documental original.
