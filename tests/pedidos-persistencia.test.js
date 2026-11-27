'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const {planificarAltaPedido}=require('../src/pedidos-persistencia');
const orden={confirmado:true,requestId:'FLORA-REQ-0001',pedidoId:'FLP-0001',fecha:'2026-11-26',clienteNombre:'Cliente ficticio',items:[{productoId:'FL-003',cantidad:5},{productoId:'FL-005',cantidad:3}]};
test('prepara pedido con varios productos sin escribir datos',()=>{const p=planificarAltaPedido(orden);assert.equal(p.pedido[6],'PENDIENTE');assert.equal(p.items.length,2);assert.deepEqual(p.items.map(x=>x[6]),[0,0]);assert.equal(p.evento[4],'ALTA_PEDIDO');});
test('requiere confirmación e idempotencia',()=>{assert.throws(()=>planificarAltaPedido({...orden,confirmado:false}),/confirmación/);assert.equal(planificarAltaPedido(orden,[],['FLORA-REQ-0001']).duplicada,true);assert.throws(()=>planificarAltaPedido(orden,['FLP-0001']),/duplicado/);});
test('no acepta pedido vacío ni cantidades fraccionarias',()=>{assert.throws(()=>planificarAltaPedido({...orden,items:[]}),/sin productos/);assert.throws(()=>planificarAltaPedido({...orden,items:[{productoId:'FL-003',cantidad:1.5}]}),/inválido/);});
