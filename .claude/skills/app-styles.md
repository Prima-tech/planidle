---
description: Sistema de estilos/temas de la app (data-appstyle) — paletas de los 6 estilos, el mixin appstyle-bar, cómo tematizar una pieza nueva y el flujo de "5 opciones en galería". Se activa al hablar de estilos, temas, appstyle, tematizar un panel/barra/menú, crear o modificar un estilo, o los estilos wood/cyberpunk/arcano/sangre/holo/real.
triggers:
  - estilo
  - estilos
  - tema visual
  - tematizar
  - appstyle
  - data-appstyle
  - AppStyleService
  - appstyle-bar
  - host-context
  - marco negro
  - wood
  - cyberpunk
  - arcano
  - sangre
  - holo
  - real
  - barra de vida
  - selector de estilo
  - crear estilo
  - modificar estilo
  - galeria de opciones
---

# Estilos / temas de la app (`data-appstyle`)

La app tiene **temas conmutables** desde Ajustes. Cada pieza que quiera variar por tema
redefine sus colores con `:host-context([data-appstyle="<id>"])` en su propio SCSS.
`wood` es la BASE (sin `:host-context`); el resto son overrides.

## Archivos involucrados

| Archivo | Responsabilidad |
|---------|----------------|
| `src/app/services/app-style.service.ts` | Fuente de verdad: `AppStyleId`, `APP_STYLES` (lista para el selector), persistencia en `localStorage` (`app_style`), pinta `data-appstyle` en `<html>` |
| `src/app/app.component.ts` | Instancia el servicio al arrancar (aplica el atributo antes de pintar → sin parpadeo) |
| `src/app/pages/game-settings/game-settings.page.html` | Selector: `*ngFor` sobre `appStyle.styles` (un chip por estilo) |
| `src/app/pages/game-settings/game-settings.page.scss` | `.gs-style-btns` = **grid** `repeat(auto-fit, minmax(84px,1fr))` (chips que envuelven, sin scroll) |
| `src/assets/i18n/en.json` · `es.json` | Nombres de los estilos: `SETTINGS.STYLE.<CLAVE>` |
| `src/app/components/top-bar/top-bar.component.scss` | **Mixin `appstyle-bar(...)`** + un bloque `:host-context` por estilo (barra de vida + desplegable) |
| `src/app/components/npc-dialogue/npc-dialogue.component.scss` | Base wood + override `cyberpunk` (el resto de estilos aún caen a wood) |

## Cómo funciona

- `AppStyleService.set(id)` guarda en `localStorage` y hace `document.documentElement.setAttribute('data-appstyle', id)`.
- Una pieza tematizable: **maqueta la base en wood** (sin `:host-context`) y añade overrides:
  ```scss
  :host-context([data-appstyle="cyberpunk"]) {
    .mi-caja { background: #060908; border: 1px solid rgba(33,255,154,.4); }
  }
  ```
- ⚠️ Dentro de `:host-context(...)`, para el estado abierto usa el selector completo,
  **no** `.abierto &` (rompe el orden de selectores). Correcto:
  `.char-block--open .char-widget { ... }`.
- Estilos inline (`[ngStyle]`/`[style.x]`) ganan al SCSS: lo que se ponga inline no se
  puede re-tematizar por CSS.

## Los 6 estilos y sus paletas

`wood` es la base. Los demás son el "lenguaje" de color de cada tema (marco + acento + HP/MP).

| Estilo (id) | Nombre | Marco / panel | Borde | Acento | HP | MP | Notas |
|---|---|---|---|---|---|---|---|
| `wood` | Madera | `#a86f3e` (+veta) | piedra `#8f8678`/`#6b6357` biselado | oro `#ffe08a`/`#f0c040` | `#e8604a→#c0392b→#8e2418` | `#58a8e8→#2f7cc0→#1c4f80` | texto crema `#ecd9b4`, placa madera `#c08349`, outline `#3a2c20` |
| `cyberpunk` | Ciberpunk | negro `rgba(6,9,8,.96)` | fósforo `rgba(33,255,154,.16)` | `#21ff9a` | `#ff5a6e→#c0223a` | `#3fe0ff→#1785a8` | mono, corchete de esquina, texto `#dbeee4` |
| `arcano` | Arcano | `#221a3a→#140f24` | `#6d4bd6` (2px) | `#9d7ff0` (soft `rgba(122,80,230,.45)`) | `#ff6ba8→#c0246a` (magenta) | `#5be0ff→#1f8fd0` (turquesa) | serif, radius 10, texto `#ece6ff` / título `#b79cff` |
| `sangre` | Sangre | `#1a1012→#0c0708` | `#6b1620` (2px) | `#cf3a48` (soft `rgba(150,20,30,.5)`) | `#e23b32→#8e0f16` | `#7a5cc0→#3a2470` (violeta) | serif, radius 8, nivel hueso `#e8c4a8`, texto `#f0d8ce` / título `#d98a92` |
| `holo` | Holo azul | `rgba(8,18,30,.95)` | `rgba(80,180,255,.4)` | `#4db8ff` | `#ff6a5a→#c0292b` | `#4db8ff→#1c6fc0` | mono mayúsculas, radius 4, filete azul superior, texto `#dceefc` / título `#8fd4ff` |
| `real` | Real | azul real `#1e2a56→#111838` | oro `#caa23c` (2px) | `#e0b53c` | `#ff7a5e→#c0392b` | `#6fa0ff→#2f56c0` | serif, radius 12, avatar circular, placa oro `#ffe9a8→#e0b53c→#b5851f`, texto `#f0e6cc` |

Semánticos comunes en todos: bueno ≈ verde, malo ≈ rojo (`--good`/`--bad` del mixin).

## El mixin `appstyle-bar(...)` (barra de vida + desplegable)

En `top-bar.component.scss`. Genera TODO el override de un tema (tarjeta, avatar+nivel,
barras HP/MP+números, tirador, roster y panel de info de mapa con todos sus textos) a
partir de la paleta. Cada estilo es una llamada con sus colores → tocar un tema = cambiar
sus parámetros. Ejemplo real (arcano):

```scss
:host-context([data-appstyle="arcano"]) {
  @include appstyle-bar(
    $panel: linear-gradient(180deg, #221a3a, #140f24), $bcol: #6d4bd6, $bw: 2px, $radius: 10px,
    $accent: #9d7ff0, $accent-soft: rgba(122,80,230,.45), $on-accent: #160f28,
    $text: #ece6ff, $muted: rgba(216,204,245,.62), $title: #b79cff,
    $name-bg: linear-gradient(180deg,#8a63f0,#5b3bc4), $name-col: #f0e9ff, $name-bd: 1px solid #b79cff,
    $name-font: (Georgia, serif),
    $av-bg: #160f28, $av-bd: 2px solid #6d4bd6, $av-radius: 8px,
    $lvl-bg: linear-gradient(180deg,#d9c8ff,#9d7ff0), $lvl-col: #160f28,
    $track: #0d0a18, $track-bd: #3a2d5e,
    $hp: linear-gradient(180deg,#ff6ba8,#c0246a), $mp: linear-gradient(180deg,#5be0ff,#1f8fd0),
    $hp-glow: 0 0 8px rgba(255,90,160,.45), $mp-glow: 0 0 8px rgba(80,210,255,.45),
    $num-col: #f0e9ff, $inset: rgba(122,80,230,.08), $pill-bg: #1a1330,
    $good: #6be0c0, $bad: #ff6b8a
  );
}
```

Flourishes que el mixin no cubre (filete superior de `holo`, corchetes de `cyberpunk`) se
añaden como reglas extra dentro del mismo bloque `:host-context`.

## Flujo cuando el usuario pide un panel/pieza nueva

1. **Montar una GALERÍA EN VIVO con 5 opciones de diseño** de esa pieza (HTML autónomo en
   el scratchpad, con datos realistas). Abrirla con `Start-Process` + `SendUserFile`
   (`display: render`). El usuario elige una (o pide retoques). No preguntar en abstracto:
   enseñar variantes reales. (Ver galerías previas de la barra de vida / diálogos.)
2. El usuario elige **1 de las 5**.
3. **Implementar la elegida**: maquetar la base en **wood** en el SCSS de la pieza.
4. **Tematizarla en los 6 estilos** con overrides `:host-context([data-appstyle="…"])`
   usando las paletas de la tabla (reutilizar/imitar el patrón del mixin si aplica).
5. Si añade texto visible → clave i18n en `en.json` **y** `es.json` (regla del proyecto).

> Si el usuario quiere, las 5 opciones pueden mostrarse ya renderizadas en cada estilo;
> por defecto se muestran 5 variantes de layout y luego se tematizan en los 6.

## Cómo AÑADIR un estilo nuevo

1. `app-style.service.ts`: añade el id a `AppStyleId`, una entrada a `APP_STYLES`
   (`{ id, nameKey: 'SETTINGS.STYLE.<CLAVE>' }`) y al `if` de validación de `read()`.
2. i18n: `SETTINGS.STYLE.<CLAVE>` en `en.json` y `es.json`.
3. `top-bar.component.scss`: nuevo `:host-context([data-appstyle="<id>"]) { @include appstyle-bar(...); }`
   con la paleta del tema (+ flourishes si toca).
4. (Opcional) Tematizar otras piezas que ya tengan overrides (p. ej. `npc-dialogue`).
5. El selector de Ajustes se actualiza solo (`*ngFor`).

## Cómo MODIFICAR un estilo

- Colores de la barra de vida / desplegable: cambia los **parámetros del `@include`** de ese
  estilo en `top-bar.component.scss`.
- Diálogo u otras piezas: edita su bloque `:host-context` correspondiente.

## Verificación

- Compilar solo el SCSS tocado (rápido, sin OOM del build entero):
  `npx sass --no-source-map <archivo>.scss <tmp>.css` → debe salir EXIT 0.
- El usuario prueba en la app con `npm start` → Ajustes → Estilo.

## Notas

- `wood` es el estilo PRINCIPAL: toda pieza nueva se maqueta primero en wood.
- Lo que no tenga override para un estilo cae al look wood (no rompe, pero no va a juego).
- Piezas ya tematizadas en los 6 estilos: barra de vida + desplegable (`top-bar`,
  mixin `appstyle-bar`), misiones activas (`quest-tracker`, minimal-flotante, mixin
  `quest-theme`), bocadillo de diálogo de NPC (`npc-dialogue`, mixin `dialog-theme`),
  marco del minimapa (`layout.component.scss`, mixin `minimap-style`) e inventario
  (`inventory.component.scss`, mixin `inventory-style`).
- ⚠️ El INTERIOR del minimapa (fondo/barrido/rejilla) se dibuja en Phaser
  (`mobile-hud.scene.ts`) y aún NO varía por estilo — pendiente.
