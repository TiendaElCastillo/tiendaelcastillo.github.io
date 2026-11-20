# Entorno de desarrollo — Tienda El Castillo

## Repositorio oficial

- Repositorio: `TiendaElCastillo/tiendaelcastillo.github.io`
- Sitio público: https://tiendaelcastillo.github.io/
- Rama de producción: `main`
- Publicación documentada: carpeta raíz `/`

## Separación de trabajo

- `main` representa producción. No se debe experimentar ni hacer cambios directos en esta rama.
- `develop` es la rama de integración y pruebas de código. Los cambios futuros se preparan aquí o en ramas de tarea creadas desde ella.
- Una modificación solo se promociona a `main` mediante un Pull Request revisado y después de comprobarla.
- No cambiar la configuración de GitHub Pages para publicar desde `develop`: eso sustituiría la web pública por el contenido de pruebas.

## Seguridad de datos y operaciones

- La web pública está conectada al proyecto Supabase de producción.
- No crear pedidos, depósitos, pagos ni recargas de prueba usando dinero real.
- No modificar datos, tablas, políticas RLS, secretos ni funciones de producción para experimentar.
- No incluir claves privadas, tokens o credenciales en archivos del repositorio.
- Antes de probar funciones que escriben datos o despachan recargas, disponer de un entorno Supabase de pruebas separado. Mientras no exista, limitar las comprobaciones a revisión estática y pruebas de interfaz sin transacciones reales.
- No declarar una recarga completada sin confirmación real del proveedor.

## Estado de esta separación

- La rama `develop` se creó desde el mismo commit que `main`, sin modificar el contenido de producción.
- La rama `main` todavía necesita una regla de protección en GitHub.
- Esta rama es un espacio separado para el código, pero todavía no tiene una URL pública de previsualización independiente.
- La configuración real de GitHub Pages debe revisarse en Settings → Pages y mantenerse en `main` / `/(root)`.
