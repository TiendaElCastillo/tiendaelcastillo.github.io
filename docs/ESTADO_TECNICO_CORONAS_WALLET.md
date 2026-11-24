# Memoria técnica — Coronas del Castillo, invitaciones y compras con wallet

**Última revisión:** 24 de noviembre de 2026  
**Proyecto público:** https://tiendaelcastillo.github.io  
**Repositorio:** https://github.com/TiendaElCastillo/tiendaelcastillo.github.io  
**Rama de trabajo:** `feat/coronas-wallet-referrals`  
**Pull request:** https://github.com/TiendaElCastillo/tiendaelcastillo.github.io/pull/40  
**Estado de publicación:** cambios sin unir a `main`; la web pública no contiene las nuevas reglas.

Este archivo es la memoria técnica de referencia para continuar el trabajo sin reconstruir el historial ni confundir producción con pruebas.

## 1. Reglas comerciales acordadas

- **1 Corona = 1 USD.** El ledger interno de Supabase conserva USD para no alterar movimientos ni pedidos anteriores. En la interfaz, los clientes ven Coronas.
- Las Coronas son saldo interno de la tienda; no son criptomoneda, no se retiran en efectivo ni se transfieren entre cuentas.
- **Primera recarga:** 3 % extra sobre el importe completo de la primera recarga de wallet aprobada manualmente, sin tope. Solo se acredita después de comprobar el pago.
- **Invitaciones:** quien invita gana el 5 % del equivalente USD de cada paquete comprado por su amigo, pero solamente cuando el proveedor y el pedido local confirman `completed`.
- No se paga comisión por depósitos, pedidos pendientes, pagos sin confirmar, pedidos rechazados, fallidos o cancelados.
- Solo una comisión por pedido. Una devolución o reversión de una entrega retira la comisión una sola vez.
- Un solo código por cuenta, no se permiten autorreferidos, el código debe vincularse durante los primeros 7 días de la cuenta y antes de solicitar la primera recarga. Una cuenta solo puede quedar vinculada a un invitador.
- El 10 % ya incluido en ciertos paquetes participantes de Free Fire no debe presentarse como otro bono nuevo.

## 2. Qué está preparado en la rama

- La pantalla de wallet, el checkout, las promociones, el texto para compartir y las guías públicas muestran la equivalencia 1:1 y las promociones nuevas.
- La vista de invitaciones espera el resumen de amigos invitados, amigos con paquetes entregados y cantidad de paquetes recompensados.
- La versión de caché de la aplicación está en `shell-v184`.
- El icono `assets/coronas-del-castillo.svg` es provisional. No sustituirlo por una imagen inventada: falta el PNG oficial exportado desde Canva, diseño «Icono oficial Coronas del Castillo» (128 × 128).
- El checkout con Coronas utiliza la clave interna antigua `Saldo de Tienda El Castillo` para conservar compatibilidad con movimientos anteriores; no cambiarla sin migración específica.
- La función Edge `central-one-order` que está desplegada en producción sigue en versión 24. En la rama, la función ahora conserva el estado `rejected` tanto en el envío inicial como al consultar un pedido, y solo intenta reembolsar si el proveedor confirma `refund.refunded = true`.
- La interfaz trata el rechazo del proveedor como un resultado fallido que requiere revisar el pedido, sin pedir al cliente que repita el pago.

## 3. Modelo contable y protección de las compras

- `private.create_wallet_order` crea la compra con idempotencia por usuario y `wallet_request_id`, bloquea saldo insuficiente, registra el débito como `wallet_transactions.kind = 'purchase'` y confirma el pago de wallet.
- El pedido conserva `payment_confirmed_at` y `wallet_refund_amount`, que guarda el equivalente USD del paquete al crearse. Esa instantánea es la base de la comisión, no el precio de catálogo futuro ni el importe CUP.
- `private.wallet_balance` suma `deposit`, `refund` y `adjustment`; el resto de tipos resta saldo. Por ello, la comisión usa `adjustment` positivo y su reversión usa `purchase` positivo. No usar importes negativos.
- La comisión por pedido tiene una clave primaria única por `order_id`. La tabla de recompensas se mantiene en el esquema privado, con RLS y sin permisos directos de `anon` o `authenticated`.
- Las devoluciones solo se abonan cuando el proveedor confirma el reembolso, se verifica que el identificador de proveedor corresponde al pedido y se comprueba el débito/pago original. Se conserva la unicidad del movimiento de reembolso.
- Un resultado de proveedor incierto nunca debe provocar un segundo envío ni una devolución a ciegas.

## 4. Auditoría actual de producción

Proyecto Supabase de producción: `kfllglkfncebpknnugnx` (activo y saludable). El proyecto de pruebas es `kmotmgpzmeooznyymcxl`; son proyectos distintos.

Las migraciones históricas `20261124005127_coronas_wallet_referrals_first_deposit` y `20261124005315_wallet_referral_summary_link_state` aparecen en el historial de producción. **Eso no significa que las reglas comerciales nuevas estén activas.** La inspección directa de las funciones mostró que producción sigue usando:

- Bono de primera recarga limitado a una base máxima de 10 USD.
- Comisión antigua del 0,7 % sobre la primera recarga del invitado, con base máxima de 10 USD y máximo 0,07 USD.
- Resumen de invitaciones antiguo, sin contador de paquetes recompensados por pedido.
- No existe todavía `private.wallet_referral_order_rewards` ni los disparadores de comisión por paquete entregado.

El SQL nuevo permanece como borrador en `docs/sql/CORONAS_RECOMPENSAS_REFERIDOS_BORRADOR.sql`; **no está aplicado a producción**.

La función Edge `central-one-order` está activa en producción como versión 24 y tiene la ruta autenticada `submit_wallet`. No se ha actualizado la función desplegada con las últimas correcciones de `rejected`.

## 5. Hallazgos de los rechazos y las devoluciones

En producción, `finish_central_one_order` aceptaba el estado `rejected`, pero dejaba el estado local anterior. La función Edge tampoco incluía `rejected` en su lista de estados reconocidos, por lo que lo convertía en `unknown`. Además, la RPC de devolución confirmada solo aceptaba `failed` y `cancelled`.

La rama ya incluye la corrección preparada:
- reconocer `rejected` en el envío y en la consulta posterior;
- pasar el estado real a la base de datos;
- establecer el estado local `rejected`;
- permitir devolución para ese estado únicamente si el proveedor ha confirmado explícitamente el reembolso;
- revertir una comisión de invitación si un pedido completado pasa luego a `failed`, `cancelled` o `rejected`, o si se registra un reembolso.

Esta corrección está escrita en el borrador SQL y en la Edge Function de la rama. **No se ha desplegado en Supabase de producción.**

## 6. Pruebas, infraestructura y seguridad

- GitHub Actions, ejecución 33 (run `45317332308`), commit `3f664a10b97d524280a02a43a774928ae89769d8`: terminó correctamente, **41 pruebas aprobadas, 0 fallidas**.
- Las comprobaciones estáticas de JavaScript incluyen el snapshot USD desde el producto, el bloqueo de una comisión si ya existe un reembolso y los permisos explícitos de las RPC. El resultado oficial de GitHub Actions para el último commit es 41/41.
- El proyecto Supabase de pruebas sigue sin ser una copia completa de producción. Para validar esta promoción se creó una base mínima de prueba con el esquema de wallet, pedidos, depósitos, comprobantes, invitaciones, cierre y devolución. Se preparó mediante migraciones exclusivas de pruebas; no se copiaron usuarios, saldos ni pedidos de producción.
- Migraciones exclusivas del entorno de pruebas: `staging_wallet_promotion_test_baseline`, `staging_coronas_first_recharge_and_package_referrals`, `staging_provider_order_refund_test_fields`, `staging_coronas_promotions_full_validated`, `staging_coronas_rpc_access_hardening`, `staging_wallet_usd_price_snapshot_trigger`, `staging_wallet_tables_lockdown` y `staging_wallet_foreign_key_indexes`. No aplicar esos archivos/nombres a producción.
- Las tablas auxiliares de wallet y productos del proyecto de pruebas tienen RLS activado y los privilegios directos para `anon` y `authenticated` revocados; el esquema de pruebas permanece cerrado para accesos del cliente. El asesor de seguridad ya no detecta tablas nuevas de `public` sin RLS. Los avisos `rls_enabled_no_policy` son INFO por el cierre intencional de tablas privadas/públicas del entorno de prueba.
- El asesor de rendimiento del entorno pequeño aún lista 3 claves foráneas de la tabla de reseñas sin índice y varios índices recién creados como no usados; no corresponden a fallos funcionales. No se borran índices automáticamente.
- La protección contra contraseñas filtradas permanece desactivada; requiere una activación manual desde el panel de Supabase.
- Pruebas reales ejecutadas en PostgreSQL del proyecto de pruebas y datos temporales limpiados:
  - Primera recarga de 20 USD: 0,60 Corona adicional; segunda recarga: 0; primera recarga de 100 USD: 3,00 Coronas, sin tope.
  - Paquete de 4 USD: 0,20 Corona por invitación; no se duplica por repetir la actualización del pedido.
  - Una entrega que pasa de `completed` a `rejected` revierte la comisión una sola vez.
  - Una devolución del pedido revierte la comisión; la RPC de devolución confirmada acredita al cliente una sola vez.
  - Un rechazo sin confirmación de reembolso no acredita saldo.
  - Un reembolso ya registrado bloquea una confirmación tardía y no genera comisión.
  - Los pedidos no completados no reciben comisión; el resumen devuelve 5 % y cuenta los pedidos premiados activos.
  - El bono de depósito no genera comisión para el invitador.
  - El trigger de snapshot sustituyó un valor falso enviado por el cliente (999) por el precio USD del producto (1,237 → 1,24).
- En el proyecto de pruebas se comprobaron los permisos: `finish_central_one_order` y `refund_wallet_order_after_provider_refund` solo son ejecutables por `service_role`; `admin_review_wallet_deposit` queda para `authenticated`, sin acceso de `anon`.
- El SQL de promociones sigue siendo un borrador en `docs/sql/CORONAS_RECOMPENSAS_REFERIDOS_BORRADOR.sql`; no se ha creado todavía el archivo formal mediante `supabase migration new`, porque Supabase CLI no está instalado y el intento con npx no pudo completarse.
- La auditoría de producción no encontró alertas de salud. La seguridad mostró un aviso informativo de tablas privadas con RLS sin políticas (acceso directo revocado intencionalmente) y una advertencia: la protección contra contraseñas filtradas está desactivada y debe activarse en Supabase Dashboard → Authentication → Security / Password protection.
- Rendimiento: hay índices no usados en una base aún pequeña; no se borran automáticamente.
- Producción no ha recibido estas funciones ni estas migraciones. Mantiene las antiguas reglas 3 % con base máxima de 10 USD y comisión 0,7 % sobre primera recarga. No se modificó su ledger: conserva un saldo histórico de 0,16 USD en movimientos y no se tocó.
- El proyecto público no se ha actualizado ni publicado. No se ha llamado al proveedor, no se han creado pedidos reales ni se ha consumido saldo.
 
## 7. Próximos pasos obligatorios antes de publicar

1. Confirmar la nueva ejecución de GitHub Actions después del commit que actualiza el SQL y las pruebas.
2. Instalar/usar Supabase CLI y crear una migración formal mediante `supabase migration new`; no renombrar ni reescribir migraciones históricas ya aplicadas.
3. Completar el esquema de pruebas para que refleje las tablas, RPC, autenticación, validación de jugador y comprobantes reales; probar todo el flujo de compra con wallet y métodos externos. La rama de SQL ya tiene pruebas de la lógica principal, pero la prueba integral de interfaz y almacenamiento de comprobantes sigue pendiente.
4. Revisar las firmas y permisos de las funciones con el estado final de producción, crear la migración oficial y aplicarla primero a un entorno de pruebas completo.
5. Desplegar la Edge Function revisada solo después de aplicar y verificar las RPC; después probar sin gastar saldo real (usar un proveedor de pruebas o simulación).
6. Recibir el PNG original de Canva del diseño «Icono oficial Coronas del Castillo» (128 × 128), optimizarlo para conexiones lentas y revisar wallet, perfil, navegación, checkout, promociones e historial en móvil.
7. Activar la protección contra contraseñas filtradas desde el panel de Supabase.
8. Mantener PR #40 en borrador y no unir ni publicar hasta completar migración formal, permisos, pruebas integrales e icono.

## 8. Restricción operativa que no se debe olvidar

No hacer compras reales de prueba ni consumir saldo de Central One para verificar el código. Cualquier pedido real de prueba o gasto requiere autorización específica del usuario. Las pruebas de SQL y de wallet deben realizarse en un entorno aislado, sin alterar saldos reales.

## 9. Referencias de trabajo

- PR #40: https://github.com/TiendaElCastillo/tiendaelcastillo.github.io/pull/40
- Borrador SQL: https://github.com/TiendaElCastillo/tiendaelcastillo.github.io/blob/feat/coronas-wallet-referrals/docs/sql/CORONAS_RECOMPENSAS_REFERIDOS_BORRADOR.sql
- Plan operativo: https://github.com/TiendaElCastillo/tiendaelcastillo.github.io/blob/feat/coronas-wallet-referrals/docs/PLAN_CORONAS_RECOMPENSAS_PARA_MANANA.md


## Registro adicional de validación — 24 de noviembre de 2026

- La corrección del estado `rejected`, el reembolso condicionado a confirmación del proveedor, la reversión de comisiones y sus pruebas quedó en el commit de código `6f2cec31b85d1d6fd2a1984243a7c5f1bd4fc6c8`.
- GitHub Actions, ejecución **33** (`45317332308`), terminó correctamente sobre el commit `3f664a10b97d524280a02a43a774928ae89769d8`: **41 pruebas aprobadas, 0 fallidas**.
- El proyecto de pruebas recibió escrituras solo para preparar el esquema sintético, ejecutar pruebas y cerrar las tablas auxiliares. Después de las pruebas se comprobó que no quedaran depósitos, movimientos, referidos, comisiones ni pedidos temporales. Producción no recibió escrituras.
- La rama y PR continúan en borrador; el código probado todavía no está unido a `main` ni desplegado en producción.
