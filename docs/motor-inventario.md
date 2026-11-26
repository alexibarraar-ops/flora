# Flora OS — primer motor de inventario (prototipo)

Este módulo prepara cálculos para producción, venta y alertas de reposición. No cambia el sitio público ni los archivos reales de Lucy.

## Qué hace

- Escala ingredientes, envases y etiquetas según el rendimiento declarado de cada receta.
- Revisa faltantes antes de proponer una elaboración.
- Propone movimientos de stock de productos terminados y ventas.
- Devuelve alertas de insumos al llegar a su mínimo.
- Exige un `requestId` por operación y detecta IDs previamente procesados.

## Qué **no** hace todavía

- No guarda información en Google Drive ni en Google Sheets.
- No registra lotes ni controla vencimientos: antes de activar operaciones reales debe implementarse trazabilidad por lote y selección de stock apto para vender.
- No procesa comandos de voz ni conecta con ChatGPT.
- No actualiza automáticamente movimientos: una futura capa de persistencia deberá escribir, en una única operación segura, movimientos y `requestId` confirmado; además deberá gestionar la concurrencia.

## Comprobación

Desde Node.js 18 o posterior: `node --test tests/flora-core.test.js`.

Los valores de las pruebas son ficticios. **No incluir recetas, costos, ventas ni datos personales reales en este repositorio público.** Los datos operativos permanecerán bajo la cuenta de Google de Lucy.
