# Plan de migración a producción — Coronas del Castillo

**Rama de liberación:** `release/coronas-wallet-cutover`  
**Rama de pruebas conservada:** `feature/coronas-wallet-rewards`  
**Producción:** `kfllglkfncebpknnugnx`  
**Pruebas:** `kmotmgpzmeooznyymcxl`

## Estado

La rama de liberación ya está conectada a la base de datos de producción, pero **todavía no se ha unido a `main` ni se ha publicado la nueva interfaz en la web pública**. Las dos migraciones productivas ya se aplicaron y verificaron. La función `central-one-order` está activa en versión 25 con `verify_jwt=true`. No se ha hecho ninguna recarga ni compra real.

La rama de pruebas conserva su URL, clave y simuladores propios. La rama de liberación usa la URL y la clave pública `anon` que ya emplea `main`, y llama directamente a las funciones reales `central-one-player-validate`, `central-one-order` y `central-one-read`. Los nombres de funciones simuladas y sus carpetas no se incluyen en esta rama.

## Migraciones aplicadas en producción

Ya aplicadas en producción y registradas en el historial de Supabase, en este orden:

1. `20261124222142_coronas_production_wallet_and_first_purchase_rewards.sql` — aplicada.
2. `20261124222200_coronas_wallet_policy_index_cleanup.sql` — aplicada.

Las versiones anteriores `20261123222640`, `20261123222909`, `20261124005127` y `20261124005315` ya estaban registradas. Las dos migraciones nuevas también figuran ahora aplicadas. Las migraciones sintéticas permanecen aisladas en la rama de pruebas; no copiarlas ni ejecutarlas en producción.

## Cambios de comportamiento previstos

- 1 Corona equivale a 1 USD en pantalla; la contabilidad histórica permanece en USD.
- 3 % adicional, sin tope, en la primera recarga de Coronas aprobada manualmente.
- 5 % para quien invita, únicamente sobre la primera compra del invitado cuando el pedido y el estado del proveedor llegan a `completed`.
- Devolución de la compra y reversión de la recompensa solo cuando el proveedor confirma el reembolso; los procesos deben ser idempotentes.
- Los tres métodos de recarga siguen sujetos a revisión manual; no acreditar Coronas mientras el depósito esté pendiente.
- No modificar los 548 productos ni el catálogo durante esta migración.

## Secuencia de liberación

1. Las dos migraciones ya están aplicadas y verificadas en producción.
2. La Edge Function `central-one-order` ya está desplegada en versión 25, con `verify_jwt=true` y los secretos existentes del proveedor intactos. La versión incluye el estado `rejected` y la comprobación de reembolso confirmado.
3. La rama de liberación usa la URL y clave pública que ya utilizaba `main`, y dirige las llamadas directamente a las funciones reales.
4. Unir la solicitud de cambios; GitHub Pages publicará la nueva interfaz en `main`.
5. El usuario revisará la web pública visualmente y comunicará cualquier defecto.
6. Cuando la revisión visual esté correcta, el usuario hará una recarga pequeña, comprobará el 3 % tras la aprobación administrativa y realizará una compra de paquete.

## Verificaciones ya realizadas

- Proyecto productivo activo; el asesor de salud de Supabase no informa errores.
- 548 productos; 0 depósitos; 1 movimiento histórico de wallet (devolución por 0,16 USD); 0 compras con wallet y 3 pedidos del proveedor completados.
- `private.wallet_referral_order_rewards` existe, tiene RLS habilitado y empieza con 0 filas; su índice único está creado.
- No hay depósitos incompatibles con las nuevas restricciones ni referencias móviles duplicadas; la política de inserción duplicada fue retirada.
- Configuración observada: 1230 CUP/USD, red BNB Smart Chain (BEP20), 360 unidades móviles y coste de 1200 CUP.
- GitHub Actions: 33 pruebas aprobadas y 0 fallidas. Las pruebas transaccionales de staging de bonos, referidos, validaciones y reversos también constan en el historial.

## Acciones manuales pendientes

- Publicar esta rama en `main` para que el usuario pueda revisar visualmente la página real en su teléfono.
- El usuario enviará los defectos visuales o funcionales encontrados para corregirlos antes de hacer transacciones de prueba.
- Cuando el aspecto y el recorrido estén correctos, el usuario hará una recarga pequeña, verificará el bono del 3 % después de la aprobación y realizará una compra con Coronas.
- No ejecutar ninguna migración de `supabase/staging-migrations/` ni desplegar funciones de `supabase/staging-functions/` en producción.
