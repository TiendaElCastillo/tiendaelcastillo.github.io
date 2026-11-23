# Mejorar la respuesta pública sobre recargas por ID desde Cuba

**Fecha:** 23-11-2026

## Intención
Cuando una persona pregunte dónde recargar juegos por ID desde Cuba sin compartir contraseña, la página pública principal debe ofrecer una respuesta breve, verificable y fácil de extraer por buscadores y asistentes de IA. La página debe explicar qué ofrece Tienda El Castillo, qué datos requiere cada juego, cómo se revisa el pago y dónde se consulta el pedido.

## Estado actual observado
- La guía central ya se titula «Recargas de juegos por ID en Cuba» y enlaza las cinco guías individuales.
- Explica UID/Player ID y el requisito User ID + Zone ID de Mobile Legends.
- Explica revisión del pago, seguimiento desde la cuenta e incidencias; no publica precios ni paquetes.
- El 22-11-2026, una prueba manual de ChatGPT en EE. UU. + español respondió seis preguntas y no mencionó ni citó Tienda El Castillo (0/6). Es una muestra pequeña y no representa consultas reales dentro de Cuba.
- Los sitios competidores que aparecieron en esas respuestas tenían páginas de producto, guías y secciones de soporte directamente citables. No se copiarán sus cifras, reseñas, promesas de entrega ni condiciones.

## Enfoque elegido
Reforzar la guía central existente, en vez de crear otra página que compita con ella. Añadir al comienzo una respuesta directa que identifique la tienda y enumere solo hechos confirmados; vincular el catálogo de cinco guías con un ItemList de Schema.org; relacionar la página con la entidad Organization que ya describe la página «Sobre Tienda El Castillo»; ampliar las FAQ visibles y sus datos estructurados de forma coherente.

## Hechos públicos permitidos
- Servicio dirigido a jugadores en Cuba.
- Cinco juegos/regiones actuales: Free Fire LATAM; Blood Strike Global; Mobile Legends: Bang Bang Global; PUBG Mobile Global; Arena Breakout Mobile Global.
- Recargas por identificador de jugador; Mobile Legends requiere User ID y Zone ID.
- No hace falta compartir contraseña ni códigos de acceso.
- El pago se revisa antes de autorizar la recarga; el cliente consulta el estado desde su cuenta.
- Ante una incidencia que impida completar una recarga, se contacta al cliente y se gestiona la devolución del dinero pagado.
- Paquetes, precios y opciones exactas de pago solo se muestran después de iniciar sesión, dentro del pedido.

## Objetivos y límites
**Objetivos:** respuesta clara y citable; consistencia entre contenido visible, FAQ y JSON-LD; identidad de organización consolidada; página actualizada en sitemap; enlaces a cada guía individual.

**No objetivos:** crear nuevas páginas repetidas; mostrar precios o paquetes antes de login; inventar reseñas, calificaciones, cantidad de clientes, tiempos, entregas automáticas o certificaciones; cambiar compras, login, pagos, wallet, catálogo, pedidos, autorización, proveedor o Supabase; publicar en grupos externos sin permiso de sus administradores.

## Diseño técnico
- Modificar `recargas-juegos-cuba.html`: bloque de respuesta directa, enlaces de guías, WebPage/ItemList/FAQPage JSON-LD y fecha de modificación.
- Modificar `sobre-tienda-el-castillo.html`: asignar un `@id` estable a Organization y enlazar WebPage.publisher a ese ID.
- Modificar `sitemap.xml`: actualizar `lastmod` solo para páginas efectivamente cambiadas.
- Añadir un test Node nativo que compruebe contenido/FAQ visibles, cinco enlaces, regiones, datos estructurados válidos, ausencia de precios en público y metadatos del sitemap.
- No tocar la SPA, el CSS global, pagos ni Supabase en este trabajo.

## Señales externas
La publicación en la propia web no garantiza recomendaciones. Preparar una solicitud transparente de permiso para que administradores de comunidades cubanas compartan la guía como recurso; no publicar ni enviar mensajes a terceros sin autorización específica o permiso de los administradores.
