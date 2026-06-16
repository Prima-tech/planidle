---
description: Sistema de recolección de recursos del mapa (minería de rocas con pico, tala de árboles con hacha…) — nodos en el mapa, herramientas, modo contextual, animación de golpe y efectos. Punto único donde se documenta TODO lo de minería/recolección. Se activa al hablar de minería, minar, tala, talar, rocas, árboles, pico, hacha, recolección.
triggers:
  - minería
  - mineria
  - mining
  - minar
  - picar
  - tala
  - talar
  - roca
  - rock
  - árbol
  - arbol
  - tree
  - pico
  - pickaxe
  - hacha
  - axe
  - HARVEST_KINDS
  - nearestHarvestable
  - HarvestNode
  - recolección
  - recurso
---

# Sistema de recolección (minería / tala)

Sistema genérico de **nodos recolectables** en el mapa. Cada tipo (`HarvestKindId`) se pica con su herramienta: **roca → pico** (categoría `'Pico'`, slot `pickaxe`), **árbol → hacha** (categoría `'Hacha'`, slot `axe`). Es el sitio donde se mete TODO lo de minería/recolección; añadir tipos nuevos (caña→peces, pala…) = una entrada en `HARVEST_KINDS`.

## Archivos involucrados

| Archivo | Responsabilidad |
|---------|----------------|
| `src/app/scenes/gamescene/gamescene.ts` | `HARVEST_KINDS`, `HarvestNode`. Métodos `initHarvestNodes`, `trySpawnNode`, `spawnNode`, `nearestHarvestable`, `harvestNode`, `destroyNode`, `spawnDebris`, `spawnImpactSpark`, `refreshHeldLayer`, `setActiveHarvest`, `equippedTool`, `dirVector` |
| `src/app/pnj/player/equip-layer-registry.ts` | `toolLayer()` — capa LPC compartida de herramientas (walk/idle 64px + golpe "smash" oversize 128px). Items `'Pico de Hierro'`, `'Hacha de Hierro'` |
| `src/app/physics/griddrops.ts` | `TOOLS_CATALOG` — picos (cat. `'Pico'`) y hachas (cat. `'Hacha'`) |
| `src/app/services/gathering-equipment.service.ts` | Slots `pickaxe` (`'Pico'`) y `axe` (`'Hacha'`) |
| `src/app/services/interaction.service.ts` | Contextos `'mine'` (roca) y `'chop'` (árbol) del botón de acción |
| `src/app/scenes/mobile-hud.scene.ts` | Minimapa: dibuja los nodos (`getNodes` de `MinimapData`) — punto gris (roca) / verde (árbol), dinámico |
| `src/app/components/attack-button/attack-button.component.*` | Iconos `hammer-outline` (mine) / `leaf-outline` (chop) |
| `assets/sprites/map/skills/rocks/Rock1_3.png` (`rock_mine`, 32×32) · `assets/sprites/map/skills/trees/Tree1.png` (`tree_chop`, 128×128) | Sprites de los recursos |
| `assets/sprites/player/equip/tools/{picks,axes}/` | Hojas LPC de las herramientas + `icons/` |

---

## Cómo funciona

### Config por tipo (`HARVEST_KINDS`)
```ts
rock: { texture:'rock_mine', toolCategory:'Pico', toolSlotId:'pickaxe', context:'mine',
        footprintW:2, footprintH:2, scale:3,   offsetY:0,  count:3, debris:[grises] }
tree: { texture:'tree_chop', toolCategory:'Hacha', toolSlotId:'axe',  context:'chop',
        footprintW:2, footprintH:2, scale:3.2, offsetY:80, count:3, debris:[madera+hojas] }
```

### Spawn
- `initHarvestNodes()` (diferido en `create()`): solo fuera de `hogar`. Por cada kind cuyo `texture` esté precargado, intenta colocar `count` nodos con `trySpawnNode`.
- Cada nodo ocupa una **huella `footprintW×footprintH` tiles** y **bloquea esas tiles** (`collisionTiles`). El sprite se ancla por su base (`origin (0.5,1)`) centrado sobre la huella, + `offsetY` para asentar el tronco/base en el suelo. `scale` ajusta el tamaño (roca 96px=2×2; árbol más alto con copa por encima).
- `nodes: HarvestNode[]` (`{ sprite, hits, tileKeys, kind }`), reseteado en `create()`.

### Modo recolección contextual (herramienta PEGAJOSA)
- Cada frame, `update()` → `nearestHarvestable()`: nodo más cercano en rango (`TILE_SIZE*2.5`) y **en la dirección de mirada**, **cuya herramienta esté equipada** (`equippedTool(cat, slot)`). El punto de interacción es el **centro de la huella en el suelo** (no la copa).
- `activeHarvest` (herramienta en mano) es **pegajoso**: `update()` solo lo **activa** al encarar un recurso (`setActiveHarvest(kind)`); NO lo limpia al alejarte. Así la herramienta se queda visible tras minar/talar (incluido tras destruir el recurso). Solo se limpia (`setActiveHarvest(null)`) en `strike()` cuando es un **ataque normal** (sin recurso delante → enemigo/al aire), que es "otra acción".
- `refreshHeldLayer()`: si `activeHarvest` y su herramienta está equipada, **oculta el arma y muestra la capa de la herramienta** (`pickaxe`/`axe`); si no, muestra el arma. El slot `weapon` se gestiona SOLO ahí (el bucle de `initEquipLayers` lo salta).
- El botón de acción toma el `context` del recurso encarado (`'mine'`/`'chop'`); al alejarte vuelve a `'attack'` aunque la herramienta siga visible.

### Golpe
- `strike()`: si `nearestHarvestable()` → `playerAttack()` (el cuerpo hace el swing y la capa de la herramienta reproduce su `attack` = bloque **smash** 128px de la hoja) y a 140ms `harvestNode`. Si no → ataque normal de arma.
- `harvestNode`: flash blanco, squash/sacudida, `spawnImpactSpark`, `spawnDebris` (color según kind), camera shake. **3er golpe** → `destroyNode` (libera las tiles, estallido + fade).

---

## Constantes / valores clave

| Qué | Valor | Dónde |
|-----|-------|-------|
| Nodos por tipo y mapa | 3 (`count`) | `HARVEST_KINDS` |
| Golpes para destruir | 3 | `harvestNode` (`hits >= 3`) |
| Rango | `TILE_SIZE * 2.5` (120 px) | `nearestHarvestable` |
| Delay del impacto | 140 ms | `strike` |
| Huella | `footprintW×footprintH` tiles (colisión) | `HARVEST_KINDS` |
| Solo fuera del hogar | `id !== 'hogar'` | `initHarvestNodes` |

---

## Cómo extender

- **Nuevo recurso (caña→pez, pala→…):** añade el PNG, cárgalo en `preload` (`this.load.image('clave', ...)`), añade una entrada a `HARVEST_KINDS` con su textura/herramienta/slot/contexto/huella/escala. El slot debe existir en `GatheringEquipmentService` y, si quieres icono de herramienta sobre el personaje, registra la herramienta con `toolLayer(...)` en el registry + entrada en `TOOLS_CATALOG`. Añade el contexto a `InteractionContext` + icono en `attack-button`.
- **Drops al destruir (mineral/madera):** `destroyNode` suelta el recurso definido en `HARVEST_KINDS[kind].drop` (`{ name, min, max }`, nombre en `ITEM_CATALOG`) vía `gridDrops.spawnDrop` sobre la base del nodo. Hoy: árbol → `Madera` (1). La roca aún no suelta nada (añade un `drop` a su entrada). La cantidad/probabilidad la escalarán a futuro talentos/variables de skill.
- **Dureza por herramienta/tier:** `equippedTool` devuelve el item; lee `stats`/tier para escalar nº de golpes.
- **Persistir nodos:** hoy se regeneran por mapa; para guardarlos, al `GameSnapshot` (ver skill `save-pattern`).

## Notas / a verificar

- Orden de direcciones del smash asumido up/left/down/right (estándar LPC).
- `offsetY` del árbol = `25 (padding inferior) × scale`. A `scale 3.2` → `offsetY 80`. Si cambias la escala, recalcula el offsetY así para que el tronco siga asentado.
- Los nodos usan **depth por-Y** = `(tileY + footprintH) * TILE_SIZE` (su base en el suelo), igual que el jugador (`depth = su Y de pies`). Así el árbol tapa al jugador cuando está detrás (al norte) y el jugador pasa por delante cuando está al sur.
