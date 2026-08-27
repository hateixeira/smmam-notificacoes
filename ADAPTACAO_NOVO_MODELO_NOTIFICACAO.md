# Adaptação do novo modelo de notificação

O modelo recebido apresenta uma página A4 em orientação retrato, com grade documental, cabeçalho institucional, identificação do notificado, endereço de correspondência, cadastro imobiliário, motivo da notificação, infrações, orientações, prazo, bases legais e assinaturas.

## Campos preservados

| Grupo | Campos no sistema |
|---|---|
| Destinatário e VIPP | `nome`, `endereco`, `bairro`, `cidade`, `uf`, `cep`, `telefone` e `doc` (CPF/CNPJ). |
| Identificação complementar | `identidade` para RG/CNH. |
| Imóvel | `cadDistrito`, `cadZona`, `cadQuadra`, `cadLote`, `cadImob` e `loteEndereco`. |
| Emissão | `numNotif`, `dataNotif`, `tipoPresencial`, `tipoAR`, `codigoAR` e `dataRecebimento`. |
| Conteúdo | `motivoNotificacao`, `arrayInfracoes`, `ref`, `obs`, fiscal e matrícula. |

## Parâmetros administrativos

Os parâmetros por setor ficam em `configuracoes/parametros_{SETOR}` e são gravados como cópia em `parametrosDocumento` no momento da emissão. Isso preserva o conteúdo histórico mesmo quando uma configuração é alterada posteriormente. A alteração é restrita a administrador e auditada pela função `updateDocumentParameters`.

## Prévia obrigatória

Antes da criação de uma notificação, o sistema monta a mesma grade usada para impressão em uma janela de conferência. O operador pode retornar para editar, imprimir/salvar em PDF ou confirmar o salvamento. A numeração definitiva somente é atribuída no salvamento pelo backend.

## Verificação local

Em 27 de agosto de 2026, a aplicação foi aberta localmente a partir do arquivo `index.html`. A tela de acesso carregou com a identidade visual esperada e não apresentou erro no console do navegador. A conferência completa do fluxo autenticado continua dependente de ambiente Firebase de homologação com perfil institucional aprovado.

A prévia também foi conferida com dados exclusivamente locais de teste. A grade apresentou cabeçalho, identificação, RG/CNH, endereço, cadastro imobiliário, motivo, infração, prazo, orientações, base legal e assinaturas em uma composição A4. O modal disponibiliza retorno à edição, impressão/salvamento em PDF e confirmação explícita antes da gravação.
