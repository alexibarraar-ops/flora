const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const fuente = fs.readFileSync('apps-script/FloraProductosPrivado.gs', 'utf8');
const html = fs.readFileSync('apps-script/FloraProductosPrivado.html', 'utf8');

function contexto({correo='lucy@example.com',nombreLibro='FLORA_OS_DB',filasReceta}={}) {
  const datos = {
    PRODUCTOS: [
      ['PRODUCTO_ID','NOMBRE','TIPO','VARIANTE','UNIDAD_VENTA','ACTIVO','OBSERVACIONES'],
      ['FL-001','Shampoo suave','Cosmética','','unidad','NO',''],
      ['FL-002','Aceite de masajes','Cosmética','','frasco','NO',''],
    ],
    BORRADOR_RECETAS: [
      ['PRODUCTO_ID','INSUMO_ID','INSUMO','CANTIDAD_POR_UNIDAD','UNIDAD','RENDIMIENTO_UNIDADES','ESTADO','OBSERVACIONES'],
      ...(filasReceta ?? [
        ['FL-001','IN-001','Agua','20','g',5,'PENDIENTE',''],
        ['FL-001','IN-002','Aceite esencial','3','gotas',5,'PENDIENTE','Cantidad aproximada'],
        ['FL-002','IN-003','Jojoba','40','ml',5,'PENDIENTE','Confirmar unidad con Lucy'],
      ]),
    ],
  };
  const libro = {
    getName:()=>nombreLibro,
    getId:()=> 'libro-test',
    getSheetByName:(p)=>datos[p]&&({getDataRange:()=>({getValues:()=>datos[p]})}),
  };
  const entorno = {
    SpreadsheetApp:{getActiveSpreadsheet:()=>libro},
    PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})},
    Session:{getActiveUser:()=>({getEmail:()=>correo})},
    DriveApp:{getFileById:(id)=>id==='libro-test'?{}:null},
    HtmlService:{createHtmlOutputFromFile:()=>({setTitle:()=>({})})},
  };
  vm.createContext(entorno);
  vm.runInContext(fuente, entorno);
  return entorno;
}

test('lista productos y borradores desde la base sin escribir ni activar fórmulas',()=>{
  const r=contexto().FLORA_productosPrivadosConsultar();
  assert.equal(r.cantidad,2);
  assert.equal(r.modo,'SOLO_LECTURA');
  assert.equal(r.productos[0].estado,'PENDIENTE');
  assert.equal(r.productos[0].ingredientes[1].unidad,'gotas');
  assert.equal(r.productos[1].ingredientes[0].unidad,'ml');
  assert.match(r.productos[1].ingredientes[0].advertencia,/Confirmar unidad/);
});

test('sin identidad Google identificable no muestra recetas',()=>{
  assert.throws(()=>contexto({correo:''}).FLORA_productosPrivadosConsultar(),/No se pudo identificar/);
});

test('rechaza libro equivocado y recetas que no sean borradores válidos',()=>{
  assert.throws(()=>contexto({nombreLibro:'Otro'}).FLORA_productosPrivadosConsultar(),/vinculada/);
  const fila=['FL-001','IN-001','Agua','10','g',5,'APROBADO',''];
  assert.throws(()=>contexto({filasReceta:[fila]}).FLORA_productosPrivadosConsultar(),/Borrador inválido/);
});

test('la interfaz calcula dentro de Flora sin exportar datos privados ni pedir pegado',()=>{
  assert.match(html,/google\.script\.run/);
  assert.match(html,/cantidad\*n/);
  assert.match(html,/Recetas en revisión/);
  assert.doesNotMatch(html,/copiar y pegar|docs\.google\.com|spreadsheets\.google\.com/i);
  assert.doesNotMatch(html,/luciana4631|FL-001|Aceite de jojoba/);
  const codigo = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(codigo);
  assert.doesNotThrow(()=>new Function(codigo));
});
