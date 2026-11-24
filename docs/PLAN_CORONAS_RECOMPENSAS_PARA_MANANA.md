# Plan operativo — Coronas, invitaciones y wallet

**Última actualización:** 24 de noviembre de 2026  
**Memoria técnica permanente:** [ESTADO_TECNICO_CORONAS_WALLET.md](./ESTADO_TECNICO_CORONAS_WALLET.md)  
**Rama:** `feat/coronas-wallet-referrals` · **PR #40:** https://github.com/TiendaElCastillo/tiendaelcastillo.github.io/pull/40  
**Estado:** cambios no unidos a `main`; la web pública continúa con la versión anterior.

## Reglas comerciales que no se deben cambiar

- 1 Corona = 1 USD. El ledger continúa usando USD internamente.
- Primera recarga de wallet aprobada manualmente: 3 % extra sobre el importe completo, sin tope.
- Invitador: 5 % del equivalente USD de cada paquete del amigo, solo después de que el estado local y el proveedor confirmen `completed`.
- No hay comisión por depósitos, pedidos pendientes, rechazados, fallidos o cancelados.
- Una comisión por pedido; si la entrega se revierte o se devuelve, se descuenta una sola vez.
- Un solo invitador por cuenta, sin autorreferidos; el código se vincula dentro de los primeros 7 días y antes de solicitar la primera recarga.
- El 10 % incluido en los paquetes participantes de Free Fire ya forma parte del paquete; no sumarlo como regalo nuevo.
- No publicar nunca el nombre del proveedor externo en la interfaz de clientes.

## Hecho y verificado en la rama / pruebas

- [x] Interfaz de wallet, checkout, promociones, compartir y guías actualizada a Coronas y equivalencia 1:1.
- [x] Promoción visual de 3 % de primera recarga sin límite.
- [x] Invitación de 5 % por cada paquete entregado.
- [x] El ledger mantiene compatibilidad con los movimientos anteriores y su unidad USD.
- [x] Se conserva la clave interna antigua del método de pago de wallet.
- [x] Caché del sitio en `shell-v184`.
- [x] SQL de promociones actualizado con tabla privada única por pedido, controles de duplicados, reversión, bloqueo de comisiones después de un reembolso y permisos específicos.
- [x] Preparado el estado local `rejected` y devolución solo con confirmación explícita del proveedor.
- [x] Snapshot USD fijado en el servidor desde `products.price_usdt`; el navegador no decide la base del 5 %.
- [x] En Supabase de pruebas se creó un esquema mínimo aislado para wallet, depósitos, referidos, pedidos y devoluciones. No es una copia completa de producción.
- [x] Pruebas PostgreSQL superadas: 20 USD → 0,60 Corona; 100 USD → 3 Coronas; segunda recarga → 0; pedido 4 USD → 0,20 Corona; duplicados bloqueados; reversión por rechazo y devolución; rechazo sin reembolso confirmado sin abono; reembolso previo bloquea comisión tardía; snapshot falso 999 sustituido por 1,24 USD.
- [x] Permisos revisados en pruebas: cierre y devolución de proveedor solo `service_role`; revisión de depósitos solo `authenticated`.
- [x] Los datos temporales de prueba se limpiaron. Se verificó que quedaron 0 movimientos, depósitos, referidos, comisiones ni pedidos de prueba.
- [x] Tablas auxiliares públicas del proyecto de pruebas cerradas con RLS; permisos directos `anon` y `authenticated` revocados.
- [x] Índices añadidos a las nuevas claves foráneas del esquema de pruebas; las únicas referencias sin índice que siguen apareciendo son de la tabla existente de reseñas, más antigua.
- [x] GitHub Actions en el último commit: ejecución 34, 41 pruebas aprobadas y 0 fallidas (`https://github.com/TiendaElCastillo/tiendaelcastillo.github.io/actions/runs/45317332308`).
- [x] Ningún saldo, depósito, pedido ni función de producción fue alterado; no se consumió saldo del proveedor.
- [x] Memoria técnica actualizada en `docs/ESTADO_TECNICO_CORONAS_WALLET.md`.

## Pendiente antes de activar o publicar

- [x] Comprobar GitHub Actions: el último commit tiene 41 pruebas aprobadas y 0 fallidas.
- [ ] Crear una migración formal con Supabase CLI (`supabase migration new`). El CLI no está disponible en el entorno actual; el archivo en `docs/sql` sigue siendo borrador validado en pruebas, no una migración formal ni producción.
- [ ] Completar una copia de pruebas con el esquema real, autenticación, validación de jugador y almacenamiento de comprobantes; revisar el flujo integral desde checkout hasta entrega sin gastar saldo del proveedor. El esquema sintético actual solo valida la lógica SQL principal.
- [ ] Aplicar la migración formal en pruebas completas y verificar permisos, datos y resultados antes de modificar producción.
- [ ] Desplegar la Edge Function revisada solo después de las RPC y migraciones.
- [ ] Recibir el PNG original de Canva «Icono oficial Coronas del Castillo» (128 × 128); reemplazar el SVG provisional y revisar todos los puntos de wallet en móvil.
- [ ] Activar la protección contra contraseñas filtradas desde Supabase Dashboard → Authentication → Security.
- [ ] Mantener la PR #40 como borrador; no unir ni publicar hasta completar lo anterior.

## Separación de entornos

- **Producción:** sigue usando la antigua comisión 0,7 % sobre la primera recarga y el bono de 3 % limitado a 10 USD de base. No se ha aplicado la nueva regla.
- **Pruebas:** contiene migraciones auxiliares de validación que solo pertenecen al proyecto de pruebas; no copiarlas a producción.
- **Web pública:** no se ha publicado ninguno de estos cambios.
- **Proveedor externo:** no se han creado pedidos ni consumido saldo para probar.

