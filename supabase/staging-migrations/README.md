# Migraciones exclusivas del entorno de pruebas

Estos archivos se aplicaron o se utilizaron para preparar el proyecto Supabase de pruebas de Tienda El Castillo.

**No ejecutar estos archivos en producción.** No forman parte del paquete de migración a la web pública.

La configuración de pruebas utiliza valores ficticios, tablas y políticas de paridad, y una estructura de saldo móvil diferente a la base productiva. El proyecto de pruebas se mantiene separado.

Para la migración productiva, usar únicamente los archivos que permanecen en `supabase/migrations/` después de revisar el orden y la versión de producción.
