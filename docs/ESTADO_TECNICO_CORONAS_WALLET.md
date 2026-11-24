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

- GitHub Actions ejecutó el flujo «Pruebas de fiabilidad de la tienda» (ejecución 25) y terminó correctamente antes de las últimas correcciones de rechazo. Hay que confirmar la ejecución posterior al último commit de esta rama.
- El arnés aislado anterior pasó 38/38 comprobaciones, pero no sustituye a GitHub Actions ni a una prueba completa de Supabase.
- El proyecto Supabase de pruebas no tiene el esquema completo de la tienda: solo aparecen tablas de perfiles, pedidos de prueba simplificados y reseñas. Faltan las tablas de wallet, depósitos, comprobantes y referidos; no sirve todavía para probar esta migración.
- La auditoría de asesores de producción no encontró avisos de salud. Seguridad: hay un aviso informativo por tablas privadas con RLS sin políticas (el acceso está revocado, por lo que es intencional) y una advertencia porque la protección contra contraseñas filtradas está desactivada. Esta última se activa manualmente en Supabase Dashboard, en Authentication → Security / Password protection.
- Rendimiento: solo se listaron índices sin uso en esta base de datos todavía pequeña; no eliminarlos automáticamente.
- El entorno de trabajo no tiene instalado Supabase CLI. No se ha creado aún una migración formal con `supabase migration new`. No inventar un nombre de migración ni reescribir archivos de migraciones ya aplicadas.
- No se ha ejecutado SQL de escritura durante esta auditoría, no se han creado pedidos en el proveedor y no se ha consumido saldo de proveedor.

## 7. Próximos pasos obligatorios antes de publicar

1. Preparar un entorno de pruebas completo, con el esquema real de wallet, pedidos, validación de jugador y reembolsos.
2. Instalar/usar Supabase CLI y crear la migración formal mediante `supabase migration new`; revisar la firma y las dependencias contra producción. Incluir la nueva tabla, funciones, permisos y disparadores, junto con la corrección del estado `rejected`.
3. Probar en pruebas la primera recarga 3 % sin tope (20 USD → 0,60 Corona; 100 USD → 3,00 Coronas), el 5 % por pedido entregado (4 USD → 0,20 Corona), varios pedidos del mismo invitado, no duplicación, devolución, reversión, rechazo sin reembolso confirmado y rechazo con devolución confirmada.
4. Ejecutar GitHub Actions después de los cambios y los asesores de Supabase después de la migración.
5. Desplegar la Edge Function revisada solo después de tener las RPC correspondientes aplicadas y comprobadas en pruebas.
6. Recibir el PNG oficial de Canva, optimizarlo para conexiones lentas y revisar wallet, perfil, navegación, checkout, promociones y movimientos en móvil.
7. Activar la protección contra contraseñas filtradas en el panel de Supabase.
8. Mantener PR #40 como borrador hasta terminar lo anterior. No unir ni publicar mientras las pruebas integrales y la migración sigan pendientes.

## 8. Restricción operativa que no se debe olvidar

No hacer compras reales de prueba ni consumir saldo de Central One para verificar el código. Cualquier pedido real de prueba o gasto requiere autorización específica del usuario. Las pruebas de SQL y de wallet deben realizarse en un entorno aislado, sin alterar saldos reales.

## 9. Referencias de trabajo

- PR #40: https://github.com/TiendaElCastillo/tiendaelcastillo.github.io/pull/40
- Borrador SQL: https://github.com/TiendaElCastillo/tiendaelcastillo.github.io/blob/feat/coronas-wallet-referrals/docs/sql/CORONAS_RECOMPENSAS_REFERIDOS_BORRADOR.sql
- Plan operativo: https://github.com/TiendaElCastillo/tiendaelcastillo.github.io/blob/feat/coronas-wallet-referrals/docs/PLAN_CORONAS_RECOMPENSAS_PARA_MANANA.md


## Registro adicional de validación — 24 de noviembre de 2026

- La corrección del estado `rejected`, el reembolso condicionado a confirmación del proveedor, la reversión de comisiones y sus pruebas quedó en el commit de código `6f2cec31b85d1d6fd2a1984243a7c5f1bd4fc6c8`.
- GitHub Actions, ejecución **31** (`45316625583`), terminó correctamente: **39 pruebas aprobadas, 0 fallidas**. La ejecución anterior falló únicamente porque una prueba antigua seguía esperando la lista de estados sin `rejected`; esa expectativa se actualizó y la nueva ejecución pasó.
- El PR continúa en borrador. El código probado todavía no está unido a `main` ni desplegado en producción.
