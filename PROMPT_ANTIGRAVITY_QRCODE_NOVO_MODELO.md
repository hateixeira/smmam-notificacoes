# Prompt para o Google Antigravity — novo modelo de notificação e QR Code WhatsApp

Copie o prompt abaixo e cole no Google Antigravity, dentro do repositório correto `smmam-notificacoes`.

```text
Você está trabalhando no repositório correto do sistema SMMAM Notificações.

ANTES DE COMEÇAR
1. Confirme que o remoto Git é:
   https://github.com/hateixeira/smmam-notificacoes.git
2. Confirme o projeto Firebase `smmam-fiscalizacao-tb` e a região
   `southamerica-east1`.
3. Não trabalhe diretamente na branch main. Crie uma branch:
   feat/novo-modelo-qrcode-notificacao
4. Leia README.md, ADAPTACAO_NOVO_MODELO_NOTIFICACAO.md,
   MAPEAMENTO_NOVO_MODELO_2026.md, index.html, css/style.css e js/app.js.
5. Faça primeiro uma análise curta dos arquivos e do fluxo de impressão.
   Depois implemente a tarefa abaixo.

OBJETIVO
Atualizar somente o documento impresso/visualização de notificação para:
A. reproduzir o novo modelo institucional de notificação;
B. incluir um QR Code exclusivo para cada notificação, direcionando ao
   WhatsApp da Fiscalização com mensagem pré-preenchida;
C. preservar todos os dados, o salvamento existente e principalmente a
   exportação VIPP.

NOVO MODELO INSTITUCIONAL
A área de impressão deve seguir o modelo anexado anteriormente e manter os
campos dinâmicos já existentes. Ajuste os textos fixos e os rótulos para:

- `2. NOTIFICAÇÃO N°` no lugar de `2. DOCUMENTO N°`;
- `3. DATA DA NOTIFICAÇÃO` no lugar de `3. DATA DE EMISSÃO`;
- `7. CARTEIRA IDENTIDADE/CNTPS`;
- incluir o texto de advertência penal como item 14:
  `O não atendimento desta notificação poderá caracterizar crime de
   desobediência, nos termos do art. 330 do Código Penal.`
- usar `15. MOTIVO DA NOTIFICAÇÃO`;
- manter as bases legais no formato de opções marcadas com `( X )`, conforme
  o modelo institucional;
- usar o título `OBSERVAÇÕES:`;
- exibir os dados do servidor como `NOME DO NOTIFICANTE`, `RE` e `MATRÍCULA`;
- exibir `ASSINATURA DO NOTIFICANTE` e `ASSINATURA DO NOTIFICADO`;
- manter a linha de recebimento:
  `Recebi o presente em ____/____/________.`

Não remova nenhum campo dinâmico já usado pelo sistema. Se um campo não tiver
valor, mantenha o rótulo e deixe o espaço em branco conforme o layout.

QR CODE DO WHATSAPP
Adicionar o QR Code no documento impresso, preferencialmente acima das
assinaturas e em uma composição compacta com o texto explicativo ao lado.

Parâmetros obrigatórios:
- número do WhatsApp para o link: `555430557211`;
- exibição humana: `(54) 3055-7211`;
- URL base: `https://wa.me/555430557211`;
- mensagem padrão exata, substituindo o número pelo número oficial da
  notificação:
  `Olá, estou entrando em contato sobre a notificação XXX/2026.`
- o `XXX/2026` deve ser substituído por algo como `0538B/2026`, usando o
  número oficial gerado e salvo pelo backend;
- montar a URL com `encodeURIComponent` para preservar acentos e espaços;
- cada QR Code deve ser único porque a mensagem contém o número individual da
  notificação;
- usar a biblioteca local já existente em `js/vendor/qrcode.min.js`, se ela
  estiver presente; não criar dependência externa nem depender de CDN;
- não usar o número com zero de tronco no link. O link deve usar o formato
  internacional `55 + DDD 54 + número 30557211`;
- imprimir o QR Code em tamanho legível, com margem branca, alto contraste e
  sem deformação;
- preservar a quiet zone/margem do QR Code e não sobrepor texto ao código.

Texto explicativo que deve acompanhar o QR Code:

`Após realizar a limpeza do terreno, ou em caso de dúvidas, aponte a câmera do celular para o QR Code ao lado e envie as fotos da limpeza para o WhatsApp da Fiscalização (54) 3055-7211. A mensagem já vai pronta com o número desta notificação.`

COMPORTAMENTO DO NÚMERO
- Antes de salvar, o número oficial ainda pode não existir. Nesse caso, a
  prévia pode mostrar um aviso discreto de que o QR Code será gerado após o
  salvamento, sem criar um QR Code falso ou com número provisório.
- Depois de salvar, ao abrir ou imprimir a notificação, o QR Code deve ser
  gerado com o número definitivo, por exemplo `0538B/2026`.
- Ao editar uma notificação já salva, o QR Code deve continuar usando o mesmo
  número, nunca um novo número.
- Para autos de infração, não criar QR Code de notificação se o modelo não
  solicitar isso; preservar o fluxo de autos sem alterações desnecessárias.

PRESERVAÇÃO OBRIGATÓRIA DO VIPP
Não altere, renomeie, remova ou reordene nenhum campo que alimente o VIPP.
Não altere a função `exportarVipp`, a montagem do CSV, os cabeçalhos, a ordem
das colunas ou os dados usados na exportação. Em especial, preserve:

`nome`, `endereco`, `bairro`, `cep`, `cidade`, `uf`, `telefone`, `doc`,
`tipoAR`, `codigoAR` e o número da notificação.

A alteração deve ficar limitada à apresentação impressa, ao CSS do documento,
e às funções auxiliares necessárias para montar o QR Code. Não altere
Firestore, Storage, Cloud Functions, regras de segurança ou dados reais, salvo
se for demonstrado que isso é indispensável — nesse caso, pare e peça
aprovação antes de editar.

VALIDAÇÃO OBRIGATÓRIA
Depois da implementação, execute:

- `node scripts/smoke-test.mjs`;
- `node scripts/domain-test.mjs`;
- `node --check js/app.js`;
- `git diff --check`.

Faça também uma validação determinística do QR Code sem gastar tempo com
muitos recortes de imagem:

1. gere um QR Code de teste para `0538B/2026`;
2. verifique no código ou em um teste automatizado que o conteúdo é exatamente
   `https://wa.me/555430557211?text=Olá%2C%20estou%20entrando%20em%20contato%20sobre%20a%20notificação%200538B%2F2026.`
   ou a mesma URL com codificação equivalente;
3. confira que a mensagem contém o número correto;
4. gere uma prévia/PDF A4 e verifique se o QR Code cabe em uma página e não
   interfere nas assinaturas.

Antes de concluir, compare o diff da exportação:

`git diff -- js/app.js index.html css/style.css`

Se aparecer qualquer alteração em `exportarVipp`, no CSV ou nos campos VIPP,
pare, reverta somente essa alteração e informe o conflito.

ENTREGA
Não faça deploy nem altere produção automaticamente. Mostre:

- branch criada;
- arquivos alterados;
- diff resumido;
- resultado dos testes;
- conteúdo exato de uma URL de WhatsApp de teste;
- confirmação visual do PDF;
- confirmação de que exportarVipp e o CSV VIPP não foram alterados;
- comando de commit sugerido;
- comando de push sugerido;
- plano de reversão.

Aguarde minha autorização antes de fazer commit final, push ou deploy.
```
