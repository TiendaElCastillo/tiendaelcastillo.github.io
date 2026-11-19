# Corrección de Booyah Norte y carga inicial de catálogo — 19 de noviembre de 2026

## Referencia de trabajo
- Repositorio: `TiendaElCastillo/tiendaelcastillo.github.io`
- Rama: `main`
- Web pública: https://tiendaelcastillo.github.io/
- Despliegue de Pages: https://github.com/TiendaElCastillo/tiendaelcastillo.github.io/actions/runs/44606638103

## 1. Pase Booyah LATAM Norte
Causa: `nexLevelOfferAsset()` resolvía primero la imagen antigua `pase-2.avif` para los nombres Norte/Sur. Como `freeFirePlanIcon()` y `productArtwork()` devolvían inmediatamente el arte de esa función, nunca llegaban a la imagen enviada por el propietario.

Corrección:
- La función genérica ya no asigna el arte antiguo a Booyah Norte/Sur.
- El icono compacto aplica directamente `assets/ff-booyah-latam.webp` antes de consultar el arte genérico.
- El arte de producto hace la misma comprobación antes del resolver Nex.
- Booyah Premium conserva su recurso anterior; no se mezclan los dos diseños.
- Se verificó que el producto Norte sigue activo y visible, con proveedor activo y stock disponible. No se modificó su precio: Transferencia CUP 1330, Saldo móvil 399 y USDT 1.15.

## 2. Carga inicial de los juegos
Causa: al entrar, la aplicación esperaba de forma secuencial las notificaciones, estadísticas, métodos de pago y finalmente los productos. Después esperaba wallet, depósitos y pedidos antes de terminar la secuencia de inicio.

Corrección:
- Se muestran de inmediato cinco tarjetas de carga —solo los juegos que ya tienen catálogo publicado: Free Fire, Blood Strike, Mobile Legends, Arena Breakout y PUBG Mobile—. Durante la consulta no se pueden pulsar, para evitar entrar a un catálogo aún vacío.
- Las imágenes de portada se cargan de forma diferida, dejando que aparezcan primero los nombres y el estado de cada juego.
- Métodos de pago y productos se consultan en paralelo.
- Notificaciones, estadísticas, wallet, pedidos y tareas administrativas se ejecutan en segundo plano y ya no retienen la carga principal del catálogo.
- Si la consulta falla, se retiran los estados de carga y se muestra el mensaje de error, en lugar de dejar botones bloqueados como si siguieran cargando.

## 3. Verificación
- Los dos scripts JavaScript inline compilan sin errores.
- CSS con llaves equilibradas.
- HTML y service worker cargan `storefront-polish.css?v=21`.
- Caché de service worker: `shell-v168`.
- Se mantienen el control de sesión obligatorio y la consulta de productos activos/publicados.
- No se cambian paquetes, cantidades, precios, métodos de pago, validación de ID, checkout ni autorización de pedidos.
- SQL confirmó que Booyah Norte está activo, visible, disponible con el proveedor y mantiene los importes existentes.

## 4. Commits
- Corrección de prioridad de imagen y paralelización de `openStore`: `3acf42ca644aa0b54c781793d33e094f4580da4d`
- Ajustes de estados de carga y tamaño del icono: `2c7e9ffa805a96215c5c333324fa7157fe20d23b`
- Service worker `shell-v168` / CSS v21: `bf70b1e9641b3f932bc9e07f751127c130b4d458`
- Gestión de error de catálogo: `b0bffc3053df12514568ed5bd4f1fc98a2d8fa6d`

## 5. Comprobación visual pendiente
El build y despliegue de GitHub Pages terminó correctamente. La página no pudo inspeccionarse aquí en un navegador autenticado igual al Redmi del propietario; por tanto, la confirmación visual final debe hacerse tras cerrar/reabrir la pestaña para que se descargue la versión nueva.