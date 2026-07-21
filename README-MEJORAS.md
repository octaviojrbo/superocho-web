# Super 8 — versión mejorada

## Cambios principales
- Interfaz visual más moderna y consistente.
- Header y navegación optimizados para computadora y móvil.
- Hero principal mejorado con mejor jerarquía, espaciado y animación ligera.
- Tarjetas de categorías, productos, sucursales y servicios renovadas.
- Mejoras de accesibilidad: foco visible, atributos ARIA, tecla Escape y reducción de movimiento.
- Loader conectado a la carga real de la página, con respaldo automático.
- Enlaces de inicio corregidos para funcionar también en subdirectorios y hosting estático.
- Página de sucursales real habilitada en lugar de la página temporal.
- Limpieza del paquete final: se eliminaron archivos internos de Git y metadatos de macOS.

## Archivos importantes
- `styles.css`: incluye al final la capa visual “MEJORA 2026”.
- `script.js`: incluye al final mejoras de experiencia y accesibilidad.
- `sucursales.html`: contiene ahora la versión completa de sucursales.

## Antes de publicar
1. Prueba el sitio con tu conexión de Supabase.
2. Revisa que las políticas RLS de Supabase estén activas.
3. Conecta credenciales reales de Mercado Pago únicamente desde un backend seguro.

## Actualización solicitada posteriormente

- Catálogo y Promociones permanecen completos y funcionales dentro del proyecto, pero fueron retirados de la navegación pública.
- La página y los datos de Sucursales permanecen guardados, pero el enlace público está desactivado temporalmente.
- El menú visible ahora contiene únicamente Inicio, Nosotros y Sucursales a la izquierda; Mayoreo, Servicios y Contáctanos a la derecha.
- Se rediseñaron también las páginas Nosotros, Mayoreo, Servicios y Contáctanos para mantener la misma calidad visual de Inicio.
