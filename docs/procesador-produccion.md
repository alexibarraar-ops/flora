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

## Venta de productos terminados (prototipo)

- `FLORA_registrarVenta` recibe `REQUEST_ID`, producto, cantidad entera y confirmación. `clienteId` es opcional; si se informa, debe existir una única vez en `CLIENTES`. Las ventas anónimas siguen permitidas.
- `FLORA_historialCliente(clienteId)` consulta las compras verificadas de ese cliente desde `EVENTOS_STOCK`, sin duplicarlas en otra hoja ni enviar mensajes. Es una consulta de solo lectura y requiere que el cliente exista.
- `FLORA_sugerirReposiciones(clienteId, fechaReferencia)` entrega una **estimación orientativa** usando el intervalo entre las dos últimas fechas distintas de compra de un mismo producto. Necesita `CONSENTIMIENTO_CONTACTO = SI`; si no consta, no ofrece sugerencias. Una estimación no equivale a una necesidad confirmada. Nunca envía WhatsApp ni registra un seguimiento automáticamente.
- `FLORA_consultarReposicionesPendientes(fechaReferencia)` prepara una bandeja general de posibles reposiciones cuya fecha estimada ya pasó, únicamente de clientes con consentimiento afirmativo. Lee la base una vez por consulta, retorna nombre, cliente, producto y fechas para revisión humana, y no envía mensajes. Esta salida queda preparada para una futura pantalla y secretaria por voz; **no** exponerla en un endpoint público sin autenticación/autorización.
- Reconstruye los saldos de los lotes desde `EVENTOS_STOCK` y elige primero los lotes aptos con vencimiento más cercano (**FEFO**).
- Rechaza ventas sin unidades suficientes **no vencidas**. Un reintento con el mismo `REQUEST_ID` no vuelve a descontar.
- Una venta puede descontar de varios lotes. Los lotes vencidos permanecen en el historial, pero quedan excluidos de la venta.
- Todavía **no** genera una venta contable en `VENTAS`, factura, contacto al cliente ni puntos de Flora Club. Tampoco contempla devoluciones, consignaciones o productos comprados terminados.

## Pendiente antes de uso real

- Validar con Lucy las recetas y unidades.
- Cargar existencias iniciales solo después de un conteo físico aprobado por Lucy. Nunca inferir cantidades desde recetas o planillas de ventas.
- Completar el flujo de ventas contables, mermas, devoluciones, productos comprados terminados y consignaciones.
- Pruebas de integración en una copia privada bajo la cuenta de Lucy, incluyendo fallos concurrentes y reintentos.
- Vincular la interfaz y la secretaria virtual con el procesador de forma autenticada y segura.

**No** ejecutar todavía `FLORA_registrarProduccion` con datos reales. No se creó ni modificó un proyecto Apps Script de Lucy. No hay API pública ni se publica contenido privado en GitHub.
