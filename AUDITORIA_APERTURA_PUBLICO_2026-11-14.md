# Tienda El Castillo — auditoría de preparación para apertura pública

**Fecha:** 14 de noviembre de 2026  
**Repositorio oficial auditado:** `TiendaElCastillo/tiendaelcastillo.github.io`  
**Rama auditada:** `main`  
**Commit auditado:** `d605911da9c48249283264b1b15e1767f814ff56`  
**Web:** https://tiendaelcastillo.github.io/  
**Supabase:** `Tienda-El-Castillo` · `kfllglkfncebpknnugnx` · `us-east-2`  
**Rama de este informe:** `audit/opening-readiness-20261114`

## Veredicto

**NO RECOMENDADO ABRIR TODAVÍA PARA PEDIDOS PÚBLICOS.**

Hay una base funcional considerable: autenticación obligatoria, catálogo con tres juegos, pagos manuales, comprobantes privados, panel administrativo y cuatro Edge Functions activas. Sin embargo, se encontraron dos bloqueadores: la billetera sigue habilitada en la aplicación y existe una brecha de integridad en metadatos internos de pedidos que el cliente puede intentar suministrar.

No se modificó código funcional ni configuración de producción. No se realizaron compras, depósitos, pedidos ni recargas reales.

## 1. Estado verificado

### Repositorio y continuidad
- La fuente oficial actual es `TiendaElCastillo/tiendaelcastillo.github.io`, no el repositorio histórico `tienda-el-castillo`.
- `main` estaba en el commit indicado arriba.
- Existe `work/redesign-audit-20261106`, pero está **19 commits por delante y 346 por detrás** de `main`, con historial divergente. No se debe fusionar ni usar como base sin reconciliación.
- El informe anterior `AUDITORIA_SEGURIDAD_Y_DISENO_2026-11-06.md` y su propuesta de migración están en esa rama antigua, no en la versión actual de `main`.
- Las tres migraciones más recientes registradas en Supabase (12 de noviembre) no se encontraron en las rutas esperadas de `supabase/migrations/` en el repositorio actual. Hace falta sincronizar y versionar el historial SQL antes de depender de Git como fuente reproducible de producción.

### Autenticación
- `index.html` consulta `db.auth.getSession()` y abre la tienda únicamente cuando existe una sesión.
- `showView()` devuelve al formulario de acceso si no existe usuario autenticado.
- La tabla `products` no concede SELECT a `anon`; las columnas usadas por el catálogo sí están concedidas a `authenticated`.
- La lectura de métodos de pago tampoco está concedida a `anon`.
- RLS está habilitado en las tablas públicas revisadas.
- Esto respalda el requisito de registro/inicio de sesión antes de entrar. **No se hizo prueba funcional de navegador**, por lo que no se certifica el flujo real de registro, confirmación de correo, recuperación o cierre de sesión.

### Supabase y funciones
- Proyecto: `ACTIVE_HEALTHY`, PostgreSQL 17.
- Las cuatro Edge Functions están activas:
  - `central-one-read` v6, JWT requerido.
  - `central-one-sync` v8, JWT no requerido; debe usar el token privado de sincronización.
  - `central-one-player-validate` v7, JWT requerido.
  - `central-one-order` v20, JWT requerido.
- El bucket `payment-proofs` es privado, límite 5 MB y MIME permitidos JPEG, PNG y WebP.
- Las funciones SECURITY DEFINER revisadas fijan `search_path` vacío, una buena medida contra secuestro de objetos.
- Algunas funciones privadas de sincronización tienen EXECUTE concedido a anon/PUBLIC y dependen de validar un token. Revisar la exposición del esquema `private` y retirar permisos innecesarios cuando se confirme que no rompe la sincronización.
- El Security Advisor informa que la protección contra contraseñas filtradas está desactivada.
- El Performance Advisor muestra 18 índices no utilizados (informativos); no borrar índices automáticamente.
- El Health Advisor no devolvió hallazgos.

### Pagos y pedidos
- Están activos tres métodos: Transferencia CUP, Saldo móvil y USDT.
- Los tres tienen instrucciones configuradas; no se validó que los destinos y la recepción real estén correctos.
- El bucket de comprobantes y las políticas de almacenamiento limitan el acceso al propietario del pedido o al administrador.
- El flujo de Central One contiene comprobación de coste, saldo disponible y rentabilidad antes de enviar.
- No se probó el saldo actual del proveedor, el alcance balance:read ni la entrega real. No se creó ninguna orden.

## 2. Bloqueadores críticos

### B1 — Billetera del cliente sigue habilitada
La decisión del propietario es mantenerla desactivada. El estado actual contradice esa decisión:
- `profileView` todavía muestra la billetera y el asistente de depósitos.
- El checkout incluye `Saldo de Tienda El Castillo`.
- `isPaymentMethodReady()` considera ese método disponible.
- `private.create_wallet_order` sigue teniendo EXECUTE para `authenticated` y crea pedidos, registra transacciones y descuenta saldo.
- La función de validación de pedidos todavía contempla `payment_source='wallet'`.

**Trabajo requerido:** deshabilitar de forma coordinada la interfaz, el método de pago, las RPC/funciones y las rutas de depósito/compra con saldo. Conservar tablas e historial; no borrar datos. No aplicar cambios hasta preparar y probar migración reversible en una rama/entorno de desarrollo.

### B2 — Metadatos internos de pedidos aceptados desde el cliente
Los permisos de columna de `authenticated` incluyen INSERT en campos internos como:
- `central_one_order_id`, `central_one_status`, `central_one_request_id`, `central_one_response`, `central_one_idempotency_key`, fechas y errores del proveedor.
- `payment_confirmed_at`, `payment_confirmed_by`, `paid_at`.
- Otros campos de estado de proveedor y validación.

El disparador `private.validate_order_request()` recalcula el producto, el nombre, el precio, el estado inicial y el código, y limpia varios campos de pago. El disparador `private.enforce_provider_player_validation()` verifica el token de jugador. Pero el disparador de inserción no neutraliza todos los campos internos de Central One ni todos los datos de confirmación.

**Riesgo:** un cliente puede intentar falsificar metadatos de envío/estado y causar pedidos engañosos o bloquear la gestión/actualización de una orden. No se ejecutó ninguna prueba de explotación.

**Trabajo requerido:** mover la creación a una RPC segura o restringir las columnas INSERT; forzar todos los metadatos de proveedor y confirmación a valores iniciales en servidor; conservar únicamente el token real de validación para que el disparador lo consuma. Añadir pruebas negativas con un usuario cliente y pruebas positivas de administrador.

## 3. Catálogo y expansión de juegos/servicios

### Oferta actualmente lista en la base de datos
Hay 485 registros de productos. De ellos, 57 cumplen simultáneamente activo, publicado, proveedor activo y stock disponible:

| Juego | Productos listos |
|---|---:|
| Blood Strike | 39 |
| Free Fire | 10 |
| Mobile Legends: Bang Bang | 8 |
| **Total** | **57** |

Hay 333 productos activos de Mobile Legends que permanecen ocultos de la tienda; no publicarlos en bloque sin comprobar categoría, región, stock, precio y validación.

La interfaz filtra explícitamente el catálogo principal a Free Fire, Blood Strike y Mobile Legends. El código define referencias adicionales a Arena Breakout, Honor of Kings, Genshin Impact, Wuthering Waves y Roblox, pero no las muestra como categorías activas.

### Gift Cards
La interfaz contempla Xbox, PlayStation, Apple y Nintendo, pero la consulta de productos no encontró tarjetas publicadas. No existe aún un flujo completo de inventario/códigos y entrega que se haya probado.

### Plan recomendado de expansión
No añadir juegos solo con una tarjeta visual. Cada integración debe tener:
1. Producto y SKU confirmado por proveedor.
2. Región/servidor compatible con el cliente.
3. Campos de destino correctos (UID, zona/servidor, cuenta o correo, según producto).
4. Validación real del destino cuando el proveedor la soporte.
5. Sincronización de stock y precio, con bloqueo de producto agotado.
6. Cálculo de precio y comprobación del objetivo comercial de rentabilidad de al menos 35%, validando la fórmula usada por el sistema.
7. Flujo de pedido, entrega, estados, errores, reintentos e incidencias.
8. Imagen optimizada y fallback que cargue bien con conexiones lentas.

Orden sugerido para evaluar: Honor of Kings, Genshin Impact, Arena Breakout, Wuthering Waves y Roblox; después Xbox y Apple Gift Cards, y luego PlayStation/Nintendo. **No se confirma disponibilidad de estos productos en Central One.** Mantener el límite de capital del propietario: no recomendar depósitos o compromisos superiores a 10 USD ni pruebas con compras reales.

### Arquitectura que falta para escalar
La sincronización actual de Central One tiene lógica específica para Free Fire, Mobile Legends y Blood Strike. Conviene diseñar adaptadores por tipo de producto (recarga de juego, pase/suscripción, tarjeta/código digital) y esquemas de destino, en lugar de copiar lógica por cada juego. Las gift cards necesitan inventario de códigos, región/denominación, entrega segura y control de uso único; no deben forzarse dentro del flujo de UID de jugador.

## 4. Pruebas y preparación operativa pendientes

### Pruebas funcionales obligatorias
- Registro, confirmación de correo, login, recuperación y logout.
- Confirmar que sin sesión no se puede ver catálogo, productos, precios ni métodos de pago.
- Compra de prueba en entorno seguro, sin fondos reales.
- Validación de ID para Free Fire, MLBB y Blood Strike; IDs inválidos, región incorrecta, token vencido y token reutilizado.
- Checkout por cada método activo; comprobante correcto, archivo inválido, tamaño superior a 5 MB, referencia/TxID incorrecto y pérdida de conexión.
- Panel admin: aprobar/rechazar pago, revisar comprobante privado, autorizar recarga, reintentar sin duplicar, actualizar estado y resolver fallo/reembolso.
- Comprobar que un usuario nunca puede leer pedidos, comprobantes, notificaciones ni datos de otro usuario.
- Comprobar que no se cachean autenticación, base de datos, pagos, comprobantes ni llamadas al proveedor.
- No probar compras ni recargas reales a Central One sin autorización expresa.

### Operación y atención al cliente
- Publicar políticas claras de entrega, horarios, soporte, errores de ID, regiones, cancelación y reembolso.
- Definir un procedimiento para pago recibido pero proveedor sin saldo, recarga parcial, proveedor caído, pedido duplicado y comprobante ilegible.
- Revisar saldo de Central One antes de abrir y definir un umbral de alerta compatible con el capital disponible.
- Probar recuperación de cuenta y acceso administrativo; activar MFA para administración y revisar límites/captcha de Auth.
- Definir quién revisa pagos y pedidos, y cuánto tiempo puede permanecer un pedido sin atención.

## 5. Diseño, accesibilidad y rendimiento

- No se dispuso de navegador ni entorno visual de vista previa; no se declara prueba visual en teléfono o escritorio.
- El viewport de `index.html` incluye `maximum-scale=1` y `user-scalable=no`, lo que impide ampliar con gestos. Corregir para accesibilidad.
- El manifest declara un icono de 128x128 solamente; añadir iconos apropiados de 192x192 y 512x512 para instalación PWA.
- `theme-color` de HTML y manifest no coincide.
- El catálogo usa imágenes externas en algunos casos. Comprobar carga, fallback, peso y derechos de uso; preparar WebP optimizadas y caché solo de recursos visuales.
- Ejecutar revisión visual de anchos móviles pequeños, escritorio, registro, checkout, visor de comprobantes y seis apartados del panel administrativo.
- Revisar contraste, tamaño de botones, etiquetas accesibles, zoom, foco visible y mensajes de error.
- Medir carga con red lenta y evitar que imágenes grandes bloqueen la compra.

## 6. Service Worker y conexión lenta

El `sw.js` actual es `shell-v129`. El código usa navegación network-first y excluye peticiones externas de Supabase/servicios del proveedor del caché; las imágenes pueden guardarse después de cargarse. El borrador offline conserva producto/ID/método durante 12 horas, no conserva comprobantes ni datos de pago y no crea pedidos automáticamente.

**Pendiente de prueba real:** instalar/actualizar PWA en Android, verificar que los teléfonos adopten v129, abrir en modo offline, restaurar un borrador y confirmar que nunca se envíe una orden sin conexión.

## 7. Plan de salida por etapas

### Etapa 0 — Seguridad y consistencia (bloquea apertura)
1. Desactivar completamente la billetera sin borrar historial.
2. Corregir inserción de pedidos y campos internos de Central One.
3. Sincronizar migraciones de Supabase con Git y reconciliar el historial.
4. Activar protección contra contraseñas filtradas y revisar MFA/captcha de Auth.
5. Revisar permisos EXECUTE de funciones de sincronización y exposición del esquema privado.

### Etapa 1 — MVP público controlado
1. Mantener solo Free Fire, Blood Strike y Mobile Legends con sus 57 productos listos.
2. Confirmar precios, margen, métodos de pago y datos de recepción con el propietario.
3. Completar pruebas funcionales sin dinero real y pruebas visuales en Android.
4. Probar panel, comprobantes, fallos y procedimiento de soporte.
5. Abrir inicialmente con volumen controlado, monitorizando pedidos y stock.

### Etapa 2 — Ampliación
1. Integrar nuevos juegos uno por uno tras confirmar catálogo, regiones y validación.
2. Incorporar gift cards con flujo separado de códigos digitales.
3. Añadir más servicios/pases solo después de probar entrega, rentabilidad y reembolsos.
4. Mantener cada integración en commits pequeños y aislados, sin publicar automáticamente.

## 8. Cambios realizados en esta auditoría

- Se creó únicamente este informe en la rama `audit/opening-readiness-20261114`.
- No se modificó `main`.
- No se modificó código funcional.
- No se aplicaron migraciones ni cambios de RLS, permisos, Auth, precios, pedidos, billetera o datos.
- No se realizaron transacciones ni pedidos a Central One.
- No se dispuso de navegador; pruebas visuales y funcionales quedan pendientes.

**Aprobación requerida:** los cambios de billetera, integridad de pedidos, Auth, permisos y cualquier publicación necesitan revisión y autorización expresa del propietario.
