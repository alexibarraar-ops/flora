# Flora OS · Pedidos privados

La base `FLORA_OS_DB`, propiedad de Lucy, dispone de tres pestañas vacías:

- `PEDIDOS`: cabecera, cliente, canal, fecha comprometida, estado y REQUEST_ID.
- `PEDIDO_ITEMS`: líneas de un pedido, cantidad pedida y entregada, variante y estado.
- `PEDIDO_EVENTOS`: historial de altas, cambios de estado y entregas parciales; incluye `DATOS_JSON` para reconstruir las altas sin escrituras multihoja.

`src/pedidos-persistencia.js` implementa la validación y preparación de un alta de varios artículos **sin escribir**. `apps-script/FloraPedidos.gs` prepara el registro confirmado y posteriores cambios como **un evento único por operación**, con `REQUEST_ID` idempotente, bloqueo y lectura de verificación. El código público no contiene pedidos reales ni datos personales de Lucy.

## Circuito de pedidos preparado

- `FLORA_registrarPedido`: alta en estado `PENDIENTE`.
- `FLORA_cambiarEstadoPedido`: `PENDIENTE → PRODUCCION → LISTO`; cancelación antes de cualquier entrega.
- `FLORA_registrarEntregaPedido`: entrega por índice de línea y cantidad, estado `PARCIAL` hasta completar todas las unidades y luego `ENTREGADO`.
- `FLORA_consultarPedidos` y `FLORA_consultarPedidosPendientes`: reconstrucción de pedidos, cantidades entregadas y pendientes a partir del historial oficial.
- `FLORA_consultarProduccionAgrupada`: suma cantidades de pedidos `PENDIENTE` por producto y variante sin mezclar personalizados. Es solo una ficha tentativa; no calcula recetas ni compra insumos.

Todas las operaciones de escritura requieren confirmación y `REQUEST_ID`; los reintentos idénticos no duplican eventos. No existe todavía conexión autenticada con la PWA ni un procesador instalado en la cuenta de Lucy.

## Reglas de la futura conexión

1. La PWA deberá autenticar a Lucy antes de consultar o registrar datos. No publicar una hoja privada ni exponer una URL con permisos de escritura anónima.
2. Las operaciones requieren confirmación explícita, un `REQUEST_ID` único y un procesador Apps Script bajo la cuenta de Lucy.
3. El procesador debe usar bloqueo, verificar IDs duplicados y dejar evento auditable. No declarar éxito hasta comprobar el registro completo. Si la escritura parcial falla, conciliar antes de reintentar; Google Sheets no ofrece una transacción multihoja automática.
4. Crear o cambiar un pedido **no** genera una venta ni descuenta stock. Producción y entrega tendrán operaciones independientes, con cantidades y lotes verificados.
5. Los pedidos personalizados requieren aprobación de receta antes de entrar a producción automática.
6. No usar `BORRADOR_RECETAS` para fabricar; solo las recetas validadas pasarán a `RECETAS` y se activarán.

Estado actual: **circuito de altas, estados, entregas parciales y consultas preparado y probado con datos ficticios; procesador no instalado, PWA sin persistencia real**. `PEDIDOS` y `PEDIDO_ITEMS` siguen vacías por diseño: el evento es la fuente oficial, y las vistas materiales se definirán antes del uso real.
