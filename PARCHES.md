# Archivos de cambios (parches)

Guita lee dos tipos de archivo en **⚙ Ajustes → 📥 Abrir archivo**:

- **Respaldo entero** (`{app:"guita", datos:{...}}`) — el que genera "💾 Guardar respaldo".
  Pisa todo el estado. Sirve para mudarse de celular.
- **Archivo de cambios** (este documento) — se **suma** a lo que ya hay, sin borrar
  nada. Muestra una previsualización de qué va a pasar antes de aplicar, y deja
  Deshacer por 6 segundos.

En Android también se pueden **compartir** a Guita desde WhatsApp, el mail o Drive.

## Por qué existe

El ciclo de trabajo es: Julián cuenta sus movimientos por chat → se le devuelve un
archivo de cambios → lo abre y la app queda al día. Y al revés: si usó la app,
exporta el respaldo y lo pasa para actualizar el contexto de la conversación.

Un respaldo no sirve para el primer sentido: si él cargó cosas en la app entre medio,
restaurar se las borra. Por eso los cambios van como parche.

## Formato

```json
{
  "app": "guita",
  "parche": 1,
  "nota": "Septiembre: alquiler, sueldo y el pago de Visa",
  "cambios": [ ... ]
}
```

Todo lo que se refiere a algo que ya existe —tarjetas, billeteras, préstamos, fijos,
metas— **se nombra, no se referencia por id**. La app resuelve el nombre con la misma
comparación que usa para los comercios, así que "Visa" encuentra "Visa Provincia".
Si un nombre no se encuentra, esa operación se salta y aparece en la lista de errores;
el resto se aplica igual.

Las fechas van `YYYY-MM-DD`; si falta o está mal, se usa hoy. Los meses, `YYYY-MM`.

## Operaciones

### `gasto` · `ingreso`
```json
{"op":"gasto", "monto":650000, "desc":"Alquiler", "categoria":"Hogar",
 "fecha":"2026-09-01", "billetera":"Lemon"}
{"op":"ingreso", "monto":1500000, "desc":"Sueldo", "fecha":"2026-09-05",
 "billetera":"Lemon", "adelanto":false}
```
`billetera` o `tarjeta` (una u otra). `adelanto:true` marca el ingreso como adelanto
del próximo sueldo. Categorías: Comida, Transporte, Hogar, Servicios, Salud, Salidas,
Ropa, Educación, Tarjeta, Otros (y para ingresos, Ingreso).

### `fijo`
Crea o actualiza un gasto fijo. Si existe uno con ese nombre —o enganchado a ese
`comercio`— lo actualiza en vez de duplicarlo.
```json
{"op":"fijo", "nombre":"Gas", "monto":32593.41, "dia":15, "categoria":"Servicios",
 "esencial":true, "tarjeta":"Mastercard Provincia", "comercio":"camuzzi gas"}
```
`comercio` es la clave del comercio como aparece en el resumen: mantiene el vínculo
aunque el fijo se llame distinto. `esencial:true` = de los que sí o sí.
`moneda:"USD"` si el monto está en dólares.

### `billetera` · `saldo`
```json
{"op":"billetera", "nombre":"Naranja X", "saldo":50000, "inversion":false}
{"op":"saldo", "billetera":"Lemon", "monto":1023000}
```
`saldo` no reemplaza el historial: calcula la diferencia contra el saldo actual y
anota un ajuste, igual que "ajustar saldo real" en la app.

### `tarjeta` · `resumen` · `pagoResumen`
```json
{"op":"tarjeta", "nombre":"Visa Provincia", "cierre":13, "vto":24}

{"op":"resumen", "tarjeta":"Visa Provincia", "mes":"2026-09",
 "monto":1200000, "saldoAnterior":1139775.22, "pagos":500000,
 "impuestos":95000, "pagoMinimo":180000, "usd":10, "pagado":0,
 "detalle":[
   {"desc":"NETFLIX", "monto":30598.47, "categoria":"Servicios", "sub":true},
   {"desc":"GITHUB, INC.", "monto":10, "categoria":"Servicios", "moneda":"USD"}
 ]}

{"op":"pagoResumen", "tarjeta":"Visa Provincia", "mes":"2026-08",
 "monto":300000, "billetera":"Lemon", "fecha":"2026-09-02"}
```
`resumen` reemplaza el resumen de ese mes si ya existía, y al aplicarlo pone al día
los gastos fijos enganchados a esa tarjeta. `pagoResumen` **suma** al pago anterior
—los pagos parciales se acumulan— y descuenta de la billetera si se indica.

### `prestamo` · `pagoPrestamo`
```json
{"op":"prestamo", "nombre":"Préstamo Provincia", "cuota":118242, "cuotas":3,
 "dia":31, "proxima":"2026-08-31", "pagadas":1, "billetera":"Cuenta DNI"}

{"op":"pagoPrestamo", "prestamo":"Préstamo Provincia", "monto":118242,
 "fecha":"2026-08-31"}
```
`proxima` es la fecha exacta de la próxima cuota y manda sobre `dia`; al registrar un
pago avanza sola un mes. `pagadas` son las cuotas que ya venías pagando antes de
cargar el préstamo (no toca los pagos ya registrados).

### `planTarjeta`
```json
{"op":"planTarjeta", "tarjeta":"Mercado Pago", "plan":"monto", "monto":310689}
```
Con qué criterio proyectar el próximo resumen de esa tarjeta: `todo` (lo pagás
entero), `minimo`, `monto` (lo que digas) o `historico` (lo que venís pagando,
que es el que viene por defecto). No paga nada: sólo hace que la estimación
del próximo resumen refleje lo que pensás hacer.

### `presupuesto` · `previsto`
```json
{"op":"presupuesto", "porDia":20000}
{"op":"previsto", "desc":"Cumpleaños", "monto":45000, "fecha":"2026-09-13"}
```
`presupuesto` fija el sobre semanal (`porDia` × 7). Si es la primera vez, el arrastre
arranca el lunes de esta semana: no se inventa historia vieja. `previsto` aparta plata
para un gasto que ya se sabe que viene, así lo que queda por día no miente.

### `meta` · `config`
```json
{"op":"meta", "nombre":"Viaje", "objetivo":1200000, "guardado":200000,
 "fecha":"2026-12", "icono":"✈️"}
{"op":"config", "sueldo":3000000, "diaCobro":5, "dolar":1500}
```

### `borrarMov`
Borra los movimientos que coincidan. Cualquiera de los tres campos alcanza, pero
cuantos más se den, más preciso.
```json
{"op":"borrarMov", "desc":"Pago resumen", "monto":90000, "fecha":"2026-08-26"}
```

## Ejemplo completo

```json
{
  "app": "guita",
  "parche": 1,
  "nota": "Cierre de agosto y arranque de septiembre",
  "cambios": [
    {"op":"config", "sueldo":3000000, "diaCobro":5, "dolar":1500},
    {"op":"prestamo", "nombre":"Préstamo Provincia", "dia":31, "proxima":"2026-08-31"},
    {"op":"pagoPrestamo", "prestamo":"Préstamo Provincia", "monto":118242, "fecha":"2026-08-31"},
    {"op":"fijo", "nombre":"Alquiler", "monto":650000, "dia":1, "categoria":"Hogar",
     "esencial":true, "billetera":"Lemon"},
    {"op":"fijo", "nombre":"Gas", "monto":32593.41, "dia":24, "categoria":"Servicios",
     "esencial":true, "tarjeta":"Mastercard Provincia", "comercio":"camuzzi gas"},
    {"op":"gasto", "monto":45000, "desc":"Súper", "categoria":"Comida",
     "fecha":"2026-09-02", "billetera":"Lemon"},
    {"op":"saldo", "billetera":"Lemon", "monto":890000}
  ]
}
```
