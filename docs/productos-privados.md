# Flora OS · Productos y recetas privadas

## Estado

La pantalla privada está preparada en `apps-script/FloraProductosPrivado.gs` y
`apps-script/FloraProductosPrivado.html`, pero **todavía no está desplegada**.
La PWA pública de GitHub Pages **no debe mostrar fórmulas privadas**.

## Fuente de información

- Libro de Google de Lucy: `FLORA_OS_DB`.
- Lectura de `PRODUCTOS` y `BORRADOR_RECETAS`, sin copiar, pegar o editar hojas.
- Las recetas todavía son **PENDIENTE**: no están aprobadas para fabricar.
- Los aceites y las hierbas se pesan individualmente; aceites esenciales en gotas.
  Corregir la base con Lucy antes de usar las cantidades. No convertir ml a g
  automáticamente sin densidad verificada.

## Habilitación privada — una sola vez

1. Desde la cuenta propietaria de Lucy, abrir `FLORA_OS_DB` y **Extensiones → Apps Script**.
2. Crear/actualizar los dos archivos de la carpeta `apps-script` con esos nombres;
   el HTML debe ser un archivo HTML del proyecto, no texto dentro del `.gs`.
3. En **Configuración del proyecto → Propiedades de secuencia de comandos**,
   definir `FLORA_SPREADSHEET_ID` con el ID del libro propietario.
4. Desplegar como **Aplicación web**, ejecutando como **usuario que accede**
   (no como propietaria) y con acceso **solo para cuentas Google identificadas**.
   No permitir acceso anónimo ni publicar las recetas por URL abierta.
5. Lucy autoriza el uso de Google al abrirla por primera vez. Alex también puede
   probar con su propia cuenta si conserva el permiso de lectura de la base.
6. Verificar desde ambos usuarios que la pantalla carga productos y que una
   cuenta sin acceso al libro no puede verlos. Recién entonces enlazar la URL
   privada desde el botón `Productos` de la PWA pública.

**Pendiente:** ejecutar el despliegue real y probar permisos. Subir el código a
GitHub no despliega esta aplicación ni sustituye la autorización de Google.

## Seguridad

- Ningún ingrediente o cantidad real está incluido en los archivos públicos.
- La consulta requiere cuenta Google identificable y permiso al libro.
- No hay escrituras, altas de productos ni actualización de stock.
- No registrar ventas o fabricación desde cantidades sin aprobar.
- El circuito de voz y las operaciones de escritura se integrarán después,
  mediante confirmación y verificaciones independientes.
