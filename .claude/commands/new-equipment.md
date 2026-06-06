# new-equipment — Añadir un item de armadura o accesorio

Guía para crear cascos, armaduras, pantalones, botas y accesorios. Para armas usar `/new-weapon`.

## Argumentos esperados

- **Nombre del item** (ej. `Yelmo de Hierro`, `Armet`)
- **Tipo de slot** (`helmet`, `pants`, `boots`, `armor`, `necklace`, `ring1`, `ring2`, `food`, `potion`)
- **Carpeta de sprites** (ej. `helmets/armet/`)
- **Enemigos que lo dropean** y **% de drop**
- **Stats** (ej. `hp: 15`)

---

## Paso 1 — Analizar los sprites

Carpeta típica: `assets/sprites/player/equip/<tipo>/<nombre>/`

| Archivo | Dimensiones | Frames |
|---------|-------------|--------|
| `idle.png` | 128×256 (2 cols × 4 filas) | 2 frames/dir |
| `walk.png` | 576×256 (9 cols × 4 filas) | 9 frames/dir |
| `slash.png` | 384×256 (6 cols × 4 filas) | 6 frames/dir |

Frame size: siempre **64×64** para este tipo de items.
Orden de filas: **fila 0 = UP, fila 1 = LEFT, fila 2 = DOWN, fila 3 = RIGHT** (estándar LPC).

---

## Paso 2 — Registrar en `equip-layer-registry.ts`

Archivo: `src/app/pnj/player/equip-layer-registry.ts`

### Item individual

```typescript
'NombreItem': {
  frameWidth: 64, frameHeight: 64,
  depth: 3,   // 3 = sobre el cuerpo del jugador
  mode: 'anim',
  playerPrefix: 'player_',
  layerPrefix: 'nombre_',
  fallbackAnim: 'nombre_idle_down',
  sheets: [
    {
      key: 'nombre_idle',
      path: 'assets/sprites/player/equip/<tipo>/<nombre>/idle.png',
      frameWidth: 64, frameHeight: 64,
      anims: [
        { key: 'nombre_idle_up',    startFrame: 0, endFrame: 1, frameRate: 2,  repeat: -1 },
        { key: 'nombre_idle_left',  startFrame: 2, endFrame: 3, frameRate: 2,  repeat: -1 },
        { key: 'nombre_idle_down',  startFrame: 4, endFrame: 5, frameRate: 2,  repeat: -1 },
        { key: 'nombre_idle_right', startFrame: 6, endFrame: 7, frameRate: 2,  repeat: -1 },
      ],
    },
    {
      key: 'nombre_walk',
      path: 'assets/sprites/player/equip/<tipo>/<nombre>/walk.png',
      frameWidth: 64, frameHeight: 64,
      anims: [
        { key: 'nombre_walk_up',    startFrame: 0,  endFrame: 8,  frameRate: 10, repeat: -1 },
        { key: 'nombre_walk_left',  startFrame: 9,  endFrame: 17, frameRate: 10, repeat: -1 },
        { key: 'nombre_walk_down',  startFrame: 18, endFrame: 26, frameRate: 10, repeat: -1 },
        { key: 'nombre_walk_right', startFrame: 27, endFrame: 35, frameRate: 10, repeat: -1 },
      ],
    },
    {
      key: 'nombre_slash',
      path: 'assets/sprites/player/equip/<tipo>/<nombre>/slash.png',
      frameWidth: 64, frameHeight: 64,
      anims: [
        { key: 'nombre_attack_up',    startFrame: 0,  endFrame: 5,  frameRate: 10, repeat: 0 },
        { key: 'nombre_attack_left',  startFrame: 6,  endFrame: 11, frameRate: 10, repeat: 0 },
        { key: 'nombre_attack_down',  startFrame: 12, endFrame: 17, frameRate: 10, repeat: 0 },
        { key: 'nombre_attack_right', startFrame: 18, endFrame: 23, frameRate: 10, repeat: 0 },
      ],
    },
  ],
},
```

> **Claves en minúsculas**: siempre `nombre_walk_down`, nunca mayúsculas.

### Muchos items del mismo tipo — usar helper existente

Ya existen helpers en `equip-layer-registry.ts`: `helmetLayer`, `armourLayer`, `bootsLayer`, `legsLayer`.

```typescript
// En EQUIP_LAYER_REGISTRY:
'Barbarian': helmetLayer('barbarian'),
'Bascinet':  helmetLayer('bascinet'),
```

Cada helper genera el config completo con las rutas correctas. Si necesitas un tipo nuevo, crear un helper siguiendo el mismo patrón.

### Referencia de `depth`

| Valor | Posición |
|-------|----------|
| 1 | Sombra |
| 2 | Jugador |
| 3 | Sobre el cuerpo (cascos, armaduras) |
| 4 | En la mano (armas) |

---

## Paso 3 — Añadir el drop en `griddrops.ts`

Archivo: `src/app/physics/griddrops.ts`

```typescript
{
  name: 'NombreItem', category: 'Casco', type: 'item',
  chance: 0.20, minQty: 1, maxQty: 1, mergeable: false,
  texture: 'nombre_idle', frame: 4, animKey: 'nombre_idle_down',
  scale: 1.5,
  iconSheet: 'assets/sprites/player/equip/<tipo>/<nombre>/idle.png',
  iconFrame: 4,         // fila 3 col 1 → frame = 2×cols + 0 = 4
  iconFrameSize: 64,
  iconFrameCols: 2,
  order: 2, description: 'Descripción.', stats: { hp: 15 },
},
```

> `frame: 4` = fila 2 (DOWN), col 0 del `idle.png` con 2 cols. Cálculo: `fila × cols + col` (0-based).

Repetir en `orc1_elite`, `orc1_oblivion`, etc. con sus propias chances.

### Solo en ventana de invocación (sin drop de enemigos)

```typescript
const _helmet = (folder: string, name: string, hp: number): LootEntry => ({
  name, category: 'Casco', type: 'item',
  chance: 1, minQty: 1, maxQty: 1, mergeable: false,
  texture: `${folder}_idle`, frame: 4, animKey: `${folder}_idle_down`,
  iconSheet: `assets/sprites/player/equip/helmets/${folder}/idle.png`,
  iconFrame: 4, iconFrameSize: 64, iconFrameCols: 2,
  scale: 1.5, order: 2, stats: { hp },
});
```

### Stats disponibles

| Clave | Efecto |
|-------|--------|
| `hp` | Aumenta HP máximo |
| `mp` | Aumenta MP máximo |
| `damage` | Aumenta daño base |
| `healing` | Pociones consumibles |

---

## Paso 4 — Verificar el slot en `equipment.service.ts`

No hace falta tocarlo si `category` es uno de los existentes:

```
'Casco' → helmet | 'Armadura' → armor | 'Pantalones' → pants | 'Botas' → boots
```

Solo editar `accepts` si la categoría es nueva.

---

## Paso 5 — Ajuste visual del icono (si se ve desplazado)

Añadir clase CSS en los 3 componentes: `inventory`, `equipment`, `summon`.

**HTML** (junto a `[class.item-icon-sheet--equip]`):
```html
[class.item-icon-sheet--armour]="entry.category === 'Armadura'"
```

**SCSS** (después de `.item-icon-sheet--equip`):
```scss
.item-icon-sheet--armour {
  transform: scale(2) translateY(-5px);
}
```

---

## Paso 6 — El sistema carga todo automáticamente

No hay que tocar `gamescene.ts`. Lee `EQUIP_LAYER_REGISTRY` en `preload()`, registra animaciones en `registerEquipLayerAnims()`, y aplica layers en `applyEquipLayer()` al equipar/desequipar.

---

## Checklist

- [ ] PNGs existen en `src/assets/sprites/player/equip/<tipo>/<nombre>/`
- [ ] Entrada en `EQUIP_LAYER_REGISTRY` con claves en **minúsculas**
- [ ] `startFrame`/`endFrame` correctos (fila 0=UP, 1=LEFT, 2=DOWN, 3=RIGHT)
- [ ] `category` correcto en `griddrops.ts` (`'Casco'`, `'Armadura'`, `'Pantalones'`, `'Botas'`)
- [ ] Si drop de enemigo: añadido en `LOOT_TABLES`. Si solo summon: en catálogo separado
- [ ] Slot en `EquipmentService` ya existe o añadido con `accepts` correcto
- [ ] Si icono desplazado: clase CSS en los 3 componentes
