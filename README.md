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
- 🤝 **Asesor financiero con IA** (con API key): un chat en Análisis que conoce
  tus números — gastos, ingresos, tarjetas, fijos, billeteras, deudas,
  inversiones y presupuestos — con prioridades sanas: primero cortar la deuda
  de tarjeta, después fondo de emergencia, recién después invertir.
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
  velo junto a los resúmenes sin pagar — el asesor lo trata como prioridad nº1.
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
  Con Haiku, leer un resumen sale ~US$0,02–0,05 y una consulta al asesor
  menos de US$0,01 (~5× más barato que Opus).
- 💡 **Recomendaciones locales gratis** en Análisis: costo real de financiar,
  cuotas que se liberan, suscripciones, presupuestos pasados, balance del
  mes y fondo de emergencia — sin gastar API.
- 🔮 **Próximo resumen detallado**: tocá la proyección en el historial y ves
  cuota por cuota qué sigue (y cuál es la última 🎉), qué cuotas terminan,
  suscripciones, consumos nuevos, financiado, impuestos estimados, total y
  pago mínimo estimado según tu proporción histórica.
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
