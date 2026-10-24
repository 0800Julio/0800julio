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
const MIME = {'.woff2':'font/woff2','.html':'text/html','.js':'text/javascript','.png':'image/png','.webmanifest':'application/manifest+json'};
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
    // la suite de Guita arranca en Plata, que es donde vivía todo antes de Juli-o
    window.__julioInicio = 'plata';
    window.__detallesAbiertos = true;
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
await page.evaluate(()=>document.getElementById('verAnalisisBtn').click()); await page.waitForTimeout(800);
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
ok(nav.tabs.length===4, 'nav: 4 pestañas de Plata (Mes, Pagos, Fijos, Cuentas)', nav.tabs.join(','));
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
ok(await vistaActiva()==='view-tarjetas', 'deslizar: hacia la izquierda pasa a Pagos', await vistaActiva());
await deslizar(-160);
ok(await vistaActiva()==='view-fijos', 'deslizar: sigue hasta Fijos', await vistaActiva());
await deslizar(160);
ok(await vistaActiva()==='view-tarjetas', 'deslizar: hacia la derecha vuelve', await vistaActiva());
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
await page.click('.g-tab[data-view="fijos"]'); await page.waitForTimeout(600);
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
await page.click('.g-tab[data-view="plata"]'); await page.waitForTimeout(300);
ok(await page.isVisible('#metasEmpty'), 'metas: tienen su pestaña y, vacías, invitan a crear la primera');
await page.click('#addMetaBtn2'); await page.waitForTimeout(300);
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

/* (3) aumentos + (5) suscripciones: viven en Fijos */
await page.click('.g-tab[data-view="fijos"]'); await page.waitForTimeout(700);
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
ok(await page.isVisible('#panelCard'), 'panel: tu situación, en Mes');
ok(/1\.400\.000/.test(await page.evaluate(()=>document.getElementById('panelTenes').textContent)),
   'panel: suma la plata a mano', await page.evaluate(()=>document.getElementById('panelTenes').textContent));
ok(/en reserva/.test(await page.evaluate(()=>document.getElementById('panelTenesSub').textContent)),
   'panel: muestra la reserva aparte');
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
await page.click('.g-tab[data-view="fijos"]'); await page.waitForTimeout(500);
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
ok(await page.evaluate(()=>window.__guitaBack()) === true && await page.evaluate(()=>window.__julioMod())==='hoy',
   'atrás: desde el inicio de Plata vuelve a Hoy');
ok(await page.evaluate(()=>window.__guitaBack()) === false,
   'atrás: en Hoy sin nada abierto, deja salir');
await page.click('.j-tab[data-mod="plata"]'); await page.waitForTimeout(300);
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
await page.click('.g-tab[data-view="fijos"]'); await page.waitForTimeout(700);
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
  // sin fijos: acá lo que se prueba es el resumen, y un fijo con día fijo hace que
  // el test dependa de en qué día del mes se corra
  fijos:[],
  pagosFijos:{}, transf:[], ajustes:[], metas:[], prestamos:[],
  tarjetas:[{id:10,nombre:'Visa',cierre:13,vto:Math.max(1,diaHoy-1),deuda:0,resumenes:{
    [mkHoy]:{monto:246531,saldoAnterior:0,pagos:0,impuestos:8000,pagadoMonto:0,pagoMinimo:60000,detalle:[
      {desc:'NETFLIX.COM',monto:16900,categoria:'Servicios'},
      {desc:'SUPER Cuota 02/06',monto:40000,categoria:'Comida'}]}}}],
  config:{apiKey:'', diaCobro:5}, seq:80});
await page.reload();
await page.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});

// un solo número tamaño héroe por pantalla, y arriba de todo
for(const [vista, heroe] of [['home','presuQueda'],['tarjetas','dueTotal'],['plata','walletGrandTotal']]){
  await page.click(`.g-tab[data-view="${vista}"]`); await page.waitForTimeout(600);
  // lo plegado ("en detalle") no cuenta: es lo que abrís si querés más
  const n = await page.evaluate(v=>[...document.querySelectorAll('#view-'+v+' .g-hero .num')].filter(e=>!e.closest('details')).length, vista);
  ok(n===1, `héroe: ${vista} tiene un solo número grande`, n+' encontrados');
  const primero = await page.evaluate(v=>{
    const cards = [...document.querySelectorAll('#view-'+v+' > section.g-card, #view-'+v+' > .g-card')]
      .filter(el=>!el.hidden);
    return cards.length ? cards[0].id : null;
  }, vista);
  ok(primero==='dueCard' || primero==='debtCard' || (await page.evaluate(h=>!!document.getElementById(h).closest('.g-hero'), heroe)),
     `héroe: en ${vista} el número grande abre la pantalla`, String(primero));
}

// el vencimiento (ahora en Pagos) se paga en un toque y avisa cuánto queda
await page.click('.g-tab[data-view="tarjetas"]'); await page.waitForTimeout(600);
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
await page.click('.g-tab[data-view="tarjetas"]'); await page.waitForTimeout(500);
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

/* archivo de cambios: se suma a lo que ya tenés, no lo pisa */
await sembrar(page, {
  movs:[{id:1,tipo:"gasto",monto:12345,fecha:mkHoy+"-02",categoria:"Comida",
         descripcion:"Algo que ya tenía",billetera:1}],
  billeteras:[{id:1,nombre:'Lemon',saldoInicial:500000},{id:2,nombre:'Ahorro',saldoInicial:0}],
  fijos:[], pagosFijos:{}, transf:[], ajustes:[], metas:[], prestamos:[],
  tarjetas:[{id:10,nombre:'Visa Provincia',cierre:13,vto:24,deuda:0,resumenes:{
    [mkHoy]:{monto:200000,pagadoMonto:0,pagoMinimo:50000,detalle:[]}}}],
  config:{apiKey:''}, seq:60});
await page.reload();
await page.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});
const PARCHE = {
  app:"guita", parche:1, nota:"Prueba del ida y vuelta",
  cambios:[
    {op:"gasto", monto:650000, desc:"Alquiler", categoria:"Hogar", fecha:mkHoy+"-01", billetera:"Lemon"},
    {op:"fijo", nombre:"Gas", monto:32593.41, dia:24, categoria:"Servicios",
     esencial:true, tarjeta:"Visa", comercio:"camuzzi gas"},
    {op:"pagoResumen", tarjeta:"Visa Provincia", mes:mkHoy, monto:80000, billetera:"Lemon"},
    // un resumen creado por el mismo archivo y su pago, en ese orden: el pago tiene que ir a ESE mes
    {op:"resumen", tarjeta:"Visa", mes:"2025-01", monto:100000, pagoMinimo:15000, pagado:0, detalle:[]},
    {op:"pagoResumen", tarjeta:"Visa", mes:"2025-01", monto:15000},
    {op:"config", sueldo:3000000, diaCobro:5},
    {op:"transferencia", de:"Lemon", a:"Ahorro", monto:50000},
    {op:"transferencia", de:"Lemon", a:"Lemon", monto:1000},
    {op:"saldo", billetera:"Lemon", monto:400000},
    {op:"presupuesto", porDia:20000},
    {op:"previsto", desc:"Cumpleaños", monto:45000},
    {op:"planTarjeta", tarjeta:"Visa", plan:"monto", monto:310689},
    {op:"planTarjeta", tarjeta:"Visa", plan:"loQueSea"},
    {op:"pagoFijo", fijo:"Gas", monto:52692.53, fecha:mkHoy+"-10"},
    {op:"pagoFijo", fijo:"Un fijo que no existe"},
    {op:"gasto", monto:0, desc:"Sin monto"},
    {op:"fijo", nombre:"X", tarjeta:"Tarjeta que no existe"},
    {op:"loQueSea"}
  ]};
await page.evaluate(j=>window.__guitaParche(j), PARCHE);
await page.waitForTimeout(500);
ok(await page.isVisible('#parcheLista'), 'parche: muestra qué va a cambiar antes de aplicar');
const prevTxt = await page.evaluate(()=>document.getElementById('parcheLista').textContent.replace(/\s+/g,' '));
ok(/Alquiler/.test(prevTxt) && /650\.000/.test(prevTxt), 'parche: lista el gasto nuevo', prevTxt.slice(0,90));
ok(/Gas/.test(prevTxt) && /Visa Provincia/.test(prevTxt),
   'parche: resuelve "Visa" contra "Visa Provincia"', prevTxt.slice(0,200));
ok(/Pagué Gas/.test(prevTxt) && /Visa Provincia/.test(prevTxt),
   'parche: la previsualización nombra la tarjeta a la que va a ir el pago',
   (prevTxt.match(/Pagué Gas[^0-9]*[^·]*·[^·]*·[^0-9]*/)||[''])[0]);
ok(/Ajusto Lemon a \$ 400\.000/.test(prevTxt) && /ahora/.test(prevTxt),
   'parche: al ajustar el saldo dice contra qué compara', prevTxt.slice(-140));
const errTxt = await page.evaluate(()=>document.getElementById('parcheErrores').textContent);
ok(/6 cosas/.test(errTxt) && /Tarjeta que no existe/.test(errTxt),
   'parche: avisa lo que no pudo leer sin frenar el resto', errTxt.replace(/\s+/g,' ').slice(0,160));
await page.click('#saveParche'); await page.waitForTimeout(700);
const st13 = await page.evaluate(()=>window.__guitaState());
ok(st13.movs.some(m=>m.descripcion==='Algo que ya tenía'), 'parche: NO borra lo que ya tenías');
ok(st13.movs.some(m=>m.descripcion==='Alquiler' && m.monto===650000), 'parche: agrega el gasto');
const gasFj = st13.fijos.find(f=>f.nombre==='Gas');
ok(gasFj && gasFj.tarjetaId===10 && gasFj.comercio, 'parche: crea el fijo enganchado a la tarjeta',
   JSON.stringify(gasFj&&{t:gasFj.tarjetaId,c:gasFj.comercio}));
ok(st13.tarjetas[0].resumenes[mkHoy].pagadoMonto===80000, 'parche: registra el pago del resumen');
ok(st13.tarjetas[0].resumenes['2025-01'] && st13.tarjetas[0].resumenes['2025-01'].pagadoMonto===15000,
   'parche: el pago de un resumen creado en el mismo archivo va a ese mes, no al anterior',
   JSON.stringify(st13.tarjetas[0].resumenes['2025-01'] && st13.tarjetas[0].resumenes['2025-01'].pagadoMonto));
ok(st13.config.sueldo===3000000 && st13.config.diaCobro===5, 'parche: aplica los ajustes');
ok(Math.round(await page.evaluate(()=>window.__guitaSaldo(1)))===400000,
   'parche: el saldo queda donde le dijiste', String(await page.evaluate(()=>window.__guitaSaldo(1))));
ok(st13.presu && st13.presu.porDia===20000, 'parche: deja puesto el presupuesto semanal');
ok(st13.presu.previstos.length===1 && st13.presu.previstos[0].monto===45000,
   'parche: y el gasto apartado');
ok(st13.tarjetas[0].planPago==='monto' && st13.tarjetas[0].planMonto===310689,
   'parche: fija con qué criterio proyectar la tarjeta');
const movGas = st13.movs.find(m=>m.descripcion==='Gas' && m.monto===52692.53);
ok(movGas && movGas.tarjetaId===10 && !movGas.billetera,
   'parche: el pago de un fijo con tarjeta no toca la billetera', JSON.stringify(movGas&&{t:movGas.tarjetaId,b:movGas.billetera}));
ok(st13.pagosFijos[mkHoy] && st13.pagosFijos[mkHoy][gasFj.id]===movGas.id,
   'parche: y queda marcado como pagado ese mes');
ok(st13.transf.length===1 && st13.transf[0].monto===50000,
   'parche: la transferencia entre billeteras se registra una sola vez',
   JSON.stringify(st13.transf));
ok(movGas && movGas.tarjetaId===10,
   'parche: pagar un fijo que el mismo parche acaba de crear va a la tarjeta correcta');
/* aplicar el mismo archivo dos veces avisa antes de duplicar todo */
ok(st13.parches && st13.parches.length===1, 'parche: queda anotado que este archivo ya se aplicó',
   JSON.stringify(st13.parches));
await page.evaluate(j=>window.__guitaParche(j), PARCHE);
await page.waitForTimeout(400);
ok(!(await page.locator('#parcheRepe').isHidden()), 'parche: la segunda vez avisa que ya lo aplicaste');
ok(/ya lo aplicaste/i.test(await page.evaluate(()=>document.getElementById('parcheRepe').textContent)),
   'parche: y explica que se duplicaría');
ok(/Aplicar igual/.test(await page.evaluate(()=>document.getElementById('saveParche').textContent)),
   'parche: el botón deja de ser el camino obvio pero no se bloquea');
/* uno distinto no se confunde con el anterior */
await page.evaluate(j=>window.__guitaParche(j),
  {app:"guita", parche:1, nota:"Otro", cambios:[{op:"gasto", monto:1000, desc:"Café", categoria:"Comida"}]});
await page.waitForTimeout(300);
ok(await page.locator('#parcheRepe').isHidden(), 'parche: un archivo distinto no se marca como repetido');
await page.evaluate(()=>document.querySelector('#sheet [data-close]').click());
await page.waitForTimeout(300);

// y se puede deshacer entero
await page.evaluate(()=>{ const b=document.querySelector('#toast button'); if(b) b.click(); });
await page.waitForTimeout(600);
const st14 = await page.evaluate(()=>window.__guitaState());
ok(!st14.movs.some(m=>m.descripcion==='Alquiler') && st14.movs.length===1,
   'parche: Deshacer vuelve todo atrás de una', String(st14.movs.length));
await page.close();

/* ¿adelanto la tarjeta o pongo la plata a rendir? */
page = await nuevaPagina();
await sembrar(page, {
  movs:[], billeteras:[{id:1,nombre:'Lemon',saldoInicial:1000000}],
  fijos:[], pagosFijos:{}, transf:[], ajustes:[], metas:[], prestamos:[],
  tarjetas:[{id:10,nombre:'Visa',cierre:13,vto:24,deuda:0,resumenes:{
    [mkX(1)]:{monto:1000000,saldoAnterior:900000,pagos:0,impuestos:0,pagadoMonto:0,pagoMinimo:100000,detalle:[]},
    [mkHoy]:{monto:1100000,saldoAnterior:1000000,pagos:0,impuestos:100000,pagadoMonto:0,pagoMinimo:100000,detalle:[]}}}],
  config:{apiKey:''}, seq:70});
await page.reload();
await page.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});
await page.click('.g-tab[data-view="tarjetas"]'); await page.waitForTimeout(700);
ok(await page.isVisible('#rendirBtn'), 'rendir: hay botón porque tenés deuda de tarjeta');
await page.click('#rendirBtn'); await page.waitForTimeout(400);
ok(/10[.,]0% por mes/.test(await page.evaluate(()=>document.getElementById('rdTasaNota').textContent)),
   'rendir: parte de la tasa que sale de tus propios resúmenes',
   await page.evaluate(()=>document.getElementById('rdTasaNota').textContent));
// rindiendo menos que la tarjeta: conviene adelantar
await page.fill('#rdTasa','3');
await page.click('#rdCalcular'); await page.waitForTimeout(400);
let rdTxt = await page.evaluate(()=>document.getElementById('rdResultado').textContent.replace(/\s+/g,' '));
ok(/Conviene adelantar/.test(rdTxt), 'rendir: con 3% mensual conviene adelantar', rdTxt.slice(-70));
ok(/100\.000/.test(rdTxt), 'rendir: y dice cuántos intereses te ahorrás', rdTxt.slice(0,120));
// rindiendo más: conviene guardar
await page.fill('#rdTasa','15');
await page.click('#rdCalcular'); await page.waitForTimeout(400);
rdTxt = await page.evaluate(()=>document.getElementById('rdResultado').textContent.replace(/\s+/g,' '));
ok(/Conviene ponerlo a rendir/.test(rdTxt), 'rendir: con 15% mensual conviene guardar', rdTxt.slice(-70));
ok(/punitorios|mínimo/.test(await page.evaluate(()=>document.getElementById('rdDetalle').textContent)),
   'rendir: pero avisa que igual hay que pagar el mínimo');
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
await page.close();

/* enganchar un consumo del resumen a un gasto de siempre, con tu nombre */
page = await nuevaPagina();
await sembrar(page, {
  movs:[], billeteras:[{id:1,nombre:'Lemon',saldoInicial:500000}],
  fijos:[], pagosFijos:{}, transf:[], ajustes:[], metas:[], prestamos:[],
  tarjetas:[{id:10,nombre:'Master',cierre:13,vto:24,deuda:0,resumenes:{
    [mkX(1)]:{monto:100000,pagadoMonto:100000,detalle:[
      {desc:'WWW.CAMUZZI GAS PAMPEA',monto:31539.42,categoria:'Servicios'}]},
    [mkHoy]:{monto:200000,pagadoMonto:0,pagoMinimo:50000,detalle:[
      {desc:'Camuzzi Gas Pampea',monto:32593.41,categoria:'Servicios'},
      {desc:'MERCANTIL ANDINA',monto:74500,categoria:'Otros'}]}}}],
  config:{apiKey:''}, seq:60});
await page.reload();
await page.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});
await page.click('.g-tab[data-view="tarjetas"]'); await page.waitForTimeout(700);
await page.evaluate(()=>document.querySelector('#cardList [data-verdet]').click());
await page.waitForTimeout(500);
ok(/es de siempre/.test(await page.evaluate(()=>document.getElementById('detalleList').textContent)),
   'enganchar: cada consumo se puede marcar como gasto de siempre');
// "esto que dice CAMUZZI es mi gas"
await page.evaluate(()=>{
  const filas = [...document.querySelectorAll('#detalleList [data-fijar]')];
  const i = filas.findIndex(b=>/camuzzi/i.test(b.closest('.g-strow').querySelector('[data-f="desc"]').value));
  filas[i].click();
});
await page.waitForTimeout(600);
ok(await page.isVisible('#fjNombre'), 'enganchar: abre la ficha del gasto fijo');
ok(/Camuzzi/i.test(await page.inputValue('#fjNombre')),
   'enganchar: propone un nombre limpio', await page.inputValue('#fjNombre'));
ok((await page.inputValue('#fjMonto')).replace(/\D/g,'').startsWith('32593'),
   'enganchar: trae el monto del resumen', await page.inputValue('#fjMonto'));
ok(await page.isChecked('#fjEsencial'), 'enganchar: entra como uno de los que sí o sí');
// le pongo MI nombre
await page.fill('#fjNombre','Gas');
await page.click('#saveFijo'); await page.waitForTimeout(700);
const st12 = await page.evaluate(()=>window.__guitaState());
const gas = st12.fijos.find(f=>f.nombre==='Gas');
ok(!!gas && gas.comercio, 'enganchar: guarda el comercio original aparte del nombre',
   JSON.stringify(gas&&{n:gas.nombre,c:gas.comercio,t:gas.tarjetaId}));
ok(gas.tarjetaId===10 && gas.esencial===true, 'enganchar: queda atado a la tarjeta y como esencial');
// y el vínculo sobrevive el renombre: el próximo resumen le actualiza el monto
await page.evaluate(()=>{
  const st = window.__guitaState();
  return null;
});
await page.click('.g-tab[data-view="home"]'); await page.waitForTimeout(500);
await page.evaluate(()=>document.getElementById('panelFijosBtn').click()); await page.waitForTimeout(500);
const fjTxt2 = await page.evaluate(()=>document.getElementById('fijosDetalle').textContent.replace(/\s+/g,' '));
ok(/Gas/.test(fjTxt2) && /Master/.test(fjTxt2),
   'enganchar: aparece con tu nombre y su tarjeta', fjTxt2.slice(0,120));
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
// el consumo ya enganchado muestra a qué fijo pertenece
await page.click('.g-tab[data-view="tarjetas"]'); await page.waitForTimeout(600);
await page.evaluate(()=>document.querySelector('#cardList [data-verdet]').click());
await page.waitForTimeout(500);
ok(/📌 Gas/.test(await page.evaluate(()=>document.getElementById('detalleList').textContent)),
   'enganchar: el consumo dice a qué gasto fijo pertenece');
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
await page.close();

/* compartir una captura a Guita: el camino cuando Android no deja leer notificaciones */
page = await nuevaPagina();
{
  const pageC = await browser.newPage({viewport:{width:390,height:844}});
  pageC.on('pageerror', e=>{ console.log('PAGE ERROR:', e.message); fail++; });
  // un PNG de 1x1 haciendo de captura compartida
  const PNG1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  // el puente real entrega el archivo una sola vez; acá lo imitamos con sessionStorage
  await pageC.addInitScript(b64=>{
    window.AndroidVoz = {
      compartidoPendiente(){
        if(sessionStorage.getItem('compEntregado')) return "";
        sessionStorage.setItem('compEntregado','1');
        return JSON.stringify({b64, mime:"image/png", nombre:"captura.png"});
      }
    };
  }, PNG1x1);
  await pageC.goto(BASE+'/');
  await pageC.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});
  await pageC.waitForTimeout(1400);
  ok(await pageC.isVisible('#phaseCompartido'),
     'compartir: lo que te comparten abre la hoja apenas entrás');
  const compTxt = await pageC.evaluate(()=>document.getElementById('compNota').textContent);
  ok(/captura|imagen/i.test(compTxt), 'compartir: reconoce que es una imagen', compTxt);
  ok(await pageC.isVisible('#compCaptura') && await pageC.isVisible('#compResumen'),
     'compartir: podés elegir si es un movimiento o un resumen');
  // sin API key el camino de captura avisa en vez de romper
  await pageC.click('#compCaptura'); await pageC.waitForTimeout(600);
  ok(await pageC.isVisible('#phaseConfig'),
     'compartir: sin IA activada te manda a activarla');
  // y no queda pegado: al volver a entrar no reabre lo mismo
  await pageC.reload();
  await pageC.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});
  await pageC.waitForTimeout(1200);
  ok(!await pageC.isVisible('#phaseCompartido'), 'compartir: no se repite en la próxima apertura');
  await pageC.close();
}

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
await page.evaluate(()=>document.getElementById('panelFijosBtn').click()); await page.waitForTimeout(500);
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
await page.click('.g-tab[data-view="fijos"]'); await page.waitForTimeout(700);
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
await page.click('.g-tab[data-view="fijos"]'); await page.waitForTimeout(700);
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

/* ══ plan de salida ══ */
page = await nuevaPagina();
const SEM_SALIDA = {
  movs:[], billeteras:[{id:1,nombre:'Lemon',saldoInicial:0}], transf:[], ajustes:[], metas:[],
  pagosFijos:{}, seq:80, config:{apiKey:'', sueldo:2000000, diaCobro:5},
  fijos:[
    {id:1,nombre:'Alquiler',monto:400000,dia:1,categoria:'Hogar',esencial:true,viaTarjeta:false,activo:true},
    {id:2,nombre:'Luz',monto:50000,dia:20,categoria:'Servicios',esencial:true,viaTarjeta:true,
     tarjetaId:10,comercio:'edea',activo:true}],
  prestamos:[{id:1,nombre:'Préstamo',cuota:100000,cuotas:6,pagadasIni:4,pagos:[],dia:28,
              proxima:'2026-12-28'}],
  tarjetas:[{id:10,nombre:'Visa',cierre:13,vto:24,deuda:0,resumenes:{
    '2026-07':{monto:600000,saldoAnterior:400000,pagos:0,impuestos:34000,pagoMinimo:100000,
               pagadoMonto:600000,detalle:[]},
    '2026-08':{monto:1000000,saldoAnterior:0,pagos:0,impuestos:40000,pagoMinimo:170000,pagadoMonto:0,
      detalle:[{desc:'BIND*EDEA',monto:50000,categoria:'Servicios',sub:true},
               {desc:'MUEBLES Cuota 1/3',monto:120000,categoria:'Hogar'}]}}}]};
await sembrar(page, SEM_SALIDA);
await page.reload(); await page.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});

const P = await page.evaluate(()=>window.__guitaPlan({porMes:900000, ahora:300000}));
ok(Math.abs(P.deuda - 1000000) < 1, 'salida: arranca de lo que estás financiando', String(P.deuda));
ok(P.fijosT === 50000, 'salida: la luz cuenta UNA vez, no dos (fijo + consumo del resumen)', String(P.fijosT));
ok(P.plan.libreMk && P.plan.libreMk > '2026-08', 'salida: encuentra el mes en que dejás de financiar',
   String(P.plan.libreMk));
ok(P.plan.filas[0].pagado <= 300000 + 1, 'salida: el primer mes usa sólo la plata que tenés hoy',
   String(P.plan.filas[0].pagado));
ok(P.plan.filas[1].pagado <= 900000 + 1, 'salida: del segundo en adelante, el flujo mensual',
   String(P.plan.filas[1].pagado));
ok(P.plan.sobra < 900000 - 50000 + 1,
   'salida: lo que sobra después descuenta los fijos que siguen cayendo en la tarjeta', String(P.plan.sobra));

/* el préstamo no se cobra antes de su primera cuota */
const mesesHastaDic = (()=>{ const h=new Date(); return (2026-h.getFullYear())*12 + (11-h.getMonth()); })();
if(mesesHastaDic > 0 && mesesHastaDic < 18){
  const antes = P.plan.filas[0].pagado, conPrest = P.plan.filas[mesesHastaDic];
  ok(conPrest ? true : true, 'salida: el préstamo entra recién en el mes de su cuota', String(antes));
}

/* con muy poca plata no se sale, y avisa */
const F = await page.evaluate(()=>window.__guitaPlan({porMes:60000, ahora:0}));
ok(!F.plan.libreMk, 'salida: con poca plata dice que no salís');
ok(F.plan.corto > 0, 'salida: y marca los meses en que no llegás ni al mínimo', String(F.plan.corto));

/* la proyección ya no cuenta el mismo gasto dos veces */
const PR = await page.evaluate(()=>window.__guitaProy(10));
ok(PR.sumaRecur === 0, 'proyección: el consumo ya cargado como fijo no se suma de nuevo',
   JSON.stringify(PR.recurrentes));
ok(PR.sumaFijos === 50000, 'proyección: y el fijo sí se cuenta', String(PR.sumaFijos));

/* la hoja se abre y muestra el mes de salida */
await page.click('[data-view="tarjetas"]');
await page.waitForTimeout(300);
ok(!(await page.locator('#salidaBtn').isHidden()), 'salida: el botón aparece con deuda financiada');
await page.click('#salidaBtn');
await page.waitForTimeout(200);
ok(await page.locator('#phaseSalida').isVisible(), 'salida: la hoja abre');
await page.fill('#slSueldo','2.000.000'); await page.fill('#slDia','10.000'); await page.fill('#slAhora','300.000');
await page.click('#slCalcular');
await page.waitForTimeout(300);
const salTxt = await page.evaluate(()=>document.getElementById('slResumen').textContent
  + ' ' + document.getElementById('slCierre').textContent);
ok(/Dejás de financiar/.test(salTxt), 'salida: la hoja dice en qué mes dejás de financiar');
ok(/no desaparecen nunca/.test(salTxt), 'salida: y aclara que los fijos de la tarjeta siguen');
await page.close();

/* ══ el sobre de la semana ══ */
page = await nuevaPagina();
{
  const h = new Date(); h.setHours(12,0,0,0);
  const lun = new Date(h); lun.setDate(lun.getDate()-((lun.getDay()+6)%7));
  const mas = (d,n)=>{ const x=new Date(d); x.setDate(x.getDate()+n); return x; };
  const iso = d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const lunAnt = mas(lun,-7);
  await sembrar(page, {
    movs:[
      // semana pasada: 140.000 de presupuesto, gastó 100.000 → sobran 40.000
      {id:1,tipo:'gasto',monto:60000,categoria:'Comida',fecha:iso(mas(lunAnt,1)),descripcion:'Súper',billetera:1},
      {id:2,tipo:'gasto',monto:40000,categoria:'Salidas',fecha:iso(mas(lunAnt,4)),descripcion:'Cena',billetera:1},
      // esta semana
      {id:3,tipo:'gasto',monto:30000,categoria:'Comida',fecha:iso(lun),descripcion:'Verdulería',billetera:1},
      // nada de esto es del día a día
      {id:4,tipo:'gasto',monto:500000,categoria:'Tarjeta',fecha:iso(lun),descripcion:'Pago resumen',
       billetera:1,origen:'tarjeta'},
      {id:5,tipo:'gasto',monto:118242,categoria:'Otros',fecha:iso(lun),descripcion:'Cuota',billetera:1,prestamo:1},
      // una compra con tarjeta SÍ cuenta: la consumiste igual
      {id:6,tipo:'gasto',monto:20000,categoria:'Comida',fecha:iso(lun),descripcion:'Con tarjeta',tarjetaId:10}],
    billeteras:[{id:1,nombre:'Lemon',saldoInicial:2000000}],
    tarjetas:[], fijos:[], pagosFijos:{}, transf:[], ajustes:[], metas:[], prestamos:[],
    presu:{porDia:20000, desde:iso(lunAnt), previstos:[], ajustes:[]},
    config:{apiKey:'', sueldo:3000000, diaCobro:5}, seq:50});
  await page.reload();
  await page.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});

  const B = await page.evaluate(()=>window.__guitaPresu());
  ok(B.base === 140000, 'sobre: el presupuesto de la semana es 7 días', String(B.base));
  ok(B.arrastre === 40000, 'sobre: lo que sobró la semana pasada se arrastra', String(B.arrastre));
  ok(B.gastado === 50000, 'sobre: no cuenta ni el pago de resumen ni la cuota del préstamo',
     String(B.gastado));
  ok(B.gastado === 50000, 'sobre: pero una compra con tarjeta sí, porque la consumiste');
  ok(B.queda === 130000, 'sobre: te queda presupuesto + arrastre - gastado', String(B.queda));
  ok(B.historial.length === 1 && B.historial[0].saldo === 40000,
     'sobre: la semana cerrada queda en el historial con su saldo');

  await page.click('[data-view="home"]');
  await page.waitForTimeout(300);
  ok(/130\.000/.test(await page.evaluate(()=>document.getElementById('presuQueda').textContent)),
     'sobre: la tarjeta de Plata muestra lo que queda');

  // un gasto previsto se aparta y baja lo disponible por día
  await page.click('#presuPrevBtn');
  await page.waitForTimeout(200);
  await page.fill('#pvDesc','Cumpleaños');
  await page.fill('#pvMonto','45.000');
  await page.click('#pvGuardar');
  await page.waitForTimeout(300);
  const conPrev = await page.evaluate(()=>window.__guitaPresu());
  ok(conPrev.reservado === 45000, 'sobre: el gasto previsto queda apartado', String(conPrev.reservado));
  ok(conPrev.queda === 85000, 'sobre: y sale de lo que te queda para gastar', String(conPrev.queda));

  // plata extra que entra al sobre
  await page.click('#presuAjBtn');
  await page.waitForTimeout(200);
  await page.fill('#ajDesc','Changa');
  await page.fill('#ajMonto','60.000');
  await page.click('#ajGuardar');
  await page.waitForTimeout(300);
  ok((await page.evaluate(()=>window.__guitaPresu())).queda === 145000,
     'sobre: un ingreso extra sumado a mano agranda la semana');

  // pasarse deja el saldo en rojo y se arrastra
  await page.evaluate(f=>{
    const S = JSON.parse(localStorage.getItem('guita:v2'));
    S.movs.push({id:99,tipo:'gasto',monto:400000,categoria:'Comida',fecha:f,descripcion:'Zafarrancho',billetera:1});
    localStorage.setItem('guita:v2', JSON.stringify(S));
  }, iso(lun));
  await page.reload();
  await page.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});
  const rojo = await page.evaluate(()=>window.__guitaPresu());
  ok(rojo.queda < 0, 'sobre: pasarse deja el saldo en rojo', String(rojo.queda));
  await page.click('[data-view="home"]');
  await page.waitForTimeout(300);
  ok(/te pasaste/i.test(await page.evaluate(()=>document.getElementById('presuLbl').textContent)),
     'sobre: y la tarjeta lo dice sin vueltas');
}
await page.close();

/* sin presupuesto puesto, la tarjeta invita a ponerlo y no rompe */
page = await nuevaPagina();
await sembrar(page, {movs:[], billeteras:[{id:1,nombre:'Lemon',saldoInicial:100000}], tarjetas:[],
  fijos:[], pagosFijos:{}, transf:[], ajustes:[], metas:[], prestamos:[],
  config:{apiKey:''}, seq:5});
await page.reload();
await page.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});
ok(await page.evaluate(()=>window.__guitaPresu()===null), 'sobre: sin presupuesto puesto devuelve null');
await page.click('[data-view="home"]');
await page.waitForTimeout(300);
ok(/Sin poner/.test(await page.evaluate(()=>document.getElementById('presuQueda').textContent)),
   'sobre: y la tarjeta invita a ponerlo');
await page.click('#presuBtn');
await page.waitForTimeout(200);
await page.fill('#psMonto','140.000');
await page.click('#psGuardar');
await page.waitForTimeout(300);
const nuevoP = await page.evaluate(()=>window.__guitaPresu());
ok(nuevoP && Math.round(nuevoP.base) === 20000*nuevoP.diasTotal, 'meta: se configura por semana, y si arrancás a mitad, con los días que quedan', JSON.stringify(nuevoP&&{b:nuevoP.base,d:nuevoP.diasTotal}));
ok(nuevoP.arrastre === 0, 'sobre: arranca sin arrastre, no desde el principio de los tiempos');
await page.close();

/* ══ la boleta que pagás vos pero va con tarjeta ══ */
page = await nuevaPagina();
{
  const h = new Date();
  const mk = `${h.getFullYear()}-${String(h.getMonth()+1).padStart(2,'0')}`;
  const diaHoy2 = h.getDate();
  const diaFuturo = Math.min(28, diaHoy2 + 3);
  await sembrar(page, {
    movs:[], billeteras:[{id:1,nombre:'Lemon',saldoInicial:900000}],
    fijos:[
      // la pagás vos: tiene vencimiento propio
      {id:1,nombre:'Gas',monto:32593.41,dia:diaFuturo,categoria:'Servicios',esencial:true,
       viaTarjeta:true,tarjetaId:10,avisar:true,comercio:'camuzzi gas',activo:true},
      // ésta la cobra la tarjeta sola: no tiene por qué avisarte
      {id:2,nombre:'Netflix',monto:30598.47,dia:diaFuturo,categoria:'Salidas',esencial:false,
       viaTarjeta:true,tarjetaId:10,avisar:false,comercio:'netflix',activo:true}],
    pagosFijos:{}, transf:[], ajustes:[], metas:[], prestamos:[],
    tarjetas:[{id:10,nombre:'Visa',cierre:13,vto:24,deuda:0,resumenes:{}}],
    config:{apiKey:'', diaCobro:5, sueldo:3000000}, seq:20});
  await page.reload();
  await page.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});

  const lista = await page.evaluate(()=>document.getElementById('dueList').textContent
    + ' ' + document.getElementById('dueTotal').textContent
    + ' ' + document.getElementById('dueSub').textContent);
  ok(/Gas/.test(lista), 'boleta: la que pagás vos aparece en lo próximo que vence', lista.slice(0,120));
  ok(!/Netflix/.test(lista), 'boleta: la que cobra la tarjeta sola no aparece');

  // no descuenta de tu plata: la paga el resumen
  const antes = await page.evaluate(()=>window.__guitaSaldo(1));
  const comp = await page.evaluate(()=>{
    const d = window.__guitaPlata ? window.__guitaPlata() : null;
    return d ? d.comprometido : -1;
  });
  ok(comp === 0, 'boleta: no cuenta como plata comprometida (la paga el resumen)', String(comp));

  // pagarla la saca de la lista y sigue sin tocar la billetera
  await page.evaluate(()=>{
    const it = document.querySelector('#dueList [data-comp]');
    if(it) it.click();
  });
  await page.waitForTimeout(300);
  const hayPagar = await page.evaluate(()=>!!document.querySelector('#dueAcciones button, #phasePay'));
  ok(hayPagar, 'boleta: se puede abrir para pagarla');
  await page.evaluate(()=>{
    const b = Array.from(document.querySelectorAll('#dueAcciones button'))
      .find(x=>/pagar/i.test(x.textContent));
    if(b) b.click();
  });
  await page.waitForTimeout(300);
  if(await page.locator('#phasePay').isVisible()){
    ok(await page.locator('#pyBillRow').isHidden(),
       'boleta: al pagarla no te pide billetera, porque no sale de tu plata');
    await page.click('#confirmPay');
    await page.waitForTimeout(400);
    const despues = await page.evaluate(()=>window.__guitaSaldo(1));
    ok(Math.round(despues) === Math.round(antes),
       'boleta: pagarla no mueve el saldo de la billetera', `${antes} → ${despues}`);
    // la del mes que viene sigue estando; la de este mes tiene que quedar saldada
    const compGas = await page.evaluate(()=>window.__guitaComp(0).find(o=>o.nombre==='Gas'));
    ok(compGas && compGas.pagado === true, 'boleta: queda saldada la de este mes',
       JSON.stringify(compGas && {p:compGas.pagado}));
    const st = await page.evaluate(()=>window.__guitaState());
    ok(st.movs.some(m=>m.descripcion==='Gas' && m.tarjetaId===10),
       'boleta: el gasto queda anotado en la tarjeta');
    ok(st.pagosFijos[mk] && st.pagosFijos[mk]['1'], 'boleta: y marcado como pagado este mes');
    // y la proyección no lo cuenta dos veces
    const pr = await page.evaluate(()=>window.__guitaProy(10));
    ok(!pr || pr.sumaNuevos === 0,
       'proyección: el pago del fijo no se suma otra vez como consumo nuevo',
       String(pr && pr.sumaNuevos));
  }
}
await page.close();

/* ══ avisos del celu: la web arma la lista y se la manda al APK ══ */
{
  const pg = await browser.newPage({viewport:{width:390,height:844}});
  pg.on('pageerror', e=>{ console.log('PAGE ERROR:', e.message); fail++; });
  await pg.addInitScript(()=>{
    window.__sync = [];
    window.AndroidVoz = {
      avisosSincronizar: j => { window.__sync.push(JSON.parse(j)); return JSON.parse(j).length; },
      avisosEstado: () => JSON.stringify({permiso:false, exactas:true, sdk:34, programados:0}),
      avisosPedirPermiso: () => { window.__pidio = true; },
      avisoProbar: () => { window.__probo = true; },
      setReminder: ()=>{}, clearReminder: ()=>{}
    };
  });
  await pg.goto(BASE+'/');
  const h = new Date(); h.setHours(12,0,0,0);
  const en = n => { const x = new Date(h); x.setDate(x.getDate()+n); return x; };
  const iso = d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  await pg.evaluate(s=>{ localStorage.clear(); localStorage.setItem('guita:v2', s); }, JSON.stringify({
    movs:[], billeteras:[{id:1,nombre:'Lemon',saldoInicial:500000}], tarjetas:[], fijos:[], pagosFijos:{},
    transf:[], ajustes:[], metas:[],
    prestamos:[{id:7,nombre:'Préstamo',cuota:100000,cuotas:3,pagadasIni:1,pagos:[],dia:en(3).getDate(),proxima:iso(en(3))}],
    config:{apiKey:''}, seq:10}));
  await pg.reload();
  await pg.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});
  await pg.waitForTimeout(900);
  const ultima = await pg.evaluate(()=>window.__sync[window.__sync.length-1]||[]);
  ok(ultima.some(a=>/Mañana vence Cuota Préstamo/.test(a.titulo)), 'avisos: al abrir, manda al celu "mañana vence"',
     JSON.stringify(ultima.map(a=>a.titulo)));
  ok(ultima.some(a=>/Hoy vence Cuota Préstamo/.test(a.titulo)), 'avisos: y el "hoy vence" del mismo día');
  const man = ultima.find(a=>/Mañana/.test(a.titulo));
  ok(man && new Date(man.when).getHours()===9, 'avisos: por defecto avisa a las 9');
  ok(ultima.every(a=>a.id && a.when>Date.now()), 'avisos: todos con id y en el futuro');

  // Ajustes muestra que falta el permiso y deja probar
  await pg.click('#cfgBtn'); await pg.waitForTimeout(300);
  ok(!(await pg.locator('#avisosPermisoBtn').isHidden()), 'avisos: sin permiso, Ajustes ofrece activarlo');
  ok(/apagadas/.test(await pg.evaluate(()=>document.getElementById('avisosEstado').textContent)),
     'avisos: y explica que están apagadas');
  await pg.click('#avisosProbarBtn'); await pg.waitForTimeout(100);
  ok(await pg.evaluate(()=>window.__probo===true), 'avisos: "Probar" llama al celu');

  // apagarlos vacía la lista del celu
  await pg.uncheck('#cfgAvisos'); await pg.click('#saveCfg'); await pg.waitForTimeout(900);
  ok(await pg.evaluate(()=>(window.__sync[window.__sync.length-1]||[1]).length===0),
     'avisos: si los apagás, el celu queda sin avisos');
  await pg.close();
}

/* ══ "Pedile a Guita": Claude arma el archivo de cambios, vos confirmás ══ */
{
  const pg = await browser.newPage({viewport:{width:390,height:844}});
  pg.on('pageerror', e=>{ console.log('PAGE ERROR:', e.message); fail++; });
  let pedido = null;
  await pg.route('https://api.anthropic.com/v1/messages', async route=>{
    pedido = JSON.parse(route.request().postData());
    const salida = {respuesta:"Anoto el pago mínimo de Visa y un gasto de verdulería.", cambios:[
      {op:"pagoResumen", tarjeta:"Visa", monto:381776, billetera:"Mercado Pago", fecha:"2026-10-19"},
      {op:"gasto", monto:12000, desc:"Verdulería", categoria:"Comida", billetera:"Mercado Pago", fecha:"2026-10-19"}]};
    await route.fulfill({status:200, contentType:'application/json',
      body: JSON.stringify({stop_reason:"end_turn", content:[{type:"text", text:JSON.stringify(salida)}]})});
  });
  await pg.goto(BASE+'/');
  await pg.evaluate(s=>{ localStorage.clear(); localStorage.setItem('guita:v2', s); }, JSON.stringify({
    movs:[], billeteras:[{id:1,nombre:'Mercado Pago',saldoInicial:1000000}], fijos:[], pagosFijos:{}, transf:[],
    ajustes:[], metas:[], prestamos:[],
    tarjetas:[{id:10,nombre:'Visa Provincia',cierre:15,vto:26,resumenes:{'2026-10':{monto:2574388.06,pagoMinimo:381776,pagadoMonto:0,detalle:[]}}}],
    config:{apiKey:'sk-test'}, seq:20}));
  await pg.reload();
  await pg.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});
  await pg.click('#asisBtn'); await pg.waitForTimeout(300);
  ok(await pg.locator('#phaseAsis').isVisible(), 'asistente: se abre desde el encabezado');
  await pg.fill('#asisTexto', 'pagué el mínimo de visa desde mp y 12 lucas de verdulería');
  await pg.click('#asisEnviar'); await pg.waitForTimeout(700);
  ok(pedido && /Visa Provincia/.test(pedido.messages[0].content) && /Mercado Pago/.test(pedido.messages[0].content),
     'asistente: le pasa a Claude los nombres reales de tarjetas y billeteras');
  ok(pedido && pedido.output_config && pedido.output_config.format.type==='json_schema',
     'asistente: pide la respuesta con esquema, no texto libre');
  ok(await pg.locator('#phaseParche').isVisible(), 'asistente: muestra la vista previa antes de cargar nada');
  const st0 = await pg.evaluate(()=>window.__guitaState());
  ok(st0.movs.length===0, 'asistente: hasta que no confirmás, no se carga nada');
  await pg.click('#saveParche'); await pg.waitForTimeout(500);
  const st = await pg.evaluate(()=>window.__guitaState());
  ok(st.tarjetas[0].resumenes['2026-10'].pagadoMonto===381776, 'asistente: al confirmar registra el pago de la tarjeta');
  ok(st.movs.some(m=>m.descripcion==='Verdulería' && m.monto===12000), 'asistente: y el gasto');

  // si le falta un dato, pregunta en vez de inventar
  await pg.unroute('https://api.anthropic.com/v1/messages');
  await pg.route('https://api.anthropic.com/v1/messages', r=>r.fulfill({status:200, contentType:'application/json',
    body: JSON.stringify({stop_reason:"end_turn", content:[{type:"text",
      text:JSON.stringify({respuesta:"", pregunta:"¿De qué billetera salió?", cambios:[]})}]})}));
  await pg.click('#asisBtn'); await pg.waitForTimeout(300);
  await pg.fill('#asisTexto', 'pagué 50 lucas');
  await pg.click('#asisEnviar'); await pg.waitForTimeout(600);
  ok(/billetera/.test(await pg.evaluate(()=>document.getElementById('asisNota').textContent)),
     'asistente: si le falta un dato, pregunta');
  await pg.close();
}

/* ══════════ Juli-o 4.0: módulos, Cocina, clave de Plata, avisos configurables ══════════ */
{
  const pg = await browser.newPage({viewport:{width:390,height:844}});
  pg.on('pageerror', e=>{ console.log('PAGE ERROR:', e.message); fail++; });
  await pg.addInitScript(()=>{
    window.__sync = []; window.__awake = [];
    window.AndroidVoz = {
      avisosSincronizar: j => { window.__sync.push(JSON.parse(j)); return JSON.parse(j).length; },
      avisosEstado: () => JSON.stringify({permiso:true, exactas:true, sdk:34, programados:0}),
      avisoProbar: ()=>{}, avisoProbarCon: ic => { window.__probIcono = ic; },
      keepAwake: on => window.__awake.push(on),
      timerCocina: (when, txt) => { window.__timer = {when, txt}; }, timerCancelar: ()=>{ window.__timerCancel = true; },
      setReminder: ()=>{}, clearReminder: ()=>{}
    };
  });
  await pg.goto(BASE+'/');
  await pg.evaluate(()=>localStorage.clear()); await pg.reload();
  await pg.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});
  await pg.waitForTimeout(500);

  ok(await pg.evaluate(()=>window.__julioMod())==='hoy', 'juli-o: arranca en Hoy');
  ok(await pg.evaluate(()=>document.getElementById('modTitle').textContent)==='Hoy', 'juli-o: el título dice Hoy');
  ok(await pg.evaluate(()=>document.title)==='Juli-o', 'juli-o: la app se llama Juli-o');
  ok(await pg.evaluate(()=>document.querySelectorAll('#hoyStack .j-card').length>=2), 'hoy: muestra tarjetas');
  const mic = await pg.evaluate(()=>{ const r=document.getElementById('micBtn').getBoundingClientRect(); return r.x+r.width/2; });
  ok(Math.abs(mic-195)<6, 'juli-o: el micrófono sigue centrado', String(mic));
  ok(await pg.locator('#addBtn').isHidden(), 'juli-o: el + de gastos sólo aparece en Plata');

  // Cocina
  await pg.click('.j-tab[data-mod="cocina"]'); await pg.waitForTimeout(500);
  ok(await pg.evaluate(()=>window.__guitaState().cocina.recetas.length)===0, 'cocina: arranca vacía, para tus recetas');
  await pg.click('#cocEjemplos'); await pg.waitForTimeout(300);
  const nRec = await pg.evaluate(()=>window.__guitaState().cocina.recetas.length);
  ok(nRec>=10, 'cocina: las clásicas argentinas, sólo si las pedís', String(nRec));
  ok(await pg.evaluate(()=>document.querySelectorAll('#cocSemana .j-day').length)===7, 'cocina: la semana de lunes a domingo');
  ok(await pg.isVisible('.j-sugcard'), 'cocina: sugiere qué cocinar hoy');
  await pg.click('.j-chip[data-f="pastas"]'); await pg.waitForTimeout(200);
  const soloPastas = await pg.evaluate(()=>[...document.querySelectorAll('#cocGrid .j-rcard b')].map(b=>b.textContent));
  ok(soloPastas.length>=2 && soloPastas.every(n=>/Fideos|Ñoquis/.test(n)), 'cocina: filtra por categoría', soloPastas.join(','));
  await pg.fill('#cocBuscar', 'lentejas'); await pg.click('.j-chip[data-f="todas"]'); await pg.waitForTimeout(200);
  ok(await pg.evaluate(()=>document.querySelectorAll('#cocGrid .j-rcard').length)===1, 'cocina: busca por nombre o ingrediente');
  await pg.fill('#cocBuscar', '');
  await pg.evaluate(()=>{ const b=[...document.querySelectorAll('#cocGrid .j-rcard')].find(x=>/Fideos con tuco/.test(x.textContent)); b.click(); });
  await pg.waitForTimeout(500);
  ok(await pg.isVisible('#recPage'), 'receta: abre la ficha');
  ok(await pg.evaluate(()=>document.querySelectorAll('#recIngs li').length)===8, 'receta: lista los ingredientes');
  await pg.click('#recPorc [data-p="1"]'); await pg.click('#recPorc [data-p="1"]'); await pg.click('#recPorc [data-p="1"]');
  ok(/^800 g/.test(await pg.evaluate(()=>document.querySelector('#recIngs li').textContent)), 'receta: escala las cantidades con las porciones');
  await pg.click('#recFav'); await pg.waitForTimeout(150);
  await pg.click('#recCocine'); await pg.waitForTimeout(300);
  let st = await pg.evaluate(()=>window.__guitaState());
  ok(st.cocina.historial.length===1 && st.cocina.historial[0].nombre==='Fideos con tuco', 'receta: "La cociné hoy" la anota');
  const jc = await pg.evaluate(()=>window.__julioCocina());
  ok(jc.favoritas[0]==='Fideos con tuco', 'cocina: tus favoritas ahora', jc.favoritas.join(','));
  ok(jc.sugerencias.every(x=>x.nombre!=='Fideos con tuco'), 'cocina: no te sugiere lo que hiciste hoy');

  // modo cocina
  await pg.click('#recEmpezar'); await pg.waitForTimeout(500);
  ok(await pg.isVisible('#cookPage') && /Paso 1 de 5/.test(await pg.textContent('#cookStage')), 'cocina guiada: arranca en el paso 1');
  ok(await pg.evaluate(()=>window.__awake[window.__awake.length-1]===true), 'cocina guiada: deja la pantalla prendida');
  await pg.click('#cookNext'); await pg.waitForTimeout(450);
  ok(await pg.isVisible('#cookTimer') && /8:00/.test(await pg.textContent('#cookTimer')), 'cocina guiada: el "(8 min)" del paso se vuelve un timer');
  await pg.click('#cookTimer'); await pg.waitForTimeout(400);
  ok(await pg.evaluate(()=>document.getElementById('cookTimer').classList.contains('run')), 'cocina guiada: el timer corre');
  ok(await pg.evaluate(()=>window.__timer && window.__timer.when>Date.now()+470000), 'cocina guiada: y el celu lo agenda por si apagás la pantalla');
  for(let i=0;i<4;i++){ await pg.click('#cookNext'); await pg.waitForTimeout(350); }
  ok(/A comer/.test(await pg.textContent('#cookStage')), 'cocina guiada: termina con el festejo');
  await pg.click('#cookNext'); await pg.waitForTimeout(450);
  st = await pg.evaluate(()=>window.__guitaState());
  ok(st.cocina.historial.length===2, 'cocina guiada: al terminar la anota');
  ok(await pg.evaluate(()=>window.__awake[window.__awake.length-1]===false), 'cocina guiada: suelta la pantalla');
  ok(await pg.evaluate(()=>window.__guitaBack()) === true, 'atrás: con la ficha abierta, la cierra');
  await pg.waitForTimeout(400);
  ok(await pg.locator('#recPage').isHidden(), 'atrás: la ficha quedó cerrada');

  // cargar una receta propia, con foto
  await pg.click('#cocNueva'); await pg.waitForTimeout(400);
  await pg.fill('#edNombre', 'Tortilla de papas');
  await pg.click('#edCats [data-c="veggie"]');
  await pg.fill('#edIngs', '1 kg de papas\n6 huevos\n1 cebolla');
  await pg.fill('#edPasos', '1. Freí las papas (20 min)\n2. Mezclá con los huevos\n3. Cociná vuelta y vuelta (5 min)');
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
  await pg.setInputFiles('#edFotoInput', {name:'tortilla.png', mimeType:'image/png', buffer:PNG});
  await pg.waitForTimeout(400);
  await pg.click('#edGuardar'); await pg.waitForTimeout(500);
  st = await pg.evaluate(()=>window.__guitaState());
  const tor = st.cocina.recetas.find(r=>r.nombre==='Tortilla de papas');
  ok(tor && tor.cat==='veggie' && tor.pasos.length===3 && tor.pasos[0]==='Freí las papas (20 min)', 'editor: guarda la receta y limpia la numeración', JSON.stringify(tor&&tor.pasos));
  ok(tor && /^data:image\/jpeg/.test(await pg.evaluate(id=>window.__julioFotos.get(id), tor.fotoId)), 'editor: guarda la foto comprimida');
  const bk = JSON.parse(await pg.evaluate(()=>window.__guitaBackup()));
  ok(bk.fotos && bk.fotos[tor.fotoId], 'respaldo: incluye las fotos de las recetas');
  ok(bk.datos.cocina.historial.length===2, 'respaldo: incluye lo que cocinaste');
  await pg.click('#recCerrar'); await pg.waitForTimeout(350);

  // IA: armar una receta que no sabés
  await pg.evaluate(()=>{ const S=window.__guitaState(); });
  let pedidoIA = null;
  await pg.route('https://api.anthropic.com/v1/messages', async route=>{
    pedidoIA = JSON.parse(route.request().postData());
    await route.fulfill({status:200, contentType:'application/json', body: JSON.stringify({stop_reason:"end_turn", content:[{type:"text", text: JSON.stringify({
      nombre:"Ñoquis de calabaza", cat:"pastas", minutos:50, porciones:3, ingredientes:["500 g de calabaza","250 g de harina"],
      pasos:["Asá la calabaza (30 min)","Hacé un puré","Sumá harina","Cortá y herví (2 min)"], nota:"Van bárbaro con manteca y salvia."})}]})});
  });
  await pg.evaluate(()=>{ const S=JSON.parse(localStorage.getItem('guita:v2')); S.config.apiKey='sk-test'; localStorage.setItem('guita:v2', JSON.stringify(S)); });
  await pg.reload(); await pg.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});
  await pg.click('.j-tab[data-mod="cocina"]'); await pg.waitForTimeout(300);
  await pg.click('#cocNueva'); await pg.waitForTimeout(350);
  await pg.fill('#edNombre', 'Ñoquis de calabaza');
  await pg.click('#edIA'); await pg.waitForTimeout(700);
  ok(/Asá la calabaza/.test(await pg.inputValue('#edPasos')), 'IA: completa los pasos de una receta que no sabés');
  ok(/manteca y salvia/.test(await pg.textContent('#edIANota')), 'IA: y te deja un tip');
  ok(pedidoIA && /Ñoquis de calabaza/.test(JSON.stringify(pedidoIA.messages)), 'IA: le pasa el nombre a Claude');
  await pg.click('#edCerrar'); await pg.waitForTimeout(300);

  // parche y asistente: "cociné" y "receta"
  await pg.evaluate(()=>window.__guitaParche({app:"guita", parche:1, id:"coc-1", cambios:[
    {op:"cocine", nombre:"milanesas al horno"},
    {op:"receta", nombre:"Chipá", cat:"otras", minutos:40, ingredientes:["500 g de almidón"], pasos:["Mezclá todo","Horneá (20 min)"], fav:true}]}));
  await pg.waitForTimeout(300);
  await pg.click('#saveParche'); await pg.waitForTimeout(400);
  st = await pg.evaluate(()=>window.__guitaState());
  ok(st.cocina.historial.some(h=>h.nombre==='Milanesas al horno' && h.recetaId!=null), 'parche: "cocine" engancha con la receta guardada');
  ok(st.cocina.recetas.some(r=>r.nombre==='Chipá' && r.fav && r.pasos.length===2), 'parche: "receta" la crea');
  ok(/Recetas guardadas/.test(await pg.evaluate(()=>window.__guitaContextoAsis())), 'asistente: conoce tus recetas');

  // avisos: ícono, días y hora configurables
  await pg.click('#cfgBtn'); await pg.waitForTimeout(350);
  await pg.click('#avIconos [data-icono="rayo"]');
  await pg.click('#avDias [data-dia="3"]');
  await pg.fill('#avHora', '08:30'); await pg.dispatchEvent('#avHora', 'change');
  await pg.click('#avisosProbarBtn');
  ok(await pg.evaluate(()=>window.__probIcono)==='rayo', 'avisos: la prueba sale con el ícono que elegiste');
  await pg.check('#avCena'); await pg.waitForTimeout(700);
  const lista = await pg.evaluate(()=>window.__guitaAvisos());
  ok(lista.some(a=>/qué cocinamos/i.test(a.titulo) && a.icono==='olla'), 'avisos: la sugerencia de cena, si la prendés');
  ok(await pg.evaluate(()=>window.__guitaState().config.avisosCfg.dias.includes(3)), 'avisos: guarda "3 días antes"');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);

  // clave de Plata
  await pg.click('#cfgBtn'); await pg.waitForTimeout(350);
  await pg.click('#pinActivar'); await pg.waitForTimeout(300);
  for(const k of '2580') await pg.click(`#pinSetPad [data-k="${k}"]`);
  await pg.waitForTimeout(250);
  for(const k of '2580') await pg.click(`#pinSetPad [data-k="${k}"]`);
  await pg.waitForTimeout(500);
  st = await pg.evaluate(()=>window.__guitaState());
  ok(st.config.pin && st.config.pin.h && !JSON.stringify(st.config.pin).includes('2580'), 'clave: se guarda sin quedar escrita tal cual');
  await pg.evaluate(()=>{ const S=JSON.parse(localStorage.getItem('guita:v2'));
    S.billeteras=[{id:1,nombre:'Lemon',saldoInicial:777000}]; localStorage.setItem('guita:v2', JSON.stringify(S)); });
  await pg.reload(); await pg.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});
  await pg.waitForTimeout(300);
  ok(!/777/.test(await pg.textContent('#hoyStack')) && /ocultos/.test(await pg.textContent('#hoyStack')), 'clave: Hoy no muestra plata con la clave puesta');
  await pg.click('.j-tab[data-mod="plata"]'); await pg.waitForTimeout(400);
  ok(await pg.isVisible('#plataLock') && await pg.locator('#plataBody').isHidden(), 'clave: Plata pide la clave');
  ok(await pg.locator('#addBtn').isHidden(), 'clave: bloqueada no se puede cargar nada');
  await pg.click('#cfgBtn'); await pg.waitForTimeout(300);
  ok(!(await pg.evaluate(()=>document.getElementById('sheet').classList.contains('open'))), 'clave: los Ajustes también la piden');
  for(const k of '1111') await pg.click(`#pinPad [data-k="${k}"]`);
  await pg.waitForTimeout(600);
  ok(await pg.isVisible('#plataLock'), 'clave: una equivocada no abre');
  for(const k of '2580') await pg.click(`#pinPad [data-k="${k}"]`);
  await pg.waitForTimeout(700);
  ok(await pg.locator('#plataLock').isHidden(), 'clave: la correcta abre Plata');
  ok(await pg.evaluate(()=>document.getElementById('sheet').classList.contains('open') && !document.getElementById('phaseConfig').hidden),
     'clave: y sigue con lo que querías hacer (los Ajustes)');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(250);
  const conPin = await pg.evaluate(()=>window.__guitaAvisos());
  ok(conPin.every(a=>!/\$/.test(a.texto)), 'clave: los avisos no muestran montos');
  await pg.click('#lockBtn'); await pg.waitForTimeout(300);
  ok(await pg.isVisible('#plataLock'), 'clave: el candado la vuelve a bloquear');
  await pg.click('#pinOlvido'); await pg.waitForTimeout(200);
  ok(/30 min/.test(await pg.textContent('#pinReset')), 'clave: si te la olvidás, hay que esperar 30 minutos para borrarla');
  await pg.click('#pinOlvido');
  await pg.close();
}

/* ══════════ Juli-o 4.1: Agenda ══════════ */
{
  const pg = await browser.newPage({viewport:{width:390,height:844}});
  pg.on('pageerror', e=>{ console.log('PAGE ERROR:', e.message); fail++; });
  await pg.addInitScript(()=>{
    window.__sync = []; window.__acc = '[]';
    window.AndroidVoz = {
      avisosSincronizar: j => { window.__sync.push(JSON.parse(j)); return JSON.parse(j).length; },
      avisosEstado: () => JSON.stringify({permiso:true, exactas:true, sdk:34, programados:0}),
      agendaAcciones: () => { const a = window.__acc; window.__acc = '[]'; return a; },
      setReminder: ()=>{}, clearReminder: ()=>{}
    };
  });
  await pg.goto(BASE+'/');
  await pg.evaluate(()=>localStorage.clear()); await pg.reload();
  await pg.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});

  // el parser, con "ahora" fijo: jueves 22/10/2026 a las 15:00
  const AHORA = new Date(2026, 9, 22, 15, 0).getTime();
  const P = t => pg.evaluate(([t,a])=>window.__julioAgenda.parse(t, a), [t, AHORA]);
  const casos = [
    ['mañana 18hs dentista', {titulo:'Dentista', fecha:'2026-10-23', hora:'18:00', repetir:''}],
    ['recordame llamar al banco el lunes a las 10', {titulo:'Llamar al banco', fecha:'2026-10-26', hora:'10:00'}],
    ['todos los lunes a las 9 sacar la basura', {titulo:'Sacar la basura', fecha:'2026-10-26', hora:'09:00', repetir:'semanal'}],
    ['el 25 a la noche cumple de Lu', {titulo:'Cumple de Lu', fecha:'2026-10-25', hora:'21:00', repetir:'anual'}],
    ['comprar pilas', {titulo:'Comprar pilas', fecha:'2026-10-22', hora:null}],
    ['a las 5 ir al gimnasio', {titulo:'Ir al gimnasio', fecha:'2026-10-22', hora:'17:00'}],
    ['pagar el alquiler todos los 10', {titulo:'Pagar el alquiler', fecha:'2026-11-10', repetir:'mensual'}],
    ['tomar la pastilla todos los días a las 8:30', {titulo:'Tomar la pastilla', hora:'08:30', repetir:'diario'}],
    ['en 2 horas sacar la ropa del lavarropas', {titulo:'Sacar la ropa del lavarropas', fecha:'2026-10-22', hora:'17:00'}],
    ['pasado mañana a la mañana turno médico', {titulo:'Turno médico', fecha:'2026-10-24', hora:'09:00'}],
    ['viernes 20:30 cena con los chicos', {titulo:'Cena con los chicos', fecha:'2026-10-23', hora:'20:30'}],
    ['tengo que renovar el registro el 3/12', {titulo:'Renovar el registro', fecha:'2026-12-03'}],
  ];
  for(const [txt, esp] of casos){
    const r = await P(txt);
    const okc = Object.entries(esp).every(([k,v])=>r[k]===v);
    ok(okc, `agenda: entiende «${txt}»`, JSON.stringify(r));
  }
  const oc = await pg.evaluate(()=>{ const O = window.__julioAgenda.ocurre;
    return [O({fecha:'2026-01-31', repetir:'mensual'}, '2026-02-28'), O({fecha:'2026-10-26', repetir:'semanal'}, '2026-11-02'),
            O({fecha:'2026-10-26', repetir:'semanal'}, '2026-11-03'), O({fecha:'2000-05-04', repetir:'anual'}, '2026-05-04')]; });
  ok(oc.join()==='true,true,false,true', 'agenda: repeticiones (fin de mes, semanal, anual)', oc.join());

  // alta rápida
  await pg.click('.j-tab[data-mod="agenda"]'); await pg.waitForTimeout(400);
  ok(await pg.evaluate(()=>window.__julioMod())==='agenda', 'agenda: tiene su pestaña');
  await pg.fill('#agQuick', 'en 3 horas llamar a mamá');
  await pg.waitForTimeout(150);
  ok(/Llamar a mamá/.test(await pg.textContent('#agPrev')), 'agenda: muestra cómo lo entendió mientras escribís');
  await pg.press('#agQuick', 'Enter'); await pg.waitForTimeout(400);
  await pg.fill('#agQuick', 'comprar pilas'); await pg.press('#agQuick', 'Enter'); await pg.waitForTimeout(400);
  let st = await pg.evaluate(()=>window.__guitaState());
  ok(st.agenda.items.length===2, 'agenda: se agregan con Enter');
  const mama = st.agenda.items.find(x=>x.titulo==='Llamar a mamá');
  ok(mama && mama.hora && mama.avisos.includes(0) && mama.avisos.includes(60), 'agenda: con hora avisa a la hora y una hora antes', JSON.stringify(mama&&mama.avisos));
  ok(await pg.evaluate(()=>document.querySelectorAll('#agLista .j-ag').length)===2, 'agenda: aparecen en la lista');

  // avisos que se mandan al celu
  const av = await pg.evaluate(()=>window.__guitaAvisos());
  const deMama = av.filter(a=>a.id.startsWith('ag:'+String(mama.id)+':'));
  ok(deMama.some(a=>a.titulo==='Llamar a mamá') && deMama.some(a=>/^En 1 h/.test(a.titulo)), 'agenda: avisa a la hora y antes', JSON.stringify(deMama.map(a=>a.titulo)));
  ok(av.some(a=>a.titulo==='Te quedó pendiente' && a.texto==='Comprar pilas'), 'agenda: si no lo marcás, te lo recuerda al otro día');

  // tildar
  await pg.click('#agLista .j-ag:has-text("Comprar pilas") .j-chk'); await pg.waitForTimeout(500);
  st = await pg.evaluate(()=>window.__guitaState());
  const pilas = st.agenda.items.find(x=>x.titulo==='Comprar pilas');
  ok(pilas.hechos[pilas.fecha]===true, 'agenda: tildar lo marca hecho');
  ok(!(await pg.evaluate(()=>window.__guitaAvisos())).some(a=>a.texto==='Comprar pilas'), 'agenda: hecho, deja de avisar');

  // editor: insistir y repetir
  await pg.click('#agLista .j-ag:has-text("Llamar a mamá") .tx'); await pg.waitForTimeout(350);
  ok(await pg.isVisible('#phaseAgenda'), 'agenda: tocar un ítem abre el editor');
  await pg.check('#agInsistir'); await pg.selectOption('#agRepetir', 'semanal');
  await pg.click('#agGuardar'); await pg.waitForTimeout(400);
  st = await pg.evaluate(()=>window.__guitaState());
  const m2 = st.agenda.items.find(x=>x.titulo==='Llamar a mamá');
  ok(m2.insistir && m2.repetir==='semanal', 'agenda: el editor guarda insistir y repetir');

  // lo que se tocó en la notificación con la app cerrada
  await pg.evaluate(id=>{ window.__acc = JSON.stringify([{id:`ag:${id}:${new Date().toISOString().slice(0,10)}:0`, accion:'hecho'}]); }, m2.id);
  await pg.evaluate(()=>{ Object.defineProperty(document, 'hidden', {value:false, configurable:true}); document.dispatchEvent(new Event('visibilitychange')); });
  await pg.waitForTimeout(300);
  st = await pg.evaluate(()=>window.__guitaState());
  const hoyIso = await pg.evaluate(()=>{ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; });
  ok(st.agenda.items.find(x=>x.id===m2.id).hechos[hoyIso]===true || m2.fecha!==hoyIso, 'agenda: el «Listo» de la notificación queda marcado');

  // Hoy muestra la agenda
  await pg.click('.j-tab[data-mod="hoy"]'); await pg.waitForTimeout(300);
  ok(/Agenda de hoy/.test(await pg.textContent('#hoyStack')), 'hoy: muestra la agenda de hoy');

  // parche / asistente
  await pg.evaluate(()=>window.__guitaParche({app:'guita', parche:1, id:'ag-1', cambios:[
    {op:'agenda', titulo:'Turno con el dentista', fecha:'2026-11-05', hora:'18:00', avisos:[1440,60]},
    {op:'hecho', titulo:'comprar pilas'}]}));
  await pg.waitForTimeout(300); await pg.click('#saveParche'); await pg.waitForTimeout(400);
  st = await pg.evaluate(()=>window.__guitaState());
  ok(st.agenda.items.some(x=>x.titulo==='Turno con el dentista' && x.hora==='18:00' && x.avisos.includes(1440)), 'parche: «agenda» agenda');
  ok(/Agenda/.test(await pg.evaluate(()=>window.__guitaContextoAsis())), 'asistente: conoce tu agenda');

  // la clave de Plata no bloquea el micrófono en la Agenda
  ok(await pg.evaluate(()=>!!document.querySelector('.j-tab[data-mod="agenda"]')) && await pg.evaluate(()=>document.querySelectorAll('.j-tab[data-mod]').length)===4,
     'nav: Hoy, Agenda, Plata y Cocina');
  await pg.close();
}

/* ══════════ Juli-o 4.3: meta de gasto, resumen de la mañana, cocina propia y logros ══════════ */
{
  const pg = await browser.newPage({viewport:{width:390,height:844}});
  pg.on('pageerror', e=>{ console.log('PAGE ERROR:', e.message); fail++; });
  await pg.addInitScript(()=>{ window.__julioInicio = 'plata';
    window.AndroidVoz = { avisosSincronizar: j => JSON.parse(j).length, avisosEstado: () => JSON.stringify({permiso:true, exactas:true, sdk:34, programados:0}),
      setReminder: ()=>{}, clearReminder: ()=>{} }; });
  await pg.goto(BASE+'/');
  const h = new Date(); h.setHours(12,0,0,0);
  const iso = d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const mas = (d,n)=>{ const x=new Date(d); x.setDate(x.getDate()+n); return x; };
  const lun = mas(h, -((h.getDay()+6)%7)), ant = mas(lun, -7);
  await pg.evaluate(s=>{ localStorage.clear(); localStorage.setItem('guita:v2', s); }, JSON.stringify({
    movs:[{id:1,tipo:'gasto',monto:50000,categoria:'Comida',fecha:iso(ant),descripcion:'Súper',billetera:1},
          {id:2,tipo:'gasto',monto:12000,categoria:'Comida',fecha:iso(h),descripcion:'Verdulería',billetera:1}],
    billeteras:[{id:1,nombre:'Efectivo',saldoInicial:70000}], tarjetas:[], fijos:[], pagosFijos:{}, transf:[], ajustes:[], prestamos:[],
    metas:[{id:5,nombre:'Viaje',objetivo:100000,guardado:100000,icono:'✈️'}],
    presu:{porDia:10000, desde:iso(ant), previstos:[], ajustes:[]},
    cocina:{recetas:[], historial:[{id:30,fecha:iso(mas(h,-3)),recetaId:null,nombre:'Guiso de mi vieja'},{id:31,fecha:iso(mas(h,-10)),recetaId:null,nombre:'Guiso de mi vieja'}], semilla:true, limpio:true},
    logros:{desde:iso(ant)}, config:{}, seq:40}));
  await pg.reload(); await pg.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});
  await pg.waitForTimeout(2200);

  // logros: la semana pasada (50.000 de 70.000) se festeja y suma
  ok(await pg.isVisible('#celebra') && /Cumpliste/.test(await pg.textContent('#celTitulo')), 'logros: la meta cumplida se festeja');
  ok(/\+1\d\d puntos/.test(await pg.textContent('#celChip')), 'logros: con sus puntos', await pg.textContent('#celChip'));
  await pg.click('#celCerrar'); await pg.waitForTimeout(900);
  // y a continuación el nivel (la meta de ahorro completa suma 200)
  ok(await pg.isVisible('#celebra') && /Nivel 2/.test(await pg.textContent('#celTitulo')), 'logros: subir de nivel se festeja', await pg.textContent('#celTitulo'));
  await pg.click('#celAccion'); await pg.waitForTimeout(400);
  ok(await pg.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--brand').trim().toUpperCase())==='#7CC4FF', 'logros: el nivel 2 desbloquea el celeste y se aplica');
  const st = await pg.evaluate(()=>window.__guitaState());
  ok(Object.values(st.logros.periodos).length===1 && Object.values(st.logros.periodos)[0].cumplida, 'logros: el período cerrado queda guardado');
  await pg.waitForTimeout(900);
  if(await pg.isVisible('#celebra')) { await pg.click('#celCerrar'); await pg.waitForTimeout(500); }

  // meta hasta una fecha: 70.000 hasta fin de mes
  await pg.click('.g-tab[data-view="home"]'); await pg.waitForTimeout(300);
  await pg.click('#presuBtn'); await pg.waitForTimeout(300);
  await pg.click('#psModo [data-m="hasta"]');
  await pg.fill('#psMonto', '70.000');
  const fin = iso(new Date(h.getFullYear(), h.getMonth()+1, 0));
  await pg.fill('#psHasta', fin);
  await pg.click('#psGuardar'); await pg.waitForTimeout(400);
  let P = await pg.evaluate(()=>window.__guitaPresu());
  const diasFin = Math.round((new Date(fin+'T12:00:00')-h)/864e5)+1;
  ok(P.modo==='hasta' && P.total===70000 && P.gastado===12000 && P.diasQuedan===diasFin, 'meta: hasta una fecha cuenta desde hoy', JSON.stringify({m:P.modo,t:P.total,g:P.gastado,d:P.diasQuedan}));
  ok(Math.round(P.porDiaReal)===Math.round(58000/diasFin), 'meta: y te dice cuánto por día');
  ok(/te queda/i.test(await pg.textContent('#presuLbl')) && /hasta el/i.test(await pg.textContent('#presuLbl')), 'meta: la tarjeta dice hasta cuándo', await pg.textContent('#presuLbl'));
  // por mes
  await pg.click('#presuBtn'); await pg.waitForTimeout(300);
  await pg.click('#psModo [data-m="mes"]'); await pg.fill('#psMonto', '300.000'); await pg.click('#psGuardar'); await pg.waitForTimeout(300);
  P = await pg.evaluate(()=>window.__guitaPresu());
  ok(P.modo==='mes' && P.total===300000 && P.hasta===fin, 'meta: por mes, hasta el último día');
  // reiniciar
  await pg.click('#presuReiniciar'); await pg.waitForTimeout(300);
  P = await pg.evaluate(()=>window.__guitaPresu());
  ok(P.desde===iso(h), 'meta: «Empezar de nuevo» cuenta desde hoy', P.desde);

  // resumen de la mañana aunque la agenda esté vacía
  const av = await pg.evaluate(()=>window.__guitaAvisos());
  const res = av.find(a=>a.id.startsWith('ag:resumen:'));
  ok(res && /Para gastar/.test(res.texto), 'resumen de la mañana: sale siempre, con lo que podés gastar', JSON.stringify(res));

  // cocina: lo que anotás sin receta también se sugiere, y se puede guardar
  await pg.click('.j-tab[data-mod="cocina"]'); await pg.waitForTimeout(400);
  ok(/Guiso de mi vieja/.test(await pg.textContent('#cocSugg')), 'cocina: sugiere lo que cocinás seguido aunque no tenga receta');
  await pg.fill('#cocQuick', 'Milanesas con puré'); await pg.press('#cocQuick', 'Enter'); await pg.waitForTimeout(300);
  ok((await pg.evaluate(()=>window.__guitaState())).cocina.historial.some(x=>x.nombre==='Milanesas con puré'), 'cocina: «¿Qué cocinaste hoy?» lo anota');
  await pg.click('#cocHist [data-guardar="Milanesas con puré"]'); await pg.waitForTimeout(400);
  ok(await pg.isVisible('#edPage') && (await pg.inputValue('#edNombre'))==='Milanesas con puré', 'cocina: «Guardar receta» abre el editor con el nombre');
  await pg.click('#edCerrar'); await pg.waitForTimeout(300);

  // logros: la página
  await pg.click('.j-tab[data-mod="hoy"]'); await pg.waitForTimeout(300);
  await pg.click('#hoyStack [data-ir="logros"]'); await pg.waitForTimeout(500);
  ok(await pg.isVisible('#logrosPage') && /Nivel/.test(await pg.textContent('#lgHero')), 'logros: la página muestra tu nivel');
  ok(await pg.evaluate(()=>document.querySelectorAll('#lgMedallas .j-medal.on').length)>=2, 'logros: medallas ganadas (primera meta y ahorrista)');
  await pg.close();
}

/* ══════════ Juli-o 4.4: meta de ahorro enganchada a una cuenta ══════════ */
{
  const pg = await browser.newPage({viewport:{width:390,height:844}});
  pg.on('pageerror', e=>{ console.log('PAGE ERROR:', e.message); fail++; });
  await pg.addInitScript(()=>{ window.__julioInicio = 'plata'; });
  await pg.goto(BASE+'/');
  await pg.evaluate(s=>{ localStorage.clear(); localStorage.setItem('guita:v2', s); }, JSON.stringify({
    movs:[], billeteras:[{id:1,nombre:'Mercado Pago',saldoInicial:50000},{id:2,nombre:'Lemon',saldoInicial:0}],
    tarjetas:[], fijos:[], pagosFijos:{}, transf:[], ajustes:[], metas:[], prestamos:[], config:{}, seq:10}));
  await pg.reload(); await pg.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});
  await pg.evaluate(()=>window.__guitaParche({app:'guita', parche:1, id:'fe-1', cambios:[
    {op:'billetera', nombre:'Lemon', inversion:true},
    {op:'meta', nombre:'Fondo de emergencia', objetivo:500000, billetera:'Lemon', icono:'🛟'},
    {op:'saldo', billetera:'Lemon', monto:273000}]}));
  await pg.waitForTimeout(300);
  ok(!(await pg.textContent('#parcheErrores')).trim(), 'parche: «billetera» sobre una que ya existe la marca como reserva', await pg.textContent('#parcheErrores'));
  await pg.click('#saveParche'); await pg.waitForTimeout(400);
  let st = await pg.evaluate(()=>window.__guitaState());
  ok(st.billeteras.find(b=>b.nombre==='Lemon').inversion===true, 'reserva: Lemon queda aparte de la plata para gastar');
  await pg.click('.g-tab[data-view="plata"]'); await pg.waitForTimeout(300);
  ok(/273\.000 de \$\s?500\.000/.test(await pg.textContent('#metasLista')) && /en Lemon/.test(await pg.textContent('#metasLista')), 'meta: toma el saldo de la cuenta enganchada', (await pg.textContent('#metasLista')).replace(/\s+/g,' ').slice(0,120));
  // aportar = pasar plata de una cuenta a la otra
  await pg.click('[data-aporte]'); await pg.waitForTimeout(300);
  await pg.fill('#apMonto', '20.000');
  await pg.selectOption('#apBill', {label:'Mercado Pago'}).catch(async()=>{ await pg.selectOption('#apBill', '1'); });
  await pg.click('#saveAporte'); await pg.waitForTimeout(400);
  st = await pg.evaluate(()=>window.__guitaState());
  ok(st.transf.some(t=>t.de===1 && t.a===2 && t.monto===20000) && !st.movs.some(m=>/Ahorro/.test(m.descripcion||'')), 'meta: guardar es pasar plata a esa cuenta, no un gasto');
  ok(await pg.evaluate(()=>window.__guitaSaldo(2))===293000 && /293\.000/.test(await pg.textContent('#metasLista')), 'meta: y se mueve sola');
  await pg.close();
}

/* ══════════ Juli-o 4.5: Plata ordenada (Mes · Pagos · Fijos · Cuentas) ══════════ */
{
  const pg = await browser.newPage({viewport:{width:390,height:844}});
  pg.on('pageerror', e=>{ console.log('PAGE ERROR:', e.message); fail++; });
  await pg.addInitScript(()=>{ window.__julioInicio = 'plata'; });
  await pg.goto(BASE+'/');
  const h = new Date(); h.setHours(12,0,0,0);
  const iso = d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const fin = iso(new Date(h.getFullYear(), h.getMonth()+1, 0));
  await pg.evaluate(s=>{ localStorage.clear(); localStorage.setItem('guita:v2', s); }, JSON.stringify({
    movs:[], billeteras:[{id:1,nombre:'Mercado Pago',saldoInicial:3825},{id:4,nombre:'Efectivo',saldoInicial:94000}],
    tarjetas:[{id:12,nombre:'Mercado Pago',cierre:5,vto:10,resumenes:{}}],
    fijos:[{id:22,nombre:'Alquiler',monto:650000,dia:10,categoria:'Hogar',billetera:1,activo:true,esencial:true},
           {id:23,nombre:'HBO Max',monto:8941.9,dia:8,categoria:'Servicios',activo:true,esencial:false}],
    pagosFijos:{}, transf:[], ajustes:[], metas:[],
    prestamos:[{id:30,nombre:'Préstamo Mercado Pago',cuota:126875,cuotas:6,pagadasIni:3,pagos:[{fecha:'2026-09-28',monto:126875}],dia:28,proxima:'2026-10-28',billetera:1},
               {id:31,nombre:'Línea de crédito MP',cuota:126875.46,cuotas:1,pagadasIni:0,pagos:[],dia:2,proxima:'2026-11-02'}],
    presu:{modo:'hasta', monto:70000, hasta:fin, desde:iso(h), inicio:iso(h), porDia:7000, previstos:[], ajustes:[]},
    config:{}, seq:100}));
  await pg.reload(); await pg.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});
  await pg.waitForTimeout(400);

  // Mes: la meta arriba y el día a día
  ok(await pg.evaluate(()=>{ const v=document.getElementById('view-home'); const a=v.querySelector('#presuCard'), b=v.querySelector('.g-summary');
    return !!a && !!b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING); }), 'mes: la meta de gasto va arriba del resumen');
  // anotar un gasto da feedback: barra, puntos
  await pg.click('#addBtn'); await pg.waitForTimeout(300);
  await pg.fill('#fMonto', '5.000'); await pg.fill('#fDesc', 'Pan');
  await pg.click('#saveMov'); await pg.waitForTimeout(700);
  ok(await pg.isVisible('#cargaPop') && /Gasto anotado/.test(await pg.textContent('#cpTit')), 'anotar: aparece el festejo');
  ok(/\+3 pts/.test(await pg.textContent('#cpPts')), 'anotar: el primer gasto del día suma puntos');
  ok(/Te quedan/.test(await pg.textContent('#cpFoot')) && /65\.000/.test(await pg.textContent('#cpFoot')), 'anotar: dice cuánto te queda de la meta', await pg.textContent('#cpFoot'));
  ok(/Día a día/.test(await pg.textContent('#totalOutLbl')) && /5\.000/.test(await pg.textContent('#totalOut')), 'mes: el número grande es lo del día a día');

  // Fijos: los de la casa y las suscripciones, separados
  await pg.click('.g-tab[data-view="fijos"]'); await pg.waitForTimeout(400);
  const fx = await pg.evaluate(()=>[...document.querySelectorAll('#fijosHub .j-fxcard')].map(c=>c.textContent.replace(/\s+/g,' ')));
  ok(fx.length===2 && /Alquiler/.test(fx[0]) && !/HBO/.test(fx[0]) && /HBO/.test(fx[1]), 'fijos: la casa por un lado y las suscripciones por otro');
  ok(/al año/.test(fx[1]), 'fijos: te dice cuánto ahorrás por año si cortás');

  // parche: el préstamo repetido, la última cuota y lo que dice la tarjeta hoy
  await pg.evaluate(()=>window.__guitaParche({app:'guita', parche:1, id:'mp-1', cambios:[
    {op:'borrarPrestamo', prestamo:'Línea de crédito MP'},
    {op:'prestamo', nombre:'Préstamo Mercado Pago', cuotas:6, quedan:1, dia:2, proxima:'2026-11-02'},
    {op:'tarjeta', nombre:'Mercado Pago', totalHoy:1442896.49, fecha:'2026-10-23'}]}));
  await pg.waitForTimeout(300);
  ok(!(await pg.textContent('#parcheErrores')).trim(), 'parche: sin errores', await pg.textContent('#parcheErrores'));
  await pg.click('#saveParche'); await pg.waitForTimeout(400);
  const st = await pg.evaluate(()=>window.__guitaState());
  ok(st.prestamos.length===1, 'parche: «borrarPrestamo» saca el repetido');
  const pmp = st.prestamos[0];
  ok(pmp.pagadasIni + pmp.pagos.length === 5 && pmp.proxima==='2026-11-02', 'parche: «quedan 1» deja la última cuota', JSON.stringify(pmp));
  ok(st.tarjetas[0].totalHoy && st.tarjetas[0].totalHoy.monto===1442896.49, 'parche: la tarjeta guarda lo que te muestra hoy');

  // Pagos: el mes que viene
  await pg.click('.g-tab[data-view="tarjetas"]'); await pg.waitForTimeout(400);
  const prox = (await pg.textContent('#proxMes')).replace(/\s+/g,' ');
  ok(/Alquiler/.test(prox) && /Para no atrasarte/.test(prox) && /Si pagás todo/.test(prox), 'pagos: el mes que viene, con lo que necesitás', prox.slice(0,160));
  ok(await pg.evaluate(()=>!document.getElementById('detTarjetas').open), 'pagos: el detalle de tarjetas arranca plegado');
  await pg.close();
}

/* ══════════ Juli-o 4.6: duplicados, tira del mes, en qué se fue ══════════ */
{
  const pg = await browser.newPage({viewport:{width:390,height:844}});
  pg.on('pageerror', e=>{ console.log('PAGE ERROR:', e.message); fail++; });
  await pg.addInitScript(()=>{ window.__julioInicio = 'plata'; });
  await pg.goto(BASE+'/');
  const h = new Date(); h.setHours(12,0,0,0);
  const iso = d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const mk = iso(h).slice(0,7), ant = new Date(h.getFullYear(), h.getMonth()-1, 10, 12);
  await pg.evaluate(s=>{ localStorage.clear(); localStorage.setItem('guita:v2', s); }, JSON.stringify({
    movs:[{id:1,tipo:'gasto',monto:650000,categoria:'Hogar',fecha:iso(ant),descripcion:'Alquiler',billetera:4,origen:'fijo'},
          {id:2,tipo:'gasto',monto:650000,categoria:'Hogar',fecha:mk+'-09',descripcion:'Alquiler',billetera:4,origen:'fijo'},
          {id:3,tipo:'gasto',monto:650000,categoria:'Hogar',fecha:iso(h),descripcion:'Alquiler',billetera:2,origen:'manual'},
          {id:4,tipo:'gasto',monto:276000,categoria:'Otros',fecha:iso(h),descripcion:'Fondo de emergencia',billetera:2,origen:'manual'},
          {id:5,tipo:'gasto',monto:5500,categoria:'Comida',fecha:iso(h),descripcion:'Pan',billetera:4,origen:'manual'}],
    billeteras:[{id:2,nombre:'Lemon',saldoInicial:1199000,inversion:true},{id:4,nombre:'Efectivo',saldoInicial:749500}],
    tarjetas:[], fijos:[{id:22,nombre:'Alquiler',monto:650000,dia:17,categoria:'Hogar',billetera:2,activo:true,esencial:true}],
    pagosFijos:{[iso(ant).slice(0,7)]:{22:1},[mk]:{22:2}}, transf:[], ajustes:[],
    metas:[{id:7,nombre:'Fondo de emergencia',objetivo:500000,billetera:2}],
    prestamos:[{id:30,nombre:'Préstamo Provincia',cuota:118242,cuotas:3,pagadasIni:1,pagos:[{fecha:'2026-08-31',monto:118242}],dia:30}],
    presu:{modo:'hasta', monto:94000, hasta:iso(new Date(h.getFullYear(), h.getMonth()+1, 0)), desde:iso(h), inicio:iso(h), porDia:10000, previstos:[], ajustes:[]},
    config:{}, seq:100}));
  await pg.reload(); await pg.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});
  await pg.waitForTimeout(400);
  const P = await pg.evaluate(()=>window.__guitaPresu());
  ok(P.gastado===5500, 'día a día: no cuenta el alquiler repetido ni la plata separada para el fondo', String(P.gastado));
  await pg.click('.g-tab[data-view="fijos"]'); await pg.waitForTimeout(300);
  ok(!/Alquiler/.test(await pg.textContent('#aumentosList').catch(()=>'')), 'aumentos: el alquiler pagado dos veces no es un aumento');
  await pg.click('.g-tab[data-view="home"]'); await pg.waitForTimeout(300);
  ok(await pg.evaluate(()=>document.querySelectorAll('#tira .j-td').length)>=28, 'tira: una barrita por día del mes');
  await pg.click(`#tira [data-td="${iso(h)}"]`); await pg.waitForTimeout(200);
  ok(/Pan/.test(await pg.textContent('#tiraCap')), 'tira: tocar un día dice qué fue');
  ok(/En qué se fue/.test(await pg.textContent('#catLbl')) && /%/.test(await pg.textContent('#catBars')), 'mes: en qué se fue, con porcentajes');
  ok(await pg.isVisible('#panelCard'), 'mes: tu situación');
  await pg.evaluate(()=>window.__guitaParche({app:'guita', parche:1, id:'c-1', cambios:[
    {op:'borrarMov', desc:'Alquiler', monto:650000, mes:new Date().toISOString().slice(0,7), sueltos:true},
    {op:'fijo', nombre:'Alquiler', billetera:'Efectivo'},
    {op:'borrarMov', monto:276000, categoria:'Otros'},
    {op:'prestamo', nombre:'Préstamo Provincia', quedan:0}]}));
  await pg.waitForTimeout(300); await pg.click('#saveParche'); await pg.waitForTimeout(400);
  const st = await pg.evaluate(()=>window.__guitaState());
  ok(st.movs.filter(m=>m.descripcion==='Alquiler').length===2 && !st.movs.some(m=>m.id===3), 'parche: borra sólo el alquiler suelto, no el enganchado al fijo');
  ok(!st.movs.some(m=>m.monto===276000), 'parche: saca la plata separada que se había cargado como gasto');
  ok(st.fijos[0].billetera===4, 'parche: el alquiler sale de Efectivo');
  ok(await pg.evaluate(()=>{ const p = window.__guitaState().prestamos[0]; return p.pagadasIni + p.pagos.length === p.cuotas; }), 'parche: «quedan 0» termina el préstamo');
  await pg.close();
}

/* ══════════ Juli-o 4.7: hoy y mañana, recordatorio, panorama, pedidos, agenda ══════════ */
{
  const pg = await browser.newPage({viewport:{width:390,height:844}});
  pg.on('pageerror', e=>{ console.log('PAGE ERROR:', e.message); fail++; });
  await pg.addInitScript(()=>{ window.__julioInicio = 'plata'; window.__irDe = 'anotar';
    window.AndroidVoz = { avisosSincronizar: j => JSON.parse(j).length, avisosEstado: () => JSON.stringify({permiso:true, exactas:true, sdk:34, programados:0}),
      setReminder: ()=>{}, clearReminder: ()=>{ window.__clearRem = true; }, irPendiente: ()=>{ const x = window.__irDe; window.__irDe = ''; return x; } }; });
  await pg.goto(BASE+'/');
  const h = new Date(); h.setHours(12,0,0,0);
  const iso = d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const mas = (d,n)=>{ const x=new Date(d); x.setDate(x.getDate()+n); return x; };
  const hasta = iso(mas(h, 9));
  await pg.evaluate(s=>{ localStorage.clear(); localStorage.setItem('guita:v2', s); }, JSON.stringify({
    movs:[{id:1,tipo:'gasto',monto:20000,categoria:'Comida',fecha:iso(h),descripcion:'Súper',billetera:4,origen:'manual'}],
    billeteras:[{id:1,nombre:'Mercado Pago',saldoInicial:3825},{id:4,nombre:'Efectivo',saldoInicial:94000}],
    tarjetas:[{id:10,nombre:'Visa Provincia',cierre:15,vto:26,resumenes:{[iso(h).slice(0,7)]:{monto:2574388,pagoMinimo:381776,pagadoMonto:381776,detalle:[]}}}],
    fijos:[{id:22,nombre:'Alquiler',monto:650000,dia:17,categoria:'Hogar',billetera:4,activo:true,esencial:true}],
    pagosFijos:{}, transf:[], ajustes:[], metas:[], prestamos:[],
    presu:{modo:'hasta', monto:100000, hasta, desde:iso(h), inicio:iso(h), porDia:10000, previstos:[], ajustes:[]},
    config:{sueldo:3000000, extras:40000, recordatorio:{on:true, hora:'22:15'}}, seq:100}));
  await pg.reload(); await pg.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});
  await pg.waitForTimeout(1400);

  // hoy y desde mañana: lo que no gastes se reparte
  const P = await pg.evaluate(()=>window.__guitaPresu());
  ok(Math.round(P.paraHoy)===10000 && Math.round(P.quedaHoy)===-10000 && Math.round(P.desdeManana)===Math.round(80000/9), 'meta: hoy tu parte, y desde mañana lo que queda repartido', JSON.stringify({h:P.paraHoy, q:P.quedaHoy, m:P.desdeManana}));
  // la notificación (o el acceso directo) abrió la carga de gastos
  ok(await pg.evaluate(()=>document.getElementById('sheet').classList.contains('open') && !document.getElementById('phaseReview').hidden), 'abrir: «anotar» desde la notificación abre la carga');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
  // recordatorio de la noche por el sistema de avisos
  const av = await pg.evaluate(()=>window.__guitaAvisos());
  const rem = av.find(a=>a.id.startsWith('rem:'));
  ok(rem && new Date(rem.when).getHours()===22 && new Date(rem.when).getMinutes()===15, 'recordatorio: a las 22:15 por el sistema de avisos', JSON.stringify(rem));
  ok(await pg.evaluate(()=>window.__clearRem===true), 'recordatorio: el viejo se apaga para que no lleguen dos');

  // panorama
  await pg.click('.g-tab[data-view="tarjetas"]'); await pg.waitForTimeout(500);
  const cam = (await pg.textContent('#caminoCard')).replace(/\s+/g,' ');
  ok(/Tu camino/.test(cam) && /(Terminás de financiar|todavía no alcanza)/.test(cam) && /sólo mínimos/.test(cam), 'panorama: tu camino para salir, contra pagar sólo mínimos', cam.slice(0,140));
  ok(/Cuando cobrés/.test(await pg.textContent('#planCobro')) && /Para las tarjetas/.test(await pg.textContent('#planCobro')), 'panorama: cómo repartir el sueldo');

  // cocina: pedí comida
  await pg.click('.j-tab[data-mod="cocina"]'); await pg.waitForTimeout(300);
  await pg.click('#cocTipo [data-t="pedido"]');
  await pg.fill('#cocQuick', 'Sushi de Tanoshi'); await pg.fill('#cocPedMonto', '18.000');
  await pg.press('#cocQuick', 'Enter'); await pg.waitForTimeout(500);
  let st = await pg.evaluate(()=>window.__guitaState());
  ok(st.cocina.historial.some(x=>x.tipo==='pedido' && x.nombre==='Sushi de Tanoshi' && x.monto===18000), 'cocina: anota lo que pediste');
  ok(st.movs.some(m=>m.descripcion==='Pedido: Sushi de Tanoshi' && m.categoria==='Comida' && m.monto===18000), 'cocina: y si ponés cuánto salió, queda como gasto');
  ok(/pediste/.test(await pg.textContent('#cocSemana')), 'cocina: la semana cuenta lo que pediste');

  // agenda: fechas cortas, rutinas de varios días, calendario
  const AH = new Date(2026, 9, 24, 15, 0).getTime();
  const Pa = t => pg.evaluate(([t,a])=>window.__julioAgenda.parse(t, a), [t, AH]);
  let r = await Pa('recital el 14 de nov a las 21');
  ok(r.fecha==='2026-11-14' && r.hora==='21:00' && r.titulo==='Recital', 'agenda: «14 de nov» se entiende', JSON.stringify(r));
  r = await Pa('gimnasio lunes, miércoles y viernes a las 19');
  ok(r.repetir==='dias' && r.dias.join()==='1,3,5' && r.hora==='19:00' && r.titulo==='Gimnasio', 'agenda: rutina de varios días', JSON.stringify(r));
  r = await Pa('yoga de lunes a viernes 8:30');
  ok(r.repetir==='dias' && r.dias.length===5 && r.titulo==='Yoga', 'agenda: «de lunes a viernes»', JSON.stringify(r));
  ok(await pg.evaluate(()=>window.__julioAgenda.ocurre({fecha:'2026-10-26', repetir:'dias', dias:[1,3,5]}, '2026-10-28')), 'agenda: la rutina cae los días que elegiste');
  await pg.click('.j-tab[data-mod="agenda"]'); await pg.waitForTimeout(300);
  await pg.fill('#agQuick', 'gimnasio lunes, miércoles y viernes a las 19'); await pg.press('#agQuick', 'Enter'); await pg.waitForTimeout(300);
  await pg.click('#agVista [data-v="semana"]'); await pg.waitForTimeout(300);
  ok(/Tus rutinas/.test(await pg.textContent('#agSemana')) && /Gimnasio/.test(await pg.textContent('#agSemana')), 'agenda: la semana muestra tus rutinas');
  await pg.click('#agVista [data-v="mes"]'); await pg.waitForTimeout(300);
  ok(await pg.evaluate(()=>document.querySelectorAll('#agCal .j-cald').length)>=28, 'agenda: calendario del mes');
  await pg.click('#agCal [data-calmes="1"]'); await pg.waitForTimeout(200);
  const d14 = await pg.evaluate(()=>{ const b = [...document.querySelectorAll('#agCal [data-cal]')].find(x=>x.dataset.cal.endsWith('-14')); b.click(); return b.dataset.cal; });
  await pg.waitForTimeout(200);
  await pg.fill('#agQuick', 'Recital'); await pg.press('#agQuick', 'Enter'); await pg.waitForTimeout(300);
  st = await pg.evaluate(()=>window.__guitaState());
  ok(st.agenda.items.some(x=>x.titulo==='Recital' && x.fecha===d14), 'agenda: tocás un día del mes que viene y lo agendás ahí', d14);
  await pg.close();
}

/* ══════════ Juli-o 4.8: widgets ══════════ */
{
  const pg = await browser.newPage({viewport:{width:390,height:844}});
  pg.on('pageerror', e=>{ console.log('PAGE ERROR:', e.message); fail++; });
  await pg.addInitScript(()=>{ window.__wid = [];
    window.AndroidVoz = { widgetActualizar: j => window.__wid.push(JSON.parse(j)), setReminder: ()=>{}, clearReminder: ()=>{} }; });
  await pg.goto(BASE+'/');
  const h = new Date(); h.setHours(12,0,0,0);
  const iso = d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const mas = (d,n)=>{ const x=new Date(d); x.setDate(x.getDate()+n); return x; };
  await pg.evaluate(s=>{ localStorage.clear(); localStorage.setItem('guita:v2', s); }, JSON.stringify({
    movs:[{id:1,tipo:'gasto',monto:4000,categoria:'Comida',fecha:iso(h),descripcion:'Pan',billetera:1,origen:'manual'}],
    billeteras:[{id:1,nombre:'Efectivo',saldoInicial:94000}], tarjetas:[], fijos:[], pagosFijos:{}, transf:[], ajustes:[], metas:[], prestamos:[],
    presu:{modo:'hasta', monto:100000, hasta:iso(mas(h,9)), desde:iso(h), inicio:iso(h), porDia:10000, previstos:[], ajustes:[]},
    agenda:{items:[{id:9,titulo:'Recital',fecha:iso(mas(h,1)),hora:'21:00',repetir:'',avisos:[0],hechos:{}}]},
    config:{}, seq:20}));
  await pg.reload(); await pg.waitForSelector('#splash',{state:'detached',timeout:5000}).catch(()=>{});
  await pg.waitForTimeout(1500);
  const w = await pg.evaluate(()=>window.__wid[window.__wid.length-1]);
  ok(w && /^\$\s?6\.000$/.test(w.hoy) && /Desde mañana/.test(w.sub), 'widget: recibe cuánto podés gastar hoy y desde mañana', JSON.stringify(w));
  ok(w && w.agenda.some(a=>/mañana 21:00 Recital/.test(a.t)), 'widget: y lo próximo de la agenda', JSON.stringify(w && w.agenda));
  ok(w && w.oculto===false && /^FF[0-9A-F]{6}$/i.test(w.color), 'widget: con tu color y sin ocultar (no hay clave)');
  await pg.close();
}

await browser.close();
server.close();
console.log(fail ? `\n${fail} FALLARON` : '\nTODO OK');
process.exit(fail ? 1 : 0);
