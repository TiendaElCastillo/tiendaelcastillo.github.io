# Reparación Evo y auditoría del recorrido del cliente — 19 de noviembre de 2026

## Proyecto y referencia
- Repositorio: `TiendaElCastillo/tiendaelcastillo.github.io`
- Rama: `main`
- Web: https://tiendaelcastillo.github.io/
- Supabase: proyecto `kfllglkfncebpknnugnx`

## 1. Error de la pestaña Fragmentos Evo
### Causa
Las expresiones regulares de `evoBoxes` y `evoWeapons` estaban doblemente escapadas. Buscaban los caracteres literales `\s` en lugar de espacios, por lo que la categoría recibía las 8 ofertas y las contaba, pero los subgrupos devolvían 0 tarjetas.

### Corrección
- Cajas: `/cajas?\s+de\s+fragmentos/`
- Fragmentos de arma: `/fragmentos\s+de\s+arma/`

### Validación
La prueba sobre los ocho nombres reales devuelve:
- 4 ofertas de cajas: 1, 5, 10 y 50
- 4 ofertas de fragmentos de arma: 10, 50, 100 y 500

La consulta SQL confirma que las ocho ofertas siguen activas, visibles, con proveedor activo y stock disponible. Los precios y cantidades permanecen idénticos.

## 2. Marca de agua de Wallet
- Se creó `assets/el-castillo-watermark.svg` utilizando la geometría de la corona y el castillo del emblema de marca existente, sin fondo, para que funcione como marca de agua transparente.
- El panel azul de Wallet usa el emblema a baja opacidad, detrás del contenido. El saldo y el icono de la cartera permanecen por encima.
- En móvil se reduce el tamaño y la opacidad para evitar que cubra información.
- El saldo inicial ahora muestra «Cargando saldo…» hasta recibir el balance real, evitando aparentar que el saldo es cero durante la consulta.
- El nuevo SVG se incluye en el precaché offline del service worker.

## 3. Auditoría del recorrido del cliente
### Cuenta y acceso
- Alta e inicio de sesión con correo y contraseña; la interfaz exige verificación Cloudflare.
- El perfil se crea como cliente cuando aún no existe; el rol de administrador procede del perfil protegido.
- La puerta de acceso impide abrir la tienda completa sin una sesión.

### Catálogo y métodos de pago
- Se comprobó que la vista de catálogo usa productos activos/publicados y métodos disponibles.
- Métodos y ofertas se solicitan en paralelo; notificaciones, estadísticas, wallet, pedidos y tareas administrativas no retienen la carga inicial.
- Las imágenes de portada se cargan de forma diferida.
- Se añadió actualización de la pantalla del juego cuando termina de cargarse la configuración de Wallet, para que la opción USDT no quede falsamente deshabilitada si el usuario abre un juego antes de recibir la configuración de red/dirección.

### Privacidad antes de iniciar sesión
Se detectó que la interfaz ocultaba el catálogo a invitados, pero las políticas RLS permitían consultar por API los productos publicados (precios) y los métodos de pago (instrucciones). Se eliminó el acceso `anon` a:
- `public.products`
- `public.payment_methods`

Se mantienen públicas únicamente las noticias/avisos publicados de la tienda; los usuarios autenticados conservan las políticas de lectura correspondientes. La API ya no entrega precios ni instrucciones de pago a visitantes anónimos.

### Verificación de cuenta y pedidos
Revisión de código y base de datos:
- El formulario comprueba ID y Zone ID cuando corresponda.
- La función de validación confirma el jugador con el proveedor; la validación se vincula al usuario, producto, región y hash del ID, tiene caducidad y es de un solo uso.
- Triggers del servidor reconstruyen precio, nombre de paquete, juego y otros campos a partir del producto de la base de datos. No se confía en precios enviados por el navegador.
- Se comprueba que el producto siga activo/publicado y que el método directo esté activo.
- La base de datos limita a 4 operaciones directas por cuenta en estados pendientes/revisión.
- Se bloquean duplicados de referencias de Transferencia CUP y TxID USDT entre pedidos y depósitos.
- El comprobante solo puede asociarse al pedido del usuario, mientras siga pendiente; la ruta/archivo se valida en el servidor.
- Si falla la subida del comprobante, el usuario recibe instrucciones para adjuntarlo al mismo pedido, sin duplicarlo.
- Un pedido incompleto solo puede cancelarse mediante la función que comprueba que no tenga pago, comprobante ni actividad de proveedor.
- La autorización de recarga continúa en la zona administrativa; la autorización repetida se protege mediante idempotencia y reserva de saldo.

### Comprobantes y almacenamiento
- El bucket `payment-proofs` es privado, con límite de 5 MB e imágenes JPEG, PNG o WEBP.
- Las políticas permiten subir solo a la carpeta propia y vinculada a pedidos/depósitos pendientes o en revisión; la lectura queda restringida al propietario y administrador.
- La compresión de comprobantes de pedidos se reutiliza también para depósitos Wallet, reduciendo tamaño antes de subir desde móvil.
- Se corrigió el flujo del depósito incompleto: si una solicitud queda creada pero sin comprobante, la pantalla no crea otra; pide completar la solicitud pendiente desde el historial.
- El botón de envío de depósito ahora tiene texto consistente con la revisión manual.
- Una vez que el servidor confirma una compra con wallet o un pedido directo con comprobante, los fallos posteriores al refrescar el saldo/historial se manejan aparte. La pantalla conserva el número de pedido y avisa que no se repita la compra; así no se presenta como fallido un cargo ya confirmado.

## 4. Alcance de los depósitos de Wallet
La configuración de la wallet verificada en Supabase conserva la tasa de 1160 CUP/USD y una dirección BNB Smart Chain (BEP20) configurada para pagos USDT directos de juegos.

Importante: la regla actual de la base de datos permite añadir saldo a Wallet únicamente mediante **Transferencia CUP**. Lo establecen tanto la política de inserción de `wallet_deposits` como el trigger `validate_wallet_deposit_request()`. No se amplió a depósitos USDT porque requeriría una decisión y un cambio coordinado de las reglas de acceso, validación y revisión administrativa. El checkout de juegos con USDT sigue siendo una opción separada.

## 5. Validaciones ejecutadas
- Dos bloques JavaScript inline de `index.html`: sintaxis correcta.
- Scripts externos `customer-center.js`, `admin-panel.js` y `offline-guard.js`: sintaxis correcta.
- CSS: llaves equilibradas.
- Los 8 nombres de ofertas coinciden con los filtros corregidos: 4 cajas y 4 fragmentos de arma.
- HTML y service worker apuntan a `storefront-polish.css?v=21`.
- Service worker: `shell-v169`; emblema de Wallet en precaché.
- La consulta RLS de Supabase ya no muestra políticas `anon` de lectura en `products` ni `payment_methods`.
- GitHub Pages publicó el último commit de código con éxito: https://github.com/TiendaElCastillo/tiendaelcastillo.github.io/actions/runs/44612971282

No se realizó una compra real ni una transferencia de prueba. Tampoco se pudo ejecutar una comprobación visual interactiva en el mismo navegador Redmi del propietario; esa última comprobación debe hacerla el propietario en su dispositivo.

## 6. Avisos de Supabase pendientes
El asesor de seguridad sigue marcando desactivada la protección de contraseñas filtradas. No hay una acción de configuración Auth disponible en la conexión de herramientas actual; debe activarse en la configuración de Auth del proyecto siguiendo la guía oficial: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

El asesor de rendimiento lista 19 índices no utilizados. No se borraron: algunos pueden servir para consultas poco frecuentes, historial, conciliación o futuras operaciones administrativas. Se deben revisar con estadísticas de uso y planes de consulta antes de eliminarlos.

## 7. Restricciones respetadas
No se modificaron nombres/cantidades de paquetes, precios, márgenes, métodos de pago de checkout, tarifas CUP/USD, reglas de autorización, proveedor, ni el flujo de pedido ya pagado.