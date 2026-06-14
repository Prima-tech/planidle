# new-building — Añadir un item/edificio construible en la ciudad

Guía para registrar un nuevo construible del sistema de construcción de Asgard
(mapa `hogar`). El jugador lo coloca con el botón **Construir** del footer; queda
**permanente y compartido entre todos los personajes** (se persiste en la clave
global `city_buildings` vía `StorageService`, igual que el cofre de ciudad).

## Argumentos esperados

- **Nombre del construible** (ej. `Fragua`, `Estatua`, `Granero`)
- **Textura/sprite**: ruta del PNG (spritesheet o imagen suelta) y, si es sheet,
  el **frame** y el **tamaño de frame** en px
- **Escala** en el mundo (el cofre usa `4`)
- **Footprint**: tamaño aproximado en tiles que ocupa (informativo; la colisión
  real se calcula de `frameSize × scale`)
- **¿Único?** (`unique: true` → desaparece del menú al construir uno)
- **¿Comportamiento al interactuar?** (decorativo/colisión, o algo activable)

> Tile = `48px` (`GameScene.TILE_SIZE`). Un sprite de `frameSize 32 × scale 4`
> ocupa `128px` ≈ 3×3 tiles.

---

## Paso 1 — Tener la textura cargada en Phaser

El sprite **debe estar cargado** en `preload()` de la escena, en
`src/app/scenes/gamescene/gamescene.ts`. Si reutilizas una textura ya cargada
(p.ej. `'chests'`, `'icons1'`) no hay nada que hacer. Si es nueva, añade en
`preload()`:

```typescript
// Spritesheet (varios frames):
this.load.spritesheet('fragua', 'assets/sprites/resources/fragua.png', { frameWidth: 32, frameHeight: 32 });
// …o imagen suelta (un único frame → frame: 0, frameSize = ancho del PNG):
this.load.image('estatua', 'assets/sprites/resources/estatua.png');
```

---

## Paso 2 — Registrar en `BUILDABLES`

Archivo: `src/app/services/city-build.service.ts` → array `BUILDABLES`.

```typescript
{
  type: 'fragua',          // id único interno (sin espacios)
  name: 'BUILD.FORGE',     // clave i18n (ver Paso 3)
  spriteKey: 'fragua',     // textura cargada en preload()
  frame: 0,                // frame dentro del spritesheet
  frameSize: 32,           // lado del frame en px → define el footprint/colisión
  scale: 4,                // escala en el mundo
  tilesW: 3, tilesH: 3,    // hint de footprint (informativo)
  unique: false,           // true → solo uno por tipo
  // isTownChest: true,    // ver Paso 4 (solo si abre el almacén compartido)
},
```

Con esto **ya funciona**: aparece en el panel Construir, se coloca con
placeholder verde/rojo + check, persiste y se vuelve a pintar al entrar en
Asgard. No hay que tocar la escena salvo casos especiales (Pasos 4-5).

---

## Paso 3 — Textos i18n

Archivos: `src/assets/i18n/es.json` y `en.json`, bajo la clave `"BUILD"`.

```jsonc
"BUILD": {
  "TITLE": "Construir",
  "NONE": "Nada que construir",
  "TOWN_CHEST": "Cofre de ciudad",
  "FORGE": "Fragua"        // ← nueva clave, en AMBOS idiomas
}
```

---

## Paso 4 — (Opcional) Comportamiento al interactuar

Por defecto un construible es **colisión + sprite** (decorativo/bloqueante). Si
necesita interacción:

### a) Que abra el almacén compartido (como otro cofre)

Pon `isTownChest: true` en su entrada de `BUILDABLES`. `spawnBuilding()` lo
enrutará a `addTownChest()` y abrirá la **misma** ventana compartida que el cofre
fijo. (Requiere que `spriteKey` sea `'chests'` para las animaciones de apertura.)

### b) Otro comportamiento propio

En `gamescene.ts`, método `spawnBuilding(b)`: hay un `if (def.isTownChest) … else …`.
Añade una rama por `def.type` (o un nuevo flag en `BuildableDef`) para crear tu
sprite + registrar tu interacción. Patrones de interacción de cercanía reutilizables:
`activeChests`, `nearestOpenableChest()` y el contexto del botón de acción
(`InteractionService.setContext()`).

### c) Vaciar su "interior" al borrarlo

Si el edificio guarda contenido (como el cofre vacía su almacén), añade el borrado
en `CityBuildService.confirmDelete()`. Hoy hace `if (def?.isTownChest) await
this.townChest.clear()`. Para otro tipo con interior, añade su limpieza ahí.

### d) Abrir una ventana al pulsarlo (como la tienda)

Pon `opensWindow: true` en su `BuildableDef`. Hay **dos formas** de abrir la ventana,
ambas vía `cityBuild.requestOpenWindow(type)` → `openWindow$`:
- **Tap** sobre el sprite (`handleBuildingWindowTap` en el pointerdown de la escena).
- **Cercanía + botón de acción**: en `update()`, `nearestWindowBuilding()` detecta el
  edificio cerca y pone el contexto `'shop'` (`InteractionService`), que cambia el
  botón de atacar al icono de interacción (dorado, `attack-button`). Al mantener el
  botón se abre una sola vez (latch `shopActionLatched`).

En `footer-bar`, la suscripción a `openWindow$` mapea el `type` a la apertura del
modal (p.ej. `'shop'` → `openBuildShop()`, abre `BuildShopComponent` en un modal
`'build-shop'` a la izquierda). Para un tipo nuevo:
1. Crea el componente de la ventana (`components/<x>/`, `standalone:false`, declarado
   en `components.module.ts`).
2. Añade su `&.<tipo>` en `modal-container.component.scss` (lado/tamaño).
3. Añade `@ViewChild` + `<app-modal-container #xModal>` + método `openX()` en
   `footer-bar`, e inclúyelo en `closeOtherOnSide`/`closeAllPanels`.
4. Mapea el `type` en la suscripción a `openWindow$`.

> El cofre de ciudad NO usa esto: se abre por cercanía + botón de acción
> (`nearestOpenableChest`), no por tap.

**Ejemplo — la tienda (`shop`)**: su ventana (`BuildShopComponent`) usa
`BuildShopService` (clave global `build_shop`): oro propio (500 inicial), 6 slots de
venta (`PRODUCTS`) con precio/stock. Pulsar un slot abre un **panel de detalle**
(fijo, a la derecha de la ventana) con el botón **Comprar**; los items **apilables**
(`entry.mergeable`) muestran un **selector de cantidad ±** (limitado por stock y oro).
`buy(item, qty)` hace −oro jugador (`addCoins(-precio·qty)`), mete los items con
`inventory.addOrDropToWorld()` (al inventario o **al suelo si está lleno**, apilables
en una pila de qty), −stock y +oro tienda. Al abrir la tienda se abre también el
inventario a la derecha (espeja el cofre); se cierran juntos al alejarse.
La ventana tiene 2 pestañas: **Comprar** (lo anterior) y **Vender** — un inventario
de venta (`sellGrid`, drag desde la mochila espejando el cofre: `sellCellIds` +
`removeRequest$`/`sellRemoveRequest$`); el botón **Vender** paga desde el oro de la
tienda (`sellValue`/`SELL_VALUES`, `sell(total)`) y los items desaparecen; lo no
vendido vuelve a la mochila al cerrar (`addDroppedItem` en `ngOnDestroy`). El oro/maquetación clona
`.coins-section` del inventario. `reset()` (oro 500 + restock) se llama desde
`settings.page.clearAll()` ("borrar todo"). Precio/stock se editan en `PRODUCTS`.

---

## Paso 5 — Minimapa (automático)

Los construibles colocados **ya salen en el minimapa** sin tocar nada:
`buildMinimapData().getBuildings()` (en `gamescene.ts`) devuelve `placedBuildings`
(posición + `kind`), y `MobileHUDScene.updateMinimap()` los pinta dinámicamente
(dot dorado para cofre, verde para tienda). Para un color nuevo por tipo, añade el
`kind` en `getMinimapBuildings()` y un color en `MobileHUDScene`.

---

## Flujo de uso (UX, ya implementado)

1. Botón **martillo** del footer (solo en Asgard) → abre el panel Construir.
2. Eliges un item → **se cierran TODAS las ventanas abiertas** (`closeAllPanels()`
   en `footer-bar`, disparado por la suscripción a `placementMode$`) y aparece el
   **ghost** sobre el personaje.
3. **Arrastras** el ghost por el mapa (mantén pulsado): sigue al dedo/ratón tile a
   tile, pintándose **verde** (válido) o **rojo** (colisión / fuera de límites) en
   tiempo real. Un toque simple lo teletransporta a ese tile.
4. Pulsas **✓** (solo visible si es válido) para construir, o **✕** para cancelar.
5. Lo construido **persiste y es compartido** entre personajes; reaparece al
   entrar en Asgard.
6. **Mover edificio**: botón al pie del panel Construir (`BUILD.MOVE`, deshabilitado
   si no hay nada colocado). Al pulsarlo se cierran todas las ventanas y entras en
   modo selección; pinchas un edificio del mapa y pasa a **modo edición** (mismo
   ghost arrastrable verde/rojo). ✓ lo reubica, ✕ lo deja donde estaba. Solo son
   movibles los edificios **construidos por el jugador** (el cofre fijo no).
7. **Borrar edificio**: botón rojo al pie del panel (`BUILD.DELETE`). Cierra ventanas
   y entra en modo selección; pinchas un edificio y aparece un **modal de
   confirmación** (`BuildDeleteModalComponent`). Al confirmar, el borrado es
   **permanente** (sale del storage) y **su interior se vacía** (un cofre pierde
   todos sus items vía `TownChestService.clear()`).
8. El botón **🗑 Borrar todo** (ajustes) **borra también las construcciones**
   (`CityBuildService.clear()` desde `settings.page.ts`) y **resetea la tienda**
   (`BuildShopService.reset()` → oro 500 + restock), así que un `unique` vuelve a
   estar disponible para reconstruir.

---

## Cómo funciona por dentro (referencia)

- **Servicio**: `CityBuildService` (`city-build.service.ts`) — catálogo
  `BUILDABLES`, persistencia (`load`/`add`/`isBuilt`/`clear`/`move`/`hasBuildings`),
  bridge de colocación (`placementMode$`), de movimiento (`moveMode$`) y de borrado
  (`deleteMode$`, `pendingDelete$`, `requestDelete`, `confirmDelete`, `cancelDelete`),
  de apertura de ventana (`openWindow$`, `requestOpenWindow`)
  + notificaciones (`placed$`, `cleared$`, `removed$`).
- **Panel UI**: `BuildPanelComponent` (`components/build-panel/`) — lista
  `BUILDABLES` ocultando los `unique` ya construidos + botones **Mover edificio**
  (`startMove()`) y **Borrar edificio** (`startDelete()`), ambos deshabilitados si
  `!hasBuildings`. Declarado en `components.module.ts`.
- **Modal de borrado**: `BuildDeleteModalComponent` (`components/build-delete-modal/`),
  montado siempre en `layout.component.html`; se muestra con `pendingDelete$`.
- **Footer**: botón martillo en `footer-bar` (solo `currentMapId === 'hogar'`);
  `openBuild()` abre el modal `'build'` (lado izquierdo). `placementMode$`,
  `moveMode$` y `deleteMode$` disparan `closeAllPanels()`.
- **Escena**: `gamescene.ts` →
  - `initPlacedBuildings()` pinta lo persistido al entrar en Asgard.
  - `initBuildPlacementListener()` reacciona a `placementMode$` (colocar) y a
    `moveMode$` (activa `moveSelecting`).
  - `initBuildClearedListener()` → `removePlacedBuildings()` (usa `detachPlacedBuilding`)
    quita en caliente lo construido al recibir `cleared$` (botón borrar todo).
  - `startBuildPlacement(def, moving?)` / `refreshGhost()` gestionan ghost (verde/rojo)
    y botones ✓/✕. Con `moving` es una reubicación: arranca en el tile del edificio.
  - `handleBuildPointer()` (pointerdown: botones o iniciar arrastre) +
    `moveGhostToPointer()` (pointermove mientras `dragging`) + `pointerup` (fin de arrastre).
  - `handleMoveSelect()` (en `moveSelecting`, pincha un edificio) → `beginMoveBuilding()`
    lo saca de la escena (`detachPlacedBuilding`) y arranca el ghost en modo reubicar.
  - `handleDeleteSelect()` (en `deleteSelecting`, pincha un edificio) → `requestDelete()`
    (abre el modal). Al confirmar, `removed$` → `removeBuildingFromScene()` lo detacha.
  - `handleBuildingWindowTap()` (tap sobre un edificio con `opensWindow`) y
    `nearestWindowBuilding()` (cercanía → contexto `'shop'` + botón de acción, con
    latch `shopActionLatched`) → `requestOpenWindow(type)` → `openWindow$` → `footer-bar`.
  - `confirmBuildPlacement()` → `add()` (nuevo) o `move()` (reubicación) + `spawnBuilding()`.
    Cancelar una reubicación restaura el original (`cancelBuildPlacement`).
  - `spawnBuilding()` coloca la construcción definitiva con colisión y la registra en
    `placedBuildings` (con su `PlacedBuilding`, para poder quitarla/moverla).
- **Bridge**: registrado como `REGISTRY_KEYS.CITY_BUILD` en `game-registry.ts` y
  `layout.component.ts` → accesible en escena como `this.reg.cityBuild`.

---

## Checklist

- [ ] PNG existe en `src/assets/sprites/...` y **cargado en `preload()`** (o reusa textura ya cargada)
- [ ] Entrada en `BUILDABLES` (`city-build.service.ts`) con `frameSize` y `scale` correctos
- [ ] Clave i18n `BUILD.<KEY>` añadida en `es.json` **y** `en.json`
- [ ] Si interactúa: `isTownChest: true` o rama nueva en `spawnBuilding()`
- [ ] Verificado en Asgard: aparece en el panel, al elegirlo se cierran las
      ventanas, el ghost se **arrastra** y pinta verde/rojo, ✓ coloca, persiste al
      salir/entrar y entre personajes
- [ ] `unique` puesto según corresponda (desaparece del menú tras construir)
- [ ] **Mover edificio**: lo selecciona del mapa, lo arrastra y ✓ lo reubica; ✕ lo
      deja donde estaba
- [ ] **Borrar edificio**: lo selecciona, confirma en el modal y desaparece
      (permanente); si tiene interior, se vacía (cofre → sin items)
- [ ] Verificado que **🗑 Borrar todo** lo elimina y se puede reconstruir

> No hace falta tocar el flujo de UX (cierre de ventanas, arrastre, mover, borrar,
> borrar-todo): es genérico para cualquier entrada de `BUILDABLES`. Solo Pasos 1-3
> (y 4-5 si aplica, incl. vaciar interior en `confirmDelete` para tipos con almacén).
