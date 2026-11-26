# Flora OS — estructura prevista de Google Sheets

La titular y administradora de los datos será Lucy, desde su propia cuenta de Google.
El repositorio de GitHub es público: contiene código y pruebas ficticias, **nunca** recetas ni información comercial real.

| Hoja | Columnas propuestas | Uso |
| --- | --- | --- |
| `PRODUCTOS` | `PRODUCTO_ID`, `NOMBRE`, `TIPO`, `VARIANTE`, `ACTIVO` | Elaborados, comprados y consignación. |
| `INSUMOS` | `INSUMO_ID`, `NOMBRE`, `UNIDAD`, `STOCK_MINIMO`, `PROVEEDOR_ID` | Materias primas, envases y etiquetas. |
| `RECETAS` | `PRODUCTO_ID`, `RENDIMIENTO`, `INSUMO_ID`, `CANTIDAD`, `UNIDAD` | Fórmulas escalables. |
| `LOTES` | `LOTE_ID`, `PRODUCTO_ID`, `FECHA_ELABORACION`, `VENCIMIENTO`, `CANTIDAD_ORIGINAL` | Trazabilidad y caducidad. |
| `MOVIMIENTOS_STOCK` | `REQUEST_ID`, `SECUENCIA`, `FECHA`, `TIPO`, `ITEM_ID`, `CANTIDAD`, `LOTE_ID`, `VENCIMIENTO` | Libro inmutable para calcular existencias. |
| `VENTAS` | `VENTA_ID`, `FECHA`, `CANAL`, `PRODUCTO_ID`, `CANTIDAD`, `IMPORTE`, `REQUEST_ID` | Detalle por producto y canal. |
| `COMPRAS` | `COMPRA_ID`, `FECHA`, `PROVEEDOR_ID`, `INSUMO_ID`, `CANTIDAD`, `COSTO`, `REQUEST_ID` | Reposición y costos. |
| `OPERACIONES_IA` | `REQUEST_ID`, `FECHA`, `TIPO`, `DATOS_JSON`, `ESTADO`, `RESULTADO_JSON` | Pedidos de secretaria virtual, pendientes de confirmación. |

## Reglas de integridad

1. Una orden conversacional requiere confirmación humana antes de enviarse a procesar.
2. Cada orden lleva un `REQUEST_ID` único. Repetirlo devuelve el resultado previo, nunca duplica movimientos.
3. Se registran juntos todos los movimientos de una operación; se usa un bloqueo del procesador antes de comprobar existencias y escribir.
4. Los saldos oficiales se obtienen del libro de movimientos, no de valores supuestos por el asistente.
5. La elaboración necesita lote y vencimiento. Antes de vender debe incorporarse la selección de lotes no vencidos (FEFO).
6. Las recetas digitalizadas de Lucy se revisarán contra rendimientos, unidades, envases y etiquetas antes de importar.

**Estado:** diseño y simulador de libro de movimientos preparados en GitHub. Todavía NO existe una base de datos operativa conectada a Google Sheets ni un procesador instalado bajo la cuenta de Lucy.
