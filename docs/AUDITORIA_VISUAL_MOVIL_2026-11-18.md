# Auditoría visual móvil — 18 de noviembre de 2026

## Fuente revisada
- Grabación enviada por el propietario el 18 de noviembre de 2026.
- Recorrido aproximado: 3 minutos y 8 segundos.
- Formato observado: Android, pantalla vertical de 360 × 800 píxeles.
- La grabación muestra el sitio público con sesión iniciada como administrador. No se inspeccionaron vistas de escritorio ni tablet.

## Aspecto actual que debe conservarse
- Identidad visual azul, azul marino, blanco y acentos violetas.
- Logo principal del Castillo y escudo cuadrado como icono de marca.
- Cabecera compacta, barra inferior fija de cinco accesos y presentación de tarjetas.
- Portada con hero, contador de entregas y catálogo de cinco juegos.
- Fichas de juegos con selección explícita del método de pago antes de mostrar los paquetes.
- Catálogos extensos agrupados por moneda principal y después ofertas, pases y especiales.
- Pantallas de pedidos, wallet, perfil, notificaciones y panel administrativo.

## Observaciones del recorrido
1. La portada y la identidad se reconocen bien en un teléfono pequeño.
2. El campo de búsqueda llevaba un texto demasiado largo para su ancho.
3. El número del contador de entregas no destacaba suficientemente en la grabación móvil.
4. En la pestaña de pedidos del administrador, los filtros quedaban en una fila desplazable horizontalmente y algunos botones se veían cortados.
5. El editor de avisos de la tienda ocupaba mucho alto en móvil; sus campos necesitan apilarse.
6. Los paneles vacíos de movimientos y depósitos de la wallet tenían demasiado espacio sin un punto visual de referencia.
7. Las tarjetas de juegos y paquetes, los selectores de pago y las pantallas de cliente ya tienen una base uniforme y no necesitan un rediseño general.

## Mejoras aplicadas en esta ronda
- Acortado el placeholder a «Busca juegos, paquetes y servicios…».
- Aumentado y reforzado el tamaño del contador en pantallas pequeñas.
- Ordenados los filtros de pedidos del administrador en una cuadrícula de dos columnas, con texto que puede partirse y sin desplazamiento horizontal.
- Apilados los campos del editor de avisos en una columna en móvil.
- Añadido tratamiento visual ligero a los estados vacíos de movimientos y depósitos de wallet usando el escudo oficial.
- Renovada la caché estática para los estilos actualizados.

## Versiones publicadas en el repositorio
- `index.html`: hojas de estilo `admin-panel.css?v=32` y `storefront-polish.css?v=13`.
- Service worker: `shell-v158`.

## Pendiente para completar la auditoría
- Revisar el resultado de estos últimos cambios en un móvil real con una nueva grabación o capturas.
- Hacer una revisión equivalente en pantalla de escritorio y tablet.
- Revisar checkout completo para cada método de pago sin crear pedidos reales ni gastar saldo del proveedor.
- Revisar las pantallas administrativas con pedidos reales de ejemplo y listas con más contenido; el vídeo incluye estados vacíos y datos limitados.
- Evaluar contraste, tamaños de letra y carga de imágenes en una conexión lenta.

## Reglas de conservación
- No cambiar la paleta azul/blanco/violeta ni sustituir el logo o el escudo aprobados.
- No sustituir las imágenes oficiales de los juegos por ilustraciones generadas.
- No cambiar precios, paquetes, orden del catálogo, métodos ni lógica de pago durante el pulido visual.
- Mantener la web ligera y usable en teléfonos Android y conexiones lentas.

## Ajuste posterior solicitado — iconos vacíos y perfil

- Causa de los cuadros vacíos: el CSS de `assets/storefront-polish.css` cargaba el emblema con rutas `./assets/el-castillo-icon.webp`. Al estar el CSS dentro de `assets/`, el navegador intentaba buscar `/assets/assets/el-castillo-icon.webp`.
- Corregidas las 10 referencias para cargar `./el-castillo-icon.webp` desde la carpeta correcta. Esto cubre el emblema de las tarjetas de juegos, el encabezado del catálogo, el mensaje de bienvenida y los estados vacíos del Wallet.
- Perfil reorganizado: bienvenida con nombre y correo, fecha de ingreso, resumen de actividad, accesos a Wallet/Pedidos/Avisos/Ayuda y seguridad/cierre de sesión.
- Eliminadas las etiquetas visuales «Administrador/Cliente» y el campo «Tipo de cuenta» de la pestaña de perfil. Los permisos y la detección interna del rol administrador permanecen activos.
- Versiones publicadas: `storefront-polish.css?v=14`; caché de Service Worker `shell-v159`.
- Verificación de código: cero referencias antiguas a `./assets/el-castillo-icon.webp`; HTML y Service Worker usan la misma versión CSS; las referencias de actividad y accesos siguen presentes; autorización interna de administrador y métodos de pago permanecen intactos.
- Pendiente de confirmación visual final: abrir la web desde el móvil después de que GitHub Pages publique los cambios y comprobar que el emblema ya aparece en todos los lugares señalados.
