
## Atualização após consulta ao console

O Firebase Console confirmou que `deleteDocuments` está implantada no projeto `smmam-fiscalizacao-tb`, região `southamerica-east1`, como função HTTP v2. Portanto, o erro do usuário não é simplesmente função ausente ou falta de deploy. A lista do console mostra também `processIptuImport` não presente entre as 10 funções exibidas, enquanto `deleteDocuments` aparece normalmente.

A mensagem `functions/internal — internal` é compatível com uma exceção não convertida em HttpsError durante a execução. A correção local agora envolve capturar a limpeza do Storage de forma isolada e não permitir que ela interrompa a remoção do Firestore. O próximo deploy das Functions precisa publicar esta correção; sem consultar os registros de execução, não é possível afirmar qual linha falhou na versão atualmente implantada.


## Confirmação adicional no console

A lista de Functions no Firebase Console confirmou `deleteDocuments` implantada em `southamerica-east1`, como HTTP v2. O console também mostrou 0 solicitações nas últimas 24 horas no momento da consulta. A tentativa de abrir a visualização de registros do Google Cloud redirecionou para login separado, então a exceção de execução não pôde ser lida por esse caminho. Nenhuma ação destrutiva ou alteração foi feita no console.
