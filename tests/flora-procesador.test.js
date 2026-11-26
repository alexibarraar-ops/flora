'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const fuente = fs.readFileSync(require('node:path').join(__dirname, '../apps-script/FloraProcesador.gs'), 'utf8');

function entorno({ activo = 'SI', conStock = true } = {}) {
  const tablas = {
    PRODUCTOS: [['PRODUCTO_ID','NOMBRE','ACTIVO'], ['FL-001','Jabón ficticio',activo]],
    INSUMOS: [['INSUMO_ID','NOMBRE','UNIDAD'], ['IN-001','Base','g'],['IN-002','Envase','unidad']],
    RECETAS: [['PRODUCTO_ID','RENDIMIENTO','INSUMO_ID','CANTIDAD','UNIDAD'],['FL-001',2,'IN-001',80,'g'],['FL-001',2,'IN-002',2,'unidad']],
    EVENTOS_STOCK: [['REQUEST_ID','FECHA','TIPO','DATOS_JSON','RESULTADO_JSON']],
  };
  if (conStock) tablas.EVENTOS_STOCK.push(['INICIAL-01','2026-11-25','INICIAL','{}',JSON.stringify({ movimientos:[
    {tipo:'insumo',id:'IN-001',cantidad:200},{tipo:'insumo',id:'IN-002',cantidad:5},
  ]})]);
  let lockTaken=false;
  const hoja = (nombre) => ({
    getDataRange: () => ({getValues:()=>tablas[nombre].map(r=>r.slice())}),
    appendRow: (r) => { tablas[nombre].push(r.slice()); },
  });
  const globals = {
    Number,Date,JSON,Math,Error,RegExp,String,Object,Array,isFinite,
    PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'archivo-ficticio'})},
    SpreadsheetApp:{openById:()=>({getSheetByName:hoja}),flush:()=>{}},
    LockService:{getScriptLock:()=>({tryLock:()=>{lockTaken=true;return true},releaseLock:()=>{lockTaken=false}})},
    Utilities:{formatDate:()=> '2026-11-26'},
  };
  vm.createContext(globals);
  vm.runInContext(fuente,globals);
  return {api:globals,tablas,lockLiberado:()=>!lockTaken};
}

const orden = (id='PROD-0001') => ({requestId:id,productoId:'FL-001',cantidad:3,loteId:'LOTE-01',vencimiento:'2027-02-01',confirmado:true});

test('vista previa calcula insumos y envases', () => {
  const {api}=entorno();
  const r=api.FLORA_calcularProduccion(orden());
  assert.equal(r.cantidad,3);
  assert.deepEqual(Array.from(r.consumo,x=>x.cantidad),[120,3]);
});

test('receta sin validar bloquea cualquier elaboración', () => {
  const {api}=entorno({activo:'NO'});
  assert.throws(()=>api.FLORA_calcularProduccion(orden()),/pendiente de validación/);
});

test('sin confirmación no se registra nada', () => {
  const e=entorno();
  assert.throws(()=>e.api.FLORA_registrarProduccion({...orden(),confirmado:false}),/confirmación/);
  assert.equal(e.tablas.EVENTOS_STOCK.length,2);
});

test('faltantes impiden registrar y liberan el bloqueo', () => {
  const e=entorno({conStock:false});
  const r=e.api.FLORA_registrarProduccion(orden());
  assert.equal(r.registrada,false);
  assert.equal(r.faltantes.length,2);
  assert.equal(e.tablas.EVENTOS_STOCK.length,1);
  assert.equal(e.lockLiberado(),true);
});

test('registra un evento y repetir el ID no duplica el stock', () => {
  const e=entorno();
  const a=e.api.FLORA_registrarProduccion(orden());
  assert.equal(a.registrada,true);
  assert.equal(a.movimientos.length,3);
  assert.equal(e.tablas.EVENTOS_STOCK.length,3);
  const b=e.api.FLORA_registrarProduccion(orden());
  assert.equal(b.duplicada,true);
  assert.equal(e.tablas.EVENTOS_STOCK.length,3);
  assert.equal(e.lockLiberado(),true);
});

test('rechaza vencimiento anterior a la fecha de producción', () => {
  const e=entorno();
  assert.throws(()=>e.api.FLORA_registrarProduccion({...orden(),vencimiento:'2026-11-01'}),/Vencimiento inválido/);
});

test('ingreso inicial agrega materias primas con unidades verificadas', () => {
  const e=entorno({conStock:false});
  const ingreso={requestId:'INICIAL-10',confirmado:true,items:[
    {insumoId:'IN-001',cantidad:200,unidad:'g'},
    {insumoId:'IN-002',cantidad:5,unidad:'unidad'},
  ]};
  const r=e.api.FLORA_registrarStockInicial(ingreso);
  assert.equal(r.registrada,true);
  assert.equal(e.tablas.EVENTOS_STOCK.length,2);
  const produccion=e.api.FLORA_registrarProduccion(orden());
  assert.equal(produccion.registrada,true);
  assert.equal(e.tablas.EVENTOS_STOCK.length,3);
  assert.equal(e.lockLiberado(),true);
});

test('stock inicial solo se admite una vez, pero reintentos del mismo ID son seguros', () => {
  const e=entorno({conStock:false});
  const ingreso={requestId:'INICIAL-11',confirmado:true,items:[{insumoId:'IN-001',cantidad:10,unidad:'g'}]};
  e.api.FLORA_registrarStockInicial(ingreso);
  assert.equal(e.api.FLORA_registrarStockInicial(ingreso).duplicada,true);
  assert.throws(()=>e.api.FLORA_registrarStockInicial({...ingreso,requestId:'INICIAL-12'}),/primer evento/);
  assert.equal(e.tablas.EVENTOS_STOCK.length,2);
});

test('recepción de compra incrementa stock y no duplica al reintentar', () => {
  const e=entorno({conStock:false});
  const compra={requestId:'COMPRA-001',confirmado:true,items:[{insumoId:'IN-001',cantidad:130,unidad:'g'}]};
  assert.equal(e.api.FLORA_registrarIngresoCompra(compra).registrada,true);
  assert.equal(e.api.FLORA_registrarIngresoCompra(compra).duplicada,true);
  assert.equal(e.tablas.EVENTOS_STOCK.length,2);
  assert.equal(e.api.FLORA_registrarProduccion(orden()).registrada,false);
});

test('unidades incorrectas y cantidades negativas nunca se registran', () => {
  const e=entorno({conStock:false});
  assert.throws(()=>e.api.FLORA_registrarIngresoCompra({requestId:'COMPRA-002',confirmado:true,items:[{insumoId:'IN-001',cantidad:12,unidad:'ml'}]}),/no validada/);
  assert.throws(()=>e.api.FLORA_registrarIngresoCompra({requestId:'COMPRA-003',confirmado:true,items:[{insumoId:'IN-001',cantidad:-12,unidad:'g'}]}),/positivo/);
  assert.equal(e.tablas.EVENTOS_STOCK.length,1);
});
