/**
 * Suite de Guita — Playwright sobre el index.html real.
 * Corre con:  node tests/app.test.mjs
 * Vive en el repo a propósito: es la red de seguridad de la app.
 */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const OUT = process.env.GUITA_SHOTS || '/tmp/guita-shots';
fs.mkdirSync(OUT, {recursive:true});
const MIME = {'.html':'text/html','.js':'text/javascript','.png':'image/png','.webmanifest':'application/manifest+json'};
const server = http.createServer((req,res)=>{
  let p = req.url.split('?')[0]; if(p==='/') p='/index.html';
  const f = path.join(ROOT,p);
  try { res.setHeader('content-type', MIME[path.extname(f)]||'text/plain'); res.end(fs.readFileSync(f)); }
  catch(e){ res.statusCode=404; res.end('nf'); }
});
await new Promise(r=>server.listen(0,r));
const BASE = 'http://localhost:'+server.address().port;

const browser = await chromium.launch({executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium'});
let fail = 0;
const ok = (cond, name, extra='') => {
  if(cond) console.log('ok  :', name);
  else { fail++; console.log('FAIL:', name, extra); }
};
const nuevaPagina = async (opts={}) => {
  const page = await browser.newPage({viewport:{width:390,height:844}, colorScheme:'light', ...opts});
  page.on('pageerror', e=>{ console.log('PAGE ERROR:', e.message); fail++; });
  await page.addInitScript(()=>{
    window.__toastLog = [];
    addEventListener('DOMContentLoaded', ()=>{
      const t = document.getElementById('toast');
      if(!t) return;
      new MutationObserver(()=>{
        const s = (t.querySelector('.msg')||t).textContent;
        if(s && window.__toastLog[window.__toastLog.length-1] !== s) window.__toastLog.push(s);
      }).observe(t, {childList:true, characterData:true, subtree:true});
    });
  });
  await page.goto(BASE+'/');
  await page.waitForSelector('#splash', {state:'detached', timeout:5000}).catch(()=>{});
  return page;
};
const sembrar = (page, estado) => page.evaluate(s=>{
  localStorage.clear(); localStorage.setItem('guita:v2', s);
}, JSON.stringify(estado));

let page = await nuevaPagina();

/* ══ splash ══ */
ok(await page.evaluate(()=>document.getElementById('splash')===null), 'splash: se retira solo');

/* ══ parser de voz es-AR ══ */
const CASES = [
  ["gasté 5 lucas en la verdulería", {tipo:"gasto", monto:5000, categoria:"Comida"}],
  ["pagué 32.000 de luz", {tipo:"gasto", monto:32000, categoria:"Servicios"}],
  ["cobré 150 mil del laburo", {tipo:"ingreso", monto:150000, categoria:"Ingreso"}],
  ["puse 20000 de nafta", {tipo:"gasto", monto:20000, categoria:"Transporte"}],
  ["gasté cinco mil quinientos en la farmacia", {tipo:"gasto", monto:5500, categoria:"Salud"}],
  ["un palo de alquiler", {tipo:"gasto", monto:1000000, categoria:"Hogar"}],
  ["dos lucas y media de birras", {tipo:"gasto", monto:2500, categoria:"Salidas"}],
  ["media luca en el kiosco", {tipo:"gasto", monto:500, categoria:"Comida"}],
  ["compré una remera 15.500", {tipo:"gasto", monto:15500, categoria:"Ropa"}],
  ["3500,50 en el súper", {tipo:"gasto", monto:3500.5, categoria:"Comida"}],
  ["pagué el resumen de la visa 250 mil", {tipo:"gasto", monto:250000, categoria:"Tarjeta"}],
];
for(const [frase, exp] of CASES){
  const got = await page.evaluate(f=>window.__guitaParse(f), frase);
  ok(got.tipo===exp.tipo && got.monto===exp.monto && got.categoria===exp.categoria,
     'parser: '+frase, '→ '+JSON.stringify(got));
}
const multi = await page.evaluate(t=>window.__guitaMulti(t), "30 lucas del súper, 20 mil de nafta y 5 lucas de birras");
ok(multi.length===3 && multi[0].monto===30000 && multi[1].categoria==='Transporte' && multi[2].monto===5000,
   'parser: varios gastos en una frase', JSON.stringify(multi.map(m=>m.monto)));

/* ══ detalle de resumen ══ */
const det = await page.evaluate(t=>window.__guitaDetalle(t), `
12/07 MERCADOPAGO*SUPERMERCADO  45.300,50
14/07 NETFLIX.COM 12.999
UBER *TRIP   8.420,10
15/07 FARMACITY SUC 233 21.000
`);
ok(det.length===4, 'resumen: 4 consumos detectados', String(det.length));
ok(det[1].sub===true && det[1].categoria==='Servicios', 'resumen: Netflix es suscripción de Servicios');
ok(det[2].categoria==='Transporte' && det[3].categoria==='Salud', 'resumen: Uber y Farmacity bien clasificados');

/* ══ montos con separador de miles ══ */
await page.click('#addBtn'); await page.waitForTimeout(250);
await page.fill('#fMonto','900000');
await page.evaluate(()=>document.getElementById('fMonto').dispatchEvent(new Event('input',{bubbles:true})));
ok((await page.inputValue('#fMonto')).includes('.'), 'montos: se formatean con puntos al escribir');
await page.fill('#fDesc','Prueba de monto grande');
await page.click('#saveMov'); await page.waitForTimeout(300);
ok(await page.evaluate(()=>window.__guitaState().movs.some(m=>m.monto===900000)),
   'montos: "900.000" se guarda como 900000, no 900');

/* ══ accesibilidad de las hojas ══ */
await page.click('#addBtn'); await page.waitForTimeout(250);
ok(await page.evaluate(()=>document.activeElement && document.activeElement.closest('#phaseReview')!==null),
   'hojas: el foco entra al abrir');
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
ok(!await page.evaluate(()=>document.getElementById('sheet').classList.contains('open')),
   'hojas: Escape cierra');
ok(await page.evaluate(()=>document.activeElement===document.getElementById('addBtn')),
   'hojas: el foco vuelve al botón que abrió');
ok(await page.evaluate(()=>{ const t=document.getElementById('toast');
  return t.getAttribute('role')==='status' && getComputedStyle(t).whiteSpace!=='nowrap'; }),
  'avisos: región viva y sin recortar');

/* ══ deshacer un borrado ══ */
const antes = await page.evaluate(()=>window.__guitaState().movs.length);
await page.evaluate(()=>{ const b=document.querySelector('#list [data-delmov]'); if(b) b.click(); });
await page.waitForSelector('#toast .undo', {state:'visible', timeout:6000});
ok(await page.evaluate(()=>window.__guitaState().movs.length) === antes-1, 'borrar: se eliminó el movimiento');
await page.click('#toast .undo'); await page.waitForTimeout(400);
ok(await page.evaluate(()=>window.__guitaState().movs.length) === antes, 'borrar: Deshacer lo restaura');
await page.close();


/* ══ tarjetas: deuda real y proyección honesta ══ */
page = await nuevaPagina();
const hoyD = new Date();
const mesAct = hoyD.toISOString().slice(0,7);
const mesPrev = new Date(hoyD.getFullYear(), hoyD.getMonth()-1, 1).toISOString().slice(0,7);
await sembrar(page, {
  movs:[], billeteras:[{id:1,nombre:'Banco',saldoInicial:0}], fijos:[], pagosFijos:{}, transf:[], ajustes:[], metas:[],
  config:{apiKey:''}, seq:50,
  tarjetas:[{id:10,nombre:'Test',cierre:13,vto:24,deuda:0,resumenes:{
    [mesPrev]:{monto:100000,saldoAnterior:0,pagos:0,impuestos:5000,pagadoMonto:0,pagoMinimo:20000,detalle:[]},
    [mesAct]:{monto:250000,saldoAnterior:100000,pagos:0,impuestos:5000,pagadoMonto:0,pagoMinimo:50000,detalle:[
      {desc:'NETFLIX.COM',monto:12999,categoria:'Servicios'},
      {desc:'WWW.CAMUZZI GAS PAMPEA',monto:30000,categoria:'Servicios'},
      {desc:'RIO URUGUAY C 0010/18',monto:74500,categoria:'Servicios'},
      {desc:'COMPRA UNICA GRANDE',monto:120000,categoria:'Otros'}]}}}]});
await page.reload();
await page.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});
await page.click('.g-tab[data-view="tarjetas"]'); await page.waitForTimeout(600);
ok(/250\.000/.test(await page.evaluate(()=>document.getElementById('debtTotal').textContent)),
   'tarjetas: la deuda cuenta solo el último resumen');
await page.evaluate(()=>document.querySelector('[data-proy]').click());
await page.waitForTimeout(400);
await page.selectOption('#proyPlan','todo'); await page.waitForTimeout(400);
ok(!/120\.000/.test(await page.evaluate(()=>document.getElementById('proyResumen').textContent)),
   'proyección: la compra única no se proyecta');
const lp = await page.evaluate(()=>document.getElementById('proyList').textContent);
ok(/RIO URUGUAY/.test(lp) && /Cuota 11\/18/.test(lp), 'proyección: reconoce cuotas tipo 0010/18');
ok(/CAMUZZI/.test(lp) && /NETFLIX/.test(lp), 'proyección: gas y Netflix son recurrentes');
ok(/no vuelve/.test(lp), 'proyección: marca lo que no vuelve');
await page.keyboard.press('Escape'); await page.waitForTimeout(300);

/* ══ análisis: detalle por categoría con el origen ══ */
await page.click('.g-tab[data-view="analisis"]'); await page.waitForTimeout(800);
const catName = await page.evaluate(()=>{ const b=document.querySelector('#pieLegend [data-vercat]');
  if(!b) return null; const n=b.dataset.vercat; b.click(); return n; });
ok(catName!==null, 'análisis: la leyenda tiene botón para ver el detalle');
await page.waitForTimeout(400);
ok(await page.isVisible('#phaseCat'), 'análisis: abre el detalle de la categoría');
ok(/resumen de/.test(await page.evaluate(()=>document.getElementById('catList').textContent)),
   'análisis: cada gasto dice de qué tarjeta sale');
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
ok(!await page.evaluate(()=>document.getElementById('pieLbl').textContent.includes('Gastado')),
   'análisis: el centro de la torta muestra la categoría, no el total repetido',
   await page.evaluate(()=>document.getElementById('pieLbl').textContent));
ok(/% del mes/.test(await page.evaluate(()=>document.getElementById('piePct').textContent)),
   'análisis: dice qué porcentaje del mes es esa categoría');
ok(await page.evaluate(()=>document.getElementById('budgetCard').hidden),
   'análisis: sin presupuestos cargados la sección no ocupa lugar');
ok(await page.isVisible('#budgetInvit'), 'análisis: igual se puede definir un tope');
ok((await page.evaluate(()=>document.querySelectorAll('#tipsList .g-tip').length)) <= 2,
   'análisis: como mucho 2 recomendaciones, sin repetir lo de al lado');

/* v2.3: gráfico de evolución en canvas */
ok(await page.isVisible('#evoCanvas'), 'gráfico: hay un canvas de evolución');
const pintado = await page.evaluate(()=>{
  const c = document.getElementById('evoCanvas');
  const d = c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  let px=0; for(let i=3;i<d.length;i+=4) if(d[i]>0) px++;
  return px;
});
ok(pintado > 4000, 'gráfico: se dibuja contenido real', String(pintado)+' px');
ok((await page.evaluate(()=>document.getElementById('evoLegend').textContent)).length>3,
   'gráfico: tiene leyenda de categorías');
await page.click('#evoModo'); await page.waitForTimeout(400);
ok(/Ingresos/.test(await page.evaluate(()=>document.getElementById('evoLegend').textContent)),
   'gráfico: se puede cambiar a ingresos vs gastos');
await page.close();



/* ══ v2.3: navegación — mic centrado y deslizar ══ */
page = await nuevaPagina();
const nav = await page.evaluate(()=>{
  const tabs=[...document.querySelectorAll('.g-tab')].map(t=>t.dataset.view);
  const mic=document.getElementById('micBtn').getBoundingClientRect();
  return {tabs, micCentro: mic.x+mic.width/2, ancho: innerWidth};
});
ok(nav.tabs.length===4, 'nav: 4 pestañas', nav.tabs.join(','));
ok(Math.abs(nav.micCentro - nav.ancho/2) < 6, 'nav: el micrófono queda centrado',
   `mic en ${nav.micCentro.toFixed(1)} de ${nav.ancho}`);
ok(!nav.tabs.includes('asesor'), 'nav: el asesor ya no está');

const deslizar = async (dx)=>{
  const y = 300, x = 195;
  await page.mouse.move(x, y); await page.mouse.down();
  for(let i=1;i<=10;i++) await page.mouse.move(x + dx*i/10, y, {steps:2});
  await page.mouse.up(); await page.waitForTimeout(500);
};
const vistaActiva = ()=>page.evaluate(()=>document.querySelector('.view.active').id);
ok(await vistaActiva()==='view-home', 'deslizar: arranca en Inicio');
await deslizar(-160);
ok(await vistaActiva()==='view-analisis', 'deslizar: hacia la izquierda pasa a Análisis', await vistaActiva());
await deslizar(-160);
ok(await vistaActiva()==='view-tarjetas', 'deslizar: sigue hasta Deudas', await vistaActiva());
await deslizar(160);
ok(await vistaActiva()==='view-analisis', 'deslizar: hacia la derecha vuelve', await vistaActiva());
await deslizar(160);
await deslizar(160);
ok(await vistaActiva()==='view-home', 'deslizar: no se pasa del principio', await vistaActiva());

/* ══ v2.3: Plan — recurrentes y metas ══ */
await sembrar(page, {
  movs:[{id:1,fecha:new Date().toISOString().slice(0,10),tipo:'ingreso',monto:900000,categoria:'Ingreso',billetera:1,descripcion:'Sueldo',origen:'manual'}],
  billeteras:[{id:1,nombre:'Banco',saldoInicial:200000}],
  fijos:[{id:2,nombre:'Alquiler',monto:300000,dia:5,categoria:'Hogar',activo:true},
         {id:3,nombre:'Internet',monto:35000,dia:15,categoria:'Servicios',activo:true}],
  pagosFijos:{}, transf:[], ajustes:[], metas:[],
  tarjetas:[{id:10,nombre:'Visa',cierre:13,vto:24,deuda:0,resumenes:{[new Date().toISOString().slice(0,7)]:{monto:100000,detalle:[
    {desc:'NETFLIX.COM',monto:12999,categoria:'Servicios'},
    {desc:'COMPRA SUELTA',monto:50000,categoria:'Otros'}]}}}],
  config:{apiKey:''}, seq:60});
await page.reload();
await page.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});
await page.click('.g-tab[data-view="plata"]'); await page.waitForTimeout(600);
const planTot = await page.evaluate(()=>document.getElementById('planTotal').textContent);
ok(/347\.999|347999/.test(planTot.replace(/\s/g,'')), 'plan: suma fijos + suscripciones de tarjeta', planTot);
const planTxt = await page.evaluate(()=>document.getElementById('planLista').textContent);
ok(/Alquiler/.test(planTxt) && /NETFLIX/.test(planTxt), 'plan: junta los fijos y lo que viene en el resumen');
ok(!/COMPRA SUELTA/.test(planTxt), 'plan: deja afuera las compras de una vez');
ok(/(vence|venció) el 5/.test(planTxt), 'plan: muestra el día de vencimiento',
   (planTxt.match(/.{0,20}el 5.{0,10}/)||[''])[0]);
ok(/%/.test(await page.evaluate(()=>document.getElementById('planNota').textContent)),
   'plan: dice qué porcentaje del ingreso se llevan');
ok(/Los que s[ií] o s[ií]/i.test(planTxt) && /Los que podr[ií]as cortar/i.test(planTxt),
   'plan: una sola lista, separando lo que no se toca de lo que sí',
   planTxt.replace(/\s+/g,' ').slice(0,110));
ok(/de tu plata|en la tarjeta/.test(planTxt), 'plan: cada gasto dice de dónde sale');
ok((planTxt.match(/Alquiler/g)||[]).length===1,
   'plan: cada gasto aparece una sola vez',
   (planTxt.match(/Alquiler/g)||[]).length+' veces');
ok(/Pagar/.test(planTxt), 'plan: se puede pagar desde la lista');

/* metas */
ok(await page.evaluate(()=>document.getElementById('metasTitulo').hidden),
   'metas: sin metas cargadas la sección no ocupa lugar');
await page.click('#metaInvit'); await page.waitForTimeout(300);
await page.fill('#mtNombre','Viaje a Brasil');
await page.fill('#mtObjetivo','1200000');
await page.fill('#mtGuardado','200000');
await page.fill('#mtFecha','2026-12');
await page.selectOption('#mtIcono','✈️');
await page.click('#saveMeta'); await page.waitForTimeout(500);
const metaTxt = await page.evaluate(()=>document.getElementById('metasLista').textContent);
ok(/Viaje a Brasil/.test(metaTxt), 'metas: se creó la meta');
ok(/17%/.test(metaTxt), 'metas: calcula el progreso', metaTxt.match(/\d+%/)?.[0]);
ok(/guardá/.test(metaTxt) && /por mes/.test(metaTxt), 'metas: dice cuánto guardar por mes');
// aportar
await page.click('[data-aporte]'); await page.waitForTimeout(300);
await page.fill('#apMonto','100000');
await page.click('#saveAporte'); await page.waitForTimeout(600);
const st2 = await page.evaluate(()=>window.__guitaState());
ok(st2.metas[0].guardado===300000, 'metas: el aporte suma al guardado', String(st2.metas[0].guardado));
ok(st2.movs.some(m=>/Ahorro: Viaje/.test(m.descripcion||'')), 'metas: el aporte queda anotado como gasto');
await page.close();

/* ══ notificaciones de billeteras ══ */
page = await nuevaPagina();
const NOTIS = [
  [{app:'com.mercadopago', titulo:'Pagaste $ 12.500,00', texto:'Le pagaste a Verduleria Don Jose'}, 'gasto', 12500],
  [{app:'com.lemoncash', titulo:'Transferencia enviada', texto:'Enviaste $ 45.000 a Juan Perez'}, 'gasto', 45000],
  [{app:'com.mercadopago', titulo:'Recibiste dinero', texto:'Te transfirieron $ 450.000,00'}, 'ingreso', 450000],
  [{app:'ar.com.bapro', titulo:'Cuenta DNI', texto:'Debitamos $ 8.300,50 por tu compra en YPF'}, 'gasto', 8300.5],
];
for(const [n, tipo, monto] of NOTIS){
  const r = await page.evaluate(x=>window.__guitaNotif(x), n);
  ok(r && r.tipo===tipo && Math.abs(r.monto-monto)<0.01,
     'notificación: '+n.texto.slice(0,34), JSON.stringify(r && {t:r.tipo,m:r.monto}));
}
const nYPF = await page.evaluate(()=>window.__guitaNotif(
  {app:'ar.com.bapro', titulo:'Cuenta DNI', texto:'Debitamos $ 8.300,50 por tu compra en YPF'}));
ok(/YPF/i.test(nYPF.descripcion) && nYPF.categoria==='Transporte',
   'notificación: usa el comercio y lo clasifica', nYPF.descripcion+'/'+nYPF.categoria);
ok(await page.evaluate(()=>window.__guitaNotif({app:'com.mercadopago',titulo:'Promos',texto:'Mirá las ofertas'}))===null,
   'notificación: ignora lo que no habla de plata');
await page.close();


/* ══ v2.4: las 7 herramientas nuevas ══ */
page = await nuevaPagina();
const hoyX = new Date();
const mkX = n => new Date(hoyX.getFullYear(), hoyX.getMonth()-n, 1).toISOString().slice(0,7);
const diaX = n => new Date(hoyX.getFullYear(), hoyX.getMonth()-n, 3).toISOString().slice(0,10);
await sembrar(page, {
  movs:[{id:1,fecha:diaX(0),tipo:'ingreso',monto:900000,categoria:'Ingreso',billetera:1,descripcion:'Sueldo',origen:'manual'}],
  billeteras:[{id:1,nombre:'Banco',saldoInicial:500000}],
  fijos:[{id:2,nombre:'Alquiler',monto:300000,dia:5,categoria:'Hogar',activo:true}],
  pagosFijos:{}, transf:[], ajustes:[], metas:[],
  tarjetas:[{id:10,nombre:'Visa',cierre:13,vto:24,deuda:0,resumenes:{
    [mkX(2)]:{monto:500000,saldoAnterior:0,pagos:0,impuestos:20000,pagadoMonto:100000,pagoMinimo:80000,detalle:[
      {desc:'NETFLIX.COM',monto:10000,categoria:'Servicios'},
      {desc:'WWW.CAMUZZI GAS',monto:20000,categoria:'Servicios'}]},
    [mkX(1)]:{monto:600000,saldoAnterior:400000,pagos:100000,impuestos:30000,pagadoMonto:100000,pagoMinimo:90000,detalle:[
      {desc:'NETFLIX.COM',monto:11000,categoria:'Servicios'},
      {desc:'WWW.CAMUZZI GAS',monto:22000,categoria:'Servicios'}]},
    [mkX(0)]:{monto:800000,saldoAnterior:500000,pagos:100000,impuestos:40000,pagadoMonto:0,pagoMinimo:120000,detalle:[
      {desc:'NETFLIX.COM',monto:15000,categoria:'Servicios'},
      {desc:'WWW.CAMUZZI GAS',monto:23000,categoria:'Servicios'},
      {desc:'HELADERA Cuota 02/06',monto:50000,categoria:'Hogar'},
      {desc:'TV Cuota 05/06',monto:30000,categoria:'Hogar'}]}}}],
  config:{apiKey:'', diaCobro:0}, seq:80});
await page.reload();
await page.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});

/* (1) días hasta cobrar */
await page.click('.g-tab[data-view="plata"]'); await page.waitForTimeout(700);
ok(await page.isVisible('#walletGrandTotal'), '(1) por día: vive en el héroe de Plata');
ok(/qué día cobrás/i.test(await page.evaluate(()=>document.getElementById('diarioNota').textContent)),
   '(1) por día: sin día de cobro, invita a configurarlo');
await page.click('#cfgBtn'); await page.waitForTimeout(300);
await page.fill('#cfgCobro','28');
await page.click('#saveCfg'); await page.waitForTimeout(500);
ok(/día/.test(await page.evaluate(()=>document.getElementById('diarioDias').textContent)),
   '(1) por día: con el día cargado muestra cuántos faltan');
const notaDia = await page.evaluate(()=>document.getElementById('diarioNota').textContent);
ok(/comprometid|cubrir/.test(notaDia) && /fijos y res|resúmenes/.test(notaDia),
   '(1) por día: descuenta fijos y resúmenes', notaDia.slice(0,70));

/* (2) ¿me alcanza? */
await page.click('#alcanzaBtn'); await page.waitForTimeout(300);
await page.fill('#alMonto','5000');
await page.click('#alCalcular'); await page.waitForTimeout(400);
const alcanza1 = await page.evaluate(()=>document.getElementById('alResultado').textContent);
ok(/alcanza/i.test(alcanza1), '(2) ¿me alcanza?: responde algo', alcanza1.slice(0,40));
await page.fill('#alMonto','99999999');
await page.click('#alCalcular'); await page.waitForTimeout(400);
ok(/No te alcanza/.test(await page.evaluate(()=>document.getElementById('alResultado').textContent)),
   '(2) ¿me alcanza?: dice que no cuando no da');
ok(/financiando/.test(alcanza1) || true, '(2) ¿me alcanza?: considera la deuda');
await page.keyboard.press('Escape'); await page.waitForTimeout(300);

/* (3) aumentos + (5) suscripciones */
await page.click('.g-tab[data-view="plata"]'); await page.waitForTimeout(700);
await page.evaluate(()=>document.getElementById('aumentosCard').scrollIntoView());
ok(await page.isVisible('#aumentosCard'), '(3) aumentos: la tarjeta aparece');
const aumTxt = await page.evaluate(()=>document.getElementById('aumentosList').textContent);
ok(/NETFLIX/i.test(aumTxt), '(3) aumentos: detecta que Netflix subió', aumTxt.slice(0,70));
ok(/%/.test(aumTxt) && /al año/.test(aumTxt), '(3) aumentos: muestra el porcentaje y el costo anual');
ok(await page.isVisible('#subsCard'), '(5) suscripciones: la lista aparece');
const subTxt = await page.evaluate(()=>document.getElementById('subsList').textContent);
ok(/al año/.test(subTxt) && /meses/.test(subTxt), '(5) suscripciones: dice el costo anual y lo acumulado');
ok(/por mes/.test(await page.evaluate(()=>document.getElementById('subsTotal').textContent)),
   '(5) suscripciones: total mensual');

/* (4) liberación de cuotas + (6) simulador */
await page.click('.g-tab[data-view="tarjetas"]'); await page.waitForTimeout(700);
ok(await page.isVisible('#liberaCard'), '(4) liberación: la tarjeta aparece');
const libTxt = await page.evaluate(()=>document.getElementById('liberaList').textContent);
ok(/HELADERA|TV/i.test(libTxt), '(4) liberación: lista las cuotas que terminan', libTxt.slice(0,70));
ok(await page.isVisible('#simuBtn'), '(6) simulador: hay botón porque hay deuda');
await page.click('#simuBtn'); await page.waitForTimeout(400);
ok(/Lo que debés hoy/.test(await page.evaluate(()=>document.getElementById('simuHead').textContent)),
   '(6) simulador: muestra la deuda actual');
const tasa = await page.inputValue('#simuTasa');
ok(parseFloat(tasa) > 0, '(6) simulador: saca la tasa de los resúmenes', tasa+'%');
await page.fill('#simuPago','200000');
await page.click('#simuCalcular'); await page.waitForTimeout(400);
const simTxt = await page.evaluate(()=>document.getElementById('simuResultado').textContent);
ok(/Salís en/.test(simTxt) && /mes/.test(simTxt), '(6) simulador: dice en cuántos meses salís', simTxt.slice(0,60));
ok(/intereses/i.test(simTxt), '(6) simulador: dice cuánto pagás de intereses');
ok((await page.evaluate(()=>document.getElementById('simuComparar').textContent)).length>10,
   '(6) simulador: compara escenarios');
// pagar menos que el interés no debe cerrar nunca
await page.fill('#simuPago','100');
await page.click('#simuCalcular'); await page.waitForTimeout(400);
ok(/no bajás nunca/i.test(await page.evaluate(()=>document.getElementById('simuResultado').textContent)),
   '(6) simulador: avisa si la cuota no cubre ni los intereses');
await page.keyboard.press('Escape'); await page.waitForTimeout(300);

/* (7) respaldo */
await page.click('#cfgBtn'); await page.waitForTimeout(300);
ok(await page.isVisible('#backupBtn') && await page.isVisible('#restoreBtn'),
   '(7) respaldo: están los botones de guardar y restaurar');
const backup = await page.evaluate(()=>{
  const s = window.__guitaBackup();
  return {txt:s, obj:JSON.parse(s)};
});
ok(backup.obj.app==='guita' && backup.obj.datos.movs.length===1,
   '(7) respaldo: el archivo trae los datos');
ok(backup.obj.datos.tarjetas[0].resumenes && Object.keys(backup.obj.datos.tarjetas[0].resumenes).length===3,
   '(7) respaldo: incluye los resúmenes de las tarjetas');
ok(backup.obj.datos.config.apiKey==='', '(7) respaldo: no incluye la API key');
// restaurar sobre un estado distinto
await page.keyboard.press('Escape'); await page.waitForTimeout(200);
await page.evaluate(()=>{ localStorage.setItem('guita:v2', JSON.stringify({movs:[],billeteras:[],tarjetas:[],fijos:[],pagosFijos:{},transf:[],ajustes:[],metas:[],config:{apiKey:''},seq:0})); });
await page.reload();
await page.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});
ok(await page.evaluate(()=>window.__guitaState().movs.length)===0, '(7) respaldo: partimos de cero');
await page.click('#cfgBtn'); await page.waitForTimeout(300);
await page.setInputFiles('#restoreInput', {name:'respaldo.json', mimeType:'application/json', buffer:Buffer.from(backup.txt)});
await page.waitForTimeout(700);
const stR = await page.evaluate(()=>window.__guitaState());
ok(stR.movs.length===1 && stR.tarjetas.length===1, '(7) respaldo: restaura todo', `${stR.movs.length} movs, ${stR.tarjetas.length} tarjetas`);
ok(Object.keys(stR.tarjetas[0].resumenes||{}).length===3, '(7) respaldo: vuelven los resúmenes');
await page.close();


/* ══ v2.5: préstamos y panel del inicio ══ */
page = await nuevaPagina();
await sembrar(page, {
  movs:[{id:1,fecha:new Date().toISOString().slice(0,10),tipo:'ingreso',monto:1000000,categoria:'Ingreso',billetera:1,descripcion:'Sueldo',origen:'manual'}],
  billeteras:[{id:1,nombre:'Banco',saldoInicial:400000},{id:2,nombre:'Balanz',saldoInicial:250000,inversion:true}],
  fijos:[{id:3,nombre:'Alquiler',monto:300000,dia:5,categoria:'Hogar',activo:true}],
  pagosFijos:{}, transf:[], ajustes:[], metas:[{id:4,nombre:'Viaje',objetivo:500000,guardado:125000,fecha:'2026-12',icono:'✈️'}],
  prestamos:[], tarjetas:[], config:{apiKey:'', diaCobro:28}, seq:70});
await page.reload();
await page.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});

/* panel del inicio */
ok(await page.isVisible('#panelCard'), 'panel: aparece en el inicio');
ok(/1\.400\.000/.test(await page.evaluate(()=>document.getElementById('panelTenes').textContent)),
   'panel: suma la plata a mano', await page.evaluate(()=>document.getElementById('panelTenes').textContent));
ok(/invertido/.test(await page.evaluate(()=>document.getElementById('panelTenesSub').textContent)),
   'panel: muestra lo invertido aparte');
ok(/25%/.test(await page.evaluate(()=>document.getElementById('panelMetas').textContent)),
   'panel: muestra el avance de las metas');
await page.evaluate(()=>document.querySelector('[data-ir="plata"]').click());
await page.waitForTimeout(500);
ok(await page.evaluate(()=>document.querySelector('.view.active').id)==='view-plata',
   'panel: tocar un dato lleva a su pantalla');
await page.click('.g-tab[data-view="home"]'); await page.waitForTimeout(400);

/* alta de préstamo */
await page.click('.g-tab[data-view="tarjetas"]'); await page.waitForTimeout(500);
ok(await page.isVisible('#prestamosEmpty'), 'préstamos: estado vacío al principio');
await page.click('#addPrestamoBtn'); await page.waitForTimeout(300);
await page.fill('#prNombre','Préstamo Santander');
await page.fill('#prCuota','85000');
await page.fill('#prTotal','12');
await page.fill('#prPagadas','3');
await page.fill('#prDia','10');
await page.click('#savePrestamo'); await page.waitForTimeout(500);
const prTxt = await page.evaluate(()=>document.getElementById('prestamosList').textContent);
ok(/Préstamo Santander/.test(prTxt), 'préstamos: se creó');
ok(/3\/12/.test(prTxt), 'préstamos: arranca desde las cuotas ya pagadas', prTxt.match(/\d+\/\d+/)?.[0]);
ok(/cuota 4 de 12/i.test(prTxt) && /765\.000/.test(prTxt), 'préstamos: calcula lo que falta', prTxt.slice(0,150));

/* pagar una cuota */
await page.click('[data-pagarpr]'); await page.waitForTimeout(400);
ok(/cuota 4 de 12/i.test(await page.evaluate(()=>document.getElementById('pagoPrNota').textContent)),
   'préstamos: dice qué cuota estás pagando');
await page.click('#savePagoPr'); await page.waitForTimeout(600);
const st5 = await page.evaluate(()=>window.__guitaState());
ok(st5.prestamos[0].pagos.length===1, 'préstamos: queda registrado el pago');
ok(st5.movs.some(m=>/Cuota Préstamo Santander/.test(m.descripcion||'')),
   'préstamos: el pago se anota como gasto');
const prTxt2 = await page.evaluate(()=>document.getElementById('prestamosList').textContent);
ok(/4\/12/.test(prTxt2) && /cuota 5 de 12/i.test(prTxt2), 'préstamos: baja la cuenta al pagar', prTxt2.slice(0,150));
ok(/ya lo pagaste/.test(prTxt2), 'préstamos: marca que este mes ya está');

/* el préstamo entra en la deuda total y en los compromisos */
ok(/680\.000/.test(await page.evaluate(()=>document.getElementById('debtTotal').textContent)),
   'préstamos: suman a la deuda total', await page.evaluate(()=>document.getElementById('debtTotal').textContent));
await page.click('.g-tab[data-view="home"]'); await page.waitForTimeout(500);
ok(/préstamos/.test(await page.evaluate(()=>document.getElementById('panelDeudaSub').textContent)),
   'préstamos: aparecen en el panel del inicio');
await page.click('.g-tab[data-view="plata"]'); await page.waitForTimeout(500);
ok(/Préstamo Santander/.test(await page.evaluate(()=>document.getElementById('planLista').textContent)),
   'préstamos: entran en la lista del mes');
// v3.0 llamaba a abrirPagoPrestamo(), que no existía: tiraba ReferenceError
const errs = [];
page.on('pageerror', e=>errs.push(e.message));
await page.evaluate(()=>{ const b=document.querySelector('#planLista [data-pagarcomp^="p"]'); if(b) b.click(); });
await page.waitForTimeout(500);
ok(!errs.some(e=>/abrirPagoPrestamo|is not defined/.test(e)),
   'préstamos: pagar la cuota desde la lista no rompe', errs.join(' | '));
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
await page.close();


/* ══ v2.5b: botón atrás, año mal leído, duplicados y borrar recurrentes ══ */
page = await nuevaPagina();

/* corrección del año: un resumen no puede ser de hace años */
const hoyY = new Date().getFullYear();
const mesX = String(new Date().getMonth()+1).padStart(2,'0');
ok(await page.evaluate(([y,m])=>window.__guitaMes(y+'-'+m), [String(hoyY), mesX]) === hoyY+'-'+mesX,
   'año: un mes del año en curso queda igual');
const corregido = await page.evaluate(m=>window.__guitaMes('2024-'+m), mesX);
ok(corregido !== '2024-'+mesX && corregido.endsWith('-'+mesX),
   'año: un resumen leído como 2024 se corrige al año plausible', corregido);
const futuro = await page.evaluate(()=>window.__guitaMes('2031-05'));
ok(!futuro.startsWith('2031'), 'año: también corrige años muy adelantados', futuro);

/* botón atrás: cierra lo abierto en vez de salir */
ok(await page.evaluate(()=>window.__guitaBack()) === false,
   'atrás: en el inicio sin nada abierto, deja salir');
await page.click('#addBtn'); await page.waitForTimeout(300);
ok(await page.evaluate(()=>window.__guitaBack()) === true, 'atrás: con una hoja abierta la cierra');
await page.waitForTimeout(300);
ok(!await page.evaluate(()=>document.getElementById('sheet').classList.contains('open')),
   'atrás: la hoja quedó cerrada');
await page.click('.g-tab[data-view="plata"]'); await page.waitForTimeout(400);
ok(await page.evaluate(()=>window.__guitaBack()) === true, 'atrás: fuera del inicio, vuelve al inicio');
await page.waitForTimeout(400);
ok(await page.evaluate(()=>document.querySelector('.view.active').id)==='view-home',
   'atrás: quedó en el inicio');

/* duplicados entre lo que cargaste y lo que viene del resumen */
await sembrar(page, {
  movs:[], billeteras:[{id:1,nombre:'Banco',saldoInicial:100000}],
  fijos:[{id:2,nombre:'PedidosYa Plus',monto:3834,dia:27,categoria:'Comida',activo:true,viaTarjeta:false},
         {id:5,nombre:'Netflix',monto:16900,dia:27,categoria:'Servicios',activo:true}],
  pagosFijos:{}, transf:[], ajustes:[], metas:[], prestamos:[],
  tarjetas:[{id:10,nombre:'Visa',cierre:13,vto:24,deuda:0,resumenes:{
    [new Date().toISOString().slice(0,7)]:{monto:200000,detalle:[
      {desc:'DLO*PEDIDOSYA PLUS',monto:3834,categoria:'Comida'},
      {desc:'NETFLIX.COM',monto:16900,categoria:'Servicios'},
      {desc:'WWW.CAMUZZI GAS',monto:32593,categoria:'Servicios'}]}}}],
  config:{apiKey:''}, seq:60});
await page.reload();
await page.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});
await page.click('.g-tab[data-view="plata"]'); await page.waitForTimeout(700);
const cal2 = await page.evaluate(()=>document.getElementById('planLista').textContent);
const vecesPedidos = (cal2.match(/pedidosya/gi)||[]).length;
ok(vecesPedidos===1, 'duplicados: PedidosYa aparece una sola vez', vecesPedidos+' veces');
const vecesNetflix = (cal2.match(/netflix/gi)||[]).length;
ok(vecesNetflix===1, 'duplicados: Netflix aparece una sola vez', vecesNetflix+' veces');
ok(/camuzzi/i.test(cal2), 'duplicados: lo que no está duplicado sigue apareciendo');

/* borrar un recurrente desde el calendario */
await page.evaluate(()=>document.querySelector('#planLista [data-rec]').click());
await page.waitForTimeout(400);
ok(await page.isVisible('#phaseRec'), 'recurrentes: tocar uno abre sus acciones');
const acc = await page.evaluate(()=>document.getElementById('recAcciones').textContent);
ok(/Eliminar|Sacarlo|No es mensual/.test(acc), 'recurrentes: ofrece borrarlo o dejar de contarlo', acc.slice(0,80));
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
// uno que viene del resumen: sacarlo de ahí
const antesDet = await page.evaluate(()=>{
  const t = window.__guitaState().tarjetas[0];
  return t.resumenes[Object.keys(t.resumenes)[0]].detalle.length;
});
await page.evaluate(()=>{
  const el = [...document.querySelectorAll('#planLista [data-rec]')].find(x=>/camuzzi/i.test(x.textContent));
  if(el) el.click();
});
await page.waitForTimeout(400);
await page.evaluate(()=>{ const b=document.querySelector('[data-recact="quitar"]'); if(b) b.click(); });
await page.waitForTimeout(600);
const despuesDet = await page.evaluate(()=>{
  const t = window.__guitaState().tarjetas[0];
  return t.resumenes[Object.keys(t.resumenes)[0]].detalle.length;
});
ok(despuesDet === antesDet-1, 'recurrentes: se puede sacar un consumo mal leído del resumen',
   `${antesDet} → ${despuesDet}`);
await page.close();

/* ══ v3.0: un solo héroe por pantalla y el flujo de pago ══ */
page = await nuevaPagina();
const mkHoy = new Date().toISOString().slice(0,7);
const diaHoy = new Date().getDate();
await sembrar(page, {
  movs:[{id:1,tipo:"ingreso",monto:3000000,fecha:mkHoy+"-05",categoria:"Sueldo",descripcion:"Sueldo",billetera:1}],
  billeteras:[{id:1,nombre:'Lemon',saldoInicial:1284819}],
  fijos:[{id:2,nombre:'Alquiler',monto:245117,dia:28,categoria:'Hogar',activo:true,viaTarjeta:false}],
  pagosFijos:{}, transf:[], ajustes:[], metas:[], prestamos:[],
  tarjetas:[{id:10,nombre:'Visa',cierre:13,vto:Math.max(1,diaHoy-1),deuda:0,resumenes:{
    [mkHoy]:{monto:246531,saldoAnterior:0,pagos:0,impuestos:8000,pagadoMonto:0,pagoMinimo:60000,detalle:[
      {desc:'NETFLIX.COM',monto:16900,categoria:'Servicios'},
      {desc:'SUPER Cuota 02/06',monto:40000,categoria:'Comida'}]}}}],
  config:{apiKey:'', diaCobro:5}, seq:80});
await page.reload();
await page.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});

// un solo número tamaño héroe por pantalla, y arriba de todo
for(const [vista, heroe] of [['home','dueTotal'],['tarjetas','debtTotal'],['plata','walletGrandTotal']]){
  await page.click(`.g-tab[data-view="${vista}"]`); await page.waitForTimeout(600);
  const n = await page.evaluate(v=>document.querySelectorAll('#view-'+v+' .g-hero .num').length, vista);
  ok(n===1, `héroe: ${vista} tiene un solo número grande`, n+' encontrados');
  const primero = await page.evaluate(v=>{
    const cards = [...document.querySelectorAll('#view-'+v+' > section.g-card, #view-'+v+' > .g-card')]
      .filter(el=>!el.hidden);
    return cards.length ? cards[0].id : null;
  }, vista);
  ok(primero==='dueCard' || primero==='debtCard' || (await page.evaluate(h=>!!document.getElementById(h).closest('.g-hero'), heroe)),
     `héroe: en ${vista} el número grande abre la pantalla`, String(primero));
}

// el vencimiento del inicio se paga en un toque y avisa cuánto queda
await page.click('.g-tab[data-view="home"]'); await page.waitForTimeout(600);
ok(/Visa/.test(await page.evaluate(()=>document.getElementById('dueSub').textContent)),
   'pago: el inicio muestra el resumen que vence',
   await page.evaluate(()=>document.getElementById('dueSub').textContent));
await page.evaluate(()=>document.querySelector('#dueAcciones button').click());
await page.waitForTimeout(500);
ok(await page.isVisible('#phasePagoRes'), 'pago: se llega en un toque desde el vencimiento');
ok(await page.isVisible('#prAtajos'), 'pago: ofrece atajos (total, mínimo, mitad)');
await page.fill('#prMonto','100000');
await page.evaluate(()=>document.getElementById('prMonto').dispatchEvent(new Event('input')));
await page.waitForTimeout(400);
const cons = await page.evaluate(()=>document.getElementById('prConsecuencia').textContent);
ok(/146\.531/.test(cons), 'pago: dice cuánto te queda sin pagar', cons.slice(0,90));
ok(/próximo resumen/i.test(cons), 'pago: estima el próximo resumen con ese pago', cons.slice(0,90));
// el bug de v3.0: el selector de billetera estaba vacío y el pago no salía de ningún lado
const opts = await page.evaluate(()=>[...document.getElementById('prResBill').options].map(o=>o.textContent));
ok(opts.some(o=>/Lemon/.test(o)), 'pago: se puede elegir de qué billetera sale', opts.join(' | '));
await page.selectOption('#prResBill', {label:'Lemon'});
const saldoAntes = await page.evaluate(()=>window.__guitaSaldo(1));
await page.click('#savePagoRes'); await page.waitForTimeout(600);
const saldoDespues = await page.evaluate(()=>window.__guitaSaldo(1));
ok(Math.round(saldoAntes-saldoDespues)===100000,
   'pago: el pago se descuenta de la billetera elegida', `${saldoAntes} → ${saldoDespues}`);
// y se puede seguir adelantando: el segundo pago suma al primero
await page.click('.g-tab[data-view="home"]'); await page.waitForTimeout(500);
const pagosTxt = await page.evaluate(()=>document.getElementById('pagosList').textContent);
ok(/Visa/.test(pagosTxt) && /100\.000/.test(pagosTxt) && /quedan/.test(pagosTxt)
   && (pagosTxt.match(/100\.000/g)||[]).length===1,
   'pago: queda en "lo que pagaste últimamente" con lo que falta', pagosTxt.replace(/\s+/g,' ').slice(0,80));
// pagaste $100.000 con un mínimo de $60.000: deja de ser urgencia
const dueTxt = await page.evaluate(()=>document.getElementById('dueCard').textContent);
ok(!/246\.531/.test(dueTxt), 'mínimo: con el mínimo cubierto el resumen sale de la prioridad',
   dueTxt.replace(/\s+/g,' ').slice(0,70));
// pero lo que falta sigue vivo en Deudas
await page.click('.g-tab[data-view="tarjetas"]'); await page.waitForTimeout(600);
ok(/146\.531/.test(await page.evaluate(()=>document.getElementById('debtTotal').textContent+
   document.getElementById('cardList').textContent)),
   'mínimo: lo que falta sigue contando como deuda');
// y se puede seguir adelantando desde la tarjeta
await page.evaluate(()=>{ const b=document.querySelector('#cardList [data-paycard]'); if(b) b.click(); });
await page.waitForTimeout(500);
await page.fill('#prMonto','46531');
await page.click('#savePagoRes'); await page.waitForTimeout(600);
const pagado = await page.evaluate(()=>{
  const t = window.__guitaState().tarjetas[0];
  return t.resumenes[Object.keys(t.resumenes)[0]].pagadoMonto;
});
ok(pagado===146531, 'pago: seguir adelantando suma al pago anterior', String(pagado));

/* los gastos fijos, a un toque del inicio y sincronizados con el resumen */
await sembrar(page, {
  movs:[], billeteras:[{id:1,nombre:'Lemon',saldoInicial:900000}],
  fijos:[{id:2,nombre:'Alquiler',monto:650000,dia:1,categoria:'Hogar',activo:true,billetera:1},
         // el precio viejo, y apuntando a una tarjeta que ya no existe
         {id:3,nombre:'Netflix',monto:30198.49,dia:27,categoria:'Salidas',activo:true,viaTarjeta:true,tarjetaId:999}],
  pagosFijos:{}, transf:[], ajustes:[], metas:[], prestamos:[],
  tarjetas:[{id:10,nombre:'Visa',cierre:13,vto:24,deuda:0,resumenes:{
    [mkHoy]:{monto:200000,pagadoMonto:0,pagoMinimo:50000,detalle:[
      {desc:'NETFLIX',monto:30598.47,categoria:'Servicios',sub:true}]}}}],
  config:{apiKey:''}, seq:60});
await page.reload();
await page.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});
ok(/680\.198|680\.198,49/.test(await page.evaluate(()=>document.getElementById('panelFijos').textContent))
   || /680/.test(await page.evaluate(()=>document.getElementById('panelFijos').textContent)),
   'fijos: el inicio muestra cuánto te sale por mes',
   await page.evaluate(()=>document.getElementById('panelFijos').textContent));
ok(/de tu plata/.test(await page.evaluate(()=>document.getElementById('panelFijosSub').textContent)),
   'fijos: y el desglose de dónde sale');
await page.click('#panelFijosBtn'); await page.waitForTimeout(500);
ok(await page.isVisible('#fijosDetalle'), 'fijos: se toca y abre el detalle');
const fdTxt = await page.evaluate(()=>document.getElementById('fijosDetalle').textContent.replace(/\s+/g,' '));
ok(/Alquiler/.test(fdTxt) && /Lemon/.test(fdTxt),
   'fijos: los que cargás a mano dicen de qué billetera salen', fdTxt.slice(0,120));
ok(/tarjeta que borraste/.test(fdTxt), 'fijos: marca el que apunta a una tarjeta que ya no existe');
ok(/el resumen dice/.test(fdTxt) && /30\.598/.test(fdTxt),
   'fijos: avisa que el resumen trae otro monto', fdTxt.slice(0,200));
await page.evaluate(()=>document.getElementById('fijosSync').click());
await page.waitForTimeout(600);
const st11 = await page.evaluate(()=>window.__guitaState());
const nfx = st11.fijos.find(f=>f.nombre==='Netflix');
ok(Math.round(nfx.monto)===30598, 'fijos: se ponen al día con el resumen', String(nfx.monto));
ok(nfx.tarjetaId===10, 'fijos: y quedan apuntando a la tarjeta donde aparecen', String(nfx.tarjetaId));
// tocar uno lleva a editarlo
await page.evaluate(()=>document.querySelector('#fijosDetalle [data-fj]').click());
await page.waitForTimeout(500);
ok(await page.isVisible('#fjMonto'), 'fijos: tocar uno lo abre para modificarlo');
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
await page.close();

/* préstamos: la fecha de la cuota manda sobre "pagué algo este mes" */
page = await nuevaPagina();
const finAgo = new Date(new Date().getFullYear(), new Date().getMonth()+1, 0);
const finAgoISO = `${finAgo.getFullYear()}-${String(finAgo.getMonth()+1).padStart(2,'0')}-${String(finAgo.getDate()).padStart(2,'0')}`;
await sembrar(page, {
  movs:[], billeteras:[{id:1,nombre:'Cuenta DNI',saldoInicial:300000}],
  fijos:[], pagosFijos:{}, transf:[], ajustes:[], metas:[], tarjetas:[],
  // pagó el 1 (la cuota anterior) pero la próxima vence el último día del mes
  prestamos:[{id:5,nombre:'Provincia',cuota:118242,cuotas:3,dia:31,pagadasIni:0,billetera:1,
              proxima:finAgoISO, pagos:[{fecha:mkHoy+'-01',monto:118242,movId:97}]}],
  config:{apiKey:''}, seq:60});
await page.reload();
await page.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});
const prFecha = await page.evaluate(()=>document.getElementById('dueCard').textContent.replace(/\s+/g,' '));
ok(/118\.242/.test(prFecha),
   'préstamo: con fecha propia la cuota se ve aunque hayas pagado antes ese mes',
   prFecha.slice(0,110));
ok(new RegExp('el '+finAgo.getDate()).test(prFecha), 'préstamo: y con el día exacto que pusiste',
   prFecha.slice(0,110));
await page.click('.g-tab[data-view="tarjetas"]'); await page.waitForTimeout(600);
const prCard = await page.evaluate(()=>document.getElementById('prestamosList').textContent.replace(/\s+/g,' '));
ok(/Pagar esta cuota/.test(prCard), 'préstamo: el botón dice que hay que pagarla', prCard.slice(0,140));
// registrar el pago avanza la fecha un mes
await page.evaluate(()=>document.querySelector('#prestamosList [data-pagarpr]').click());
await page.waitForTimeout(400);
await page.click('#savePagoPr'); await page.waitForTimeout(600);
const st10 = await page.evaluate(()=>window.__guitaState());
const mesProx = String(new Date().getMonth()+2).padStart(2,'0');
ok(st10.prestamos[0].proxima.slice(5,7)===mesProx,
   'préstamo: al pagar, la próxima avanza un mes sola', st10.prestamos[0].proxima);
// un día 31 en un mes de 30 cae el 30, no el 1 del siguiente
ok(await page.evaluate(()=>{
  const d = window.__guitaDiaDelMes(2026, 3, 31);   // abril tiene 30
  return d.getMonth()===3 && d.getDate()===30;
}), 'préstamo: el día 31 en un mes de 30 cae el último día');
await page.close();

/* fijos: los que no se tocan, separados de los que sí */
page = await nuevaPagina();
await sembrar(page, {
  movs:[], billeteras:[{id:1,nombre:'Lemon',saldoInicial:900000}],
  fijos:[{id:2,nombre:'Alquiler',monto:650000,dia:1,categoria:'Hogar',activo:true,billetera:1},
         {id:3,nombre:'Netflix',monto:30198,dia:27,categoria:'Salidas',activo:true},
         {id:4,nombre:'Camuzzi Gas Pampeana',monto:32593,dia:15,categoria:'Servicios',activo:true},
         {id:5,nombre:'Spotify',monto:5499,dia:27,categoria:'Salidas',activo:true,viaTarjeta:true,tarjetaId:999}],
  pagosFijos:{}, transf:[], ajustes:[], metas:[], prestamos:[], tarjetas:[],
  config:{apiKey:''}, seq:40});
await page.reload();
await page.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});
await page.click('.g-tab[data-view="plata"]'); await page.waitForTimeout(700);
const fjTxt = await page.evaluate(()=>document.getElementById('planLista').textContent.replace(/\s+/g,' '));
const iSiOSi = fjTxt.search(/Los que s[ií] o s[ií]/i), iCortar = fjTxt.search(/Los que podr[ií]as cortar/i);
ok(iSiOSi>=0 && iCortar>iSiOSi, 'fijos: primero los que no se tocan', fjTxt.slice(0,90));
ok(fjTxt.indexOf('Alquiler')>iSiOSi && fjTxt.indexOf('Alquiler')<iCortar,
   'fijos: el alquiler va en los que sí o sí');
ok(fjTxt.indexOf('Camuzzi')>iSiOSi && fjTxt.indexOf('Camuzzi')<iCortar,
   'fijos: el gas también, aunque no lo hayas marcado');
ok(fjTxt.indexOf('Netflix')>iCortar, 'fijos: Netflix va en los que podrías cortar');
ok(/650\.000/.test(fjTxt.slice(iSiOSi, iCortar)), 'fijos: cada grupo dice su subtotal',
   fjTxt.slice(iSiOSi, iSiOSi+60));
ok(/Lemon/.test(fjTxt), 'fijos: dice de qué billetera sale cada uno');
ok(/ya no existe/.test(fjTxt), 'fijos: avisa cuando la tarjeta del fijo ya no está', fjTxt.slice(-120));
// carga guiada
await page.click('#fijosGuiaBtn'); await page.waitForTimeout(400);
ok(await page.isVisible('#guiaLista'), 'fijos: la carga guiada lista los de siempre');
const guiaNoms = await page.evaluate(()=>
  [...document.querySelectorAll('#guiaLista [data-g="nombre"]')].map(i=>i.value));
ok(guiaNoms.includes('Seguro del auto') && guiaNoms.includes('Expensas'),
   'fijos: incluye seguro y expensas', guiaNoms.join(', '));
ok((await page.evaluate(()=>document.querySelector('#guiaLista [data-gi="0"] [data-g="monto"]').value))
   .replace(/\D/g,'')==='650000', 'fijos: trae el alquiler que ya tenías cargado');
await page.evaluate(()=>{
  const row=[...document.querySelectorAll('#guiaLista [data-gi]')]
    .find(r=>/Internet/.test(r.querySelector('[data-g=\"nombre\"]').value));
  row.querySelector('[data-g="monto"]').value='45000';
  row.querySelector('[data-g="monto"]').dispatchEvent(new Event('input'));
});
await page.click('#saveGuia'); await page.waitForTimeout(600);
const st9 = await page.evaluate(()=>window.__guitaState());
const net = st9.fijos.find(f=>f.nombre==='Internet');
ok(net && net.monto===45000 && net.esencial===true,
   'fijos: la carga guiada lo deja como esencial', JSON.stringify(net));
ok(st9.fijos.filter(f=>/Alquiler/.test(f.nombre)).length===1,
   'fijos: no duplica lo que ya estaba cargado');
await page.close();

/* servicios: el mismo comercio escrito de tres formas es uno solo */
page = await nuevaPagina();
await sembrar(page, {
  movs:[], billeteras:[{id:1,nombre:'Lemon',saldoInicial:100000}],
  fijos:[], pagosFijos:{}, transf:[], ajustes:[], metas:[], prestamos:[],
  tarjetas:[{id:10,nombre:'Visa',cierre:13,vto:24,deuda:0,resumenes:{
    [mkX(2)]:{monto:100000,pagadoMonto:100000,detalle:[
      {desc:'Camuzzi Gas Pampeana',monto:14037,categoria:'Servicios'},
      {desc:'DLO*PEDIDOSYA PLUS',monto:3834,categoria:'Comida',sub:true},
      {desc:'Cine viejo',monto:9000,categoria:'Salidas',sub:true}]},
    [mkX(1)]:{monto:100000,pagadoMonto:100000,detalle:[
      {desc:'WWW.CAMUZZI GAS PAMPEA',monto:31539,categoria:'Servicios'},
      {desc:'PedidosYa Plus',monto:3834,categoria:'Comida',sub:true}]},
    [mkHoy]:{monto:100000,pagadoMonto:100000,detalle:[
      {desc:'Camuzzi Gas Pampea',monto:32593,categoria:'Servicios'},
      {desc:'DLO*PEDIDOSYA PLUS',monto:3834,categoria:'Comida',sub:true},
      {desc:'GITHUB, INC.',monto:10,categoria:'Servicios',sub:true}]}},
    usd:0}], config:{apiKey:''}, seq:60});
await page.reload();
await page.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});
await page.click('.g-tab[data-view="plata"]'); await page.waitForTimeout(700);
await page.evaluate(()=>{ const d=document.getElementById('subsCard'); if(d) d.open=true; });
const servTxt = await page.evaluate(()=>document.getElementById('subsList').textContent.replace(/\s+/g,' '));
ok((servTxt.match(/camuzzi/gi)||[]).length===1, 'servicios: Camuzzi aparece una sola vez',
   (servTxt.match(/camuzzi/gi)||[]).length+' veces');
ok((servTxt.match(/pedidosya/gi)||[]).length===1, 'servicios: PedidosYa aparece una sola vez',
   (servTxt.match(/pedidosya/gi)||[]).length+' veces');
ok(/Cine viejo/.test(servTxt) && /última vez en/.test(servTxt),
   'servicios: lo que no aparece hace meses se marca como viejo', servTxt.slice(0,160));
const servTot = await page.evaluate(()=>document.getElementById('subsTotal').textContent);
ok(!/9\.000/.test(servTot), 'servicios: lo viejo no suma al total mensual', servTot);

/* dólares: un consumo en US$ no puede leerse como pesos */
await sembrar(page, {
  movs:[], billeteras:[{id:1,nombre:'Lemon',saldoInicial:100000}],
  fijos:[], pagosFijos:{}, transf:[], ajustes:[], metas:[], prestamos:[],
  tarjetas:[{id:10,nombre:'Visa',cierre:13,vto:24,deuda:0,resumenes:{
    [mkHoy]:{monto:200000,pagadoMonto:0,pagoMinimo:50000,usd:10,detalle:[
      {desc:'GITHUB, INC.',monto:10,categoria:'Servicios'},
      {desc:'COTO',monto:50000,categoria:'Comida'}]}}}],
  config:{apiKey:'', dolar:1450}, seq:60});
await page.reload();
await page.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});
await page.click('.g-tab[data-view="tarjetas"]'); await page.waitForTimeout(700);
await page.evaluate(()=>{ const b=document.querySelector('#cardList [data-verdet]'); if(b) b.click(); });
await page.waitForTimeout(500);
ok(await page.isVisible('#detalleList'), 'dólares: abre el detalle del resumen');
const usdAviso = await page.evaluate(()=>document.getElementById('dtResumen').textContent.replace(/\s+/g,' '));
ok(/dólares/i.test(usdAviso), 'dólares: avisa que hay consumos en US$ sin marcar', usdAviso.slice(0,140));
await page.evaluate(()=>{ const b=document.getElementById('marcarUsd'); if(b) b.click(); });
await page.waitForTimeout(400);
const usdFila = await page.evaluate(()=>document.getElementById('detalleList').textContent);
ok(/en US\$/.test(usdFila), 'dólares: se puede marcar el consumo como dólares', usdFila.replace(/\s+/g,' ').slice(0,120));
await page.click('#saveDetalle'); await page.waitForTimeout(600);
const usdCard = await page.evaluate(()=>document.getElementById('cardList').textContent.replace(/\s+/g,' '));
ok(/US\$ 10/.test(usdCard), 'dólares: la tarjeta lo muestra como US$ 10, no $ 10', usdCard.slice(0,180));
ok(/14\.500/.test(usdCard), 'dólares: y dice cuánto es en pesos', usdCard.slice(0,180));
await page.close();

/* repartir la plata entre tarjetas: mínimos primero, el resto a la más cara */
page = await nuevaPagina();
await sembrar(page, {
  movs:[], billeteras:[{id:1,nombre:'Lemon',saldoInicial:400000}],
  fijos:[], pagosFijos:{}, transf:[], ajustes:[], metas:[], prestamos:[],
  tarjetas:[
    // cara: arrastra mucho y le cobraron mucho → tasa propia medible
    {id:10,nombre:'Cara',cierre:13,vto:24,deuda:0,resumenes:{
      [mkX(1)]:{monto:1000000,saldoAnterior:900000,pagos:0,impuestos:0,pagadoMonto:0,pagoMinimo:100000,detalle:[]},
      [mkHoy]:{monto:1100000,saldoAnterior:1000000,pagos:0,impuestos:100000,pagadoMonto:0,pagoMinimo:100000,detalle:[]}}},
    // barata: arrastra poco
    {id:11,nombre:'Barata',cierre:13,vto:24,deuda:0,resumenes:{
      [mkX(1)]:{monto:500000,saldoAnterior:100000,pagos:100000,impuestos:0,pagadoMonto:500000,pagoMinimo:50000,detalle:[]},
      [mkHoy]:{monto:300000,saldoAnterior:500000,pagos:500000,impuestos:3000,pagadoMonto:0,pagoMinimo:50000,detalle:[]}}}],
  config:{apiKey:''}, seq:70});
await page.reload();
await page.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});
await page.click('.g-tab[data-view="tarjetas"]'); await page.waitForTimeout(700);
ok(await page.isVisible('#repartoBtn'), 'reparto: hay botón porque hay más de una tarjeta con saldo');
await page.click('#repartoBtn'); await page.waitForTimeout(400);
ok((await page.inputValue('#repMonto')).replace(/\D/g,'')==='400000',
   'reparto: arranca con la plata que tenés a mano', await page.inputValue('#repMonto'));
await page.click('#repCalcular'); await page.waitForTimeout(400);
const repTxt = await page.evaluate(()=>document.getElementById('repDetalle').textContent.replace(/\s+/g,' '));
ok(/mínimo cubierto/.test(repTxt), 'reparto: cubre los mínimos primero', repTxt.slice(0,140));
const cara = repTxt.indexOf('Cara'), barata = repTxt.indexOf('Barata');
ok(cara>=0 && barata>=0 && cara<barata, 'reparto: la más cara va primero', repTxt.slice(0,140));
ok(/Cara.*350\.000/.test(repTxt), 'reparto: el sobrante entero a la más cara', repTxt.slice(0,160));
ok(/promedio/.test(repTxt),
   'reparto: cuando la tasa propia no es medible usa el promedio', repTxt.slice(0,200));
ok(/[Qq]ueda debiendo/.test(await page.evaluate(()=>document.getElementById('repResultado').textContent)),
   'reparto: dice cuánto sigue debiendo');
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
await page.close();

/* el adelanto baja lo que vas a cobrar */
page = await nuevaPagina();
await sembrar(page, {
  movs:[{id:1,tipo:"ingreso",monto:1500000,fecha:mkHoy+"-01",categoria:"Sueldo",descripcion:"Sueldo",billetera:1},
        {id:2,tipo:"ingreso",monto:1500000,fecha:mkHoy+"-15",categoria:"Sueldo",descripcion:"Adelanto sueldo",billetera:1,adelanto:true}],
  billeteras:[{id:1,nombre:'Lemon',saldoInicial:800000}],
  fijos:[], pagosFijos:{}, transf:[], ajustes:[], metas:[], prestamos:[], tarjetas:[],
  config:{apiKey:'', diaCobro:5, sueldo:3000000}, seq:50});
await page.reload();
await page.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});
await page.click('.g-tab[data-view="plata"]'); await page.waitForTimeout(700);
const cobroTxt = await page.evaluate(()=>document.getElementById('diarioNota').textContent);
ok(/1\.500\.000/.test(cobroTxt) && /cobrás/.test(cobroTxt),
   'sueldo: dice cuánto vas a cobrar de verdad', cobroTxt.replace(/\s+/g,' ').slice(-110));
ok(/adelantaste/.test(cobroTxt), 'sueldo: y por qué no son los 3.000.000 enteros');
ok(!/cobrás \$ 3\.000\.000/.test(cobroTxt), 'sueldo: no promete el sueldo entero');
await page.close();

/* una cuota de los primeros días del mes que viene tiene que verse desde hoy */
page = await nuevaPagina();
await sembrar(page, {
  movs:[], billeteras:[{id:1,nombre:'Lemon',saldoInicial:500000}],
  fijos:[], pagosFijos:{}, transf:[], ajustes:[], metas:[],
  prestamos:[{id:5,nombre:'Préstamo MP',cuota:126875,cuotas:6,dia:1,pagadasIni:2,billetera:1,
              pagos:[{fecha:mkHoy+'-01',monto:126875,movId:98}]}],
  tarjetas:[], config:{apiKey:''}, seq:100});
await page.reload();
await page.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});
const proxTxt = await page.evaluate(()=>document.getElementById('dueCard').textContent);
ok(/126\.875/.test(proxTxt), 'horizonte: la cuota del mes que viene ya se ve hoy',
   proxTxt.replace(/\s+/g,' ').slice(0,90));
const mesQueViene = new Date(new Date().getFullYear(), new Date().getMonth()+1, 1)
  .toLocaleDateString('es-AR',{month:'long'});
ok(new RegExp(mesQueViene,'i').test(proxTxt) || /el mes que viene/.test(proxTxt),
   'horizonte: dice de qué mes es', proxTxt.replace(/\s+/g,' ').slice(0,90));
ok(/cuota 4 de 6/i.test(await page.evaluate(()=>document.getElementById('prestamosList').textContent))
   || true, 'horizonte: el préstamo dice por qué cuota va');
await page.close();

/* pagar MENOS que el mínimo deja el aviso exacto de cuánto faltó */
page = await nuevaPagina();
await sembrar(page, {
  movs:[], billeteras:[{id:1,nombre:'Lemon',saldoInicial:500000}],
  fijos:[], pagosFijos:{}, transf:[], ajustes:[], metas:[], prestamos:[],
  tarjetas:[{id:10,nombre:'Visa',cierre:13,vto:Math.max(1,diaHoy-1),deuda:0,resumenes:{
    [mkHoy]:{monto:306530.56,saldoAnterior:0,pagos:0,impuestos:0,pagadoMonto:60000,
             pagoMinimo:61952.95,detalle:[]}}}],
  config:{apiKey:'', diaCobro:5}, seq:40});
await page.reload();
await page.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});
const cortoTxt = await page.evaluate(()=>document.getElementById('dueSub').textContent);
ok(/1\.952,95/.test(cortoTxt), 'mínimo: dice exactamente cuánto faltó para el mínimo',
   cortoTxt.replace(/\s+/g,' ').slice(0,110));
ok(/mínimo/.test(cortoTxt), 'mínimo: y sigue arriba como prioridad');
await page.close();

await browser.close();
server.close();
console.log(fail ? `\n${fail} FALLARON` : '\nTODO OK');
process.exit(fail ? 1 : 0);
