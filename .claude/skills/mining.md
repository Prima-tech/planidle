---
description: Sistema de minería del juego — rocas minables en los mapas, el pico, el modo minería contextual, animación de picado y efectos. Punto único donde se documenta TODO lo relacionado con minería. Se activa al hablar de minería, minar, rocas, pico, picar, recolección de mineral.
triggers:
  - minería
  - mineria
  - mining
  - minar
  - picar
  - roca
  - rock
  - pico
  - pickaxe
  - rock_mine
  - miningMode
  - nearestMineableRock
  - mineral
  - cantera
---

# Sistema de minería

> Esta skill es el sitio donde se va metiendo **todo lo relacionado con minería**. Al añadir mecánicas nuevas (tipos de roca, drops de mineral, niveles de pico, profundidad/cantera, XP de minería…), documéntalas aquí.

## Archivos involucrados

| Archivo | Responsabilidad |
|---------|----------------|
| `src/app/scenes/gamescene/gamescene.ts` | Spawn de rocas, modo minería, golpe, efectos. Métodos `initRocks`, `spawnRock`, `nearestMineableRock`, `mineRock`, `destroyRock`, `spawnRockDebris`, `spawnRockSpark`, `refreshHeldLayer`, `setMiningMode`, `equippedPickaxe`, `dirVector` |
| `src/app/pnj/player/equip-layer-registry.ts` | `pickLayer()` — capa LPC del pico (walk/idle 64px + golpe "smash" oversize 128px) |
| `src/app/physics/griddrops.ts` | `TOOLS_CATALOG` — ítem "Pico de Hierro" (categoría `'Pico'`) |
| `src/app/services/gathering-equipment.service.ts` | Slot `pickaxe` (acepta categoría `'Pico'`) |
| `src/app/services/interaction.service.ts` | Contexto `'mine'` del botón de acción |
| `src/app/components/attack-button/attack-button.component.*` | Icono `hammer-outline` cuando el contexto es `'mine'` |
| `assets/sprites/map/skills/rocks/` | Sprites de roca (textura `rock_mine` = `Rock1_3.png`, 32×32) |
| `assets/sprites/player/equip/tools/picks/` | Hoja del pico (`pick_01.png`, 832×3968) + `icons/` |

---

## Cómo funciona (estado actual)

### Rocas en el mapa
- `initRocks()` (bloque diferido de `create()`) coloca **3 rocas** en mapas que **no sean `hogar`**, lejos del spawn del jugador. Se regeneran al reentrar al mapa (no se persisten).
- Cada roca ocupa una **huella de 2×2 tiles** (escala 3 → 96 px). `tx,ty` es la esquina superior izquierda; el sprite se centra en la esquina compartida `((tx+1)*TS, (ty+1)*TS)`. `initRocks` exige que las 4 tiles estén libres y pisables (`gridPhysics.isTileBlocked`).
- Cada roca **bloquea el paso en sus 4 tiles**: `spawnRock` añade las 4 keys a `collisionTiles` (mismo Set que usa GridPhysics); `destroyRock` las borra todas.
- Estructura: `interface RockNode { sprite: Phaser.GameObjects.Image; hits: number; tileKeys: string[] }`; `rocks: RockNode[]`, reseteado en `create()`.

### Modo minería (capa del pico contextual)
- Cada frame, `update()` llama a `nearestMineableRock()`: devuelve la roca más cercana en rango (`TILE_SIZE*2`) y **en la dirección de mirada** (dot-product), **solo si hay pico equipado** (`equippedPickaxe()` → slot `pickaxe`, categoría `'Pico'`).
- Si hay roca delante → `setMiningMode(true)` y el botón pasa a contexto `'mine'`. Si no → `'attack'`.
- `refreshHeldLayer()` decide qué se sostiene: en modo minería con pico → **oculta el arma y muestra el pico**; si no → muestra el arma y oculta el pico. El slot `weapon` se gestiona SOLO aquí (el bucle de `initEquipLayers` lo salta).

### Golpe / picado
- `strike()`: si `nearestMineableRock()` da una roca → `playerAttack()` (el cuerpo hace el swing y la capa del pico reproduce su animación `attack` = bloque **smash** 128px) y a **140 ms** aplica `mineRock`. Si no hay roca → ataque normal de arma.
- La animación del pico (`pickLayer`) usa el bloque "smash" de `pick_01.png`: walk/idle 64px (13 cols, filas 8-11) + golpe oversize 128px (6 cols, filas 27-30, 6 frames/dir) con `oversizeSheetKey`/`oversizeOffsetY: 80`. (En 1 frame el pico va por detrás del cuerpo y no se ve: solo hay capa fg. Aceptable.)
- Tras el swing vuelve a idle automáticamente (vía `syncLayers`); seguir pegando re-dispara el swing.

### Efectos RPG (`mineRock`)
- Flash blanco (`setTintFill`), squash + sacudida con tweens, chispa (`spawnRockSpark`), escombros de piedra en arco (`spawnRockDebris`) y camera shake.
- Al **3er golpe** (`hits >= 3`) → `destroyRock`: libera el tile de colisión, estallido mayor de escombros, temblor fuerte y fade-out.

---

## Constantes / valores clave

| Qué | Valor | Dónde |
|-----|-------|-------|
| Rocas por mapa | 3 | `initRocks` |
| Huella de la roca | 2×2 tiles (4 collision tiles) | `spawnRock` |
| Golpes para destruir | 3 | `mineRock` (`hits >= 3`) |
| Rango de minado | `TILE_SIZE * 2.5` (120 px) | `nearestMineableRock` |
| Delay del impacto | 140 ms | `strike` |
| Escala de la roca | 3 (32→96 px = 2×2 tiles) | `spawnRock` |
| Solo fuera del hogar | `id !== 'hogar'` | `initRocks` |

---

## Cómo extender

- **Nuevo tipo de roca:** añade el PNG en `assets/sprites/map/skills/rocks/`, cárgalo en `preload` (`this.load.image('clave', ...)`), y parametriza `spawnRock`/`rocks` con la textura y la dureza (nº de golpes).
- **Drops al destruir (mineral):** hoy `destroyRock` no suelta nada. Para soltar, replica el patrón de drops de enemigos (`griddrops.ts` / `addDroppedItem`) dentro de `destroyRock`.
- **Niveles/tier de pico:** `equippedPickaxe()` ya devuelve el item; lee `stats`/tier del pico para escalar golpes o daño. Más picos = más entradas en `TOOLS_CATALOG` + `pickLayer` (ver el command `/new-weapon` para el flujo de capas LPC oversize).
- **Persistir rocas:** hoy se regeneran por mapa; si hace falta guardarlas, añadir al `GameSnapshot` (ver skill `save-pattern`).

## Notas / a verificar

- Orden de direcciones del smash asumido up/left/down/right (estándar LPC) — verificar minando en las 4 direcciones.
- `oversizeOffsetY: 80` del pico puede necesitar ajuste fino de alineación vertical durante el golpe.
