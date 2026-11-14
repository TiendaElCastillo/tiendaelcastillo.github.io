# Modelo operativo de la billetera prepaga — Tienda El Castillo

**Fecha:** 14 de noviembre de 2026  
**Estado:** reglas aprobadas por el propietario; migración aplicada en Supabase, Edge Function `central-one-order` v21 activa y cambios de interfaz publicados en la rama `main`. La publicación visual de GitHub Pages no se pudo verificar desde este entorno.

## Propósito

La billetera prepaga es parte central del modelo comercial de Tienda El Castillo. No debe desactivarse ni eliminarse. Permite que el cliente adelante CUP, reciba saldo interno en USD y pague recargas de juegos sin volver a transferir por cada pedido.

La billetera de la tienda es un libro contable interno; no es una cuenta bancaria ni una wallet on-chain. El saldo mostrado representa una obligación de Tienda El Castillo frente al cliente.

## Flujo de depósito en CUP

1. El cliente inicia sesión y solicita un depósito en CUP.
2. El sistema calcula el crédito previsto usando la tasa configurada de `wallet_settings.cup_per_usd`.
3. Para la tasa actual de 1.160 CUP/USD:
   - 1.160 CUP acreditan 1,00 USD.
   - 2.320 CUP acreditan 2,00 USD.
   - Los importes se redondean hacia abajo a dos decimales; el tipo de cambio aplicado se guarda en la solicitud.
4. El cliente transfiere a la tarjeta de Tienda El Castillo, añade la referencia bancaria y el móvil remitente, y adjunta el comprobante.
5. El administrador comprueba que la transferencia llegó realmente a la tarjeta y que coinciden el importe, referencia, móvil y evidencia.
6. Solo después de confirmar la recepción se aprueba el depósito. La base de datos inserta un movimiento USD `deposit` y marca la solicitud como aprobada, todo en una sola transacción.
7. Una solicitud ya aprobada no puede acreditarse por segunda vez.

El comprobante y el número de transacción no prueban por sí solos que el dinero llegó. La confirmación debe hacerse en el banco o medio receptor.

## Compra con saldo de tienda

- El catálogo debe mostrar el precio de wallet equivalente al precio USDT del mismo producto.
- El cargo se guarda en USD y usa el valor `products.price_usdt`; no debe aplicar el precio CUP de transferencia ni el precio de saldo móvil.
- Antes de descontar, la RPC comprueba saldo suficiente y valida el producto.
- La misma clave de solicitud evita crear dos compras o descontar dos veces al reintentar por mala conexión.
- La compra crea un movimiento `purchase` negativo en el libro USD y un pedido `wallet` en una misma transacción.
- El saldo solo se considera consumido una vez que la operación contable y el pedido se han creado correctamente.
- La recarga todavía no se considera entregada cuando se crea el pedido. La entrega se confirma solamente cuando Central One informa el estado final correspondiente.

## Financiación de Central One

Los CUP recibidos no se convierten automáticamente en USDT. El propietario compra USDT por su cuenta y recarga manualmente el saldo prepago de Central One. La API de Central One se utiliza para consultar catálogo, comprobar disponibilidad/coste/saldo y enviar/seguir órdenes.

La tienda no debe prometer que los depósitos CUP compran USDT automáticamente. El proceso actual es:
- recibir y verificar CUP;
- acreditar el saldo interno USD;
- convertir/liquidar CUP a USDT por parte del propietario;
- financiar Central One;
- autorizar pedidos con comprobación previa de saldo y rentabilidad.

El saldo interno de clientes y el saldo mayorista de Central One son dos saldos distintos y deben conciliarse.

## Reembolsos

### Orden no creada en Central One
El administrador puede devolver el saldo de una compra de wallet solo cuando la base de datos demuestra que no existe una orden del proveedor:
- no hay ID ni referencia del proveedor;
- la orden nunca se envió, o Central One bloqueó/rechazó definitivamente antes de crearla;
- existe el débito original `purchase` por el importe exacto.

La devolución se registra como `refund` en el libro USD, se cancela el pedido y se guarda el resultado en el propio pedido. La operación es idempotente: repetir la acción devuelve el movimiento existente, no crea otro.

No se permite devolver automáticamente un pedido con resultado incierto, con orden del proveedor registrada, con referencia de proveedor o que siga en procesamiento.

### Orden sí creada en Central One
Cuando existe una orden del proveedor, la billetera solo se acredita después de que Central One confirma el fallo/cancelación y el reembolso efectivo al proveedor. El sistema valida el ID del proveedor, el estado, el débito original y la confirmación de devolución. El movimiento `refund` se registra una sola vez.

Si Central One todavía no ha confirmado el reembolso, la billetera no se acredita. El administrador debe revisar el estado y resolver la incidencia. No se debe reembolsar por adelantado dinero que el proveedor todavía no devolvió.

### Pago externo directo
Si el cliente pagó por transferencia CUP, saldo móvil o USDT directamente para un pedido, un fallo del proveedor requiere devolución externa al cliente. No debe acreditarse automáticamente a la billetera salvo que se implemente y apruebe explícitamente una conversión de pago externo a saldo interno.

## Reglas contables

El libro `wallet_transactions` es la fuente de verdad del saldo:
- `deposit`: crédito por depósito aprobado.
- `purchase`: débito por compra.
- `refund`: crédito por devolución legítima.
- `adjustment`: corrección administrativa controlada.

Nunca editar el saldo mostrado ni escribir un valor total en un campo editable. El saldo se calcula sumando movimientos. Las operaciones financieras deben ocurrir en funciones/RPC transaccionales con permisos de administrador o service role y restricciones RLS.

## Controles de conciliación pendientes

Antes de abrir con volumen:
1. Conciliar diariamente el total de depósitos CUP aprobados, compras USD, reembolsos USD y ajustes.
2. Mantener un registro de CUP recibidos, tasa de compra real de USDT, comisiones/spread, USDT comprado y cada recarga del saldo de Central One.
3. Comparar la suma de saldos USD disponibles de clientes con el saldo mayorista real de Central One, USDT en tránsito y reservas necesarias para pedidos pendientes.
4. No permitir que el negocio use el mismo dinero dos veces: los fondos recibidos que respaldan saldos de clientes no son beneficio libre.
5. Actualizar la tasa CUP/USD antes de nuevos depósitos cuando cambie el coste real de adquirir USDT. Los depósitos anteriores conservan la tasa que se guardó al solicitarlos.
6. Establecer límites diarios de depósito, alertas de bajo saldo del proveedor y un procedimiento para interrupciones de Central One.

## Restricciones de lanzamiento

- No realizar compras reales de prueba con dinero de clientes.
- Verificar los pagos desde la cuenta receptora, nunca solo desde una captura.
- No acreditar depósito pendiente/rechazado.
- No emitir reembolso de una orden de proveedor con resultado incierto.
- No volver a cobrar al cliente por reintentos de la misma orden.
- No cambiar precios o tasas retroactivamente sobre depósitos ya solicitados/aprobados.
