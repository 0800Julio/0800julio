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
ok(await page.isVisible('#tipsBtn'), 'análisis: botón para recalcular recomendaciones');

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
ok(nav.tabs.length===6, 'nav: 6 pestañas', nav.tabs.join(','));
ok(Math.abs(nav.micCentro - nav.ancho/2) < 6, 'nav: el micrófono queda centrado',
   `mic en ${nav.micCentro.toFixed(1)} de ${nav.ancho}`);
ok(nav.tabs.includes('plan'), 'nav: existe la pestaña Plan');

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
ok(await vistaActiva()==='view-plan', 'deslizar: sigue hasta Plan', await vistaActiva());
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
await page.click('.g-tab[data-view="plan"]'); await page.waitForTimeout(600);
const planTot = await page.evaluate(()=>document.getElementById('planTotal').textContent);
ok(/347\.999|347999/.test(planTot.replace(/\s/g,'')), 'plan: suma fijos + suscripciones de tarjeta', planTot);
const planTxt = await page.evaluate(()=>document.getElementById('planLista').textContent);
ok(/Alquiler/.test(planTxt) && /NETFLIX/.test(planTxt), 'plan: junta los fijos y lo que viene en el resumen');
ok(!/COMPRA SUELTA/.test(planTxt), 'plan: deja afuera las compras de una vez');
ok(/vence el 5/.test(planTxt), 'plan: muestra el día de vencimiento');
ok(/%/.test(await page.evaluate(()=>document.getElementById('planNota').textContent)),
   'plan: dice qué porcentaje del ingreso se llevan');
const cal = await page.evaluate(()=>document.getElementById('planCalendario').textContent);
ok(/Alquiler/.test(cal), 'plan: calendario del mes con lo que se paga');

/* metas */
await page.click('#addMetaBtn'); await page.waitForTimeout(300);
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

await browser.close();
server.close();
console.log(fail ? `\n${fail} FALLARON` : '\nTODO OK');
process.exit(fail ? 1 : 0);
