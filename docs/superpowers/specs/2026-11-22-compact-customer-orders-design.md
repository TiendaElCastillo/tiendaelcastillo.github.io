# Pedidos compactos con vista de detalle — diseño

## Objetivo
Hacer que «Mis pedidos» sea una lista breve y fácil de recorrer en móviles: cada pedido muestra solo el juego y paquete, folio, fecha, cuenta destinataria, importe y estado. Al tocar una fila se abre una vista propia con los detalles y el seguimiento completos.

## Experiencia acordada
- Agrupar pedidos por fecha, de más recientes a más antiguos.
- Cada fila será un botón accesible y compacto; no mostrará el ID de jugador completo, los datos extensos del pago ni el historial de estados.
- Al abrir un pedido, mostrar una cabecera con «Volver a mis pedidos» y todos los datos que hoy se muestran: cuenta, ID, región cuando exista, método e importe, fecha, progreso, avisos, motivo de rechazo y estado de entrega.
- Mantener dentro del detalle las acciones ya existentes para completar un comprobante faltante o cancelar un pedido incompleto, siempre bajo sus condiciones actuales.
- Al regresar, conservar la lista; al actualizar pedidos, si el detalle estaba abierto, refrescarlo con los datos nuevos.
- Mantener el diseño visual actual azul/blanco, accesible y ligero para conexiones móviles lentas.

## Enfoques considerados
1. Contraer cada pedido en un acordeón dentro de la lista: simple, pero al abrir varios pedidos la lista vuelve a crecer y es fácil perder el contexto.
2. Resumen compacto + vista independiente de detalle dentro de «Mis pedidos»: elegido porque mantiene la lista corta y ofrece un lugar amplio para el seguimiento.
3. Navegación a una URL nueva por pedido: más compleja y no aporta valor suficiente en esta aplicación de una sola página.

## Límites
- No modificar Supabase, tablas, políticas, funciones RPC ni almacenamiento.
- No cambiar pagos, precios, wallet, autorizaciones, estados ni comunicación con el proveedor.
- No quitar datos ni acciones existentes; solo trasladar su presentación a la pantalla de detalle.
- No añadir imágenes pesadas ni dependencias externas.
- No publicar directamente en `main`; entregar mediante una solicitud de revisión.
