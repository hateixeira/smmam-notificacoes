# Serviço protegido de sincronização de AR

Este Worker é publicado separadamente no plano gratuito de Workers e nunca é servido pelo Firebase Hosting. Ele recebe uma lista limitada de notificações já acessíveis ao usuário autenticado, valida os documentos no Firestore com o próprio token Firebase do usuário, consulta a API de rastreamento com uma chave guardada como segredo e devolve somente os eventos de rastreamento.

A coordenação por objeto durável reserva uma janela por setor e evita que logins simultâneos executem a mesma rodada. A exportação CSV do VIPP é independente e não é lida, modificada ou enviada por este serviço.
