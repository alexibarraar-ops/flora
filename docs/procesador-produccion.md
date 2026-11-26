# Procesador inicial Flora OS — preparado, no instalado

El archivo `apps-script/FloraProcesador.gs` es un **prototipo de procesador** para ejecutar más adelante en un Apps Script cuya propietaria sea Lucy.

## Circuito

1. Lee `PRODUCTOS`, `RECETAS` e `INSUMOS` de `FLORA_OS_DB`.
2. Solo acepta productos con `ACTIVO = SI` y recetas coherentes en cantidad, rendimiento y unidad.
3. Exige confirmación, identificador único, lote y fecha de vencimiento.
4. Bajo bloqueo del procesador, revisa duplicados, calcula cantidades y verifica existencias.
5. Si hay stock suficiente, escribe un evento completo en una sola fila de `EVENTOS_STOCK`. Los saldos se reconstruyen desde esos eventos.

## Ingresos de stock (simulados)

- `FLORA_registrarStockInicial`: agrega las cantidades reales contadas al comenzar, una sola vez. Cada insumo necesita unidad confirmada.
- `FLORA_registrarIngresoCompra`: agrega una recepción de materias primas. Repetir su `REQUEST_ID` devuelve el resultado anterior, sin duplicarlo.
- Ambas funciones exigen `confirmado: true`; el libro `EVENTOS_STOCK` sigue siendo la fuente de verdad.
- Por ahora `INGRESO_COMPRA` registra **cantidades recibidas**, no la contabilidad de compras ni sus precios. La hoja `COMPRAS` se integrará después.

## Pendiente antes de uso real

- Validar con Lucy las recetas y unidades.
- Cargar existencias iniciales solo después de un conteo físico aprobado por Lucy. Nunca inferir cantidades desde recetas o planillas de ventas.
- Añadir ventas por lote, control FEFO y movimientos de merma.
- Pruebas de integración en una copia privada bajo la cuenta de Lucy, incluyendo fallos concurrentes y reintentos.
- Vincular la interfaz y la secretaria virtual con el procesador de forma autenticada y segura.

**No** ejecutar todavía `FLORA_registrarProduccion` con datos reales. No se creó ni modificó un proyecto Apps Script de Lucy. No hay API pública ni se publica contenido privado en GitHub.
