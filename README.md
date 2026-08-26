# 💸 Guita — tus gastos, a viva voz

App de finanzas personales pensada para usar desde el celular: tocás el micrófono,
decís **"gasté 5 lucas en la verdulería"** y Guita entiende el monto, le pone
categoría y lo anota. Después ves el resumen del mes y lo exportás a una planilla.

## Qué hace

- 🎙 **Carga por voz mantener-apretado** en español rioplatense: entiende "5 lucas",
  "un palo", "32.000", "media luca"… y podés dictar **varios gastos seguidos**
  ("30 del súper, 20 de nafta y 5 de birras") que se separan y clasifican solos.
- 🤖 **IA opcional (híbrida)**: si cargás tu API key de Claude en Ajustes, los
  dictados largos y la clasificación de resúmenes pasan por Claude
  (`claude-opus-4-8` con salida estructurada). Sin key, reglas locales gratis.
  La key queda solo en tu dispositivo.
- 📈 **Análisis**: torta de gastos por categoría (con el gasto de tarjeta
  desglosado en sus consumos reales), ingresos vs gastos con tasa de ahorro y
  evolución de los últimos 6 meses. Paleta validada para daltonismo con el
  método de la skill de dataviz.
- 📄 **Subí tu resumen (PDF o foto)**: botón principal en Tarjetas. Lee el
  archivo y detecta solo qué tarjeta es, el día de cierre, el vencimiento, el
  total y cada consumo clasificado — la tarjeta se crea sola. Con IA lee
  cualquier formato (incluso fotos y escaneados, vía la lectura nativa de PDF
  de Claude); sin IA, un extractor local de texto PDF (DecompressionStream)
  cubre los PDFs con texto real.
- 🔁 **Detección de suscripciones**: al cargar el detalle del resumen, detecta
  Netflix/Spotify/etc. y te propone sumarlas como gastos fijos "vía tarjeta"
  (sin doble conteo: van en el resumen).
- 🧾 **Ver y editar cada consumo**: botón "Ver consumos (N)" en cada tarjeta
  con la lista completa editable (descripción, monto, categoría) y opción de
  recalcular el total. La torta del mes incluye el resumen aunque todavía no
  esté pagado.
- ⚡ **Carga rápida**: un toque crea tus billeteras (Lemon, Mercado Pago,
  Cuenta DNI, Santander, Astropay, Balanz) y tarjetas (Visa, Mastercard,
  Tarjeta Mercado Pago) — editable y sin duplicar lo que ya está.
- 🎯 **Presupuestos por categoría**: tope mensual por categoría con barras de
  avance en Análisis y alertas al pasar el 80% y al pasarte (cuenta también
  los consumos de tarjeta).
- 🚨 **Alerta de gasto grande**: definí un umbral y te aviso al anotar
  cualquier gasto que lo supere.
- 🔔 **Recordatorio diario** (APK): notificación a la hora que elijas para
  anotar los gastos del día; tocarla abre la app. Sobrevive reinicios.
- 📈 **Cuentas de inversión** (Balanz, plazo fijo…): se muestran aparte del
  disponible, con su propio total.
- 💣 **Deuda de tarjetas**: cargá el saldo financiado que venís arrastrando y
  velo junto a los resúmenes sin pagar, con lo que te cuesta arrastrarlo.
- 💵 **Pagos parciales**: al cargar cada resumen te pregunta cuánto pagaste;
  si pagás menos que el total, el resto queda como deuda financiada visible.
- 📊 **Historial mes a mes por tarjeta**: total, variación contra el mes
  anterior, consumos vs total (la diferencia = arrastre + intereses e
  impuestos), pagado y financiado. Con promedio de cargos y **proyección del
  próximo resumen** (consumos nuevos + financiado + cargos promedio).
- 💳 **Gastos "con tarjeta"**: al anotar un gasto podés elegir una tarjeta en
  vez de billetera — no descuenta plata y suma a la proyección del próximo
  resumen (sin doble conteo cuando cargás el resumen real).
- 🧠 **Lectura completa del resumen** (v1.7): saldo anterior, pagos del
  período, todos los impuestos e intereses (sellos, IVA, IIBB, percepciones,
  financiación), consumos en dólares, pago mínimo, descuentos en negativo y
  cuotas — validado contra resúmenes reales de Visa Provincia al centavo.
  El pago del mes anterior se detecta solo desde "SU PAGO".
- 🔢 **Montos con puntos**: todos los campos de plata formatean miles
  automáticamente (900.000 se lee como novecientos mil, no como 900).
- 🧾 **Panel de resumen extendido**: desglose completo (saldo anterior −
  pagos + consumos + impuestos = total), iconos por marca (Netflix 🎬,
  Rappi 🛵, YPF ⛽…), chips de cuota 📅 y descuentos en verde. Todos los
  totales leídos se pueden corregir a mano.
- 💸 **Modo económico de IA** (v1.8): selector Haiku/Opus en Ajustes.
  Con Haiku, leer un resumen sale ~US$0,02–0,05 y un dictado largo
  menos de US$0,01 (~5× más barato que Opus).
- 💡 **Recomendaciones locales gratis** en Análisis: costo real de financiar,
  cuotas que se liberan, suscripciones, presupuestos pasados, balance del
  mes y fondo de emergencia — sin gastar API.
- 🔮 **Próximo resumen detallado**: tocá la proyección en el historial y ves
  cuota por cuota qué sigue (y cuál es la última 🎉), qué cuotas terminan,
  suscripciones, consumos nuevos, financiado, impuestos estimados, total y
  pago mínimo estimado según tu proporción histórica.
- ✨ **Diseño con profundidad** (v1.9): splash de inicio animado, tarjetas con
  sombras en capas, resumen del mes con brillo de marca, micrófono y botones
  con gradiente, barra inferior flotante con blur — todo respetando
  `prefers-reduced-motion` y los modos claro/oscuro.
- 👈 **Deslizar para cancelar** (v1.9.1): mientras grabás con el micrófono
  apretado, arrastralo a un costado (como en WhatsApp) y se cancela la
  grabación — el mic se tiñe de rojo al acercarte al punto de cancelar y no
  se anota nada.
- ↩️ **Deshacer al borrar** (v2.0): borrar un movimiento, una tarjeta (con todos
  sus resúmenes), una billetera o un gasto fijo te deja 6 segundos para
  arrepentirte — el aviso trae botón **Deshacer**.
- ♿ **Accesible de verdad** (v2.0): las hojas mueven el foco al abrirse, el
  tabulador queda adentro, **Escape** las cierra y el foco vuelve a donde
  estabas; los avisos son región viva (`role="status"`) y ya no se cortan en
  una línea; los movimientos se manejan con Enter/Espacio.
- 🔍 **Detalle por categoría** (v2.1): tocá una porción de la torta (o el botón
  "ver" de la leyenda) y ves **todos** los gastos de esa categoría del mes, uno
  por uno, diciendo si los anotaste a mano/por voz o de qué tarjeta salen.
- 🧮 **Deuda real de tarjetas** (v2.1): cuenta solo el último resumen de cada
  tarjeta — su total ya arrastra los meses anteriores, sumarlos todos multiplicaba
  la deuda.
- 🔮 **Estimado honesto del próximo resumen** (v2.1): proyecta solo lo que vuelve
  (cuotas, servicios, seguros y suscripciones) y deja afuera las compras de una
  sola vez, que aparecen listadas aparte. Reconoce cuotas tipo `0010/18` y podés
  marcar 🔁 a mano cualquier consumo. Elegís cuánto vas a pagar del resumen
  actual (todo, el mínimo, un monto o lo que venís pagando) y el arrastre se
  recalcula solo.
- 💡 **Recomendaciones recalculables** (v2.1): se actualizan al cargar gastos y
  tenés un botón para recalcularlas cuando quieras.
- ⌨️ **"…o escribilo"** (v2.1): la carga por texto ya no depende de que falle la voz.
- 📸 **Subir captura de movimientos** (v2.2): en Plata, mandale una captura de
  pantalla de Lemon, Mercado Pago, Cuenta DNI o tu homebanking y la IA lee
  todos los movimientos que se vean — con su fecha, si entró o salió plata y
  su categoría. Los revisás y los cargás todos juntos.
- 🔔 **Lee las notificaciones de tus billeteras** (v2.2, solo APK): activalo en
  Ajustes y cuando Lemon, Mercado Pago o tu banco te avisan de un pago o una
  transferencia, Guita lo detecta y te lo propone para cargar. **Siempre te
  pregunta antes de anotar nada** y todo queda en el teléfono: la app solo lee
  las notificaciones de las billeteras y bancos de su lista, no las demás.
  Requiere darle permiso una vez en *Ajustes de Android → Acceso a
  notificaciones*.
- 🗓 **Pestaña Plan** (v2.3): todo lo que se repite todos los meses en un solo
  lugar — gastos fijos + suscripciones y servicios que vienen dentro del
  resumen de la tarjeta. Te dice cuánto te sale el mes completo, qué
  porcentaje de tus ingresos se lleva, y un calendario de qué se paga cada
  día (marcando lo vencido en rojo).
- 🎯 **Metas** (v2.3): viajes, fondo de emergencia, gimnasio, cursos. Ponés
  cuánto necesitás y para cuándo, y te dice **cuánto guardar por mes** para
  llegar. Cada vez que guardás plata, se descuenta de una billetera y queda
  anotada como gasto de ahorro.
- 📊 **Gráfico de 6 meses apilado por categoría** (v2.3), dibujado en canvas
  nativo (sin librerías): cada mes es una barra partida por categoría, con
  el total y la comparación contra el mes anterior. Se cambia a "ingresos vs
  gastos" con un toque.
- 👆 **Deslizar entre pantallas** (v2.3): pasás de Inicio a Análisis a Plan y
  así, arrastrando el dedo, con animación en la dirección del gesto. El
  micrófono quedó centrado en la barra (3 pestañas de cada lado).
- 📆 **Cuánto podés gastar por día** (v2.4): decile qué día cobrás y en el
  inicio ves cuánto te queda por día hasta el próximo sueldo — ya descontados
  los fijos y los resúmenes que faltan pagar.
- 🤔 **"¿Me alcanza?"** (v2.4): decile cuánto querés gastar y te contesta
  mirando lo que tenés, lo comprometido, los días hasta cobrar, la deuda de
  tarjeta y tus metas.
- 📈 **Detección de aumentos** (v2.4): compara cada servicio y suscripción
  contra los meses anteriores y te avisa qué subió, cuánto por mes y cuánto
  al año.
- 🎉 **Cuándo se te libera plata** (v2.4): mes por mes, cuánto deja de venir
  en el resumen cuando terminan tus cuotas.
- 🔁 **Auditoría de suscripciones** (v2.4): todas juntas con lo que sale cada
  una por mes, al año y lo que llevás gastado desde que la pagás.
- 🧮 **Simulador de salida de deuda** (v2.4): con la tasa real sacada de tus
  propios resúmenes, te dice en cuántos meses salís pagando X por mes, cuánto
  vas a pagar de intereses, y lo compara contra pagar el mínimo o pagar más.
  Avisa si la cuota no cubre ni los intereses.
- 💾 **Respaldo completo** (v2.4): exportás todos tus datos a un archivo y los
  restaurás en otro celular (con Deshacer por si te arrepentís). La API key no
  viaja en el respaldo.
- 🏦 **Préstamos** (v2.5): cargás la cuota, cuántas son y cuántas llevás
  pagadas, y registrás cada pago. Te dice cuántas quedan y cuánto falta en
  total. Suman a la deuda, al calendario del mes y al simulador.
- 🏠 **Inicio como panel** (v2.5): de un vistazo, cuánto debés (tarjetas +
  préstamos), cuánto tenés, los compromisos del mes y el gasto total, más el
  avance de tus metas. Cada dato te lleva a su pantalla.
- 🧭 **Cuatro pestañas** (v2.5): Inicio · Análisis | 🎙 | Deudas · Plata, con
  el micrófono justo en el centro. El plan mensual y las metas viven dentro de
  Plata; las tarjetas y los préstamos, dentro de Deudas.
- ⬅️ **El botón atrás del celu** (v2.5) cierra lo que tengas abierto o te
  devuelve al inicio, en vez de cerrar la app de una.
- 💳 **Pagar un resumen en un toque** (v3.0): desde el vencimiento del inicio,
  con atajos de total / mínimo / mitad. Al escribir el monto te avisa **cuánto te
  queda sin pagar** y **cuánto vendría el próximo resumen** con ese pago aplicado.
  Los pagos parciales se acumulan: podés seguir adelantando.
- ⏰ **Vencimientos primero** (v3.0): lo más próximo abre el inicio, con
  recordatorio por vencimiento (🔔) y el resto en píldoras debajo.
- ✅ **Lo que pagaste últimamente** (v3.0): resúmenes, cuotas de préstamo y
  pagos de fijos, con cuánto quedó pendiente de cada uno.
- 🧮 **Una sola fuente de verdad** (v3.0): `gastoDelMes()`, `deudaTotal()` y
  `compromisos()`. Antes el mismo dato se calculaba de tres formas distintas en
  tres pantallas y no coincidía. `compromisos()` separa lo que sale de tu
  billetera de lo que ya viene adentro del resumen, así nada se cuenta dos veces.
- 📐 **Un solo número grande por pantalla** (v3.0): Inicio = qué pago,
  Deudas = cuánto debo, Plata = cuánto tengo, Análisis = en qué se me va.
  Las secciones sin datos (metas, presupuestos) no ocupan lugar hasta usarlas.
- 📈 **Fijos comparados con meses anteriores** (v3.0): cada recurrente dice
  cuánto cambió contra el promedio de los meses previos.
- 🏷 **Categorías automáticas** por palabras clave (súper → Comida, nafta → Transporte,
  luz → Servicios, etc.). Siempre podés corregir antes de guardar.
- ➕ **Carga manual** para cuando no querés hablar.
- 📊 **Resumen mensual**: total gastado, ingresos, balance y barras por categoría.
- 💳 **Tarjetas de crédito**: cargá el resumen de cada mes (a mano o pegando el
  detalle del PDF del banco — detecta cada consumo y suma el total solo), con
  día de cierre y vencimiento, y registrá el pago desde una billetera.
- 📅 **Gastos fijos** con día de pago: cada mes ves qué falta pagar, qué venció
  y lo anotás en un toque.
- 👛 **Billeteras** (efectivo, banco, MP…): saldo de cada una, total disponible
  al día, transferencias entre billeteras y ajuste de saldo real.
- 🔔 **Próximos vencimientos** en el inicio: fijos y resúmenes por vencer o vencidos.
- 📤 **Exportar CSV** para abrir en Google Sheets o Excel.
- 📱 **Instalable (PWA)**: desde Chrome en Android, menú ⋮ → *"Agregar a pantalla
  de inicio"* y queda como una app más, con ícono y todo. Funciona offline.
- 🔒 **Tus datos quedan en tu celular** (localStorage). No hay servidor ni cuenta.

## APK para Android (instalación nativa)

En `android/` hay un wrapper nativo: un WebView que embebe la app y le suma el
**reconocedor de voz nativo de Android** (el WebView no soporta el dictado web)
y guardado de CSV con el selector de archivos del sistema.

- El workflow **Compilar APK** (`build-apk.yml`) lo compila en GitHub Actions y
  lo deja como artifact `guita-apk` de cada corrida (pestaña *Actions* → la
  corrida → *Artifacts*). Bajás el `guita.apk`, lo abrís en el celu y lo
  instalás (Android te va a pedir permitir "instalar apps desconocidas").
- Se puede compartir el `.apk` por WhatsApp/Drive para instalarlo en otro celu.
  Cada teléfono guarda sus propios datos.
- ⚠️ Recomendado: hacer el repo **privado** (Settings → General → Change
  visibility) — así los APK compilados solo se descargan con tu cuenta, y el
  keystore de firma (`android/guita.keystore`) no queda a la vista de nadie.

## Cómo publicarla (GitHub Pages)

1. Mergeá esta rama a `main`.
2. En GitHub: **Settings → Pages → Source: GitHub Actions** (el workflow
   `deploy.yml` intenta activarlo solo la primera vez que corre).
3. Al pushear a `main`, la app queda en `https://<usuario>.github.io/<repo>/`.
4. Abrí esa URL en el celu y agregala a la pantalla de inicio.

> El dictado por voz usa la Web Speech API del navegador — anda muy bien en
> Chrome para Android. En iPhone es limitado; ahí está la carga por texto con el
> mismo parser ("escribilo como lo dirías").

## Tests

```bash
node tests/app.test.mjs     # o: npm test
```

Suite de Playwright sobre el `index.html` real: parser de voz, montos en
formato argentino, lectura de resúmenes, deuda y proyección de tarjetas,
detalle por categoría, navegación por deslizamiento, Plan y metas, gráfico,
accesibilidad de las hojas y parser de notificaciones. Vive en el repo a
propósito: es la red de seguridad de la app.

## Estructura

| Archivo | Qué es |
|---|---|
| `index.html` | Toda la app (HTML + CSS + JS, sin dependencias) |
| `sw.js` | Service worker: cache para funcionar offline |
| `manifest.webmanifest` | Manifiesto PWA (nombre, íconos, colores) |
| `icons/` | Íconos de la app |
| `.github/workflows/deploy.yml` | Publica en GitHub Pages en cada push a `main` |

## Ideas para después

- Sincronizar con una base en la nube (Supabase) para no perder datos al cambiar de celu.
- Enviar el CSV directo a Google Sheets.
- Presupuestos por categoría con alertas.
- Gastos fijos que se cargan solos cada mes.
