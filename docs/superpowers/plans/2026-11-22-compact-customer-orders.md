# Pedidos compactos con vista de detalle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Convertir «Mis pedidos» en una lista agrupada y compacta que abre el detalle completo de un pedido sin cambiar sus procesos.

**Architecture:** Añadir un pequeño módulo de presentación sin dependencias que agrupe los pedidos por día y renderice cada resumen con escape de HTML. La página principal conservará la consulta actual a Supabase y la lógica de seguimiento; solo separará la lista del panel de detalle y moverá allí la información y las acciones actuales.

**Tech Stack:** HTML, CSS y JavaScript existentes; pruebas con Node.js integrado (`node:test`), sin paquetes nuevos.

**Spec:** `docs/superpowers/specs/2026-11-22-compact-customer-orders-design.md`

## Global Constraints
- No modificar Supabase, tablas, políticas, funciones RPC, almacenamiento ni datos de clientes.
- No cambiar precios, métodos de pago, wallet, proveedor, autorización ni transiciones de estado.
- Mantener todas las acciones actuales de comprobante faltante y cancelación con sus condiciones vigentes.
- Mantener la página móvil ligera, el lenguaje español y el diseño azul/blanco.
- Trabajar en `feat/compact-customer-orders`; no escribir directamente en `main`.

## Review Focus
- Datos del jugador con caracteres HTML: el resumen y el detalle deben seguir escapándolos.
- Pedido con pago desde wallet: el importe debe seguir mostrándose en USD solo en el detalle.
- Pedido directo sin comprobante: el formulario debe seguir disponible en el detalle y asociado al mismo pedido.
- Pedido incompleto cancelable: la acción debe seguir apareciendo solo si cumple todas las condiciones existentes.
- Actualización mientras el detalle está abierto: refrescar el detalle sin devolver inesperadamente al cliente a la lista.

---

### Task 1: Módulo de resumen de pedidos y pruebas

**Files:**
- Create: `assets/customer-orders-view.js`
- Test: `tests/customer-orders-view.test.cjs`

**Interfaces:**
- Produce `window.CustomerOrdersView.groupByDay(orders, locale)`, que devuelve grupos en el orden recibido con `key`, `label` y `orders`.
- Produce `window.CustomerOrdersView.renderSummary(order, options)`, que devuelve una fila HTML accesible y compacta; `options` aporta `statusLabel` y `amountLabel`.
- Produce `window.CustomerOrdersView.statusClass(status)` para clases visuales seguras según estado y `shortStatusLabel(status)` para etiquetas breves en la lista.

- [x] **Step 1: Escribir pruebas que fallen primero**
  - `groupByDay` agrupa por día local y conserva el orden de los pedidos.
  - `renderSummary` muestra juego, paquete, folio, fecha, cuenta, importe y estado, pero no expone `player_id`, `proof_path` ni el método de pago completo.
  - `renderSummary` escapa texto no confiable de los datos del pedido.
  - `statusClass` asigna clases para completado, revisión, proceso, rechazo/fallo y cancelación.
  - `shortStatusLabel` resume los estados largos en etiquetas compactas.

- [x] **Step 2: Ejecutar las pruebas y comprobar que fallan**
  - Run: `node --test tests/customer-orders-view.test.cjs`
  - Expected: FAIL por la ausencia de `assets/customer-orders-view.js`.

- [x] **Step 3: Implementar el módulo**
  - Añadir solo funciones puras de agrupación, escape, resumen y clase de estado; sin dependencias externas ni acceso a Supabase.

- [x] **Step 4: Ejecutar las pruebas**
  - Run: `node --test tests/customer-orders-view.test.cjs`
  - Expected: PASS en todos los casos.

- [x] **Step 5: Commit**
  - Commit: `feat: add compact customer order summaries`

### Task 2: Integrar lista compacta y pantalla de detalle

**Files:**
- Modify: `index.html`
- Modify: `tests/customer-orders-view.test.cjs` only if integration assertions are needed.

**Interfaces:**
- Consume `window.CustomerOrdersView` from Task 1.
- `openCustomerOrderDetail(orderId)` abre el pedido del caché actual y renderiza el mismo detalle completo que existía antes.
- `closeCustomerOrderDetail()` regresa a la lista y detiene el reloj del detalle.
- `loadMyOrders()` conserva su consulta, estadísticas, notificaciones y condiciones de acciones; renderiza la lista agrupada y actualiza el detalle si ya estaba abierto.

- [x] **Step 1: Modificar el HTML de «Mis pedidos»**
  - Mantener `#myorders` como contenedor estable.
  - Añadir `#myordersList` para los resúmenes y `#myorderDetailView` + `#myorderDetailContent` para el detalle.

- [x] **Step 2: Añadir estilos compactos y adaptables**
  - Mostrar título, estado, folio/fecha, nombre de jugador, importe y una indicación de apertura.
  - Agrupar por fecha con contador de pedidos.
  - Dar foco visible y objetivos táctiles adecuados; no añadir imágenes ni recursos externos.

- [x] **Step 3: Separar el renderizado en la lógica existente**
  - Guardar en memoria los pedidos y eventos ya consultados.
  - Renderizar la lista con `CustomerOrdersView`.
  - Mover el marcado actual de cada pedido a `renderCustomerOrderDetailHtml` sin alterar sus condiciones ni mensajes.
  - Delegar los clics de abrir/volver desde `#myorders`.
  - Volver a asociar los manejadores de comprobante/cancelación y el reloj al contenido del detalle después de cada renderizado.

- [x] **Step 4: Verificar**
  - Run: `node --test tests/customer-orders-view.test.cjs`
  - Run: `node --check assets/customer-orders-view.js`
  - Compilación de los 3 scripts incrustados de `index.html` en el entorno de verificación: 0 errores.
  - Revisar el diff para confirmar que no cambian consultas, RPC, columnas ni condiciones de autorización/pago.

- [x] **Step 5: Commit**
  - Commit: `feat: add compact customer order detail view`

### Final review
- Revisar el diff completo frente a la especificación.
- Corregir cualquier hallazgo crítico o importante con una prueba primero.
- Entregar una solicitud de cambios hacia `main`; no fusionarla automáticamente.
