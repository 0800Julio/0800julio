---
name: guita-design
description: Sistema de diseño y motion de Guita (app de finanzas personales). Usar SIEMPRE antes de tocar la UI de index.html — define paleta, tipografía, espaciado, componentes y reglas de animación para mantener coherencia visual.
---

# Guita — sistema de diseño

## Identidad
Guita es una app de finanzas personales argentina, mobile-first, que se usa con una
mano y muchas veces por voz. El tono es cercano y rioplatense ("Te escucho…",
"¿Lo cargo así?"), nunca corporativo. Todo el copy en voseo.

## Paleta (tokens CSS en `:root`)
- Fondo `--paper` verde-grisáceo claro `#F1F4EF` / oscuro `#111613`
- Tarjetas `--card` blanco / `#1A211C`
- Marca `--brand` verde peso `#1E7A4F` / `#43A879` (dark)
- Gasto `--expense` terracota `#B5473F` / `#E58B82` — Ingreso `--income` = verde marca
- Categorías: cada una tiene su token `--c-*` con variante clara y oscura
- Gradiente de marca: `linear-gradient(150deg, var(--brand), var(--brand-2))` —
  solo para superficies "héroe" (FAB, botón primario, coin del logo)
- Nunca agregar colores sueltos: todo via tokens, redefinidos en
  `@media (prefers-color-scheme: dark)` **y** `:root[data-theme="dark"|"light"]`

## Profundidad (v1.9)
- Sombras en capas via tokens: `--shadow` (cards: key 1-2px + ambiente difusa),
  `--shadow-lg` (sheets y popups), `--shadow-fab` (FAB y coin, teñida de marca)
- Brillo de marca `--glow` (rgba verde ~.15): radial fijo arriba del `body`
  (::before, z-index -1), aurora del héroe `.g-summary::before` y halo de sombras
- Nav inferior flotante: `--nav-bg` translúcido + `backdrop-filter: blur(16px)
  saturate(1.4)` dentro de `@supports` — el fallback queda `var(--card)` sólido
- Nunca sombras duras ni negras al 100%; en dark suben alfa, no el tamaño

## Tipografía
- Stack de sistema (`system-ui`) a propósito: sensación nativa y cero payload
- Montos siempre `font-variant-numeric: tabular-nums`; total del mes en 800,
  tracking -0.03em
- Labels: 11px, uppercase, letter-spacing .08em, color `--muted`

## Layout
- Una columna, `max-width: 480px`, padding 16px
- Navegación inferior con FAB de micrófono central elevado — el mic es el héroe
- Espaciado con `gap` de flex/grid, nunca márgenes sueltos que colapsen
- Radios: cards 16px, inputs 12px, sheets 22px arriba

## Motion
- Easing estándar `--ease: cubic-bezier(.22,.9,.36,1)`; resorte suave
  `--spring: cubic-bezier(.34,1.35,.64,1)` solo para sheets y FAB
- Duraciones: micro 150–200ms, sheets 260ms, cambio de vista 220ms
- Patrones: vista entra con fade + translateY(10px); items de lista en cascada
  (delay 25ms por ítem, máximo 10); números importantes cuentan con rAF (~400ms);
  mic pulsa mientras escucha
- Mic mantener-apretado: arrastrar >70px a un costado cancela la grabación
  (estilo WhatsApp). El wrap `.g-micwrap` sigue al dedo con freno (×.55) y
  se desvanece; a >26px el botón toma `.canceling` (gradiente rojo). El
  descarte real pasa por `stopRec()` + bandera `vozCancelled` que ignora
  resultados tardíos del reconocedor (web `onend` y puente Android).
- Splash de inicio `#splash`: coin con spring + wordmark en cascada, se
  desvanece solo a los ~1.25s (`splashOut`) y el JS lo remueve del DOM
  (`animationend` + timeout de seguridad). `pointer-events: none` SIEMPRE —
  la app queda interactiva debajo. Con reduced-motion se remueve al instante.
- TODO se apaga bajo `@media (prefers-reduced-motion: reduce)` — sin excepciones
- Una sola pieza audaz por pantalla; el resto quieto

## Reglas duras
- La app es UN archivo (`index.html`), sin dependencias ni CDNs (la CSP del
  artifact bloquea todo lo externo)
- Todo dato de usuario pasa por `esc()` antes de innerHTML
- El puente `window.AndroidVoz` (APK) y `window.claude.downloads` (artifact) son
  opcionales: detectar antes de usar, siempre con fallback
- Probar con `scratchpad/test_app.mjs` (Playwright) antes de commitear
