# Flora OS · Pedidos privados

La base `FLORA_OS_DB`, propiedad de Lucy, dispone de tres pestañas vacías:

- `PEDIDOS`: cabecera, cliente, canal, fecha comprometida, estado y REQUEST_ID.
- `PEDIDO_ITEMS`: líneas de un pedido, cantidad pedida y entregada, variante y estado.
- `PEDIDO_EVENTOS`: historial de altas, cambios de estado y entregas parciales; incluye `DATOS_JSON` para reconstruir las altas sin escrituras multihoja.

`src/pedidos-persistencia.js` implementa la validación y preparación de un alta de varios artículos **sin escribir**. `apps-script/FloraPedidos.gs` prepara el registro confirmado como **un evento único** con `REQUEST_ID` idempotente, bloqueo y lectura de verificación. El código público no contiene pedidos reales ni datos personales de Lucy.

## Reglas de la futura conexión

1. La PWA deberá autenticar a Lucy antes de consultar o registrar datos. No publicar una hoja privada ni exponer una URL con permisos de escritura anónima.
2. Las operaciones requieren confirmación explícita, un `REQUEST_ID` único y un procesador Apps Script bajo la cuenta de Lucy.
3. El procesador debe usar bloqueo, verificar IDs duplicados y dejar evento auditable. No declarar éxito hasta comprobar el registro completo. Si la escritura parcial falla, conciliar antes de reintentar; Google Sheets no ofrece una transacción multihoja automática.
4. Crear o cambiar un pedido **no** genera una venta ni descuenta stock. Producción y entrega tendrán operaciones independientes, con cantidades y lotes verificados.
5. Los pedidos personalizados requieren aprobación de receta antes de entrar a producción automática.
6. No usar `BORRADOR_RECETAS` para fabricar; solo las recetas validadas pasarán a `RECETAS` y se activarán.

Estado actual: **esquema y procesador preparados y probados con datos ficticios; procesador no instalado, PWA sin persistencia real**. `PEDIDOS` y `PEDIDO_ITEMS` siguen vacías por diseño: el evento es la fuente oficial, y las vistas materiales se definirán antes del uso real.
