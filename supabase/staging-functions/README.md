# Funciones exclusivas del entorno de pruebas

Estas funciones simulan la validación de ID, la compra con Coronas y la consulta administrativa para el proyecto Supabase de pruebas.

- No llaman al proveedor de recargas.
- No usan saldo real del proveedor.
- No deben copiarse a `supabase/functions/` ni desplegarse en el proyecto de producción.
- En el HTML de la rama de pruebas solo se seleccionan cuando la URL de Supabase corresponde al proyecto de pruebas.

La producción debe seguir utilizando las funciones reales `central-one-player-validate`, `central-one-order` y `central-one-read`.
