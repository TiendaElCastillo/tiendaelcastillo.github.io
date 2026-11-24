# Plan de migración a producción — Coronas del Castillo

**Rama de liberación:** `release/coronas-wallet-cutover`  
**Rama de pruebas conservada:** `feature/coronas-wallet-rewards`  
**Producción:** `kfllglkfncebpknnugnx`  
**Pruebas:** `kmotmgpzmeooznyymcxl`

## Estado

La rama de liberación ya está preparada para conectarse a producción, pero **no se ha unido a `main`, no se han aplicado migraciones y no se ha desplegado ninguna función en producción**. La web pública y sus saldos siguen intactos.

La rama de pruebas conserva su URL, clave y simuladores propios. La rama de liberación usa la URL y la clave pública `anon` que ya emplea `main`, y llama directamente a las funciones reales `central-one-player-validate`, `central-one-order` y `central-one-read`. Los nombres de funciones simuladas y sus carpetas no se incluyen en esta rama.

## Migraciones aplicadas en producción

Ya aplicadas en producción y registradas en el historial de Supabase, en este orden:

1. `20261124222142_coronas_production_wallet_and_first_purchase_rewards.sql` — aplicada.
2. `20261124222200_coronas_wallet_policy_index_cleanup.sql` — aplicada.

Las versiones `20261123222640`, `20261123222909`, `20261124005127` y `20261124005315` ya aparecen registradas en el historial de producción. Solo quedan pendientes las dos migraciones indicadas. Las migraciones sintéticas están aisladas en la rama de pruebas; no copiarlas ni ejecutarlas en producción.

## Cambios de comportamiento previstos

- 1 Corona equivale a 1 USD en pantalla; la contabilidad histórica permanece en USD.
- 3 % adicional, sin tope, en la primera recarga de Coronas aprobada manualmente.
- 5 % para quien invita, únicamente sobre la primera compra del invitado cuando el pedido y el estado del proveedor llegan a `completed`.
- Devolución de la compra y reversión de la recompensa solo cuando el proveedor confirma el reembolso; los procesos deben ser idempotentes.
- Los tres métodos de recarga siguen sujetos a revisión manual; no acreditar Coronas mientras el depósito esté pendiente.
- No modificar los 548 productos ni el catálogo durante esta migración.

## Secuencia de liberación

1. Aplicar la primera migración y verificar la tabla privada de recompensas, las funciones y los permisos.
2. Aplicar la migración de limpieza/índice.
3. Desplegar `supabase/functions/central-one-order/index.ts` a producción con `verify_jwt=true`, conservando los secretos actuales del proveedor. La versión incluye los estados `rejected` y la comprobación de reembolso confirmado.
4. Revisar que la URL y la clave públicas de la rama sigan apuntando al proyecto productivo.
5. Unir la solicitud de cambios; GitHub Pages publicará el código de la rama `main`.
6. Hacer una prueba real de cliente: una recarga pequeña, aprobación desde administración, comprobación del 3 % y una compra de paquete. Verificar pedido único, estado final del proveedor e historial de Coronas.

## Verificaciones ya realizadas

- Proyecto productivo activo y saludable.
- 548 productos; 0 depósitos, 1 movimiento histórico de wallet y 3 pedidos del proveedor completados en el momento del prechequeo.
- No existe aún `private.wallet_referral_order_rewards`.
- No hay depósitos incompatibles con las nuevas restricciones ni referencias móviles duplicadas.
- Configuración observada: 1230 CUP/USD, red BNB Smart Chain (BEP20), 360 unidades móviles y coste de 1200 CUP.
- Las pruebas transaccionales de staging de bonos, referidos, validaciones y reversos constan en el historial de trabajo; sigue pendiente la prueba de navegador con sesión autenticada.

## Acciones manuales pendientes

- Antes de la publicación, hacer la prueba de navegador autenticado y la revisión visual móvil. No usar el método/dirección ficticios del entorno de pruebas para pagos reales.
- Durante el corte, comprobar en Supabase que los secretos actuales del proveedor permanecen configurados; no copiarlos ni exponerlos en el repositorio.
- No ejecutar ninguna migración de `supabase/staging-migrations/` ni desplegar funciones de `supabase/staging-functions/` en producción.
