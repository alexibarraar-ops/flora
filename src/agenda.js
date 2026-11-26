'use strict';
(function (root) {
  const diaISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const sumarDias = (d,n) => new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
  const inicioSemana = d => sumarDias(d,-(d.getDay()+6)%7);
  const minutos = h => Number(h.slice(0,2))*60+Number(h.slice(3,5));
  const hora = n => `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
  function sinConflicto(turnos, nuevo) {
    const comienzo=minutos(nuevo.hora),final=comienzo+nuevo.duracion;
    return final<=1440 && !turnos.some(t=>t.fecha===nuevo.fecha && comienzo<minutos(t.hora)+t.duracion && final>minutos(t.hora));
  }
  const api={diaISO,sumarDias,inicioSemana,minutos,hora,sinConflicto};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(!root.document)return;
  let seleccionado=new Date();seleccionado=new Date(seleccionado.getFullYear(),seleccionado.getMonth(),seleccionado.getDate());
  const hoy=diaISO(seleccionado);
  const turnos=[{fecha:hoy,hora:'10:00',duracion:60,cliente:'Marta · Ejemplo',servicio:'Tarot'},
    {fecha:hoy,hora:'16:00',duracion:90,cliente:'Julieta · Ejemplo',servicio:'Carta astral'},
    {fecha:diaISO(sumarDias(seleccionado,2)),hora:'15:00',duracion:120,cliente:'Grupo · Ejemplo',servicio:'Curso / taller'}];
  const $=id=>document.getElementById(id);
  const formatoMes=new Intl.DateTimeFormat('es-AR',{month:'long',year:'numeric'});
  const formatoDia=new Intl.DateTimeFormat('es-AR',{weekday:'long',day:'numeric',month:'long'});
  const formatoCorto=new Intl.DateTimeFormat('es-AR',{weekday:'short'});
  function pintar(){
    const base=inicioSemana(seleccionado),ult=sumarDias(base,6);
    $('mes').textContent=formatoMes.format(base)+(base.getMonth()!==ult.getMonth()?' · '+formatoMes.format(ult):'');
    const dias=$('dias');dias.replaceChildren();
    for(let i=0;i<7;i++){
      const dia=sumarDias(base,i),iso=diaISO(dia),btn=document.createElement('button');btn.type='button';btn.className='day'+(iso===diaISO(seleccionado)?' active':'')+(turnos.some(t=>t.fecha===iso)?' has':'');btn.setAttribute('aria-pressed',String(iso===diaISO(seleccionado)));
      const dow=document.createElement('span');dow.className='dow';dow.textContent=formatoCorto.format(dia).replace('.','');
      const num=document.createElement('span');num.className='num';num.textContent=String(dia.getDate());
      const dot=document.createElement('span');dot.className='dot';dot.setAttribute('aria-hidden','true');btn.append(dow,num,dot);btn.addEventListener('click',()=>{seleccionado=dia;pintar()});dias.append(btn);
    }
    $('tituloDia').textContent=formatoDia.format(seleccionado);
    const delDia=turnos.filter(t=>t.fecha===diaISO(seleccionado)).sort((a,b)=>a.hora.localeCompare(b.hora));
    $('cantidad').textContent=delDia.length===1?'1 turno':delDia.length+' turnos';
    const lista=$('lista');lista.replaceChildren();
    if(!delDia.length){const vacio=document.createElement('div');vacio.className='empty';vacio.innerHTML='<span class="flower" aria-hidden="true">✿</span>No hay turnos para este día.';lista.append(vacio);return;}
    delDia.forEach(t=>{const item=document.createElement('div');item.className='appt';const horas=document.createElement('div');horas.className='hour';horas.textContent=t.hora;const detalle=document.createElement('div');detalle.className='detail';const nombre=document.createElement('strong');nombre.textContent=t.cliente;const tiempo=document.createElement('span');tiempo.textContent=`${t.duracion} minutos · ${hora(minutos(t.hora)+t.duracion)} fin`;detalle.append(nombre,tiempo);const tipo=document.createElement('span');tipo.className='tag';tipo.textContent=t.servicio;item.append(horas,detalle,tipo);lista.append(item)});
  }
  $('anterior').addEventListener('click',()=>{seleccionado=sumarDias(seleccionado,-7);pintar()});
  $('siguiente').addEventListener('click',()=>{seleccionado=sumarDias(seleccionado,7);pintar()});
  const cerrar=()=>{$('modal').close();$('error').textContent=''};
  $('nuevo').addEventListener('click',()=>{$('fecha').value=diaISO(seleccionado);$('error').textContent='';$('modal').showModal()});
  $('cerrar').addEventListener('click',cerrar);$('descartar').addEventListener('click',cerrar);
  $('form').addEventListener('submit',e=>{e.preventDefault();const nuevo={cliente:$('cliente').value.trim(),servicio:$('servicio').value,fecha:$('fecha').value,hora:$('hora').value,duracion:Number($('duracion').value)};
    if(!nuevo.cliente||!nuevo.fecha||!nuevo.hora){$('error').textContent='Completá los datos del turno.';return;}
    if(!sinConflicto(turnos,nuevo)){$('error').textContent='Ese horario se superpone con otro turno o termina después de medianoche.';return;}
    turnos.push(nuevo);const p=nuevo.fecha.split('-').map(Number);seleccionado=new Date(p[0],p[1]-1,p[2]);$('form').reset();cerrar();pintar();
  });
  pintar();
})(typeof globalThis==='object'?globalThis:this);
