# Plan de expansión de juegos — Tienda El Castillo

**Fecha de auditoría:** 14 de noviembre de 2026  
**Repositorio:** `TiendaElCastillo/tiendaelcastillo.github.io`  
**Rama:** `main`  
**Versión de referencia:** commit `2eba972892c0045d77b666f1a05e77ad972fdf93`

## Decisiones del propietario

- Público objetivo: jugadores de Cuba.
- Prioridad: incorporar juegos nuevos.
- Meta gradual: aproximadamente 10–15 juegos en total.
- Los juegos y paquetes que ya están publicados quedan congelados durante esta expansión. No se agregan denominaciones ni se cambian nombres, precios, orden, disponibilidad o configuración de los paquetes actuales salvo petición expresa del propietario.
- La incorporación será de un juego a la vez. Cada nuevo juego debe quedar integrado, probado y visualmente refinado antes de avanzar al siguiente.
- El primer objetivo solicitado es Call of Duty Mobile, pero solo si Central One ofrece una región compatible con las cuentas de jugadores cubanos. No se publicará una variante regional incompatible.
- Mantener el desarrollo con herramientas y planes gratuitos. No contratar alojamiento, suscripciones ni servicios adicionales.
- No gastar saldo real de Central One en pedidos de prueba sin autorización expresa.

## Estado técnico revisado

### Repositorio y funciones

- El panel de administración ya tiene la acción **Cargar catálogo**, que consulta Central One en modo de solo lectura y guarda el resultado en `public.central_one_catalog_snapshots`.
- `central-one-read` valida la sesión y el rol de administrador antes de consultar el catálogo.
- `central-one-sync` consulta el catálogo y la cobertura de validación, pero la sincronización de productos está limitada a funciones específicas de Free Fire, Mobile Legends y Blood Strike.
- La validación y el formulario web aceptan actualmente un identificador de jugador de un solo campo (`player_id` o `game_user_id)); el caso especial de dos campos solo está implementado para Mobile Legends. No se debe asumir que otros esquemas con servidor desplegable o campos adicionales funcionarán.
- La tabla `public.products` ya contiene columnas para SKU, región, coste mayorista, estado, disponibilidad, campos y esquema del objetivo de recarga, y bandera de compatibilidad de validación.

### Catálogo histórico

La última copia completa localizada en la base de datos fue obtenida el **9 de noviembre de 2026** y contenía 8.006 productos. Es un dato histórico; no sirve por sí solo para publicar hoy. La sincronización automática más reciente del 14 de noviembre guarda solo una selección de los juegos actuales, no todo el catálogo.

En esa copia completa, las siguientes familias tenían productos de recarga activos y con stock:

| Juego | Región de proveedor | Productos activos con stock en la copia |
|---|---|---:|
| PUBG Mobile | GLOBAL | 29 |
| Arena Breakout | GLOBAL | 27 |
| Honor of Kings | GLOBAL | 32 |
| EA FC Mobile | GLOBAL | 14 |
| 8 Ball Pool | GLOBAL | 13 |
| Stumble Guys | GLOBAL | 6 |
| Rainbow Six Mobile | GLOBAL | 21 |
| Racing Master | LATAM | 21 |
| Pixel Gun 3D | GLOBAL | 36 |
| Bleach: Soul Resonance | AMERICAS | 23 |
| Wuthering Waves | GLOBAL | 14 |

Los conteos y regiones anteriores describen únicamente la copia del 9 de noviembre. Deben volver a comprobarse contra el catálogo actual de la cuenta y las reglas regionales aplicables antes de cualquier publicación.

### Cobertura de validación más reciente

La última copia compacta de sincronización guardó 506 entradas de cobertura de validación, con fecha **14 de noviembre de 2026 a las 21:30 UTC**. Entre los nuevos juegos, solo aparecieron:

| Juego | Región | Productos presentes en cobertura |
|---|---|---:|
| Arena Breakout | GLOBAL | 27 |
| PUBG Mobile | GLOBAL | 29 |

Las entradas de estos dos juegos usan un único campo de identificador `game_user_id`, compatible con la forma básica de validación de ID que ya existe en la web y en la función de validación del proveedor. Esto no equivale a una prueba de compra real; la validación del jugador, el coste, el stock y el envío del pedido deben probarse de forma controlada antes de publicar.

## Call of Duty Mobile: decisión provisional

En la copia completa del 9 de noviembre:

- Call of Duty Mobile: 9 productos, región `IN` (India).
- Call of Duty Mobile Garena: 12 productos, región `SG/MY` (Singapur/Malasia).

No se encontró una variante LATAM o GLOBAL en esa copia. Tampoco apareció CODM en la cobertura de validación guardada el 14 de noviembre.

**No publicar CODM todavía.** Solicitar a Central One confirmación explícita de si puede habilitar Call of Duty Mobile para cuentas de Cuba, preferiblemente una oferta LATAM o GLOBAL compatible. No ofrecer las variantes IN ni SG/MY como si fueran válidas para Cuba.

## Orden de expansión propuesto

### Etapa 0 — Proteger la tienda actual

1. Mantener sin cambios los productos y paquetes actuales.
2. Hacer una comprobación de regresión del flujo existente: selección de producto, validación de ID, pago/billetera, creación del pedido, envío a Central One y estado final.
3. No modificar las reglas de la billetera, las tasas, la lógica de devolución ni las funciones de pedido existentes para resolver la expansión de catálogo.

### Etapa 1 — Primeros juegos candidatos con cobertura observada

1. **PUBG Mobile GLOBAL.**
2. **Arena Breakout GLOBAL.**

Son los dos candidatos nuevos con cobertura de validación presente en la sincronización más reciente y con esquema de un solo ID. Antes de integrar cada uno, volver a cargar el catálogo actual y confirmar SKU, región, stock, coste, nombre, campos y compatibilidad para la cuenta. Después se integra uno, se prueba y se publica solo cuando todas las comprobaciones pasan.

### Etapa 2 — Ampliación condicionada a cobertura del proveedor

Investigar en este orden orientativo: Honor of Kings, EA FC Mobile, Racing Master, Rainbow Six Mobile, 8 Ball Pool, Stumble Guys, Pixel Gun 3D, Bleach: Soul Resonance y Wuthering Waves.

Estos no están aprobados para publicación por esta auditoría: aunque aparecían con stock en el catálogo histórico, no aparecieron en la cobertura de validación más reciente consultada. Deben esperar a que Central One confirme soporte de validación o a que exista un método seguro compatible que no debilite el control actual.

Los juegos que exigen servidor seleccionable, varios campos o credenciales de cuenta requieren una fase técnica adicional. No pedir ni almacenar contraseñas de cuentas de juego.

### Etapa 3 — Call of Duty Mobile

Revisar la respuesta de Central One sobre la región adecuada para Cuba. Si no existe una oferta regional compatible y validable, dejar CODM fuera, sin asumir riesgos con el dinero de los clientes. Si Central One la habilita, integrarla y refinarla con el mismo estándar que los juegos ya publicados.

### Etapa 4 — Meta de 10–15 juegos

Mantener el total actual de juegos publicados y sumar únicamente los juegos nuevos que superen todos los controles. La meta se alcanza de manera gradual; no se importará el catálogo completo ni se publicarán cientos de SKU automáticamente.

## Requisitos para aprobar cada juego nuevo

1. El producto aparece en el catálogo actualizado de la cuenta.
2. La región es compatible con las cuentas a las que se venderá en Cuba; el nombre GLOBAL o LATAM no se toma como garantía sin confirmación del proveedor.
3. El producto está activo y en stock.
4. La cobertura de validación incluye el producto cuando la operación depende de validar el ID.
5. Los campos y el esquema de objetivo coinciden exactamente entre catálogo, formulario, validación y envío de pedido.
6. El coste mayorista está actualizado y el precio minorista deja beneficio positivo calculado con el coste real de reposición de USDT y las comisiones.
7. El envío mantiene la idempotencia, la comprobación de saldo del proveedor y las reglas existentes de resultado incierto y devolución.
8. La interfaz del juego tiene imagen propia, nombre, región, instrucciones, validación y experiencia móvil cuidadas.
9. Se prueba primero la validación de ID. No se genera una compra real de prueba ni se consume saldo del proveedor sin autorización expresa.
10. Solo entonces se activa la visibilidad pública.

## Próximo paso necesario

La copia completa del catálogo encontrada es del 9 de noviembre, así que se necesita una actualización. Desde la cuenta de administrador en la web, entrar en el panel de Central One y pulsar **Cargar catálogo**. Esa acción es de solo lectura respecto a Central One: consulta el catálogo y guarda una copia en Supabase; no crea pedidos ni descuenta el saldo prepago. Una vez guardada la nueva copia, revisaré los productos y la cobertura actuales antes de comenzar la primera integración.

## Alcance de esta auditoría

- No se modificó `index.html`.
- No se modificaron productos ni paquetes publicados.
- No se ejecutaron pedidos ni pruebas que gastaran saldo de Central One.
- No se cambió la billetera ni sus tasas.
- Este documento registra una auditoría y un plan; no significa que los juegos nuevos ya estén integrados o publicados.

## Actualización de auditoría — 14 de noviembre de 2026, 22:15 UTC

Se desplegó el importador genérico con una regla más estricta: solo recargas GLOBAL/LATAM que usen un único ID de jugador sin credenciales y estén presentes en la cobertura de validación de Central One. Se preservan los paquetes publicados de Free Fire, Blood Strike y Mobile Legends.

La primera sincronización posterior al despliegue confirmó 56 productos nuevos: 29 de PUBG Mobile GLOBAL y 27 de Arena Breakout GLOBAL. Los 56 quedaron activos, visibles, con stock y cobertura de validación. Todos tienen precios positivos para Transferencia CUP, Saldo móvil y USDT; el checkout también usa el precio USDT para la billetera interna. La revisión y autorización administrativa de pedidos se conserva.

No se han realizado compras reales de prueba de los dos juegos nuevos ni se ha verificado visualmente GitHub Pages en un navegador. Los juegos restantes del catálogo histórico no se activarán hasta que Central One incluya sus productos en la cobertura de validación y cumplan el esquema sin credenciales. El detalle de la auditoría y las verificaciones está en `docs/AUDITORIA_GLOBAL_LATAM_ID_2026-11-14.md`.
