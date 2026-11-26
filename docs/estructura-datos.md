# Flora OS — estructura prevista de Google Sheets

La titular y administradora de los datos será Lucy, desde su propia cuenta de Google.
El repositorio de GitHub es público: contiene código y pruebas ficticias, **nunca** recetas ni información comercial real.

| Hoja | Columnas propuestas | Uso |
| --- | --- | --- |
| `PRODUCTOS` | `PRODUCTO_ID`, `NOMBRE`, `TIPO`, `VARIANTE`, `ACTIVO`, `DIAS_REPOSICION` (opcional) | Elaborados, comprados y consignación. Intervalo de reposición validado por Lucy. |
| `INSUMOS` | `INSUMO_ID`, `NOMBRE`, `UNIDAD`, `STOCK_MINIMO`, `PROVEEDOR_ID` | Materias primas, envases y etiquetas. |
| `RECETAS` | `PRODUCTO_ID`, `RENDIMIENTO`, `INSUMO_ID`, `CANTIDAD`, `UNIDAD` | Fórmulas escalables. |
| `LOTES` | `LOTE_ID`, `PRODUCTO_ID`, `FECHA_ELABORACION`, `VENCIMIENTO`, `CANTIDAD_ORIGINAL` | Trazabilidad y caducidad. |
| `MOVIMIENTOS_STOCK` | `REQUEST_ID`, `SECUENCIA`, `FECHA`, `TIPO`, `ITEM_ID`, `CANTIDAD`, `LOTE_ID`, `VENCIMIENTO` | Libro inmutable para calcular existencias. |
| `VENTAS` | `VENTA_ID`, `FECHA`, `CANAL`, `PRODUCTO_ID`, `CANTIDAD`, `IMPORTE`, `REQUEST_ID` | Detalle por producto y canal. |
| `COMPRAS` | `COMPRA_ID`, `FECHA`, `PROVEEDOR_ID`, `INSUMO_ID`, `CANTIDAD`, `COSTO`, `REQUEST_ID` | Reposición y costos. |
| `OPERACIONES_IA` | `REQUEST_ID`, `FECHA`, `TIPO`, `DATOS_JSON`, `ESTADO`, `RESULTADO_JSON` | Pedidos de secretaria virtual, pendientes de confirmación. |
| `CLIENTES` | `CLIENTE_ID`, `NOMBRE`, `WHATSAPP`, `EMAIL`, `FECHA_ALTA`, `CONSENTIMIENTO_CONTACTO`, `FECHA_CONSENTIMIENTO`, `PREFERENCIAS`, `OBSERVACIONES` | Ficha única de cliente; consentimiento independiente de la compra. |
| `ACTIVIDADES_CLIENTE` | `ACTIVIDAD_ID`, `CLIENTE_ID`, `FECHA`, `TIPO`, `REFERENCIA_ID`, `DETALLE`, `PROXIMO_CONTACTO`, `ESTADO_SEGUIMIENTO`, `OBSERVACIONES` | Historial común de compras, sesiones, cursos y seguimientos. |

## Reglas de integridad

1. Una orden conversacional requiere confirmación humana antes de enviarse a procesar.
2. Cada orden lleva un `REQUEST_ID` único. Repetirlo devuelve el resultado previo, nunca duplica movimientos.
3. Se registran juntos todos los movimientos de una operación; se usa un bloqueo del procesador antes de comprobar existencias y escribir.
4. Los saldos oficiales se obtienen del libro de movimientos, no de valores supuestos por el asistente.
5. La elaboración necesita lote y vencimiento. Antes de vender debe incorporarse la selección de lotes no vencidos (FEFO).
6. Las recetas digitalizadas de Lucy se revisarán contra rendimientos, unidades, envases y etiquetas antes de importar.
7. Un cliente usa siempre el mismo `CLIENTE_ID`, aunque compre productos, reserve tarot, realice una carta astral o participe de un curso.
8. El permiso para mensajes comerciales se registra expresamente en `CONSENTIMIENTO_CONTACTO`. No se infiere de una venta ni de una sesión; no se envían mensajes automáticamente.

**Estado:** las hojas de catálogo, revisión y CRM están preparadas en el Google Sheets de Lucy; el procesador sigue en fase de prueba en GitHub. No está instalado bajo su cuenta ni conectado a operaciones reales.

## Integración de ventas al CRM (fase de prueba)

- `FLORA_registrarVenta` comprueba que `clienteId`, si se proporciona, exista en `CLIENTES` antes de guardar la venta. Una venta sin cliente sigue siendo válida.
- `FLORA_historialCliente(clienteId)` reconstruye las compras desde eventos `VENTA` confirmados y las combina con actividades de sesiones, cursos y seguimientos cargadas en `ACTIVIDADES_CLIENTE`. No agrega filas ni duplica compras en esa hoja.
- `FLORA_prepararReposiciones(clienteId, fecha)` propone seguimientos únicamente si `CONSENTIMIENTO_CONTACTO` es `SI` y el producto posee `DIAS_REPOSICION` entero positivo. No envía mensajes ni escribe datos; Lucy deberá revisar y aprobar cada contacto.
- Para usar las lecturas en Google Sheets deben existir ambas hojas de CRM con los encabezados previstos. Las fechas de venta y seguimiento deben representarse como `AAAA-MM-DD`.
