# Continuidade, backup e restauração

## Escopo atual

O sistema oferece backup **setorial controlado** para administradores. O arquivo inclui metadados de geração, setor, data, responsável, quantidade de registros e instrução de restauração. O backup é uma cópia local de contingência e não substitui uma política institucional de cópias, retenção e recuperação.

## Procedimento operacional

1. O administrador acessa **Configurações do Setor** e seleciona **Baixar Backup Local JSON**.
2. O sistema gera um pacote restrito somente com os registros carregados para o setor do administrador.
3. O arquivo deve ser transferido imediatamente para um repositório institucional com controle de acesso.
4. A geração é registrada na auditoria do setor.
5. A restauração nunca deve ocorrer diretamente em produção: primeiro valide o arquivo em homologação, aprove o resultado com a área de TI e registre a operação.

## Política mínima proposta

| Controle | Frequência mínima | Responsável |
| --- | --- | --- |
| Backup setorial | Semanal e antes de alterações estruturais | Administrador do setor |
| Conferência de integridade | Mensal | Área de TI e administração setorial |
| Teste de restauração em homologação | Trimestral | Área de TI |
| Revisão de acessos e exportações | Trimestral | Chefia e encarregado de dados |
| Registro de incidente | Imediato | Usuário que identificar a ocorrência |

## Limites conhecidos

O Cloud Storage não está provisionado como repositório amplo de backup e a cópia do navegador não possui retenção central, criptografia gerenciada nem objetivo formal de recuperação. A instituição deve definir uma solução de armazenamento institucional, RPO/RTO, responsáveis e evidências de teste antes da operação em produção.
