# Procesador inicial Flora OS — preparado, no instalado

El archivo `apps-script/FloraProcesador.gs` es un **prototipo de procesador** para ejecutar más adelante en un Apps Script cuya propietaria sea Lucy.

## Circuito

1. Lee `PRODUCTOS`, `RECETAS` e `INSUMOS` de `FLORA_OS_DB`.
2. Solo acepta productos con `ACTIVO = SI` y recetas coherentes en cantidad, rendimiento y unidad.
3. Exige confirmación, identificador único, lote y fecha de vencimiento.
4. Bajo bloqueo del procesador, revisa duplicados, calcula cantidades y verifica existencias.
5. Si hay stock suficiente, escribe un evento completo en una sola fila de `EVENTOS_STOCK`. Los saldos se reconstruyen desde esos eventos.

## Pendiente antes de uso real

- Validar con Lucy las recetas y unidades.
- Diseñar y probar el registro de existencias iniciales y compras; sin esos ingresos el saldo es cero y ninguna producción puede pasar.
- Añadir ventas por lote, control FEFO y movimientos de merma.
- Pruebas de integración en una copia privada bajo la cuenta de Lucy, incluyendo fallos concurrentes y reintentos.
- Vincular la interfaz y la secretaria virtual con el procesador de forma autenticada y segura.

**No** ejecutar todavía `FLORA_registrarProduccion` con datos reales. No se creó ni modificó un proyecto Apps Script de Lucy. No hay API pública ni se publica contenido privado en GitHub.
