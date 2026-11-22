# Aviso beta discreto y difusión de Tienda El Castillo

**Fecha:** 22 de noviembre de 2026

## Objetivo
Mostrar una única nota pequeña y tranquilizadora de fase beta, sin repetirla ni hacer que el cliente dude de que su recarga llegará. Preparar material promocional orgánico para atraer jugadores.

## Decisión visual y de experiencia
- Una sola línea, colocada inmediatamente dentro de la aplicación, antes de las secciones de acceso y tienda: **FASE BETA · Estamos mejorando la tienda contigo.**
- Fondo muy suave en tono violeta, borde ligero y tipografía pequeña, sin ocupar espacio importante.
- No mencionar pedidos pequeños o compras grandes en el aviso, metadatos, compartir o guías.
- Mantener las opciones públicas de compartir la web y seguir el canal oficial de WhatsApp.
- Mantener las descripciones comerciales normales en buscadores y redes.
- Conservar las guías públicas informativas sin mensajes repetidos de fase beta.

## Límites
- Mantener el inicio de sesión obligatorio para ver paquetes y precios.
- No modificar precios, catálogo, pagos, autenticación, pedidos, billetera, Supabase ni el flujo de recargas.
- No mencionar proveedores externos ni prometer entrega instantánea.
- No crear ni activar anuncios pagados.
- Publicar contenido en Facebook solo a través de una conexión compatible y después de comprobar los textos y recursos creativos.

## Implementación
- [x] Reemplazar los dos avisos grandes por un único aviso común a la pantalla pública y a la tienda autenticada.
- [x] Separar el aviso de los botones «Compartir tienda» y «Seguir novedades en WhatsApp».
- [x] Eliminar menciones beta de los textos de compartir, metadatos y tres guías públicas.
- [x] Restaurar metadatos comerciales originales.
- [x] Añadir pruebas de regresión para la única nota y la ausencia de avisos repetidos.
- [ ] Ejecutar pruebas Node.js completas y revisar visualmente en navegador.
- [ ] Actualizar el registro de la tarea cuando termine la verificación.

## Verificación disponible
- Comprobaciones estáticas del contenido actual: una sola nota global; ninguna repetición en acceso, tienda, compartir o guías.
- Sintaxis de los tres scripts JavaScript incrustados: 3/3 analizados correctamente.
- Las pruebas Node.js aún no se ejecutaron porque el entorno no pudo resolver github.com al intentar clonar el repositorio.
- PR #16 actualizado con este cambio, pendiente de la integración y de la verificación que aún se pueda realizar.
