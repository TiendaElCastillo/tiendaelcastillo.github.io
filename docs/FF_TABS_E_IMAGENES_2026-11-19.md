# Free Fire: pestañas e inventario de imágenes — 19 de noviembre de 2026

## Referencia
- Repositorio: `TiendaElCastillo/tiendaelcastillo.github.io`
- Rama: `main`
- Web: https://tiendaelcastillo.github.io/

## Pestañas de Free Fire
Se sustituyó el antiguo esquema de dos vistas ("Diamantes" y "Ofertas extra") por pestañas independientes:
1. Diamantes
2. Fragmentos Evo
3. Mejoras de nivel
4. Pases y tarjetas
5. Pase Booyah

Las pestañas se muestran cuando la categoría dispone de ofertas para el método de pago elegido. Cada una muestra su recuento. La categoría principal (diamantes) aparece primero; pases y Booyah quedan al final. El orden interno de los paquetes se conserva.

## Productos que todavía necesitan iconografía original
Todos los productos activos de Free Fire consultados en `public.products` tenían `provider_image_url = null`. La página utiliza arte local de respaldo. En particular, los ocho paquetes Evo de las capturas usan un icono genérico:
- Cajas de fragmentos Evo: 1, 5, 10 y 50 cajas.
- Fragmentos de arma Evo: 10, 50, 100 y 500 fragmentos.

La intención es usar un arte oficial de caja para las cuatro cantidades de cajas y un arte oficial del Token Evo Universal para las cuatro cantidades de fragmentos. Las imágenes deben descargarse/recibirse antes de reemplazar esos respaldos; no se inventará ni generará arte.

## Pase Booyah LATAM Norte y LATAM Sur
Los dos artículos tienen `provider_image_url = null` y actualmente reciben la misma imagen local de respaldo que el código asigna a la familia Booyah. El propietario indicó que no son los iconos originales. No se cambia por el logotipo BOOYAH! de marca porque no es el icono del Pase Booyah. La sustitución queda pendiente de recibir la portada exacta del pase desde el juego o una imagen de Garena aprobada por el propietario. Se puede aplicar el mismo arte a Norte y Sur si el dueño confirma que deben compartir imagen; si deben distinguirse, se necesitan los dos archivos.

## Fuentes oficiales localizadas
- Publicación de Free Fire LATAM sobre el Token Evo Universal y su caja: https://x.com/freefirelatino/status/1828190688418144648
- Imagen oficial de la caja y el token en la publicación: https://pbs.twimg.com/media/GV8E082WUAAuoAu.jpg
- Imagen oficial de primer plano del token: https://pbs.twimg.com/media/GV8EwgUWUAAcmhB.jpg
- Soporte Garena, "Cómo funcionan las armas evolutivas": https://ffsoporte.garena.com/hc/es-419/articles/360031212352--C%C3%B3mo-funcionan-las-armas-evolutivas
- Soporte Garena, "Pase Booyah" (el artículo incluye imágenes del pase): https://ffsoporte.garena.com/hc/es-419/articles/14175757077785-Pase-Booyah
- Página de marca Garena con el recurso separado "BOOYAH! ICON": https://ff.garena.com/es/brand/ (ese logotipo no debe confundirse con la imagen del artículo/pase).

## Límites respetados
No se han modificado precios, nombres de producto, cantidades, métodos de pago, validación de ID, región, catálogo ni flujo de pedidos. Tampoco se reemplazaron imágenes del usuario por imágenes generadas.

## Cambios técnicos
- `index.html`: nuevo selector de cinco categorías y renderizado independiente por pestaña.
- `assets/storefront-polish.css`: estilo responsivo de pestañas (5 columnas escritorio, 3 en móvil, 2 en pantallas muy estrechas).
- `sw.js`: referencia a `storefront-polish.css?v=19`, caché `shell-v166`.

## Verificaciones
- Releído desde GitHub el HTML, el CSS y el service worker tras los commits.
- JavaScript inline: compilación sintáctica correcta.
- CSS: llaves equilibradas.
- HTML y service worker: ambos cargan CSS v19.
- Service worker: shell-v166.
- La pestaña activa mantiene la categoría seleccionada al volver a renderizar y cambia a la primera categoría disponible si la anterior no existe para el método de pago.

## Commits de la tarea
- Pestañas HTML: `3f4230b84ad42c85210e81d8caa1704fac38a0f8`
- Estilos CSS: `6f58fdb65d8db93f2d4060531c6d8b586ecddf0d`
- Caché offline: `80f00eec7459134e84f5024367dec1abf8e674dd`
- Corrección de sintaxis y validación JS: `a2ff20b4ae25d35feba9e39aa39954f0e3225a03`
