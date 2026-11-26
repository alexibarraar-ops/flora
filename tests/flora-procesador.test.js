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
    CLIENTES: [['CLIENTE_ID','NOMBRE','CONSENTIMIENTO_CONTACTO'],['CLI-01','Cliente de prueba','SI'],['CLI-02','Otra persona','NO']],
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

function agregarLote(e,id,cantidad,vencimiento) {
  const resultado={registrada:true,movimientos:[{tipo:'producto',id:'FL-001',cantidad,loteId:id,vencimiento}]};
  e.tablas.EVENTOS_STOCK.push(['PREV-'+id,'2026-11-20','PRODUCCION','{}',JSON.stringify(resultado)]);
}

test('venta usa primero el lote con vencimiento más cercano (FEFO)', () => {
  const e=entorno({conStock:false});
  agregarLote(e,'L-TARDE',5,'2027-02-15');
  agregarLote(e,'L-PRONTO',3,'2026-12-05');
  const r=e.api.FLORA_registrarVenta({requestId:'VENTA-001',productoId:'FL-001',cantidad:4,clienteId:'CLI-01',confirmado:true});
  assert.equal(r.registrada,true);
  assert.deepEqual(Array.from(r.movimientos,x=>[x.loteId,x.cantidad]),[['L-PRONTO',-3],['L-TARDE',-1]]);
  assert.equal(e.tablas.EVENTOS_STOCK.at(-1)[2],'VENTA');
  assert.equal(JSON.parse(e.tablas.EVENTOS_STOCK.at(-1)[3]).clienteId,'CLI-01');
  const historial=e.api.FLORA_historialCliente('CLI-01');
  assert.deepEqual(JSON.parse(JSON.stringify(historial)),[{requestId:'VENTA-001',fecha:'2026-11-26',productoId:'FL-001',cantidad:4}]);
  assert.equal(e.api.FLORA_historialCliente('CLI-02').length,0);
});

test('rechaza cliente inexistente sin descontar stock y acepta ventas anónimas', () => {
  const e=entorno({conStock:false});
  agregarLote(e,'L-VALIDO',4,'2027-02-01');
  assert.throws(()=>e.api.FLORA_registrarVenta({requestId:'VENTA-007',productoId:'FL-001',cantidad:1,clienteId:'CLI-99',confirmado:true}),/Cliente no registrado/);
  assert.equal(e.tablas.EVENTOS_STOCK.length,2);
  assert.equal(e.api.FLORA_registrarVenta({requestId:'VENTA-008',productoId:'FL-001',cantidad:1,confirmado:true}).registrada,true);
  assert.equal(e.api.FLORA_historialCliente('CLI-01').length,0);
  assert.throws(()=>e.api.FLORA_historialCliente('CLI-99'),/Cliente no registrado/);
});

test('dos intentos de venta con el mismo ID producen una única compra en el historial', () => {
  const e=entorno({conStock:false});
  agregarLote(e,'L-VALIDO',4,'2027-02-01');
  const orden={requestId:'VENTA-009',productoId:'FL-001',cantidad:2,clienteId:'CLI-01',confirmado:true};
  assert.equal(e.api.FLORA_registrarVenta(orden).registrada,true);
  assert.equal(e.api.FLORA_registrarVenta(orden).duplicada,true);
  assert.equal(e.api.FLORA_historialCliente('CLI-01').length,1);
  assert.equal(e.tablas.EVENTOS_STOCK.length,3);
});

function agregarVentaHistorica(e,id,fecha,clienteId='CLI-01',productoId='FL-001') {
  const datos={clienteId,productoId,cantidad:1};
  e.tablas.EVENTOS_STOCK.push([id,fecha,'VENTA',JSON.stringify(datos),JSON.stringify({registrada:true,movimientos:[]})]);
}

test('seguimiento calcula reposición solo con dos fechas distintas verificadas', () => {
  const e=entorno({conStock:false});
  agregarVentaHistorica(e,'HIST-001','2026-09-01');
  agregarVentaHistorica(e,'HIST-002','2026-09-01'); // dos unidades el mismo día no son dos ciclos
  assert.equal(e.api.FLORA_sugerirReposiciones('CLI-01','2026-11-26').estado,'SIN_HISTORIAL_SUFICIENTE');
  agregarVentaHistorica(e,'HIST-003','2026-10-01');
  const r=e.api.FLORA_sugerirReposiciones('CLI-01','2026-11-26');
  assert.equal(r.estado,'CON_ESTIMACIONES');
  assert.deepEqual(JSON.parse(JSON.stringify(r.sugerencias)), [{productoId:'FL-001',ultimaCompra:'2026-10-01',intervaloObservadoDias:30,fechaEstimada:'2026-10-31',estado:'POSIBLE_REPOSICION'}]);
  assert.equal(e.tablas.EVENTOS_STOCK.length,4); // no genera nuevos registros
});

test('seguimiento bloquea propuestas de contacto sin consentimiento', () => {
  const e=entorno({conStock:false});
  agregarVentaHistorica(e,'HIST-004','2026-09-01','CLI-02');
  agregarVentaHistorica(e,'HIST-005','2026-10-01','CLI-02');
  assert.equal(e.api.FLORA_sugerirReposiciones('CLI-02','2026-11-26').estado,'SIN_CONSENTIMIENTO');
  assert.equal(e.api.FLORA_sugerirReposiciones('CLI-02','2026-11-26').sugerencias.length,0);
  assert.throws(()=>e.api.FLORA_sugerirReposiciones('CLI-01','2026-02-30'),/Fecha de referencia inválida/);
});

test('bandeja general muestra solo reposiciones estimadas vencidas y consentidas', () => {
  const e=entorno({conStock:false});
  agregarVentaHistorica(e,'HIST-011','2026-09-01');
  agregarVentaHistorica(e,'HIST-012','2026-10-01');
  agregarVentaHistorica(e,'HIST-013','2026-09-01','CLI-02');
  agregarVentaHistorica(e,'HIST-014','2026-10-01','CLI-02');
  const filasAntes=e.tablas.EVENTOS_STOCK.length;
  const r=e.api.FLORA_consultarReposicionesPendientes('2026-11-26');
  assert.equal(r.totalPendientes,1);
  assert.equal(r.pendientes[0].nombre,'Cliente de prueba');
  assert.equal(r.pendientes[0].clienteId,'CLI-01');
  assert.equal(e.tablas.EVENTOS_STOCK.length,filasAntes);
  assert.equal(e.api.FLORA_consultarReposicionesPendientes('2026-10-15').totalPendientes,0);
});

test('bandeja detecta identificadores de cliente duplicados antes de sugerir', () => {
  const e=entorno({conStock:false});
  e.tablas.CLIENTES.push(['CLI-01','Copia accidental','SI']);
  assert.throws(()=>e.api.FLORA_consultarReposicionesPendientes('2026-11-26'),/CLIENTE_ID vacío o duplicado/);
});

test('no vende lotes vencidos aunque existan unidades físicas', () => {
  const e=entorno({conStock:false});
  agregarLote(e,'L-VENCIDO',10,'2026-11-25');
  const r=e.api.FLORA_registrarVenta({requestId:'VENTA-002',productoId:'FL-001',cantidad:1,confirmado:true});
  assert.equal(r.registrada,false);
  assert.equal(r.motivo,'STOCK_APTO_INSUFICIENTE');
  assert.equal(e.tablas.EVENTOS_STOCK.length,2);
});

test('no vende más que el stock apto ni registra ventas duplicadas', () => {
  const e=entorno({conStock:false});
  agregarLote(e,'L-03',3,'2027-02-01');
  const a={requestId:'VENTA-003',productoId:'FL-001',cantidad:2,confirmado:true};
  assert.equal(e.api.FLORA_registrarVenta(a).registrada,true);
  assert.equal(e.api.FLORA_registrarVenta(a).duplicada,true);
  assert.equal(e.api.FLORA_registrarVenta({...a,requestId:'VENTA-004'}).registrada,false);
  assert.equal(e.tablas.EVENTOS_STOCK.length,3);
  assert.equal(e.lockLiberado(),true);
});

test('venta requiere confirmación y cantidad entera', () => {
  const e=entorno({conStock:false});
  assert.throws(()=>e.api.FLORA_registrarVenta({requestId:'VENTA-005',productoId:'FL-001',cantidad:1,confirmado:false}),/confirmación/);
  assert.throws(()=>e.api.FLORA_registrarVenta({requestId:'VENTA-006',productoId:'FL-001',cantidad:1.5,confirmado:true}),/enteras/);
});

test('no permite reutilizar un identificador de lote de producción', () => {
  const e=entorno();
  agregarLote(e,'LOTE-01',1,'2027-02-01');
  assert.throws(()=>e.api.FLORA_registrarProduccion(orden()),/LOTE_ID ya existe/);
});
