'use strict';
(function(root){
  const servicios=[
    {id:'tarot',icono:'✧',nombre:'Sesión de tarot',detalle:'Un espacio para explorar tus preguntas'},
    {id:'astral',icono:'☼',nombre:'Carta astral',detalle:'Una mirada a tu mapa de nacimiento'},
    {id:'solar',icono:'☀',nombre:'Revolución solar',detalle:'Un recorrido simbólico por tu nuevo ciclo'},
    {id:'taller',icono:'❀',nombre:'Cursos y talleres',detalle:'Encuentros de cosmética y preparados botánicos'}
  ];
  const horas=['10:00','11:30','15:00','16:30','18:00','19:00'];
  const isoLocal=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  function validarSolicitud(s,fechaMinima){
    if(!servicios.some(x=>x.id===s.servicio))return 'Elegí un servicio.';
    if(typeof s.fecha!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s.fecha)||s.fecha<fechaMinima)return 'Elegí una fecha válida.';
    const fecha=new Date(s.fecha+'T12:00:00Z');
    if(Number.isNaN(fecha.getTime())||fecha.toISOString().slice(0,10)!==s.fecha)return 'Elegí una fecha válida.';
    if(!horas.includes(s.hora))return 'Elegí un horario.';
    if(typeof s.nombre!=='string'||!s.nombre.trim()||s.nombre.length>80)return 'Completá el nombre.';
    if(typeof s.contacto!=='string'||!s.contacto.trim()||s.contacto.length>100)return 'Completá el contacto de prueba.';
    return '';
  }
  const api={servicios,horas,isoLocal,validarSolicitud};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(!root.document)return;
  const $=id=>document.getElementById(id);
  const fechaMinima=isoLocal(new Date());
  $('fecha').min=fechaMinima;$('fecha').value=fechaMinima;
  let servicio='',hora='';
  const serviciosNodo=$('servicios'),horariosNodo=$('horarios');
  function pintarServicios(){serviciosNodo.replaceChildren();servicios.forEach(s=>{
    const boton=document.createElement('button');boton.type='button';boton.className='service'+(servicio===s.id?' selected':'');boton.setAttribute('aria-pressed',String(servicio===s.id));
    const icon=document.createElement('span');icon.className='symbol';icon.textContent=s.icono;icon.setAttribute('aria-hidden','true');
    const info=document.createElement('span');info.className='info';const nombre=document.createElement('strong');nombre.textContent=s.nombre;const detalle=document.createElement('small');detalle.textContent=s.detalle;info.append(nombre,detalle);
    const circulo=document.createElement('span');circulo.className='radio';circulo.setAttribute('aria-hidden','true');boton.append(icon,info,circulo);
    boton.addEventListener('click',()=>{servicio=s.id;pintarServicios()});serviciosNodo.append(boton);
  })}
  function pintarHoras(){horariosNodo.replaceChildren();horas.forEach(h=>{const boton=document.createElement('button');boton.type='button';boton.className='slot'+(hora===h?' selected':'');boton.textContent=h;boton.setAttribute('aria-pressed',String(hora===h));boton.addEventListener('click',()=>{hora=h;pintarHoras()});horariosNodo.append(boton)})}
  $('form').addEventListener('submit',e=>{e.preventDefault();const datos={servicio,fecha:$('fecha').value,hora,nombre:$('nombre').value.trim(),contacto:$('contacto').value.trim()};const error=validarSolicitud(datos,fechaMinima);$('error').textContent=error;if(error)return;
    const resumen=$('resumen');resumen.replaceChildren();const titulo=document.createElement('strong');titulo.textContent='Solicitud simulada';resumen.append(titulo);
    [['Servicio',servicios.find(s=>s.id===servicio).nombre],['Fecha',datos.fecha],['Horario',datos.hora],['Nombre',datos.nombre],['Contacto de ejemplo',datos.contacto]].forEach(par=>{const fila=document.createElement('div');fila.textContent=par[0]+': '+par[1];resumen.append(fila)});
    $('paso1').classList.add('hidden');$('paso2').classList.add('hidden');$('paso3').classList.add('hidden');$('resultado').classList.remove('hidden');$('resultado').scrollIntoView({behavior:'smooth',block:'start'});
  });
  $('volver').addEventListener('click',()=>{servicio='';hora='';$('form').reset();$('fecha').value=fechaMinima;$('resultado').classList.add('hidden');['paso1','paso2','paso3'].forEach(id=>$(id).classList.remove('hidden'));$('error').textContent='';pintarServicios();pintarHoras();window.scrollTo({top:0,behavior:'smooth'})});
  pintarServicios();pintarHoras();
})(typeof globalThis==='object'?globalThis:this);
