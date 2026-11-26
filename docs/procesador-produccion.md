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

## Sesiones, cursos y borradores (prototipo)

- `FLORA_registrarActividadCliente` registra una actividad **realizada** (`SESION` o `CURSO`) con cliente, nombre breve de servicio y fecha; exige confirmación e ID único. No almacena detalles personales o interpretaciones de una sesión. A diferencia de agendar una cita futura, registra únicamente actividades ya realizadas.
- `FLORA_historialIntegralCliente` combina las compras y las actividades confirmadas en una ficha única, sin copiar filas entre tablas. `EVENTOS_STOCK` es el libro canónico hasta que exista una proyección reconciliada de `ACTIVIDADES_CLIENTE`.
- `FLORA_prepararBorradorMensaje` genera texto editable de **reposición estimada** o **agradecimiento tras una sesión identificada**. Rechaza clientes sin consentimiento, recomendaciones sin fundamento y sesiones inexistentes. Devuelve `enviado: false`: nunca contacta a nadie ni registra el mensaje como enviado.
- Los mensajes de cumpleaños, aniversarios, promociones y cursos se definirán más adelante con fechas, preferencias y consentimientos confirmados. No se inventan aniversarios ni intereses.

## Agenda Flora (motor inicial, no conectado)

- `FLORA_reservarTurno` registra una reserva confirmada con `REQUEST_ID`, `clienteId`, `servicio`, `inicio` y `fin` en formato local `AAAA-MM-DDTHH:mm` (Argentina). Requiere confirmación; rechaza duración no positiva o mayor a 8 horas, días pasados y horarios superpuestos. Permite turnos consecutivos.
- `FLORA_cancelarTurno` cancela por identificador, mediante un nuevo evento inmutable, sin borrar el original. Repetir el mismo `REQUEST_ID` no duplica la cancelación.
- `FLORA_consultarAgenda(desde, hasta)` devuelve turnos vigentes de hasta 31 días; es de solo lectura. Los datos se derivan de `EVENTOS_STOCK`, sin hojas o calendarios paralelos que puedan quedar desincronizados.
- **Pendiente**: zona horaria y validación fina de hora actual, horarios de atención, descansos, duración por servicio, reprogramación, disponibilidad externa, autorización por usuaria y sincronización unidireccional segura con un calendario propiedad de Lucy. No se crearon eventos en Google Calendar. Nunca incluir detalles íntimos de las sesiones en eventos sincronizados.

## Lectura unificada para CRM y futura voz (no instalada)

- `FLORA_buscarClientes(texto)` permite localizar hasta 20 clientes por nombre con al menos dos letras, ignorando tildes; devuelve solamente nombre e identificador, no teléfonos ni observaciones.
- `FLORA_consultarFichaCliente(clienteId, fechaReferencia)` reúne desde las fuentes oficiales: compras, sesiones/cursos realizados, turnos futuros confirmados y posibles reposiciones. Reconstruye una ficha sin generar nuevas filas, notificaciones o mensajes. Las posibles reposiciones solo figuran cuando existe consentimiento de contacto.
- Estas funciones son **internas**; siguen sin autorización web configurada. La interfaz y la secretaria virtual deberán pasar por una capa privada de autenticación antes de poder utilizarlas con datos de Lucy. Las demos públicas de `clientes.html`, `agenda.html` y `reservas.html` permanecen completamente ficticias.
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
