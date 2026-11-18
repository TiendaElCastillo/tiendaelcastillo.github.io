# Centro de cliente — comunidad, guías y soporte

**Fecha:** 18 de noviembre de 2026  
**Repositorio:** \`TiendaElCastillo/tiendaelcastillo.github.io\`  
**Rama:** \`main\`  
**Versión de estilos:** \`storefront-polish.css?v=15\`  
**Caché:** \`shell-v160\`

## Cambios integrados

- Inicio: bloque de comunidad con acceso al futuro canal oficial de WhatsApp.
- Perfil: sección de Comunidad y un grupo de Ayuda y orientación con acceso a guías, soporte, preguntas frecuentes e información legal.
- Guías: una guía para cada juego publicado: Free Fire, Blood Strike, Mobile Legends: Bang Bang, Arena Breakout y PUBG Mobile.
- Las guías reflejan los datos actuales de validación: Free Fire LATAM; Blood Strike GLOBAL; Mobile Legends GLOBAL con ID y Zone ID; Arena Breakout GLOBAL; PUBG Mobile GLOBAL.
- Todas las guías mantienen la secuencia de compra existente y recuerdan comenzar por la moneda principal y continuar con pases/ofertas especiales.
- Soporte: selector de incidencias, campo obligatorio de folio/referencia y contacto de WhatsApp solo cuando se elige un caso que requiere revisión y se facilita una referencia.
- Los pedidos pendientes, en revisión o en proceso se dirigen al seguimiento de Órdenes y Mensajes, no a una conversación de soporte.
- Información legal: centro de acceso a Términos y condiciones, Privacidad y datos personales, y la sección existente de Pagos, cancelaciones y reembolsos.
- Privacidad: añadido un apartado descriptivo de almacenamiento técnico del navegador, mecanismos de sesión/verificación y voluntariedad del canal comunitario.
- Pie de página: retirado el acceso directo de WhatsApp para soporte y reemplazado por el Centro de soporte.
- Caché: añadidos el script del centro de cliente y la imagen local de PUBG Mobile.

## Seguridad de los cambios

No se modificaron:
- Precios ni denominaciones de productos.
- Catálogo, paquetes ni orden de los productos.
- Métodos de pago ni sus validaciones.
- Funciones de creación de pedidos, autorización del proveedor o reembolso.
- Tablas, políticas RLS, funciones de Supabase o datos de clientes.

El soporte abre WhatsApp con un texto preparado que incluye el motivo y la referencia indicada por el cliente. No se habilita el enlace mientras falte el motivo o la referencia.

## Pendientes antes de activar todas las opciones

1. **Canal comunitario:** falta que el propietario proporcione la URL oficial de invitación. La constante \`CASTLE_WHATSAPP_CHANNEL_URL\` sigue vacía y los dos botones aparecen desactivados hasta configurar una URL HTTPS válida de WhatsApp.
2. **Información del responsable:** antes de una apertura general, el titular debe confirmar qué identidad comercial/legal publicar y el contacto que recibirá solicitudes de privacidad. No se inventó ningún nombre ni domicilio.
3. **Revisión jurídica:** los textos describen el procedimiento operativo de la tienda, pero no sustituyen una revisión jurídica adaptada a la actividad y jurisdicción del titular.
4. **Verificación visual publicada:** el código y las referencias se comprobaron en GitHub, pero no fue posible abrir la página pública en un navegador desde este entorno después de la actualización. Falta confirmar el resultado en un Android real y en escritorio/tablet.

## Verificaciones de código

- Las vistas \`guidesView\`, \`supportView\`, \`legalView\`, \`faqView\`, \`privacyView\`, \`termsView\` y \`profileView\` existen una sola vez.
- El enrutador incluye las tres nuevas vistas.
- El script \`customer-center.js?v=1\` se referencia desde el HTML y el service worker.
- HTML y service worker referencian \`storefront-polish.css?v=15\`.
- El service worker usa \`shell-v160\`.
- El checkout conserva sus cuatro métodos, el consentimiento de privacidad, la validación de ID y las funciones de pedido.
- El código público nuevo no contiene claves de servicio ni credenciales privadas.
- Las referencias al soporte directo ya no aparecen en el FAQ ni en el pie de página; el único acceso de contacto se habilita desde el filtro del Centro de soporte.

## Próximo paso

Configurar el enlace oficial del canal cuando el propietario lo comparta; después, probar visualmente el perfil, Inicio, cada guía y el flujo de soporte en el móvil y en escritorio.

## Datos comunitarios confirmados por el propietario

- Nombre comercial público: **Tienda El Castillo**. No se indicó un nombre comercial alternativo.
- Número de soporte confirmado: **+53 51884050**.
- Enlace del canal comunitario facilitado por el propietario: https://whatsapp.com/channel/0029Vb8tq5vGufJ4yLhEcS0X
- El canal se distingue del soporte personal. Los anuncios se publican en el canal; las incidencias se filtran desde el Centro de soporte.
- HTML carga `customer-center.js?v=2`; el Service Worker precarga la misma versión y utiliza `shell-v161` para forzar la actualización en móviles.

## Corrección posterior del Centro de soporte

- La selección de un pedido pendiente o depósito de Wallet pendiente ya no muestra campos de folio ni detalles que no hacen falta.
- Esos casos muestran un único acceso contextual al seguimiento de Órdenes o al historial de depósitos; no abren WhatsApp.
- El aviso superior genérico se oculta cuando el cliente selecciona una incidencia real o uno de esos estados, evitando mensajes que no corresponden al caso.
- Para incidencias que sí requieren intervención, el folio/referencia se muestra y se exige antes de habilitar el enlace de WhatsApp prellenado.
- El canal comunitario usa el símbolo reconocible de WhatsApp en verde, acompañado del nombre de Tienda El Castillo; la marca general permanece azul y blanca.
- Versiones finales de esta corrección: CSS v16, customer-center.js v4 y caché shell-v163.

## Ampliación útil del Centro de ayuda

- Se añadió una vista central «Centro de ayuda» accesible desde el acceso rápido del perfil.
- Reúne guías, FAQ, soporte e información legal; incluye un glosario de estados de pedido (Pendiente, Verificando pago, Pago confirmado, Recarga en curso, Entregado, Rechazado/Fallido/Cancelado) y explica el siguiente paso sin pedir que el cliente escriba por una espera normal.
- Añade una guía de los datos que requiere cada método: Transferencia CUP, Saldo móvil, USDT y Wallet, con recordatorios de seguridad.
- Las cinco guías ahora explican dónde localizar el ID en cada juego y describen las categorías que aparecen actualmente en el catálogo publicado.
- Mobile Legends explica por separado el User ID y el Zone ID.
- Se añaden enlaces de referencia a la ayuda de Garena para Free Fire, Codashop para Mobile Legends y la ayuda oficial de PUBG Mobile.
- La vista de ayuda enlaza al canal comunitario ya configurado.
- Versiones publicadas: estilos v17, script customer-center v5 y caché del Service Worker shell-v164.
- No se modificaron los paquetes ni precios del catálogo, pagos, pedidos, ni lógica de autorización.
