# Integración final de imágenes Free Fire — 19 de noviembre de 2026

## Referencia
- Repositorio: `TiendaElCastillo/tiendaelcastillo.github.io`
- Rama: `main`
- Web pública: https://tiendaelcastillo.github.io/
- Commit desplegado: `33b840534ab941b40884967a2210558bc12eaf8a`

## Imágenes recibidas y adaptadas
Se utilizaron los tres archivos enviados por el propietario (sin sustituirlos por arte generado ni por recursos externos):
- `1000372162.jpg`: póster del Token Evo Universal. Se recortó alrededor del emblema turquesa, quitando título y elementos de la captura del teléfono; guardado como `assets/ff-evo-token.webp`.
- `1000372165.jpg`: imagen de la caja/cofre Evo. Se adaptó a icono cuadrado usando la imagen original completa del cofre en primer plano y un fondo suave derivado de esa misma imagen; guardado como `assets/ff-evo-crate.webp`.
- `1000372166.jpg`: insignia amarilla/morada del Pase Booyah. Se recortó conservando su borde naranja y el diseño completo; guardado como `assets/ff-booyah-latam.webp`.

Los tres archivos se optimizaron a WebP ligero para la conexión móvil; tamaño total aproximado: 21 KB.

## Asignación en Free Fire
- Las 4 ofertas de **Cajas de fragmentos Evo** usan `ff-evo-crate.webp`.
- Las 4 ofertas de **Fragmentos de arma Evo** usan `ff-evo-token.webp`.
- **Pase Booyah LATAM Norte** y **Pase Booyah LATAM Sur** usan `ff-booyah-latam.webp`.
- **Pase Booyah Premium** conserva su imagen anterior. No se modificó porque la imagen enviada corresponde a la insignia regional y no se debe confundir con la portada Premium.

Las imágenes se aplican tanto a los iconos compactos de las tarjetas de compra como al arte de producto donde corresponda.

## Interfaz y caché
- Se mantiene el catálogo Free Fire dividido en cinco pestañas: Diamantes, Fragmentos Evo, Mejoras de nivel, Pases y tarjetas, y Pase Booyah.
- Los estilos nuevos dejan que los iconos se ajusten al tamaño de las tarjetas sin deformarse; en las imágenes de producto se conserva una proporción cuadrada y una etiqueta breve.
- Hoja de estilos: `assets/storefront-polish.css?v=20`.
- Caché offline: `shell-v167`.
- El service worker pre-carga los tres WebP locales.

## Verificaciones
- El HTML y el service worker apuntan a CSS v20; el service worker utiliza `shell-v167`.
- Los dos bloques JavaScript inline compilan sin errores de sintaxis.
- CSS con llaves equilibradas.
- Los tres recursos existen en GitHub y están incluidos en la lista de pre-caché.
- El último workflow de GitHub Pages para el commit publicado terminó con `success`: https://github.com/TiendaElCastillo/tiendaelcastillo.github.io/actions/runs/44603223019

## Límites respetados
No se modificaron precios, cantidades, nombres de paquete, catálogo, tasas, métodos de pago, validación de ID, checkout, autorización del administrador ni lógica de pedidos. No se cambió la imagen de Booyah Premium.

## Commits de esta integración
- Añadir los tres archivos de imagen: `07b0f4efd5d859986342f613171eeada0393652b`
- Integrar los iconos en las ofertas: `ef96aa00e143052acad55a2a03728a35debb7e4b`
- Estilos de los iconos: `028f5d030a231286530b765ee5b9bf418587649a`
- Actualizar caché y recursos offline: `33b840534ab941b40884967a2210558bc12eaf8a`
