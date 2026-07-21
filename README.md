# 💸 Guita — tus gastos, a viva voz

App de finanzas personales pensada para usar desde el celular: tocás el micrófono,
decís **"gasté 5 lucas en la verdulería"** y Guita entiende el monto, le pone
categoría y lo anota. Después ves el resumen del mes y lo exportás a una planilla.

## Qué hace

- 🎙 **Carga por voz** en español rioplatense: entiende "5 lucas", "un palo",
  "32.000", "cinco mil quinientos", "media luca"…
- 🏷 **Categorías automáticas** por palabras clave (súper → Comida, nafta → Transporte,
  luz → Servicios, etc.). Siempre podés corregir antes de guardar.
- ➕ **Carga manual** para cuando no querés hablar.
- 📊 **Resumen mensual**: total gastado, ingresos, balance y barras por categoría.
- 📤 **Exportar CSV** para abrir en Google Sheets o Excel.
- 📱 **Instalable (PWA)**: desde Chrome en Android, menú ⋮ → *"Agregar a pantalla
  de inicio"* y queda como una app más, con ícono y todo. Funciona offline.
- 🔒 **Tus datos quedan en tu celular** (localStorage). No hay servidor ni cuenta.

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
