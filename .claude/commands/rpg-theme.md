# rpg-theme — Maquetar menús con el estilo madera + piedra (pixel-art RPG)

Aplica el tema visual "madera y piedra" a un menú, panel o modal del juego: paneles de
madera naranja con vetas, marcos de piedra gris biselados, contorno oscuro tipo pixel-art,
celdas marrón oscuro hundidas y acento púrpura para selección.

**Implementación de referencia:** `src/app/components/inventory/inventory.component.scss`
(y `item-detail.component.scss`). Ante cualquier duda, copiar de ahí.

## Argumentos esperados

- **Componente/panel a maquetar** (ej. `equipment`, `settings`, el modal de un panel nuevo)
- Opcional: qué piezas necesita (tabs, grid de celdas, botones, placa de título, modal)

---

## Paleta (copiar tal cual al inicio del SCSS del componente)

```scss
/* ===== Tema madera + piedra (pixel-art RPG) ===== */
$outline: #3a2c20;        // contorno oscuro de todos los marcos
$stone: #8f8678;          // piedra base
$stone-light: #a59c8d;    // piedra iluminada (arriba/izq)
$stone-dark: #6b6357;     // piedra en sombra (abajo/dcha)
$wood-bg: #a86f3e;        // madera del panel
$wood-bg-dark: #935f34;   // madera oscura
$wood-btn: #c08349;       // madera de botones/placas
$wood-btn-light: #d99a5c;
$wood-btn-dark: #8a5530;
$cell-bg: #38241d;        // interior de celdas
$cell-border: #21130e;
$grid-bg: #4a3023;        // fondo del área de grid
$text-brown: #53301c;     // texto sobre madera clara
$text-cream: #ecd9b4;     // texto sobre fondos oscuros
$purple: #6e4a67;         // selección
$metal-light: #cfc7b8;    // bisel metálico iluminado (ventanas flotantes, placa del nombre)
$metal: #9b9285;          // bisel metálico base
$metal-dark: #6b6357;     // bisel metálico en sombra
```

> Cada componente lleva su copia de las variables (no hay partial compartido).
> Si algún día se crea uno, migrar todos los usos a la vez.

---

## Recetas

### 1. Panel principal (marco piedra + madera con vetas)

El truco del marco: `border` de 4 colores simula el bisel de piedra (luz arriba/izq,
sombra abajo/dcha) y dos anillos `box-shadow` de 2px pintan el contorno oscuro por
fuera y por dentro de la piedra.

```scss
:host {
  display: block;
  margin: 2px; /* deja sitio al contorno exterior si vive en un modal con overflow */
  padding: 12px 10px 8px;
  color: $text-cream;
  background:
    repeating-linear-gradient(180deg, rgba(0, 0, 0, 0.05) 0 2px, transparent 2px 16px),
    $wood-bg;
  border: 5px solid;
  border-color: $stone-light $stone-dark $stone-dark $stone;
  border-radius: 10px;
  box-shadow:
    0 0 0 2px $outline,
    inset 0 0 0 2px $outline,
    0 8px 32px rgba(0, 0, 0, 0.6);
}
```

El `repeating-linear-gradient` son las vetas de la madera — siempre encima del color base.

### 1b. Ventana flotante / popover / ficha / tarjeta de info (marco metálico + madera clara) ⭐ POR DEFECTO

**Usar SIEMPRE esta receta para popovers, flyouts, fichas de detalle, tooltips Y
cualquier tarjeta de información** (ej. la caja de enemigos/aliados que sale al pinchar
un mapa, paneles de detalle de skill, etc.).
NO usar fondo oscuro `$cell-bg` ni borde fino `$outline` para estas ventanas/tarjetas —
ese es el estilo viejo y se ve mal. El look correcto es **bisel metálico gris + cara de
madera oscura `$wood-btn-dark`**, idéntico a la ficha de detalles de talentos
(`equipment.component.scss` → `.talent-node-card`) y a la pastilla del nombre (`char-stats`).

```scss
.floating-window {   // popover, flyout, ficha de detalle, tooltip, tarjeta de info
  padding: 8px 10px;
  color: $text-cream;
  background: $wood-btn-dark;            // madera clara — NO $cell-bg
  border: 3px solid;
  border-color: $metal-light $metal-dark $metal-dark $metal;  // bisel metálico
  border-radius: 7px;
  box-shadow:
    0 0 0 1px $outline,                  // contorno exterior
    inset 0 0 0 1px $outline,            // contorno interior
    inset 0 1px 0 rgba(255, 255, 255, 0.12),  // reflejo metálico superior
    0 4px 16px rgba(0, 0, 0, 0.6);       // sombra de elevación
}

.fw-title {                             // título dentro de la ventana
  font-family: Georgia, 'Times New Roman', serif;
  font-weight: 700;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #ffd700;                       // dorado sobre la madera
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}
```

- Sin botón de cerrar (✕): estas ventanas se cierran al reseleccionar o pinchar fuera.
- Para valores/datos dentro: enmárcalos como placa de monedas (receta 6b), no texto suelto.
- Botón de acción compacto: solo icono, cuadrado ~28px, `margin-left: auto` para alinearlo
  a la derecha de su fila.

**Referencia:** `equipment.component.scss` → `.talent-node-card` (picker de talentos),
`char-stats.component.scss` → `:host` (pastilla del nombre) y
`world-map-panel.component.scss` → `.map-info-card` (caja de enemigos/aliados del mapa).

### 2. Sección interior enmarcada (área de grid, sub-paneles)

Igual que el panel pero con borde 4px y fondo marrón oscuro:

```scss
.framed-section {
  padding: 6px;
  background: $grid-bg;
  border: 4px solid;
  border-color: $stone-light $stone-dark $stone-dark $stone;
  border-radius: 8px;
  box-shadow:
    0 0 0 2px $outline,
    inset 0 0 0 2px $outline;
}
```

### 3. Celdas de grid (hundidas)

```scss
.cell {
  width: 46px;
  height: 46px;
  margin: 2px;
  background-color: $cell-bg;
  border: 2px solid $cell-border;
  border-radius: 5px;
  box-shadow:
    inset 0 2px 4px rgba(0, 0, 0, 0.4),   /* hundido */
    0 1px 0 rgba(255, 255, 255, 0.06);     /* brillo pixel en el borde inferior */
}
```

Selección (celda púrpura como en el mockup):

```scss
.cell-item.selected {
  background-color: $purple;
  border: 2px solid lighten($purple, 14%);
}
```

### 4. Botones cuadrados (madera con marco de piedra)

Tamaño compacto 32×32 para barras de acciones (los menús deben caber a lo alto):

```scss
.btn-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: $wood-btn;
  color: $text-brown;
  border: 2px solid;
  border-color: $stone-light $stone-dark $stone-dark $stone;
  border-radius: 6px;
  box-shadow:
    0 0 0 1px $outline,
    inset 0 0 0 1px $outline;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;

  ion-icon { font-size: 16px; pointer-events: none; }
  &:hover  { background: $wood-btn-light; }
  &:active { background: $wood-btn-dark; color: $text-cream; }
}
```

Variante peligro: mismo marco, `color: #7e2c1c` y `:active { background: #a03325; }`.

### 4b. Botón metálico (cara de acero — usado en el footer)

Mismo marco de piedra, pero la cara es un degradado de acero con reflejo superior.
Iconos/texto en gris oscuro `#3a342c` / `#4a443c`:

```scss
$metal-light: #cfc7b8;
$metal: #9b9285;
$metal-dark: #6b6357;
$metal-face: linear-gradient(180deg, $metal-light 0%, $metal 45%, #847b6e 75%, $metal-dark 100%);

.btn-metal {
  background: $metal-face;
  border: 2px solid;
  border-color: $stone-light $stone-dark $stone-dark $stone;
  color: #3a342c;
  box-shadow:
    0 0 0 1px $outline,
    inset 0 0 0 1px $outline,
    inset 0 2px 0 rgba(255, 255, 255, 0.3); /* reflejo metálico */

  &:active, &.active {
    background: $purple; /* o invertir el degradado para efecto pulsado */
    box-shadow:
      0 0 0 1px $outline,
      inset 0 0 0 1px $outline,
      inset 0 2px 4px rgba(0, 0, 0, 0.35); /* hundido */
  }
}
```

> Ojo con animaciones `forwards` que pisen `background`/`box-shadow`: el último
> keyframe debe restaurar el degradado y los anillos completos.

**Referencia:** `footer-bar.component.scss`.

### 5. Tabs

Todas del mismo ancho (`flex: 1 1 0`), padding vertical 2px, inactiva = madera oscura,
activa = madera clara con texto marrón:

```scss
.tabs { display: flex; gap: 5px; margin-bottom: 10px; }

.tab {
  flex: 1 1 0;
  text-align: center;
  padding: 2px 0;
  border: 2px solid $outline;
  border-radius: 5px;
  font-size: 0.75em;
  font-weight: 700;
  cursor: pointer;
  user-select: none;
  color: $text-cream;
  background: $wood-btn-dark;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.12),
    inset 0 -2px 0 rgba(0, 0, 0, 0.25);
  transition: background-color 0.15s, color 0.15s;
}

.tab.active,
.tab:hover {
  background-color: $wood-btn;
  color: $text-brown;
  box-shadow:
    inset 0 0 0 1px $wood-btn-light,
    inset 0 -2px 0 rgba(0, 0, 0, 0.2);
}
```

### 6. Placa oscura (SOLO contadores pequeños inline: monedas, cantidades)

> **No usar para fichas ni tarjetas de info** (popovers, detalle de skill, caja del
> mapa…). Esas van con la receta 1b (marco metálico + madera). Esta placa es solo para
> un valor corto embebido (un contador de monedas, una cantidad sobre fondo oscuro).

```scss
.plaque {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  background: $cell-bg;
  border: 2px solid $outline;
  border-radius: 6px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}
```

### 6b. Placa de valor estilo monedas (madera clara + bisel de piedra)

Para mostrar un valor/dato dentro de una ventana flotante (receta 1b) o sobre madera.
Es la misma placa que el contador de monedas del inventario (`.coins-section`):

```scss
.value-plaque {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 8px;
  background: $wood-btn;
  border: 2px solid;
  border-color: $stone-light $stone-dark $stone-dark $stone;
  border-radius: 6px;
  box-shadow:
    0 0 0 1px $outline,
    inset 0 0 0 1px $outline;
  font-size: 0.66em;
  font-weight: 700;
  color: $text-brown;
}
```

**Referencia:** `inventory.component.scss` → `.coins-section`.

### 7. Modal de confirmación

Mismo marco que el panel principal (receta 1) sobre overlay oscuro. Título en serif
(estilo placa "VLAD"):

```scss
.modal-title {
  font-family: Georgia, 'Times New Roman', serif;
  font-weight: 700;
  color: $text-brown;
}
```

Botones del modal: `border: 2px solid $outline`, cancelar = `$wood-btn-dark` con texto
crema, acción destructiva = `#a03325` con texto `#f5e3c8`.

### 8. Texto

| Contexto | Color |
|----------|-------|
| Sobre madera clara (títulos, botones) | `$text-brown`, bold |
| Sobre fondos oscuros (celdas, placas) | `$text-cream` |
| Secundario sobre madera | `#6b4226` |
| Títulos/nombres destacados | serif: `Georgia, 'Times New Roman', serif` |
| Cantidades/oro sobre fondo oscuro | `#ffd700` o `#f0c040` |

---

## Integración con modal-container

Si el componente se abre vía `ModalContainerComponent`, el marco lo pinta el `:host`
del componente — la variante del modal debe quedar transparente:

```scss
/* modal-container.component.scss */
&.mi-panel {
  /* posición... */
  background: transparent;  /* sin background ni box-shadow propios */
  overflow-y: auto;
}
```

Y el `:host` del componente lleva `margin: 2px` para que el anillo exterior del
`box-shadow` no se recorte con el `overflow` del modal.

---

## Reglas de oro

1. **Contorno oscuro en todo**: cualquier marco lleva el anillo `$outline` (box-shadow 0 0 0 1-2px).
2. **Bisel = border de 4 colores**: luz `$stone-light` arriba, `$stone` izquierda, `$stone-dark` abajo/derecha. En madera: `$wood-btn-light` / `$wood-btn-dark`.
3. **Madera siempre con vetas** (`repeating-linear-gradient` de la receta 1) en superficies grandes; en botones pequeños no hace falta.
4. **Compacidad**: los paneles deben caber entre `top: 10px` y `bottom: 65px` — botones 32px, paddings ajustados, tabs con padding vertical 2px.
5. **No tocar la lógica**: este tema es solo SCSS. Mantener clases, estructura HTML y bindings existentes (CDK drag&drop depende de ellas).
6. **Popovers/flyouts/fichas/tarjetas de info = receta 1b** (marco metálico + madera `$wood-btn-dark`). Incluye cualquier caja que muestre datos al seleccionar algo (p. ej. la caja de enemigos/aliados del panel de mapa). NUNCA fondo oscuro `$cell-bg` con borde fino `$outline` — ese es el estilo viejo y queda mal. La placa oscura (receta 6) es solo para contadores pequeños inline, no para tarjetas. Sin botón ✕ de cerrar.

## Checklist

- [ ] Paleta copiada al inicio del SCSS (incluidas las `$metal-*`)
- [ ] Panel principal con marco piedra + vetas (receta 1)
- [ ] Popovers/flyouts/fichas/tarjetas de info con marco metálico + madera (receta 1b), sin ✕
- [ ] Ninguna tarjeta/ficha usa la placa oscura (receta 6) — esa es solo para contadores inline
- [ ] Secciones interiores enmarcadas (receta 2)
- [ ] Botones/tabs/placas con sus recetas (valores con placa de monedas 6b)
- [ ] Variante del modal-container en transparente (si aplica)
- [ ] Comprobado que cabe a lo alto en el viewport del juego
