# Diagnóstico inicial — login e modelo Tipo 1

## Login

A versão publicada em `https://hateixeira.github.io/smmam-notificacoes/` carrega o formulário de login e o botão `realizarLogin`. O código atual inicializa Firebase Authentication com o projeto `smmam-fiscalizacao-tb` e também inicializa Firebase App Check com `ReCaptchaEnterpriseProvider` para hosts que não sejam localhost. O fluxo de sessão usa `onAuthStateChanged` e, após a autenticação, lê `configuracoes/sistema` e `usuarios/{uid}`.

O código atual possui duas implementações de `window.realizarLogin`: uma no módulo `js/modules/auth.js`, registrada por `initAuthModule`, e outra posteriormente em `js/app.js`. A segunda sobrescreve a primeira. Essa duplicação deve ser eliminada ou unificada para evitar comportamento divergente. O login atual também usa mensagem genérica e descarta o código original do Firebase.

## Modelo Tipo 1 observado no PDF

O PDF `NOVOMODELOTIPO1.pdf` possui uma página A4 com tabela de cinco colunas e os seguintes elementos visíveis:

- cabeçalho com brasão, `PREFEITURA DE BENTO GONÇALVES`, `Secretaria Municipal de Meio Ambiente - SMMAM`, `Setor de Fiscalização` e `NOTIFICAÇÃO N°`;
- número no exemplo: `0539B/2026`;
- `DATA DA NOTIFICAÇÃO`;
- seleção de `Notificação Presencial` ou `Notificado por AR`;
- `NOME DO NOTIFICADO(A) OU RAZÃO SOCIAL`;
- `CPF OU CNPJ` e `CARTEIRA IDENTIDADE/CNH`;
- `ENDEREÇO DE CORRESPONDÊNCIA` e `TELEFONE`;
- `BAIRRO/DISTRITO`, `MUNICÍPIO`, `CEP` e `UF`;
- `DISTRITO`, `ZONA`, `QUADRA`, `LOTE` e `CADASTRO IMOBILIÁRIO`;
- título centralizado `MOTIVO DA NOTIFICAÇÃO`;
- texto de irregularidade com endereço e referência;
- linha `INFRAÇÃO - NECESSITA A LIMPEZA DE:` com opções marcadas;
- seção `ORIENTAÇÕES:`;
- texto de prazo: regularização em 15 dias corridos a partir do recebimento;
- texto `O OBJETIVO DESTA NOTIFICAÇÃO É ATENDER A CONFORMIDADE MUNICIPAL NAS LEIS:`;
- duas bases legais impressas, incluindo Lei Ordinária nº 5.198/2011 — Art. 6º e Lei Complementar nº 06/1996 — Art. 28;
- rodapé com `NOME DO SERVIDOR RESPONSÁVEL`, `RE / MATRÍCULA` e `ENDEREÇO DE APRESENTAÇÃO`;
- assinatura do notificante e assinatura do notificado com campo de recebimento.

O PDF Tipo 1 não apresenta QR Code na área visualizada. Por orientação expressa do usuário, o QR Code do WhatsApp deve permanecer no documento, mesmo não estando representado no PDF de referência.

## Decisões de implementação

O prazo padrão do Tipo 1 foi definido em 15 dias corridos, com campos administrativos para alteração do prazo de regularização, prazo de defesa, texto do motivo, orientações, prazo impresso, bases legais, texto do QR Code e endereço de apresentação. Os valores permanecem limitados e são sanitizados no cliente e no backend.

A função `exportarVipp`, o CSV VIPP, os campos usados pelo VIPP, os dados do Firestore, a numeração oficial, o fluxo de evidências e as regras de segurança não devem ser alterados durante o ajuste visual. O login foi tratado separadamente do modelo impresso.
