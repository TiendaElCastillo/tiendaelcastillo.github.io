# Auditoría e integración segura de juegos GLOBAL/LATAM

**Fecha:** 14 de noviembre de 2026  
**Proyecto:** Tienda El Castillo  
**Rama:** `main`

## Criterio solicitado por el propietario

- Venta orientada principalmente a jugadores de Cuba.
- Solo recargas de juego `game_topup` con región del proveedor `GLOBAL` o `LATAM`.
- No se permite que el cliente entregue contraseña, correo de acceso, token, credenciales ni que el operador entre en su cuenta.
- El método de entrega debe basarse en un ID de jugador/cuenta (o un campo equivalente admitido por el flujo actual).
- La compra conserva los cuatro métodos de pago actuales: Transferencia CUP, Saldo móvil, USDT y Saldo de Tienda El Castillo.
- El administrador debe confirmar el pago y autorizar cada recarga. El catálogo nuevo no envía pedidos automáticamente al proveedor.
- No se modifican ni amplían las denominaciones, precios ni opciones de los paquetes de Free Fire, Blood Strike o Mobile Legends que ya estaban publicados.

## Resultado del análisis de catálogo

La copia completa del catálogo disponible en Supabase fue descargada el **9 de noviembre de 2026** y contiene 8.006 productos. En esa copia había 131 familias de recarga de juegos GLOBAL/LATAM. 125 familias no presentaban campos de correo/contraseña/acceso en sus campos de objetivo; sin embargo, esto no demuestra que la validación del jugador esté habilitada.

La copia de cobertura de validación más reciente guardada en Supabase, del **14 de noviembre de 2026 a las 21:45 UTC**, contiene 506 productos. Fuera de los tres juegos que la tienda ya comercializa, aparecen estas dos familias nuevas:

| Juego | Región | Productos de la copia con cobertura |
|---|---|---:|
| PUBG Mobile | GLOBAL | 29 |
| Arena Breakout | GLOBAL | 27 |

Los dos usan un único campo de jugador `game_user_id`, compatible con la validación y el envío de pedidos que ya tiene la tienda. La información de stock del catálogo completo del 9 de noviembre mostraba esos 56 productos activos y disponibles, pero se debe volver a confirmar en la sincronización actual antes de publicarlos.

Otros juegos aparecen con stock en la copia histórica, pero no están en la cobertura de validación guardada. No se publican todavía porque el formulario y el proceso actual exigen una confirmación fiable del ID antes de cobrar. También quedan excluidos los productos que pidan correo/contraseña o credenciales de inicio de sesión.

## Cambios implementados

### Base de datos

- Se creó `private.central_one_managed_game_products` para identificar exclusivamente los productos creados por el sincronizador genérico. La tabla está en el esquema privado, con RLS y una política que niega acceso a clientes; solo la función privada privilegiada la utiliza.
- Se añadió `private.additional_game_target_schema_supported`, que admite un solo campo `player_id` o `game_user_id` de tipo texto y rechaza esquemas que indiquen contraseña, correo, inicio de sesión, credenciales, token o datos de acceso.
- Se añadió `private.sync_additional_provider_game_products`, que solo activa productos con región GLOBAL/LATAM, tipo game_topup, coste USD válido, objetivo por ID, producto activo, stock y coincidencia exacta de ID/región/familia en la cobertura de validación. Los productos de Free Fire, Blood Strike y Mobile Legends quedan fuera de este importador.
- Se amplió `public.claim_central_one_order` para que el control de autorización de pedidos admita el campo `game_user_id` de forma segura. El control especial existente de Mobile Legends se conserva.
- El RPC público de sincronización es SECURITY INVOKER. La operación privilegiada vive en la función del esquema privado SECURITY DEFINER, que valida el token de sincronización. El acceso a la función privada no expone la tabla interna.

### Sincronización de Central One

- `central-one-sync` está desplegada en versión 10.
- La función consulta el catálogo y la cobertura actuales, filtra productos por las reglas anteriores y llama al nuevo sincronizador.
- Los productos importados se agregan al cálculo de firma y a la copia de catálogo. La sincronización existente de Free Fire, Blood Strike y Mobile Legends permanece separada.
- El proceso automático de catálogo está programado cada 15 minutos.

### Sitio web

- Se añadió PUBG Mobile al catálogo visual y se preparó arte de PUBG Mobile y Arena Breakout.
- La cuadrícula de juegos ahora muestra las familias que tengan paquetes realmente disponibles en el catálogo, en lugar de limitarse a mostrar únicamente las tres familias originales.
- Las tarjetas de productos nuevos reutilizan el checkout común, con métodos de pago de la tienda, validación de ID, comprobante/revisión administrativa y autorización manual para enviar la recarga.

## Validaciones y límites de esta entrega

- La comprobación de esquema confirmó que `player_id` y `game_user_id` de texto se aceptan; un esquema con correo/contraseña se rechaza.
- Se revisó el flujo SQL que exige que un pago directo tenga comprobante y confirmación administrativa, o que el saldo de billetera esté descontado, antes de autorizar el pedido.
- No se creó ningún pedido de prueba ni se gastó saldo de Central One.
- Todavía falta observar una ejecución del cron posterior al despliegue de `central-one-sync` v10 y confirmar cuántos productos PUBG Mobile y Arena Breakout se insertan/activan.
- La web no ha sido comprobada visualmente en un navegador en esta auditoría. La publicación de GitHub Pages puede tardar en reflejar los cambios.
- El catálogo completo de 9 de noviembre es histórico. La activación final depende de la siguiente sincronización en vivo y de que cada SKU siga activo, en stock, con coste, región y cobertura coincidentes.

## Avisos de seguridad

Después de corregir el RPC y la política RLS, el Security Advisor ya no muestra los avisos nuevos relacionados con la tabla privada o el wrapper de sincronización. Permanece un aviso anterior de Supabase Auth: la protección frente a contraseñas filtradas está desactivada. No se cambió ese ajuste durante esta tarea.

## Resultado de la primera sincronización posterior al despliegue

La ejecución automática de `central-one-catalog-refresh` del **14 de noviembre de 2026 a las 22:15:08 UTC** terminó correctamente:

- Catálogo consultado: 8.071 productos del proveedor.
- Cobertura de validación: 506 entradas.
- Productos nuevos filtrados y guardados: 56.
- PUBG Mobile GLOBAL: 29 productos activos, visibles, con stock y cobertura.
- Arena Breakout GLOBAL: 27 productos activos, visibles, con stock y cobertura.
- Los 56 productos usan el objetivo `game_user_id`.
- La tabla de control registra 56 productos gestionados por el importador nuevo.

La consulta posterior a Supabase confirmó los 56 productos en `public.products`, todos con `active=true`, `storefront_visible=true`, estado de proveedor activo, stock y `provider_validation_supported=true`. No se creó ningún pedido de prueba ni se registraron movimientos de billetera para esta integración.

## Límites de prueba y publicación

- La sincronización de catálogo y publicación de productos sí quedó comprobada.
- El esquema ID y la cobertura de validación se comprobaron contra el catálogo y la cobertura que devolvió Central One.
- No se hizo una recarga real de PUBG Mobile o Arena Breakout, ni se consumió saldo del proveedor.
- No se ha probado visualmente la web en un navegador después del commit; la disponibilidad visual en GitHub Pages no se declara verificada.
- Antes de considerar cerrada la integración de cada juego, queda probar una validación de ID con cuenta válida y otra inválida, y completar una compra controlada autorizada por el administrador cuando el propietario lo decida.

La sincronización periódica seguirá comprobando catálogo, cobertura, coste, región y stock. Si el proveedor retira un SKU o deja de cubrir su ID, el importador lo desactiva y lo oculta.
