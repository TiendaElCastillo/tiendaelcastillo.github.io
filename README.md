# Tienda El Castillo — sitio oficial

**URL pública y canónica:** https://tiendaelcastillo.github.io/

**Repositorio oficial:** `TiendaElCastillo/tiendaelcastillo.github.io`  
**Rama de publicación:** `main`  
**Carpeta de publicación:** raíz del repositorio (`/`)

## Fuente única del proyecto

Este repositorio es la fuente oficial del sitio público y del trabajo futuro de Tienda El Castillo. La web debe abrir desde el dominio raíz indicado arriba; no se debe depender de una ruta adicional después de `.github.io`.

## Reglas de publicación

- Mantener `index.html` en la raíz del repositorio.
- Mantener las rutas internas relativas (`./assets/…`, `./sw.js`, `./manifest.webmanifest`) para que funcionen desde el dominio raíz.
- Mantener el canonical, los enlaces alternativos, Open Graph, el sitemap y el manifest apuntando al dominio corto.
- Publicar desde `main` y la carpeta `/` en la configuración de GitHub Pages.
- Revisar cada cambio antes de publicarlo y comprobar que no rompa el inicio de sesión, el catálogo, los pedidos o el panel administrativo.

## Seguridad de producción

Este sitio está conectado al Supabase de producción y puede recibir pedidos reales.

- No crear pedidos, depósitos, pagos ni recargas de prueba con dinero real.
- No exponer claves privadas, secretos ni credenciales administrativas en archivos públicos.
- No modificar tablas, políticas, funciones o datos de producción como parte de una prueba.
- Hacer cambios pequeños, verificables y con un commit identificable.
- Después de cada publicación, comprobar la web y sus rutas principales sin realizar transacciones reales.
