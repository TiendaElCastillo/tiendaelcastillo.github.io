# Plan operativo — terminar Coronas, invitaciones y wallet

**Última actualización:** 24 de noviembre de 2026  
**Memoria técnica permanente:** [ESTADO_TECNICO_CORONAS_WALLET.md](./ESTADO_TECNICO_CORONAS_WALLET.md)  
**Rama:** `feat/coronas-wallet-referrals` · **PR #40:** https://github.com/TiendaElCastillo/tiendaelcastillo.github.io/pull/40

## Reglas acordadas

- 1 Corona = 1 USD; la contabilidad interna de Supabase sigue en USD.
- Primera recarga aprobada: 3 % extra sobre el importe completo, sin tope.
- Invitador: 5 % del valor USD de cada paquete de su amigo, solo después de que el proveedor y el pedido local confirmen la entrega.
- No hay comisión por depósitos ni por pedidos pendientes, rechazados, fallidos o cancelados. La comisión es única por pedido y se revierte ante devolución/reversión.
- Los códigos solo se vinculan a cuentas nuevas (primeros 7 días), antes de solicitar la primera recarga; no hay autorreferidos ni cambio de invitador.
- El 10 % incluido en determinados paquetes Free Fire no se suma ni se presenta como una promoción adicional.

## Avances guardados en PR #40

- [x] Interfaz de wallet, checkout, promociones y guías actualizadas a Coronas y equivalencia 1:1.
- [x] Bono visual de primera recarga actualizado a 3 % sin límite.
- [x] Invitaciones visuales actualizadas a 5 % por paquete entregado.
- [x] Se conserva la clave interna histórica del método de wallet para no romper pedidos previos.
- [x] Caché móvil en `shell-v184`.
- [x] Corrección preparada para reconocer los estados `rejected` en el envío y refresco del proveedor.
- [x] Reembolso en caso de rechazo preparado para ejecutarse solo con confirmación explícita del proveedor.
- [x] Reversión de la comisión del invitador preparada para `failed`, `cancelled`, `rejected` y devolución.
- [x] Pruebas de regresión añadidas para rechazos y reembolsos confirmados.
- [x] Memoria técnica persistente creada en `docs/ESTADO_TECNICO_CORONAS_WALLET.md`.

## Estado real de los entornos

- Producción Supabase está activa. Tiene aplicadas las migraciones históricas de la primera versión de Coronas, pero sus funciones activas todavía aplican 3 % con base máxima de 10 USD y 0,7 % por primera recarga invitada. La tabla nueva de comisiones por pedido entregado no existe en producción.
- La función `central-one-order` desplegada en producción sigue en versión 24; la corrección de estado `rejected` está únicamente en la rama GitHub.
- El proyecto Supabase de pruebas no tiene el esquema completo de wallet, depósitos, comprobantes y referidos. No está listo para validar esta migración.
- La revisión de asesores no encontró alertas de salud. Queda pendiente activar en el panel Auth la protección contra contraseñas filtradas. Los índices marcados como no utilizados no se borrarán automáticamente.
- El entorno disponible no tiene Supabase CLI. No existe todavía una migración nueva formal creada mediante `supabase migration new`; el SQL actualizado continúa siendo un borrador revisable, no una migración aplicada.
- [x] GitHub Actions, ejecución 31 (commit de código `6f2cec31b85d1d6fd2a1984243a7c5f1bd4fc6c8`): **39 pruebas aprobadas, 0 fallidas**. El fallo de la ejecución 30 fue una expectativa obsoleta de una prueba y quedó corregido.
- El icono SVG actual es provisional; falta recibir el PNG original de Canva y hacer revisión visual móvil.

## Pendientes obligatorios antes de publicar

- [ ] Crear o completar un proyecto de pruebas con el esquema real de producción, sin modificar datos reales.
- [ ] Instalar/usar Supabase CLI y crear una migración formal con `supabase migration new`; revisar firmas, funciones, privilegios, triggers y dependencias contra producción.
- [ ] Probar en pruebas: 20 USD → 0,60 Corona; 100 USD → 3,00 Coronas; paquete 4 USD → 0,20 Corona; dos paquetes entregados → 0,40 Coronas.
- [ ] Verificar cero comisión por depósitos/pedidos pendientes, duplicación bloqueada, no autorreferido, códigos expirados y un solo invitador por cuenta.
- [ ] Probar cambios de completado a fallido/cancelado/rechazado, devolución confirmada y rechazo sin devolución confirmada. No se debe acreditar automáticamente si el proveedor no confirma el reembolso.
- [ ] Ejecutar GitHub Actions en el último commit y ejecutar asesores Supabase tras aplicar la migración al entorno de pruebas.
- [ ] Desplegar la Edge Function revisada solo después de verificar que las RPC correspondientes estén aplicadas y probadas.
- [ ] Recibir el PNG oficial del diseño «Icono oficial Coronas del Castillo» (Canva), optimizarlo y revisar wallet, perfil, menú, checkout, promociones e historial en un móvil.
- [ ] Activar la protección contra contraseñas filtradas desde Supabase Dashboard → Authentication → Security / Password protection.
- [ ] Mantener PR #40 en borrador hasta completar todas las validaciones. No unir ni publicar aún.

## Seguridad operativa

**No consumir saldo del proveedor ni crear pedidos reales para probar.** La prueba de compra automática debe hacerse en un entorno de pruebas aislado. Cualquier gasto o compra real necesita autorización específica. No se han realizado compras ni consumido saldo en esta revisión.

