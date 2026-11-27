/** Flora OS · Vista privada de productos/recetas. SOLO LECTURA.
 * Instalar como proyecto asociado a FLORA_OS_DB, ejecutado por el usuario que accede.
 * La cuenta que abre la vista debe tener permiso real sobre el libro.
 * No publicar su información en GitHub Pages ni implementar acceso anónimo.
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('FloraProductosPrivado')
    .setTitle('Mis productos · Flora OS');
}

function FLORA_productosPrivadosLibro_() {
  var libro = SpreadsheetApp.getActiveSpreadsheet();
  if (!libro || libro.getName() !== 'FLORA_OS_DB') throw new Error('Abrí la aplicación vinculada a FLORA_OS_DB');
  var idEsperado = PropertiesService.getScriptProperties().getProperty('FLORA_SPREADSHEET_ID');
  if (idEsperado && libro.getId() !== idEsperado) throw new Error('Base de Flora incorrecta');
  // Se debe desplegar «Ejecutar como: usuario que accede» para que Drive aplique
  // sus permisos individuales. Si el contexto no identifica al usuario, falla cerrado.
  var correo = Session.getActiveUser().getEmail();
  if (!correo) throw new Error('No se pudo identificar tu cuenta de Google. No se mostraron recetas.');
  var acceso = DriveApp.getFileById(libro.getId());
  if (!acceso) throw new Error('No tenés permiso para acceder a la base');
  return libro;
}

function FLORA_productosPrivadosTabla_(libro, nombre, columnas) {
  var hoja = libro.getSheetByName(nombre);
  if (!hoja) throw new Error('Falta la pestaña '+nombre);
  var valores = hoja.getDataRange().getValues();
  if (!valores.length || columnas.some(function(c,i){return String(valores[0][i])!==c;})) {
    throw new Error('Encabezados incompatibles en '+nombre);
  }
  return valores.slice(1).filter(function(r){return r[0]!=='';});
}

/** Solo nombres, borradores y advertencias. Ninguna receta se activa. */
function FLORA_productosPrivadosConsultar() {
  var libro = FLORA_productosPrivadosLibro_();
  var productos = FLORA_productosPrivadosTabla_(libro,'PRODUCTOS',
    ['PRODUCTO_ID','NOMBRE','TIPO','VARIANTE','UNIDAD_VENTA','ACTIVO','OBSERVACIONES']);
  var insumos = FLORA_productosPrivadosTabla_(libro,'BORRADOR_RECETAS',
    ['PRODUCTO_ID','INSUMO_ID','INSUMO','CANTIDAD_POR_UNIDAD','UNIDAD','RENDIMIENTO_UNIDADES','ESTADO','OBSERVACIONES']);
  var porProducto = {};
  insumos.forEach(function(f){
    var id=String(f[0]),cantidad=Number(String(f[3]).replace(',','.'));
    if (!Number.isFinite(cantidad) || cantidad <= 0 || String(f[6]) !== 'PENDIENTE')
      throw new Error('Borrador inválido en '+id);
    if (!porProducto[id]) porProducto[id]=[];
    porProducto[id].push({id:String(f[1]),nombre:String(f[2]),cantidad:cantidad,
      unidad:String(f[4]),advertencia:String(f[7]||'')});
  });
  var resultado = productos.map(function(f){
    var id=String(f[0]);
    return {id:id,nombre:String(f[1]),tipo:String(f[2]),variante:String(f[3]||''),
      estado:'PENDIENTE',ingredientes:porProducto[id]||[],observaciones:String(f[6]||'')};
  });
  return {productos:resultado,cantidad:resultado.length,modo:'SOLO_LECTURA',
    advertencia:'Borradores sin aprobar. No usar para fabricar.'};
}
