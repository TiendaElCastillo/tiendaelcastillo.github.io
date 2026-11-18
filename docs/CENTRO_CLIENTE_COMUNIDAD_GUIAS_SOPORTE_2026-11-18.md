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
