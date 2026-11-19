# Pulido visual de la tienda — 19 de noviembre de 2026

## Referencia de trabajo
- Repositorio: `TiendaElCastillo/tiendaelcastillo.github.io`
- Rama: `main`
- Web: https://tiendaelcastillo.github.io/

## Cambios aplicados
- Añadido un último bloque de acabado visual en `assets/storefront-polish.css`: áreas táctiles de botones, respuesta visual al pulsar, campos más cómodos, lectura tabular de precios y pequeños ajustes en pantallas estrechas.
- Activado desde el propio HTML el enlace confirmado del canal oficial de WhatsApp, tanto en la portada como en el perfil. Así funciona incluso antes de que termine de cargar el JavaScript.
- Reemplazado el texto provisional del canal por un mensaje que indica que el canal ya está disponible.
- Actualizada la referencia de la hoja de estilos a `v18` y la caché del service worker a `shell-v165`.

## Límites respetados
No se modificaron paquetes, precios, monedas, métodos de pago, productos del catálogo, imágenes, validaciones de cuenta, pedidos ni autorizaciones del proveedor. No se añadieron imágenes ni bibliotecas externas.

## Verificaciones realizadas
- Los archivos modificados se volvieron a leer desde GitHub después de los commits.
- La hoja de estilos conserva llaves equilibradas.
- El HTML y el service worker apuntan a `storefront-polish.css?v=18`.
- La caché del service worker quedó en `shell-v165`.
- Los dos enlaces estáticos de WhatsApp apuntan al mismo canal confirmado y no quedan textos provisionales en el HTML.
- El script del centro de cliente conserva exactamente el mismo enlace del canal.

## Revisión visual pendiente
No se dispone aquí de una captura de navegador en el Redmi para comprobar el renderizado real. Antes de abrir al público, revisar en el teléfono portada, catálogo, ficha de juego, checkout, perfil y navegación inferior, con caché actualizada. Esta pasada de CSS no sustituye las pruebas de compra y entrega.

## Commits
- CSS: `6860e7ec9c649b12fa0242164c3016ee04002d7b`
- HTML: `56b37730aaacd31ee648d83585fa637486fb76ac`
- Service worker: `ffd7f39530dc90e8e0328111823789b9b3f25727`
