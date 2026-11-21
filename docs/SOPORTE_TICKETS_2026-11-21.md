# Centro de soporte con tickets y respuestas dentro de la tienda

**Fecha:** 21 de noviembre de 2026  
**Repositorio:** `TiendaElCastillo/tiendaelcastillo.github.io`  
**Rama:** `main`  
**Supabase:** `Tienda-El-Castillo` (`kfllglkfncebpknnugnx`)

## Qué cambia

- El Centro de soporte permite elegir una incidencia, escribir un asunto, añadir el folio o referencia si se dispone de él y describir lo ocurrido.
- Al enviar, el cliente recibe un folio con formato `EC-S-XXXXXXXXXX`.
- La sección «Mis solicitudes» lista sus tickets y permite abrir cada conversación, leer las respuestas y contestar.
- El panel de Administración incorpora la pestaña «Soporte», con una bandeja de solicitudes, datos del cliente, motivo, referencia, estado y conversación.
- El administrador puede responder y marcar una solicitud como resuelta.
- Los estados de los tickets son: Recibida, En revisión, Respuesta enviada, Resuelta y Cerrada.

## Dónde llegan los mensajes

Los mensajes **no se envían a WhatsApp ni al correo electrónico**. Se almacenan en el proyecto Supabase de Tienda El Castillo:

- `public.support_tickets`: folio, cliente, motivo, asunto, referencia y estado.
- `public.support_messages`: cada mensaje que envía el cliente o la administración.

El cliente los consulta en «Centro de soporte → Mis solicitudes». La administración los consulta en «Admin → Soporte». No se configuraron avisos por correo ni notificaciones push para tickets.

## Seguridad

- RLS está habilitado en ambas tablas.
- Un cliente solo puede leer tickets y mensajes de sus propias solicitudes.
- Solo una cuenta con perfil `admin` puede leer la bandeja global y responder como administración.
- El rol `anon` no tiene permisos para leer las tablas ni ejecutar los RPC de soporte.
- Los procedimientos de escritura usan `SECURITY INVOKER`, validan la sesión, limitan longitud y categorías y fijan `search_path` vacío.
- No se incluyeron claves de servicio ni secretos en el navegador.

## Despliegue y caché

- Migración aplicada en Supabase: `20261121135716_customer_support_inbox_and_private_ticket_messages`.
- `assets/customer-center.js?v=6`
- `assets/admin-panel.js?v=19`
- `assets/admin-panel.css?v=33`
- Service Worker: `shell-v172`

## Verificaciones realizadas

- Tablas creadas y RLS habilitado en ambas.
- Políticas de lectura/escritura verificadas.
- Confirmado que el rol `anon` no puede leer tickets ni ejecutar `create_support_ticket`.
- Confirmado que `authenticated` puede usar el flujo de tickets.
- Sintaxis de `customer-center.js`, `admin-panel.js` y `sw.js` validada.

## Prueba pendiente después de publicar

Completar una prueba real desde una cuenta cliente y otra sesión administradora: crear un ticket, comprobar que aparece en «Admin → Soporte», contestarlo desde Administración y verificar que el cliente puede leer la respuesta. Esa prueba interactiva depende de iniciar sesión en el navegador y no se simula con la consulta SQL.


## Ajuste de rendimiento posterior

- Migración adicional aplicada: `20261121141927_index_support_message_sender_id`.
- Añade el índice `support_messages_sender_id_idx` para la clave foránea del autor de cada mensaje.
- La revisión posterior dejó de señalar claves foráneas sin índice en las tablas nuevas de soporte.
