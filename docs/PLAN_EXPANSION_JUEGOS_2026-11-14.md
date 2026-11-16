# Plan de expansión de juegos — Tienda El Castillo

**Fecha de auditoría:** 14 de noviembre de 2026  
**Repositorio:** `TiendaElCastillo/tiendaelcastillo.github.io`  
**Rama:** `main`  
**Versión de referencia:** commit `2eba972892c0045d77b666f1a05e77ad972fdf93`

## Decisiones del propietario

- Público objetivo: jugadores de Cuba.
- Prioridad: incorporar juegos nuevos.
- Meta gradual: aproximadamente 10–15 juegos en total.
- Los juegos y paquetes que ya están publicados quedan congelados durante esta expansión. No se agregan denominaciones ni se cambian nombres, precios, orden, disponibilidad o configuración de los paquetes actuales salvo petición expresa del propietario.
- La incorporación será de un juego a la vez. Cada nuevo juego debe quedar integrado, probado y visualmente refinado antes de avanzar al siguiente.
- El primer objetivo solicitado es Call of Duty Mobile, pero solo si Central One ofrece una región compatible con las cuentas de jugadores cubanos. No se publicará una variante regional incompatible.
- Mantener el desarrollo con herramientas y planes gratuitos. No contratar alojamiento, suscripciones ni servicios adicionales.
- No gastar saldo real de Central One en pedidos de prueba sin autorización expresa.

## Estado técnico revisado

### Repositorio y funciones

- El panel de administración ya tiene la acción **Cargar catálogo**, que consulta Central One en modo de solo lectura y guarda el resultado en `public.central_one_catalog_snapshots`.
- `central-one-read` valida la sesión y el rol de administrador antes de consultar el catálogo.
- `central-one-sync` consulta el catálogo y la cobertura de validación, pero la sincronización de productos está limitada a funciones específicas de Free Fire, Mobile Legends y Blood Strike.
- La validación y el formulario web aceptan actualmente un identificador de jugador de un solo campo (`player_id` o `game_user_id)); el caso especial de dos campos solo está implementado para Mobile Legends. No se debe asumir que otros esquemas con servidor desplegable o campos adicionales funcionarán.
- La tabla `public.products` ya contiene columnas para SKU, región, coste mayorista, estado, disponibilidad, campos y esquema del objetivo de recarga, y bandera de compatibilidad de validación.

### Catálogo histórico

La última copia completa localizada en la base de datos fue obtenida el **9 de noviembre de 2026** y contenía 8.006 productos. Es un dato histórico; no sirve por sí solo para publicar hoy. La sincronización automática más reciente del 14 de noviembre guarda solo una selección de los juegos actuales, no todo el catálogo.

En esa copia completa, las siguientes familias tenían productos de recarga activos y con stock:

| Juego | Región de proveedor | Productos activos con stock en la copia |
|---|---|---:|
| PUBG Mobile | GLOBAL | 29 |
| Arena Breakout | GLOBAL | 27 |
| Honor of Kings | GLOBAL | 32 |
| EA FC Mobile | GLOBAL | 14 |
| 8 Ball Pool | GLOBAL | 13 |
| Stumble Guys | GLOBAL | 6 |
| Rainbow Six Mobile | GLOBAL | 21 |
| Racing Master | LATAM | 21 |
| Pixel Gun 3D | GLOBAL | 36 |
| Bleach: Soul Resonance | AMERICAS | 23 |
| Wuthering Waves | GLOBAL | 14 |

Los conteos y regiones anteriores describen únicamente la copia del 9 de noviembre. Deben volver a comprobarse contra el catálogo actual de la cuenta y las reglas regionales aplicables antes de cualquier publicación.

### Cobertura de validación más reciente

La última copia compacta de sincronización guardó 506 entradas de cobertura de validación, con fecha **14 de noviembre de 2026 a las 21:30 UTC**. Entre los nuevos juegos, solo aparecieron:

| Juego | Región | Productos presentes en cobertura |
|---|---|---:|
| Arena Breakout | GLOBAL | 27 |
| PUBG Mobile | GLOBAL | 29 |

Las entradas de estos dos juegos usan un único campo de identificador `game_user_id`, compatible con la forma básica de validación de ID que ya existe en la web y en la función de validación del proveedor. Esto no equivale a una prueba de compra real; la validación del jugador, el coste, el stock y el envío del pedido deben probarse de forma controlada antes de publicar.

## Call of Duty Mobile: decisión provisional

En la copia completa del 9 de noviembre:

- Call of Duty Mobile: 9 productos, región `IN` (India).
- Call of Duty Mobile Garena: 12 productos, región `SG/MY` (Singapur/Malasia).

No se encontró una variante LATAM o GLOBAL en esa copia. Tampoco apareció CODM en la cobertura de validación guardada el 14 de noviembre.

**No publicar CODM todavía.** Solicitar a Central One confirmación explícita de si puede habilitar Call of Duty Mobile para cuentas de Cuba, preferiblemente una oferta LATAM o GLOBAL compatible. No ofrecer las variantes IN ni SG/MY como si fueran válidas para Cuba.

## Orden de expansión propuesto

### Etapa 0 — Proteger la tienda actual

1. Mantener sin cambios los productos y paquetes actuales.
2. Hacer una comprobación de regresión del flujo existente: selección de producto, validación de ID, pago/billetera, creación del pedido, envío a Central One y estado final.
3. No modificar las reglas de la billetera, las tasas, la lógica de devolución ni las funciones de pedido existentes para resolver la expansión de catálogo.

### Etapa 1 — Primeros juegos candidatos con cobertura observada

1. **PUBG Mobile GLOBAL.**
2. **Arena Breakout GLOBAL.**

Son los dos candidatos nuevos con cobertura de validación presente en la sincronización más reciente y con esquema de un solo ID. Antes de integrar cada uno, volver a cargar el catálogo actual y confirmar SKU, región, stock, coste, nombre, campos y compatibilidad para la cuenta. Después se integra uno, se prueba y se publica solo cuando todas las comprobaciones pasan.

### Etapa 2 — Ampliación condicionada a cobertura del proveedor

Investigar en este orden orientativo: Honor of Kings, EA FC Mobile, Racing Master, Rainbow Six Mobile, 8 Ball Pool, Stumble Guys, Pixel Gun 3D, Bleach: Soul Resonance y Wuthering Waves.

Estos no están aprobados para publicación por esta auditoría: aunque aparecían con stock en el catálogo histórico, no aparecieron en la cobertura de validación más reciente consultada. Deben esperar a que Central One confirme soporte de validación o a que exista un método seguro compatible que no debilite el control actual.

Los juegos que exigen servidor seleccionable, varios campos o credenciales de cuenta requieren una fase técnica adicional. No pedir ni almacenar contraseñas de cuentas de juego.

### Etapa 3 — Call of Duty Mobile

Revisar la respuesta de Central One sobre la región adecuada para Cuba. Si no existe una oferta regional compatible y validable, dejar CODM fuera, sin asumir riesgos con el dinero de los clientes. Si Central One la habilita, integrarla y refinarla con el mismo estándar que los juegos ya publicados.

### Etapa 4 — Meta de 10–15 juegos

Mantener el total actual de juegos publicados y sumar únicamente los juegos nuevos que superen todos los controles. La meta se alcanza de manera gradual; no se importará el catálogo completo ni se publicarán cientos de SKU automáticamente.

## Requisitos para aprobar cada juego nuevo

1. El producto aparece en el catálogo actualizado de la cuenta.
2. La región es compatible con las cuentas a las que se venderá en Cuba; el nombre GLOBAL o LATAM no se toma como garantía sin confirmación del proveedor.
3. El producto está activo y en stock.
4. La cobertura de validación incluye el producto cuando la operación depende de validar el ID.
5. Los campos y el esquema de objetivo coinciden exactamente entre catálogo, formulario, validación y envío de pedido.
6. El coste mayorista está actualizado y el precio minorista deja beneficio positivo calculado con el coste real de reposición de USDT y las comisiones.
7. El envío mantiene la idempotencia, la comprobación de saldo del proveedor y las reglas existentes de resultado incierto y devolución.
8. La interfaz del juego tiene imagen propia, nombre, región, instrucciones, validación y experiencia móvil cuidadas.
9. Se prueba primero la validación de ID. No se genera una compra real de prueba ni se consume saldo del proveedor sin autorización expresa.
10. Solo entonces se activa la visibilidad pública.

## Próximo paso necesario

La copia completa del catálogo encontrada es del 9 de noviembre, así que se necesita una actualización. Desde la cuenta de administrador en la web, entrar en el panel de Central One y pulsar **Cargar catálogo**. Esa acción es de solo lectura respecto a Central One: consulta el catálogo y guarda una copia en Supabase; no crea pedidos ni descuenta el saldo prepago. Una vez guardada la nueva copia, revisaré los productos y la cobertura actuales antes de comenzar la primera integración.

## Alcance de esta auditoría

- No se modificó `index.html`.
- No se modificaron productos ni paquetes publicados.
- No se ejecutaron pedidos ni pruebas que gastaran saldo de Central One.
- No se cambió la billetera ni sus tasas.
- Este documento registra una auditoría y un plan; no significa que los juegos nuevos ya estén integrados o publicados.

## Actualización de auditoría — 14 de noviembre de 2026, 22:15 UTC

Se desplegó el importador genérico con una regla más estricta: solo recargas GLOBAL/LATAM que usen un único ID de jugador sin credenciales y estén presentes en la cobertura de validación de Central One. Se preservan los paquetes publicados de Free Fire, Blood Strike y Mobile Legends.

La primera sincronización posterior al despliegue confirmó 56 productos nuevos: 29 de PUBG Mobile GLOBAL y 27 de Arena Breakout GLOBAL. Los 56 quedaron activos, visibles, con stock y cobertura de validación. Todos tienen precios positivos para Transferencia CUP, Saldo móvil y USDT; el checkout también usa el precio USDT para la billetera interna. La revisión y autorización administrativa de pedidos se conserva.

No se han realizado compras reales de prueba de los dos juegos nuevos ni se ha verificado visualmente GitHub Pages en un navegador. Los juegos restantes del catálogo histórico no se activarán hasta que Central One incluya sus productos en la cobertura de validación y cumplan el esquema sin credenciales. El detalle de la auditoría y las verificaciones está en `docs/AUDITORIA_GLOBAL_LATAM_ID_2026-11-14.md`.


## Acabado visual y organización de ofertas — 15 de noviembre de 2026

- Se incorporaron las dos imágenes oficiales aportadas por el propietario: PUBG Mobile y Arena Breakout. Se guardaron como WebP optimizado dentro de `assets/games/` para evitar solicitudes a servidores externos y reducir el peso de descarga.
- Las tarjetas del catálogo, las cabeceras de detalle y el anuncio previo al inicio de sesión utilizan esos archivos locales.
- Se eliminaron para ambos juegos los fondos ilustrados genéricos como respaldo visual; si una imagen no cargara, la tarjeta conservará un fondo neutro acorde al juego.
- PUBG Mobile se ordenó en cuatro categorías: UC, WOW Coins, pases/Prime y ofertas especiales.
- Arena Breakout se ordenó en cuatro categorías: Bonds, pases, bundles TAGTICAL y casos/objetos.
- Todas las opciones siguen usando el checkout común, los métodos de pago ya habilitados, la validación del ID y la autorización manual del administrador. No se crean pedidos al sincronizar ni se cambia ningún paquete de Free Fire, Blood Strike o Mobile Legends.
- La edición es de interfaz y recursos visuales; no cambia el esquema, la sincronización ni las reglas de pago del proveedor.
- Pendiente de verificación visual final desde GitHub Pages en un teléfono. Esta modificación no equivale a una prueba de compra ni de entrega real.


## Iconos de monedas y membresías — 15 de noviembre de 2026

- Se conservaron las imágenes principales locales de PUBG Mobile (assets/games/pubg-mobile.webp) y Arena Breakout (assets/games/arena-breakout.webp), ya referenciadas en las tarjetas, el escaparate previo al inicio de sesión y las cabeceras de detalle.
- Se ajustó freeFirePlanIcon() para que las tarjetas de ofertas de estos juegos usen iconos específicos según el producto, sin modificar nombres, cantidades, precios ni métodos de pago.
- PUBG Mobile: UC usa el recurso de moneda del catálogo oficial Midasbuy/Tencent (https://cdn.midasbuy.com/images/level4.5662a174.png); WOW Coins usa una moneda neutral y Prime/Prime Plus una corona; Elite Pass usa un boleto. No se encontró un archivo independiente y verificable del editor para los iconos de WOW/Prime/Royale Pass en esta revisión, así que no se presentan esos símbolos como ilustraciones oficiales.
- Arena Breakout: Bonds usa el icono del catálogo oficial Midasbuy (https://cdn.midasbuy.com/images/midas_oversea/b7eb1c35123e372b55b01afdce9f0096.png). Advanced y Premium Battle Pass usan sus respectivas tarjetas de activación del catálogo oficial Midasbuy (https://cdn.midasbuy.com/public/08f39990746f8c5eed1e09725617c5cd.png y https://cdn.midasbuy.com/public/154d156110d9f020d19fd0b68c9742c1.png).
- Los iconos externos se cargan desde la CDN de Midasbuy con carga diferida y respaldo emoji si no llegan a cargar; por tanto, estos iconos aún dependen de conexión con el dominio externo. Las imágenes grandes de los juegos sí permanecen en el repositorio.
- No se tocaron productos de Free Fire, Blood Strike o Mobile Legends, ni se modificó la base de datos, sincronización, checkout, validación por ID o autorización manual.
- Pendiente: revisión visual desde un teléfono después de que GitHub Pages publique la versión y, si se desea que todos los iconos estén alojados localmente para conexión lenta, incorporar archivos oficiales independientes para PUBG WOW Coins, Prime/Prime Plus y Elite Pass.

## Ajuste de iconos de PUBG Mobile — 15 de noviembre de 2026

- Se conectaron imágenes de catálogo para las tres familias que todavía mostraban emoji: WOW Coins, Prime y Elite Pass.
- Fuentes consultadas para estas miniaturas: catálogo público de Synn Store. Son imágenes de una tienda externa que comercializa esos productos; no se ha podido certificar que sean archivos originales publicados por PUBG/Krafton. No se describen como recursos oficiales.
- WOW Coins: `https://synnmlbb.com/storage/product/denom-icons/denom_NChzJhvgun_1789961846.webp`
- Prime / Prime Plus: `https://synnmlbb.com/storage/product/denom-icons/denom_ayvKUmlHJ2_1781704505.png`
- Elite Pass: `https://synnmlbb.com/storage/product/denom-icons/denom_t6q1jWzPIq_1781704341.png`
- Se usa el mismo icono por familia, no se duplica por denominación. Se mantiene el emoji como alternativa automática cuando la imagen remota no carga.
- El icono de UC se sustituyó posteriormente por la insignia enviada por el propietario y guardada localmente como `assets/games/pubg-uc.webp`.
- Las imágenes nuevas quedan enlazadas de forma remota; no se pudieron descargar/copiar al repositorio como archivos locales desde este entorno por un fallo de resolución/conexión del host externo. Por tanto, el catálogo depende de que el servidor de origen permita cargar esas URLs y todavía hace falta comprobar la carga desde un teléfono en Cuba.
- No se modificaron productos, precios, paquetes, inventario, región, validación, pagos ni flujo de autorización. No se realizó ningún pedido de prueba.

## Iconos locales de PUBG Mobile — actualización con recursos del propietario

- El propietario proporcionó directamente tres imágenes para las ofertas de PUBG Mobile: WOW Coins, Prime y Elite Pass; además, ya había aportado previamente la insignia UC.
- Se optimizaron a WebP con transparencia, 64 × 64 px para reducir al mínimo el peso en móviles. Tamaños finales: WOW Coins 2.292 bytes, Prime 1.948 bytes y Elite Pass 2.114 bytes (total 6.354 bytes, aproximadamente 6,2 KB).
- Archivos añadidos al repositorio: `assets/games/pubg-wow-coins.webp`, `assets/games/pubg-prime.webp`, `assets/games/pubg-elite-pass.webp`.
- El catálogo utiliza estos archivos locales en lugar de las miniaturas remotas de Synn Store. Esto elimina esas tres dependencias externas y reduce el peso para conexiones lentas.
- Las imágenes se usan como iconos de familia para las ofertas correspondientes; el logotipo de UC y los iconos de Arena Breakout permanecen como estaban.
- No se tocaron precios, denominaciones, productos, inventario, pagos, validación, pedidos ni autorización de recargas. No se realizó ningún pedido de prueba.
- Pendiente: comprobar visualmente la publicación en el teléfono del propietario y continuar la revisión de iconos de otros juegos.

## Auditoría de iconos de monedas y membresías del catálogo — 15 de noviembre de 2026

Objetivo de esta revisión: identificar únicamente recursos de producto que aún dependen de hosts externos o de emojis. No se modifican ofertas, precios ni sincronización.

| Juego | Estado actual | Recursos que conviene guardar localmente |
|---|---|---|
| Free Fire | Los iconos de diamantes y tarjetas/pases principales ya usan archivos locales. | Ninguno por ahora. |
| PUBG Mobile | UC, WOW Coins, Prime y Elite Pass guardados en `assets/games/` como WebP locales optimizados. | Ninguno por ahora. |
| Mobile Legends | Las imágenes de diamantes y de ofertas/permisos se cargan desde Codashop CDN. | Un icono transparente de diamante; Weekly Diamond Pass; Weekly Elite Pack; Monthly Elite Pack; Twilight Pass. Se puede usar una sola imagen de diamante para todas las cantidades y conservar la cantidad escrita en la tarjeta. |
| Arena Breakout | Bonds y Advanced/Premium Battle Pass usan recursos CDN de Midasbuy. Algunos bundles/objetos continúan con emoji genérico. | Icono Bonds, tarjeta Advanced Battle Pass, tarjeta Premium Battle Pass. Para bundles adicionales, pedir imagen solo si queremos sustituir los emojis en esos productos. |
| Blood Strike | Se reutiliza la portada/arte de oferta del juego o imágenes del proveedor; no hay aún un icono local independiente de la moneda ni un icono local genérico del Strike Pass. | Icono de Gold/moneda de Blood Strike (el proveedor etiqueta algunos paquetes BC en nuestro catálogo); emblema o tarjeta de Strike Pass. |

### Páginas de origen para los siguientes recursos

- Mobile Legends: página oficial de recargas Codashop: `https://www.codashop.com/en-us/mobile-legends`. Para las miniaturas de diamantes, Weekly Diamond Pass y Twilight Pass, entrar en la página de producto y guardar las imágenes individuales. Los paquetes Weekly Elite y Monthly Elite aparecen documentados en el contenido oficial de Codashop: `https://news.codashop.com/us/mobile-legends-top-up-benefit-free-diamonds/`.
- Arena Breakout: tienda oficial Tencent/Midasbuy: `https://www.midasbuy.com/midasbuy/us/shop/abi?lang=en`. Allí aparecen las tarjetas Advanced Battle Pass Activation Card y Premium Battle Pass Activation Card, además de paquetes Bonds.
- Blood Strike: recarga oficial NetEase: `https://pay.neteasegames.com/BloodStrike/topup?c=m2.55jp.x&from=home`. La tienda oficial muestra denominaciones de Gold; para el arte del Strike Pass, revisar las noticias oficiales: `https://www.blood-strike.com/official/index.html`.

### Qué imágenes pedir al propietario en la próxima entrega

1. Mobile Legends: diamante azul (1), Weekly Diamond Pass (1), Weekly Elite Pack (1), Monthly Elite Pack (1) y Twilight Pass (1).
2. Arena Breakout: Bonds (1), Advanced Battle Pass (1) y Premium Battle Pass (1).
3. Blood Strike: moneda Gold/BC (1) y tarjeta/emblema Strike Pass (1).

Formato preferido: PNG o WebP con transparencia cuando exista; conservar el diseño original, sin redibujar ni generar arte. Una captura de la página de la tienda también sirve si no permite descargar la imagen.
- Sitios oficiales o tiendas autorizadas pueden mostrar recursos diferentes según país, idioma y campaña. Verificar que el icono corresponda al producto antes de incorporarlo.
- No hay cambios de productos, precios, cantidades, stock, región, validación, pagos, pedidos ni autorización por esta auditoría.


### Icono local de UC — recurso enviado por el propietario

- Se incorporó la insignia UC que el propietario había encontrado y enviado antes, recortada al área del emblema y optimizada en WebP de 96 × 96 px (1.096 bytes).
- Archivo: `assets/games/pubg-uc.webp`. Se usa como icono UC en el catálogo. No se modifica el arte base del juego.
- Ya no depende de la imagen remota de Midasbuy para UC. Las cuatro familias de iconos PUBG (UC, WOW Coins, Prime y Elite Pass) están guardadas localmente.

## Auditoría completa de recursos visuales del catálogo activo — 15 de noviembre de 2026

### Base del inventario revisada

Consulta de solo lectura en `public.products`: 116 productos activos y visibles en cinco juegos. Ninguno de estos productos tiene `provider_image_url` poblado, por lo que las imágenes de producto dependen de la lógica del frontend, URLs remotas, archivos locales o iconos de reserva.

| Juego | Productos activos y visibles |
|---|---:|
| Free Fire | 10 |
| Blood Strike | 39 |
| Mobile Legends: Bang Bang | 11 |
| PUBG Mobile | 29 |
| Arena Breakout | 27 |
| **Total** | **116** |

### Recursos ya guardados localmente

- Portadas de los cinco juegos: `assets/games/free-fire.webp`, `assets/games/blood-strike-cover.webp`, `assets/games/mobile-legends-bang-bang.webp`, `assets/games/pubg-mobile.webp`, `assets/games/arena-breakout.webp`.
- Free Fire: arte de diamantes, Booyah Pass y tarjetas semanales/mensuales en `assets/ff-*.webp`; seis SVG de cantidades de diamantes.
- PUBG Mobile: UC, WOW Coins, Prime y Elite Pass en `assets/games/pubg-uc.webp`, `pubg-wow-coins.webp`, `pubg-prime.webp`, `pubg-elite-pass.webp`.
- En consecuencia, no pedir de nuevo portadas de Free Fire, Blood Strike, Mobile Legends, PUBG Mobile ni Arena Breakout, ni los cuatro iconos de PUBG ya aportados por el propietario.

### Mobile Legends — 11 productos: imágenes actualmente remotas

El código usa siete miniaturas de diamantes y cuatro imágenes de membresías/pases. Los siguientes enlaces son las URLs de imagen a las que apunta la implementación actual. Son archivos CDN de Codashop; la tienda oficial de recargas muestra diamantes y Twilight Pass, y Codashop documenta también Weekly Elite Bundle, Monthly Epic Bundle y Weekly/Monthly subscriptions.

Diamantes:
- 55: `https://cdn1.codashop.com/images/106_5e7a01a7-89b9-4b13-a512-a3e72f63f0d1_product/1760335237238_d1b7bb02-2b65-4e49-b340-8012f978adc9.png`
- 172: `https://cdn1.codashop.com/images/106_5e7a01a7-89b9-4b13-a512-a3e72f63f0d1_product/1760335253623_140f8c3e-7363-486e-ac68-5b25480c970c.png`
- 275: `https://cdn1.codashop.com/images/106_5e7a01a7-89b9-4b13-a512-a3e72f63f0d1_product/1760335253061_8aa498bd-d8c6-4ca3-b9b5-c7eac993892d.png`
- 565: `https://cdn1.codashop.com/images/106_5e7a01a7-89b9-4b13-a512-a3e72f63f0d1_product/1760334880901_8ac54d18-429f-4e24-81e5-35d7184f43e5.png`
- 706: `https://cdn1.codashop.com/images/106_5e7a01a7-89b9-4b13-a512-a3e72f63f0d1_product/1760335252218_b62735e6-5f62-41cc-9668-dcde1071bde5.png`
- 2195: `https://cdn1.codashop.com/images/106_5e7a01a7-89b9-4b13-a512-a3e72f63f0d1_product/1760334881128_be1975db-bc64-4c7e-a979-4862b4fdaeb1.png`
- 3688: `https://cdn1.codashop.com/images/106_5e7a01a7-89b9-4b13-a512-a3e72f63f0d1_product/1760335251935_a4f204ac-54b1-4733-b3ae-34c996810039.png`

Pases y membresías:
- Weekly Elite Pack: `https://cdn1.codashop.com/images/106_5e7a01a7-89b9-4b13-a512-a3e72f63f0d1_f66aebb8ede7c159b2dfc46c2cd00201_product/1769596214229_6ebd718e-a33f-476f-ab41-68dbc5f4f5bc.png`
- Weekly Pass: `https://cdn1.codashop.com/images/106_5e7a01a7-89b9-4b13-a512-a3e72f63f0d1_product/1760334654543_147fadd0-31a9-4ac2-b3f9-56a873ad3b83.png`
- Monthly Elite Pack (URL actual del código, pendiente de revalidación): `https://cdn1.codashop.com/images/106_5e7a01a7-89b9-4b13-a512-a3e72f63f0d1_f66aebb8ede7c159b2dfc46c2cd00201_product/1769669159381_fc8c3ae1-605f-4f19-ad5d-817ed9e0c3df.png`
- Twilight Pass (imagen visible enlazada desde la página actual de Codashop): `https://cdn1.codashop.com/images/106_5e7a01a7-89b9-4b13-a512-a3e72f63f0d1_product/1760334861806_b6849054-08c2-44af-8750-2f7ea6ce9814.png`
- La referencia antigua de Twilight Pass en el código (`1760334848892_d97e4ddf-7686-491e-9352-bcea3e163679.png`) no pudo abrirse en la comprobación web; no volver a recomendar esa URL sin verificarla.
- Página de producto: `https://www.codashop.com/en-us/mobile-legends`; artículo de Codashop que describe Weekly Elite, Monthly Epic y Twilight Pass: `https://news.codashop.com/us/mobile-legends-top-up-benefit-free-diamonds/`.
- No se deben alterar las cantidades ni los nombres de las 11 ofertas por el hecho de usar imágenes de una página de recarga regional distinta.

### Arena Breakout Mobile — 27 productos

Productos publicados: ocho paquetes Bonds; Beginner Select; Bulletproof Case (30d); Composition Case (30d); seis MAXACE (Ash, Carbon Scales, Finality, Molten Fire, Original, Venom); tres familias de pases (Monthly Advanced, Monthly Premium y Quarterly Premium); y siete TAGTICAL (I–VI y Complete).

**Corrección de fuente:** las imágenes de Battle Pass que el código utilizaba desde `midasbuy.com/.../abi` pertenecen a **Arena Breakout: Infinite** (la edición de PC), no a Arena Breakout Mobile. No volver a descargarlas ni tratarlas como arte correcto para el juego móvil. La web oficial móvil es `https://arenabreakout.com/`; la app de Google Play confirma el sitio oficial. El producto móvil y la edición Infinite son distintos.

Página de productos móviles que se identifica como partner oficial (declaración del propio sitio, no confirmada independientemente por Tencent): `https://www.topuplive.com/en/arena-breakout/`. Allí se muestran Bonds, cuatro MAXACE y TAGTICAL Bundle I/Complete. Algunos recursos directos visibles en esa página:
- Bonds (60+6): `https://cdn.topuplive.com/cdn-cgi/image/format%3Dwebp/uploads/images/goods/v4/m/M-902.webp`
- MAXACE Carbon Scales: `https://cdn.topuplive.com/cdn-cgi/image/format%3Dwebp/uploads/images/goods/20260921/1789982191_b4YXSb1o0w.webp`
- MAXACE Molten Fire: `https://cdn.topuplive.com/cdn-cgi/image/format%3Dwebp/uploads/images/goods/20260929/1790661488_McRfp2QK0j.webp`
- MAXACE Finality: `https://cdn.topuplive.com/cdn-cgi/image/format%3Dwebp/uploads/images/goods/20260929/1790661574_3JXvXZA78M.webp`
- MAXACE Venom: `https://cdn.topuplive.com/cdn-cgi/image/format%3Dwebp/uploads/images/goods/20260929/1790661681_iUVcguCx8x.webp`
- TAGTICAL Bundle I: `https://cdn.topuplive.com/cdn-cgi/image/format%3Dwebp/uploads/images/goods/20260921/1789982367_6bsXH443nN.webp`
- TAGTICAL Complete: `https://cdn.topuplive.com/cdn-cgi/image/format%3Dwebp/uploads/images/goods/20260921/1789982477_gBWDFPO8Tp.webp`
- All Pack: `https://cdn.topuplive.com/cdn-cgi/image/format%3Dwebp/uploads/images/goods/20260702/1782962440_8V24JB7zGH.webp`
- Estos enlaces de producto proceden del sitio partner, no del dominio del desarrollador. Los recursos específicos de Ash, Original, Beginner Select, los dos cases y los tres pases deben conseguirse desde la vista del juego móvil o una ficha de proveedor cuya edición esté confirmada; no sustituirlos por arte de Arena Breakout: Infinite.

### Blood Strike — 39 productos

La portada del juego está guardada localmente. El código actualmente mapea campañas a cinco imágenes remotas del CDN de NetEase:
- One-Punch Man: `https://r.res.easebar.com/pic/20260630/4ac9fc27-6eff-4139-8a21-a9ebdc19c4b8.png`
- Tokyo Revengers: `https://r.res.easebar.com/pic/20260514/74858c1d-48c6-4a88-83c0-425669f0866a.jpg`
- Seven Deadly Sins: `https://r.res.easebar.com/pic/20260403/930f5dbe-23ee-4f7d-a038-f87e0ac98f6d.png`
- Attack on Titan: `https://r.res.easebar.com/pic/20260727/8ffc7d3e-8437-417b-9252-64f9086ec54e.jpeg`
- Enzo / Maestro: `https://r.res.easebar.com/pic/20260604/edd23aed-c240-45cd-80a6-760af76f9035.png`
- La tienda oficial de NetEase GamesClub está en `https://pay.neteasegames.com/BloodStrike/topup?c=m2.55jp.x&from=home`; en la página aparecen Golds, Strike Pass Elite y Strike Pass Premium, además de productos de campaña.
- **No confundir monedas:** los nombres de los productos de nuestra base de datos dicen BC (105, 320, 540, 1100, 2260 y otros), mientras que la tienda oficial consultada etiqueta sus paquetes como Golds. No reutilizar automáticamente el icono Gold como icono BC hasta confirmar que corresponden al mismo saldo/unidad del proveedor.
- Pendiente para guardar localmente: icono de la moneda que corresponda realmente a BC, Strike Pass Elite, Strike Pass Premium y Level Up Pass. Para ofertas promocionales adicionales (Lucky Bag, vouchers, chests y pre-orders) usar las ilustraciones específicas del juego si están en la página oficial; no generar arte nuevo.

### PUBG Mobile — 29 productos

Las cuatro familias principales ya tienen iconos locales. Quedan seis productos de catálogo sin icono específico propio: First Purchase Pack, Mythic Emblem Pack, Upgradable Firearm Materials Pack, Weekly Deal Pack 1, Weekly Deal Pack 2 y Weekly Mythic Emblem Value Pack. Se puede obtener una imagen por familia de producto desde la tienda del juego o el catálogo oficial de PUBG/Midasbuy; la página pública de UC es `https://www.midasbuy.com/midasbuy/us/buy?appid=1450015065`. No usar imágenes de otras ediciones/regiones ni cambiar paquetes.

### Free Fire — 10 productos

Sin descarga pendiente para la presentación actual: portada, seis packs de diamantes, Booyah Pass y tarjetas semanales/mensuales ya están alojados localmente.

### Regla de incorporación

- Priorizar recursos del editor/desarrollador o de una tienda autorizada que corresponda exactamente a la edición móvil/global del juego.
- Un icono común puede reutilizarse entre denominaciones de la misma moneda; el número de la oferta ya aparece en el nombre/título. No descargar duplicados innecesarios.
- No usar imágenes de Arena Breakout: Infinite para Arena Breakout Mobile ni Gold de Blood Strike para BC hasta validar equivalencia.
- Descargar en WebP optimizado, conservar transparencia y alojar localmente en `assets/games/`.
- No modificar productos, cantidades, regiones, precios, pagos, validación, pedidos ni autorización durante esta tarea visual.


## Clasificación e integración de imágenes enviadas por el propietario — 16 de noviembre de 2026

Se revisaron los tres documentos adjuntos del propietario:
- `fotos de el mlb.doc`: 9 imágenes.
- `foto de mlb y de arena brecout al parecer.docx`: 9 imágenes.
- `imágenes de pug y blod strike.docx`: 8 imágenes.
- Total recuperado: 26 imágenes incrustadas.

Se consolidaron 25 imágenes útiles en un spritesheet WebP local de 320 × 560 px, 4 columnas × 7 filas, en `assets/games/store-offers-sprite.webp`. El recurso pesa aproximadamente 37 KB. El código muestra cada recorte mediante fondo CSS con posiciones indexadas; no descarga una imagen remota por tarjeta.

Mapa de recortes:
- Mobile Legends: diamantes 55, 172, 275, 565, 706, 2195 y 3688 (índices 0–6); Weekly Elite Pack (7); Weekly Pass (8).
- Arena Breakout Mobile: Bonds (10); MAXACE Carbon Scales, Molten Fire, Finality y Venom (11–14); TAGTICAL Bundle I, TAGTICAL Complete Bundle y All Pack (15–17).
- Blood Strike: Strike Pass Elite y Strike Pass Premium (18–19).
- PUBG Mobile: First Purchase Pack, Upgradable Firearm Materials Pack, Mythic Emblem Pack, Weekly Deal Pack 1, Weekly Deal Pack 2 y Weekly Mythic Emblem Value Pack (20–25).
- Índice 9: retrato de personaje no asignado; no se muestra en la tienda porque no se pudo asociar con seguridad a una oferta concreta.

Pendientes de imágenes en los documentos recibidos:
- Mobile Legends: Monthly Elite Pack y Twilight Pass siguen con sus fuentes remotas actuales; no venían como archivos descargados en estos documentos.
- Arena Breakout Mobile: no se recibió arte individual inequívoco para Advanced/Premium/Quarterly Battle Pass, Beginner Select, Bulletproof/Composition Case, MAXACE Ash/Original ni TAGTICAL Bundle II–VI. Se mantienen los fallbacks actuales para esos productos.
- Blood Strike: no se recibió icono de moneda BC/Gold; se mantiene el icono de respaldo actual. No se reasigna Gold a BC sin equivalencia comprobada.

No se modificaron tablas, precios, disponibilidad, denominaciones, pagos, pedidos, validaciones, inventario ni autorización manual de recargas. Las imágenes recibidas se tratan como material aportado por el propietario; no se certifica su procedencia oficial solo por estar en los documentos.
