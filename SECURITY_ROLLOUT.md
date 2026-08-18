# Implantação segura — Fiscalização e Notificações

## Situação atual

O Hosting da aplicação está publicado em `https://smmam-fiscalizacao-tb.web.app`. As regras do Firestore foram preparadas em `firestore.rules`, mas não foram aplicadas automaticamente junto com a atualização visual.

Essa separação é intencional: regras de banco mudam permissões de usuários reais e precisam ser implantadas somente depois da confirmação de que os perfis de operação existentes possuem os campos `setor`, `status: "aprovado"` e `nivel` adequados — especialmente `admin` para responsáveis pela gestão.

## Melhorias de segurança já incorporadas ao código

| Melhoria | Resultado |
| --- | --- |
| Acesso visitante removido da interface | Credenciais fixas não são mais exibidas ou utilizadas. |
| Perfil ausente não recebe função administrativa | Contas autenticadas sem perfil aprovado entram em uma tela de orientação, sem acesso à aplicação. |
| Consultas operacionais filtradas por setor | Notificações, infrações, auditoria e rastreamento passam a solicitar apenas o recorte do setor autenticado. |
| Regras versionadas | O projeto passa a manter regras restritivas de Firestore no repositório para revisão e histórico. |
| Sincronização de IPTU resiliente | A atualização cadastral termina mesmo se o Storage não estiver configurado para guardar a cópia auxiliar. |

## Requisito antes de aplicar `firestore.rules`

No Console Firebase, confirme que cada usuário que deve operar o sistema possui um documento em `usuarios/{uid}` com, no mínimo:

```json
{
  "setor": "SMMAM",
  "status": "aprovado",
  "nivel": "admin"
}
```

Usuários operacionais devem usar `nivel: "leitor"` ou o nível previsto para edição. A regra atual permite criar e editar documentos de fiscalização somente para usuários aprovados que não sejam leitores; exclusões permanecem restritas a administradores do mesmo setor.

## Aplicação das regras

Após a conferência administrativa dos perfis, execute:

```bash
npx firebase-tools deploy --only firestore:rules --project smmam-fiscalizacao-tb
```

## Storage

O projeto Firebase não possui Storage provisionado. Por esse motivo, `storage.rules` foi preservado como referência, mas não é parte do deploy padrão. A aplicação continua sincronizando cadastros imobiliários; apenas a cópia auxiliar do arquivo no Storage fica indisponível até que o recurso seja oficialmente habilitado e suas regras sejam revisadas.
