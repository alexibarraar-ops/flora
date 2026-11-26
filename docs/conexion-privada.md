# Flora OS · Primera conexión privada (preparación)

**Estado:** código preparado, no instalado y sin acceso desde las páginas públicas.

## Decisión de arquitectura

- La propietaria de `FLORA_OS_DB` y del futuro proyecto Apps Script será **Lucy**, desde su propia cuenta de Google.
- Las fichas originales, su Excel y los cuadernos son material de referencia. El nuevo sistema opera exclusivamente en `FLORA_OS_DB`, con datos revisados.
- El procesador no se publica como Web App mientras no exista un mecanismo de autenticación y autorización probado. La URL pública de GitHub Pages nunca deberá contener un identificador secreto, token, fórmula privada o datos de clientes.
- El primer contacto debe ser **de solo lectura**: verificar permisos y estructura, luego consultar una receta activa de prueba, sin cargar producción real.

## Prueba segura prevista

1. Lucy autoriza y ejecuta el procesador en su cuenta, asociado a su nueva planilla.
2. Se configura `FLORA_SPREADSHEET_ID` en propiedades privadas del script (no en código público).
3. Se ejecuta `FLORA_verificarConexionPrivada()`. Revisa nombre de libro, zona horaria, hojas y encabezados. No escribe nada.
4. Se ejecuta `FLORA_diagnosticarArranque()` y se revisan sus bloqueos. **No** activa productos ni carga stock.
5. Una receta validada se comprueba con `FLORA_previsualizarProduccion()` sin movimientos; la comparación final la hace Lucy.
6. Solo después se diseña y prueba el puente autenticado con la PWA y la secretaria por voz, en una copia privada con datos ficticios.

## Condiciones antes de activar registros

- Validación expresa de recetas y unidades, incluidos envases y pérdidas.
- Conteo físico inicial confirmado por Lucy, sin deducir cantidades del histórico.
- Pruebas del circuito de permisos, duplicados, conflictos y fallos de comunicación.
- Confirmación humana antes de cada escritura. Las consultas por voz no inventan ni transforman datos oficiales.

**No ejecutar aún** el registro real de producción, stock, ventas, citas o mensajes. Los cambios de código en GitHub no implementan automáticamente el procesador en la cuenta de Lucy.
