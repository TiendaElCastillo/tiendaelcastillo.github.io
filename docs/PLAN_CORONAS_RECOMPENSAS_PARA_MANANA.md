# Pendientes de Coronas, invitaciones y wallet — preparar para mañana

## Reglas nuevas acordadas
- **1 Corona = 1 USD**. La base de datos conserva USD como unidad contable; el cliente ve Coronas.
- **Primera recarga aprobada:** acreditar un 3 % adicional sobre todo el importe de la primera recarga, sin tope. Solo al aprobar manualmente el pago.
- **Invitaciones:** el usuario que invita gana el 5 % del valor USD del paquete de su amigo, convertido a Coronas, **por cada paquete que el proveedor confirme como entregado**. No se paga por depósitos ni por pedidos pendientes, rechazados, cancelados o fallidos.
- No pagarse a sí mismo, un solo código por cuenta, solo cuentas nuevas (máximo 7 días desde el alta) y antes de la primera recarga; una invitación por cuenta.
- Si una entrega que ya había generado comisión se devuelve o se revierte, se revierte también la comisión del invitador una sola vez.
- El 10 % que ya viene incluido en determinados paquetes de Free Fire no se vuelve a anunciar ni a acreditar como un bono adicional.

## Qué ya existía
- PR #40 ya contiene códigos de invitación, límite de elegibilidad, bono del 3 % (antes con tope de 10 USD), comisión de invitación (antes 0,7 % de la primera recarga, con tope) y la ruta de compra automática con Coronas.
- En Supabase de producción ya existen las tablas privadas de invitaciones y el campo del bono de primera recarga. La auditoría no encontró códigos, invitaciones ni bonos históricos.
- La función `central-one-order` está desplegada como versión 24 con la ruta autenticada `submit_wallet`. No se hizo una compra real de prueba y no se debe afirmar que el flujo completo está validado.
- El icono SVG actual es provisional. Sustituirlo por el PNG original de Canva cuando Enrique lo envíe.

## Preparación técnica
- La comisión del 5 % se registra por pedido y con índice único por pedido.
- Solo se acredita después de `central_one_status = completed` y `orders.status = completed`, con ID de pedido real del proveedor y pago confirmado.
- La base de cálculo es `orders.wallet_refund_amount`, instantánea USD del valor del paquete al crearse el pedido; no se calcula con el precio de catálogo posterior ni con el importe CUP.
- Hay borrador SQL separado en `docs/sql/CORONAS_RECOMPENSAS_REFERIDOS_BORRADOR.sql`. No es una migración ejecutable todavía; convertirlo con `supabase migration new` y revisarlo antes de aplicarlo.
- Las tablas de códigos e invitaciones permanecen privadas, con RLS y sin permisos directos para el cliente.
- Los débitos/reembolsos siguen usando la cartera contable USD. No se tocará el saldo del proveedor durante pruebas.

## Lista de mañana
- [ ] Recibir el PNG exportado desde Canva del diseño **«Icono oficial Coronas del Castillo»**.
- [ ] Sustituir el SVG provisional por el recurso original en la wallet, perfil, navegación, checkout, tarjetas promocionales y movimientos; revisar peso del archivo para Cuba.
- [x] Actualizar en la rama de PR #40 el texto de bienvenida 3 % sin límite, invitaciones 5 % por paquete entregado, resumen de Coronas, textos para compartir y guías públicas. Falta la revisión visual con el PNG de Canva.
- [ ] Crear la migración con Supabase CLI desde el nombre generado por `supabase migration new`; comparar con el esquema real de producción y probar primero en un entorno de pruebas completo. En producción aún sigue desplegada la función resumen antigua que muestra 0,7 % y tope; el borrador nuevo aún no se ha aplicado.
- [ ] Probar cálculo 3 % sin límite: por ejemplo, 20 USD → 0,60 Corona extra; 100 USD → 3,00 Coronas extra.
- [ ] Probar comisión 5 % por pedido entregado: paquete 4,00 USD → 0,20 Corona; dos pedidos entregados del mismo amigo → 0,40 Coronas en total.
- [ ] Comprobar que pedidos pendientes, rechazados, cancelados o fallidos no pagan comisión; un pedido repetido no paga dos veces; una devolución revierte una sola vez la comisión.
- [ ] Comprobar autorreferidos, códigos vencidos, código ya utilizado, cuenta con primer depósito y reintentos de conexión.
- [x] Revisar sintaxis de los scripts principales y actualizar la versión de caché a shell-v184.
- [ ] Reejecutar GitHub Actions y confirmar todas las pruebas; la ejecución visible anterior falló porque aún esperaba la equivalencia antigua y el 0,7 %, y esas aserciones ya se corrigieron.
- [ ] Revisar la versión móvil y ejecutar los asesores de seguridad y rendimiento de Supabase.
- [ ] No publicar ni unir PR #40 a `main` hasta terminar las comprobaciones. No hacer compras de prueba en producción ni usar saldo de Central One sin una autorización específica para una prueba real.

## Estado de publicación
Los cambios preparados siguen en la rama `feat/coronas-wallet-referrals` y PR #40 continúa abierto. No se han publicado estos cambios nuevos en la web ni se ha aplicado el nuevo borrador SQL.
