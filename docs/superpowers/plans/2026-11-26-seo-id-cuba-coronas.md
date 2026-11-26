# Mejorar guías de recargas por ID en Cuba y Coronas automáticas

> **Meta:** dejar claro en las páginas públicas que Tienda El Castillo es una tienda cubana, que los productos se solicitan por ID y que las compras pagadas con Coronas ya acreditadas se procesan automáticamente.

**Enfoque:** actualizar el contenido visible, títulos y descripciones de las guías de los cinco juegos, la guía principal, la página de pagos, la página institucional, portada y llms.txt. Mantener el flujo real: cargar Coronas a la cartera requiere revisión y aprobación; comprar una recarga con Coronas disponibles se procesa automáticamente; otros métodos siguen la revisión de pago correspondiente.

**Límites:** no cambiar paquetes, precios, pagos, lógica de compra, pedidos, autenticación, catálogo ni Supabase. Mantener la información de regiones/IDs comprobada. No prometer entrega instantánea.

## Archivos
- Modificar las cinco guías de juegos, la guía central, la guía de pagos y la página institucional.
- Modificar metadatos y datos estructurados de `index.html`.
- Actualizar `llms.txt` y las fechas de `sitemap.xml`.
- Ampliar `tests/ai-visibility-id-cuba.test.cjs` para proteger las afirmaciones comerciales y el matiz entre comprar con Coronas y cargar Coronas.

## Verificación
- Ejecutar las pruebas antes/después mediante GitHub Actions.
- Comprobar títulos, descripciones, H1, contenido visible y FAQ estructurada.
- Ejecutar una nueva auditoría de rastreo y repetir las búsquedas en Google/Search Console tras el despliegue.
- Solicitar en Search Console el rastreo de las páginas cambiadas cuando esté disponible; no garantizar posiciones ni indexación inmediata.
