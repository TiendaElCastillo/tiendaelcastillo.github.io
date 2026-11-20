# Entorno de desarrollo — Tienda El Castillo

## Repositorio oficial

- Repositorio: `TiendaElCastillo/tiendaelcastillo.github.io`
- Sitio público: https://tiendaelcastillo.github.io/
- Rama de producción: `main`
- Rama de desarrollo: `develop`
- Publicación: GitHub Pages desde `main` y la carpeta raíz `/`

## Separación de trabajo

- `main` representa producción. No se debe experimentar ni hacer cambios directos en esta rama.
- `develop` es la rama de integración y pruebas de código. Los cambios futuros se preparan aquí o en ramas de tarea creadas desde ella.
- Una modificación solo se promociona a `main` mediante un Pull Request, después de revisar los cambios y comprobarlos.
- No cambiar la configuración de GitHub Pages para publicar desde `develop`: eso sustituiría la web pública por el contenido de pruebas.
- La protección de `main` está activa mediante el ruleset de GitHub **Protección de producción**, dirigido únicamente a `refs/heads/main`. Exige Pull Request, impide eliminar la rama y bloquea force pushes. La lista de bypass está vacía y requiere 0 aprobaciones; por tanto, el Pull Request es obligatorio, pero no exige una segunda persona que lo apruebe.

## Seguridad de datos y operaciones

- La web pública está conectada al Supabase de producción.
- No crear pedidos, depósitos, pagos ni recargas de prueba usando dinero real.
- No modificar datos, tablas, políticas RLS, secretos ni funciones de producción para experimentar.
- No incluir claves privadas, tokens o credenciales en archivos del repositorio.
- Antes de probar funciones que escriben datos o despachan recargas, disponer de un entorno Supabase de pruebas separado. Mientras no exista, limitar las comprobaciones a revisión estática y pruebas de interfaz sin transacciones reales.
- No declarar una recarga completada sin confirmación real del proveedor.
- Las claves privadas del proveedor deben permanecer en secretos del servidor, nunca en el navegador ni en el repositorio público.

## Estado de esta separación

- La rama `develop` se creó desde el mismo commit que `main`; después se añadió este documento de trabajo en `develop`.
- `main` ya está protegida por el ruleset activo.
- `develop` separa el código, pero todavía no tiene una URL pública de previsualización independiente.
- Todavía no hay un proyecto Supabase de pruebas (staging) separado de producción.
- La configuración de GitHub Pages debe mantenerse en `main` / `/(root)`.
- El repositorio es público: nunca deben guardarse secretos, tokens, claves privadas ni datos personales de clientes en sus archivos o historial.
