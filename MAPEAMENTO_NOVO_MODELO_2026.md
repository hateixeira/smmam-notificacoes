# Mapeamento do novo modelo de notificação (NOVOMODELO.docx)

Fonte: anexo `NOVOMODELO.docx` recebido em 28/08/2026. Página A4 retrato, grade única de 5 colunas (larguras aproximadas 18,6% / 18,4% / 18,6% / 18,4% / 39,9% — a última coluna é mais larga).

## Estrutura da grade (11 linhas)

| Linha | Conteúdo | Mesclagem |
|---|---|---|
| R0 | Cabeçalho: PREFEITURA DE BENTO GONÇALVES / Secretaria / Setor de fiscalização | span 4 + célula "2. NOTIFICAÇÃO N°" |
| R1 | "3. DATA DA NOTIFICAÇÃO" | span 4 + célula "( ) Notificação Presencial ( X ) Notificado por AR" |
| R2 | "5. NOME DO NOTIFICADO (OU RAZÃO SOCIAL)" | span 5 |
| R3 | "6. CPF OU CNPJ" | span 4 + "7. CARTEIRA IDENTIDADE/CNTPS" |
| R4 | "8. ENDEREÇO DE CORRESPONDÊNCIA" | span 4 + "9. TELEFONE" |
| R5 | "10. BAIRRO/DISTRITO" span 2 + "11. MUNICÍPIO" + "12. CEP" + "13. UF" | 4 células |
| R6 | DISTRITO / ZONA / QUADRA / LOTE / CADASTRO IMOBILIÁRIO | 5 células |
| R7 | "14. O NÃO ATENDIMENTO DO PRESENTE PODERÁ CONSTITUIR CRIME DE DESOBEDIÊNCIA CONFORME O ARTIGO 330 DO CÓDIGO PENAL" | span 5 (NOVO no modelo) |
| R8 | "15. MOTIVO DA NOTIFICAÇÃO" (título de seção) | span 5 |
| R9 | Corpo do motivo: verificação do lote, checkboxes de infração, ponto de referência, OBS, "FICA NOTIFICADO POR ESTE INSTRUMENTO..." com prazo, bases legais com (X), OBSERVAÇÕES | span 5 |
| R10 | "NOME DO NOTIFICANTE / RE / MATRÍCULA" | span 4 + "18. ENDEREÇO DE APRESENTAÇÃO" |

Fora da tabela, ao final: "ASSINATURA DO NOTIFICANTE", linha "Recebi o presente em ___/___/______" e "ASSINATURA DO NOTIFICADO".

## Diferenças em relação ao espelho atual do sistema

1. **Rótulo do número**: "2. DOCUMENTO N°" passa a "2. NOTIFICAÇÃO N°".
2. **Rótulo da data**: "3. DATA DE EMISSÃO" passa a "3. DATA DA NOTIFICAÇÃO".
3. **Rótulo da identidade**: "7. CARTEIRA IDENTIDADE / CNH" passa a "7. CARTEIRA IDENTIDADE/CNTPS".
4. **Nova linha de advertência penal (item 14)**: crime de desobediência, art. 330 do Código Penal — não existia no espelho atual.
5. **Motivo passa a ser item 15** (antes era 14).
6. **Notificante**: rótulos "16. Nome do Servidor Responsável" e "17. RE / MATRÍCULA" passam a "NOME DO NOTIFICANTE" e "RE / MATRÍCULA" na mesma célula.
7. **Assinaturas**: "19. Assinatura do Responsável" → "ASSINATURA DO NOTIFICANTE"; "20. Assinatura do Munícipe" → "ASSINATURA DO NOTIFICADO", mantendo a linha "Recebi o presente em ___/___/___".
8. **Bases legais no corpo**: no modelo, as bases legais aparecem como opções com ( X ) no texto "FICA NOTIFICADO POR ESTE INSTRUMENTO, a providenciar ... em conformidade com o:" seguido das leis marcadas — o sistema já injeta `listaTextosLegaisImpresso`; o texto do prazo passa a usar a redação "FICA NOTIFICADO POR ESTE INSTRUMENTO, a providenciar a regularização...".

## Campos preservados (nenhum dado alterado)

`numNotif`, `dataNotif`, `tipoPresencial`, `tipoAR`, `nome`, `doc`, `identidade`, `endereco`, `telefone`, `bairro`, `cidade`, `uf`, `cep`, `cadDistrito`, `cadZona`, `cadQuadra`, `cadLote`, `cadImob`, `loteEndereco`, `motivoNotificacao`, `ref`, `obs`, `arrayInfracoes`, `fiscal`, `matricula`, `parametrosDocumento`, `dataRecebimento`/`dataCienciaAuto`.

## VIPP

A função `exportarVipp` (js/app.js, ~linha 1845) e o CSV gerado permanecem **intocados**.
