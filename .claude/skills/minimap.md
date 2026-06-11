---
description: Arquitectura del minimapa del HUD y pasos para añadir nuevos elementos (NPCs, drops, jefes…) o modificar su aspecto/posición. Se activa cuando se habla del minimapa, radar, puntos en el mapa o marcadores.
triggers:
  - minimapa
  - minimap
  - radar
  - marcador
  - punto en el mapa
  - MinimapData
  - MINIMAP_DATA_KEY
---

# Sistema de minimapa

## Arquitectura

El minimapa vive en **`MobileHUDScene`** (capa HUD a zoom 1 sobre el juego — no le afecta el zoom 0.4 de la cámara del juego). **`GameScene`** publica los datos vía registry con el mismo patrón que `MOBILE_INPUT_KEY`.

| Archivo | Responsabilidad |
|---------|----------------|
| `src/app/scenes/mobile-hud.scene.ts` | Interfaz `MinimapData`, constantes `MM_*`, render y update del minimapa |
| `src/app/scenes/gamescene/gamescene.ts` | `buildMinimapData()` — publica `MINIMAP_DATA_KEY` en el registry antes de `scene.launch('MobileHUDScene')` |

### Flujo de datos

```
GameScene.create()
  └─ registry.set(MINIMAP_DATA_KEY, buildMinimapData())   // ANTES de lanzar el HUD
       └─ MobileHUDScene.create() → createMinimap()        // lee dimensiones, dibuja fondo/portales
            └─ MobileHUDScene.update() → updateMinimap()   // cada frame: jugador + enemigos
```

**Claves del diseño:**
- `MinimapData.enemies` es la **referencia viva** al array `this.enemies` de GameScene (`spawnEnemy` hace `push`, el callback de muerte hace `splice` sobre el mismo array). El HUD siempre ve el estado real **sin eventos ni subscripciones**.
- `getPlayerPos` es un getter (closure) porque el player se crea después en algunos flujos.
- `MinimapEnemy` es una interfaz **estructural** (no importa `Enemy`) para evitar el ciclo `enemy.ts → gamescene → mobile-hud`.
- Cambio de mapa: `scene.restart()` → shutdown del HUD → `create()` regenera datos y relanza. Los campos `mm*` de la escena se resetean al inicio de `createMinimap()` porque **Phaser reutiliza la instancia de la escena**.

### Conversión de coordenadas

```typescript
pantallaX = mmX + clamp(mundoX * mmScale, 0, mmW)
// mmScale = min(MM_MAX_SIZE / mapWidthPx, MM_MAX_SIZE / mapHeightPx)
// mapWidthPx = currentMap.width (tiles) * GameScene.TILE_SIZE (48)
```

### Posición y estilo

Constantes `MM_*` al inicio de `mobile-hud.scene.ts`:
- `MM_TOP = 80` — bajo la top-bar de Angular (72px). Si la top-bar cambia de altura, ajustar.
- `MM_MAX_SIZE = 130`, `MM_MARGIN = 10` — tamaño/separación; el lado menor escala según proporciones del mapa.
- Colores consistentes con la UI: jugador `0x2ecc71` (verde), enemigo `0xff4444`, elite `0xe67e22`, oblivion `0x9b59b6` (los mismos del panel de mapa de la top-bar), portal `0x48c4f8`.

### Pool de puntos

Los enemigos usan un pool de `Arc` (`mmEnemyDots` + `getEnemyDot(i)`): los puntos se reutilizan entre frames, los sobrantes se ocultan con `setVisible(false)`. `setFillStyle`/`setRadius` regeneran geometría → solo se llaman cuando cambia el tier (guard con `dot.fillColor !== color`).

---

## Añadir un elemento ESTÁTICO (cofres, NPCs fijos, zonas)

1. **`MinimapData`** (mobile-hud.scene.ts): añadir el campo, p.ej. `chests: { x: number; y: number }[]` (px de mundo).
2. **`buildMinimapData()`** (gamescene.ts): poblarlo. Tile → px de mundo: `tileX * ts + ts / 2`.
3. **`createMinimap()`**: dibujarlo una sola vez, igual que los portales:
   ```typescript
   for (const c of data.chests) {
     this.add.circle(
       this.mmX + Phaser.Math.Clamp(c.x * this.mmScale, 0, this.mmW),
       this.mmY + Phaser.Math.Clamp(c.y * this.mmScale, 0, this.mmH),
       MM_DOT_CHEST, MM_COLOR_CHEST, 0.9,
     );
   }
   ```
4. Añadir constantes `MM_DOT_*` / `MM_COLOR_*` junto a las existentes.

## Añadir un elemento DINÁMICO (drops en el suelo, mascotas, jefes con icono especial)

1. **`MinimapData`**: añadir la referencia viva (array compartido) o un getter:
   - Array que GameScene muta in-place → pasar la referencia (como `enemies`).
   - Valor puntual → closure `getX: () => ...` (como `getPlayerPos`).
   - ⚠️ Si GameScene **reasigna** el array (`this.x = [...]`) la referencia muere — o bien no reasignar (push/splice), o usar getter `getX: () => this.x`.
2. **`buildMinimapData()`**: poblarlo.
3. **`updateMinimap()`**: pintarlo cada frame. Si la cantidad varía, replicar el patrón pool (`getEnemyDot`) con su propio array; ocultar sobrantes al final.
4. Para formas distintas a círculo: `this.add.rectangle(...)` o `this.add.star(...)` funcionan igual en el pool (cambiar el tipo del array).

## Modificaciones frecuentes

| Quiero… | Dónde |
|---------|-------|
| Mover/redimensionar el minimapa | `MM_TOP`, `MM_MARGIN`, `MM_MAX_SIZE` |
| Cambiar colores/tamaños de puntos | `MM_COLOR_*`, `MM_DOT_*` |
| Cambiar fondo/borde | `createMinimap()` — rectángulos `bg` y `ring` |
| Distinguir un tier nuevo de enemigo | `updateMinimap()` — cadena ternaria de `color`/`radius` por sufijo de `enemy.type` |
| Toggle de visibilidad en ajustes | Usar skill `new-setting` + replicar el patrón `showJoystick$` que ya existe en `MobileHUDScene.create()` (subscription + unsubscribe en SHUTDOWN) |
| Indicador del viewport de cámara | En `updateMinimap()`: rectángulo con `cameras.main.worldView` de GameScene (exponer vía getter en `MinimapData`) |

## Errores a evitar

- **No** llamar `registry.set(MINIMAP_DATA_KEY, …)` después de `scene.launch('MobileHUDScene')` — el HUD lee los datos en su `create()`.
- **No** guardar referencias a GameObjects entre relanzamientos de escena: se destruyen en el shutdown. Resetear todo campo `mm*` al inicio de `createMinimap()`.
- **No** importar `Enemy` (ni nada de gamescene) en `mobile-hud.scene.ts` — usar tipado estructural en `MinimapData`.
- **No** llamar `setFillStyle`/`setRadius`/`setSize` cada frame sin guard — regeneran geometría.
