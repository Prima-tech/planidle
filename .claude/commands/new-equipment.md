# new-equipment — Añadir un nuevo item de equipamiento

Guía paso a paso para crear un nuevo item equipable (casco, arma, pantalones, etc.) con sprites Phaser, drop de enemigos y slot de equipamiento.

## Argumentos esperados

Proporciona al invocar el skill:
- **Nombre del item** (ej. `Yelmo`, `Espada Larga`, `Pantalones de cuero`)
- **Tipo de slot** (`helmet`, `weapon`, `pants`, `boots`, `armor`, `necklace`, `ring1`, `ring2`, `food`, `potion`)
- **Ruta de sprites** (ej. `sprites/player/equip/helmets/yelmo/`)
- **Enemigos que lo dropean** y **% de drop** (ej. `orc1 20%, orc1_elite 50%`)
- **Stats del item** (ej. `hp: 10`, `damage: 5`, `mp: 20`)
- **Frame del icono** en `icons1.png` (hoja 16×16 de iconos)

---

## Paso 1 — Analizar los sprites

Examina los archivos PNG en la carpeta de sprites del item:

```
ls assets/sprites/player/equip/<tipo>/<nombre>/
```

Para cada PNG identifica:
- **Dimensiones totales** de la imagen (ej. 128×256)
- **Tamaño de frame** — siempre 64×64 en este proyecto
- **Nº de columnas** = ancho ÷ 64
- **Nº de filas** = alto ÷ 64
- **Total de frames** = cols × filas

Archivos típicos de un item con animaciones separadas (modo `anim`):
| Archivo | Descripción | Frames por dirección |
|---------|-------------|----------------------|
| `idle.png` | 2 cols × 4 filas = 8 frames | 2 frames/dir (up,left,down,right) |
| `walk.png` | 9 cols × 4 filas = 36 frames | 9 frames/dir |
| `slash.png` | 6 cols × 4 filas = 24 frames | 6 frames/dir |

Si el sprite es una **sola hoja combinada** (modo `frame`), es compatible con el sistema frame-sync existente (como la Espada).

---

## Paso 2 — Registrar el layer visual en `equip-layer-registry.ts`

Archivo: `src/app/pnj/player/equip-layer-registry.ts`

### Modo `anim` (sprites separados por animación — caso Armet/cascos LPC)

```typescript
'NombreItem': {
  frameWidth: 64,
  frameHeight: 64,
  depth: 3,          // 3=casco sobre el jugador, 4=arma en mano
  mode: 'anim',
  playerPrefix: 'player_',
  layerPrefix: 'nombre_',   // prefijo único en minúsculas
  fallbackAnim: 'nombre_idle_down',
  sheets: [
    {
      key: 'nombre_idle',
      path: 'assets/sprites/player/equip/<tipo>/<nombre>/idle.png',
      frameWidth: 64,
      frameHeight: 64,
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
      frameWidth: 64,
      frameHeight: 64,
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
      frameWidth: 64,
      frameHeight: 64,
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

> **CRÍTICO — claves en minúsculas**: El enum `Direction` usa valores lowercase (`"down"`, `"up"`, `"left"`, `"right"`). Las claves de animación del jugador son `player_walk_down`, `player_idle_up`, etc. Las claves del layer deben seguir el mismo patrón: `nombre_walk_down`, `nombre_idle_up`, etc. **Nunca usar mayúsculas**.

> **`startFrame` y `endFrame`**: Son índices globales en la hoja (0-based). Fila 0 = UP, fila 1 = LEFT, fila 2 = DOWN, fila 3 = RIGHT (orden LPC estándar).

### Modo `frame` (hoja combinada — caso Espada)

```typescript
'NombreItem': {
  key: 'equip_nombre',
  path: 'assets/sprites/player/equip/<tipo>/archivo.png',
  frameWidth: 64,
  frameHeight: 64,
  depth: 4,
},
```

### Referencia de `depth`
| Valor | Posición visual |
|-------|----------------|
| 2 | Detrás del jugador (capa de suelo) |
| 3 | Sobre el cuerpo del jugador (cascos, armaduras) |
| 4 | En la mano del jugador (armas) |
| 5 | Sobre todo (efectos especiales) |

---

## Paso 3 — Añadir el drop en `griddrops.ts`

Archivo: `src/app/physics/griddrops.ts`

Añadir una entrada en `LOOT_TABLES` para cada tipo de enemigo que debe dropearlo:

```typescript
orc1: [
  // ...entradas existentes...
  {
    name: 'NombreItem',         // nombre de display (ej. 'Armet', 'Yelmo de hierro')
    category: 'Casco',          // tipo de slot — usado por EquipmentService.canEquip()
    type: 'item',
    chance: 0.20,               // 0.0–1.0 (1.0 = 100%)
    minQty: 1,
    maxQty: 1,
    mergeable: false,           // true solo para consumibles (pociones, etc.)
    // --- Drop en el mundo Phaser (sprite que aparece al morir el enemigo) ---
    texture: 'nombre_idle',     // clave de la textura Phaser (ya cargada por EQUIP_LAYER_REGISTRY)
    frame: 4,                   // frame 4 = fila 3 col 1 (idle_down)
    animKey: 'nombre_idle_down',// anima el drop con idle_down
    scale: 1.5,                 // 64px × 1.5 = 96px display (equivale a 32px × 3)
    // --- Icono en la UI Angular (inventario y ventana de equipamiento) ---
    iconSheet: 'assets/sprites/player/equip/<tipo>/<nombre>/idle.png',
    iconFrame: 4,               // misma fila 3 col 1
    iconFrameSize: 64,
    iconFrameCols: 2,
    order: 2,                   // orden de recogida (menor = primero)
    description: 'Descripción del item.',
    stats: { hp: 15 },          // stats que aplica al equiparse
  },
],
```

> **Coherencia visual**: el mismo frame (fila 3, col 1 = idle_down primer frame) se usa tanto para el sprite que cae en el mundo Phaser (`texture`/`frame`) como para el icono en el inventario/equipamiento (`iconSheet`/`iconFrame`). Esto es automático porque `EQUIP_LAYER_REGISTRY` carga todos los sheets en `preload()` independientemente de si el player los tiene equipados.

> **`scale` para sprites de 64px**: usar `1.5` en lugar de `3` para mantener ~96px de tamaño en pantalla.

> **`category` vs `name`**: `name` es el nombre visible del item ('Armet', 'Yelmo de Fuego'). `category` es el tipo de slot ('Casco', 'Arma', 'Pantalones'). `EquipmentService.canEquip()` comprueba `item.category ?? item.name` contra `slot.accepts`, así que todos los cascos con `category: 'Casco'` encajan en el slot sin necesidad de listarlos uno a uno.

Repetir la entrada en `orc1_elite`, `orc1_oblivion`, y cualquier otro enemigo que dropee el item con sus propias chances.

### Icono del item — usar el propio sprite

Para que el icono en el inventario y ventana de equipamiento use el sprite del item (en lugar de un icono genérico de `icons1.png`), especifica estos campos apuntando a la hoja `idle.png` y el frame de **fila 3, columna 1** (idle_down primer frame):

```typescript
iconSheet:     'assets/sprites/player/equip/<tipo>/<nombre>/idle.png',
iconFrame:     4,    // fila 3 col 1 → row=2, col=0 en 0-based → frame = 2*cols + 0 = 4
iconFrameSize: 64,   // tamaño original del frame en px
iconFrameCols: 2,    // columnas del idle.png
```

Cálculo del frame: `frame = (fila-1) * cols + (columna-1)` (índices 1-based del sprite).

Si el idle.png tiene distinto número de columnas, ajustar `iconFrameCols`.

### Stats disponibles
| Clave | Efecto |
|-------|--------|
| `hp` | Aumenta HP máximo (CONST × 10 + equipo) |
| `mp` | Aumenta MP máximo (MAG × 5 + equipo) |
| `damage` | Aumenta daño base (STR + equipo) |
| `healing` | Usado por pociones consumibles |

---

## Paso 4 — Verificar el slot en `equipment.service.ts`

Archivo: `src/app/services/equipment.service.ts`

**No hace falta tocar `accepts`** si el item tiene `category` correcto en `griddrops.ts`. Los slots ya están configurados por categoría:

```typescript
{ id: 'helmet',    label: 'Casco',       accepts: ['Casco'],      item: null },
{ id: 'weapon',    label: 'Arma',        accepts: ['Arma'],       item: null },
{ id: 'pants',     label: 'Pantalones',  accepts: ['Pantalones'], item: null },
{ id: 'boots',     label: 'Botas',       accepts: ['Botas'],      item: null },
{ id: 'armor',     label: 'Armadura',    accepts: ['Armadura'],   item: null },
```

Solo editar `accepts` si estás añadiendo una categoría nueva que no existe todavía.

---

## Paso 5 — Verificar que GameScene y PlayerPreview cargan todo automáticamente

No hay que tocar `gamescene.ts`. El sistema ya:
- Lee `EQUIP_LAYER_REGISTRY` en `preload()` y carga las texturas de cada sheet
- Registra las animaciones Phaser en `registerEquipLayerAnims()` al entrar al mapa
- Aplica el layer con `applyEquipLayer()` cuando el jugador equipa/desequipa

`PlayerPreviewComponent` (la ventana de equipamiento Angular) también es automático:
- Para `mode: 'frame'`: usa `cfg.path` directamente (sheet LPC combinado, 13 cols)
- Para `mode: 'anim'`: busca automáticamente la hoja que contiene `_walk_down` y extrae sus parámetros (`sheetStart`, `sheetCols`) para dibujar los frames correctos

Solo asegurarse de que las rutas de los PNG en `sheets[].path` y en `cfg.path` son correctas y los archivos existen en `src/assets/`.

---

## Paso 6 — Verificar `CharacterStatsService`

Archivo: `src/app/services/character-stats.service.ts`

El servicio ya recalcula HP y MP automáticamente cuando cambia el equipamiento (suscrito a `equipment.changes$`). Si añades un stat nuevo (ej. `defense`), hay que:
1. Añadir `_calcDefense()` siguiendo el patrón de `_calcHp()`
2. Crear el observable `defense$`
3. Suscribirse al `trigger$` para sincronizar el valor con `PlayerStateService`

---

## Checklist final

- [ ] PNG del sprite existe en `src/assets/sprites/player/equip/<tipo>/<nombre>/`
- [ ] Entrada en `EQUIP_LAYER_REGISTRY` con claves de animación en **minúsculas**
- [ ] `startFrame`/`endFrame` calculados correctamente (fila 0=UP, 1=LEFT, 2=DOWN, 3=RIGHT)
- [ ] Drop añadido en `LOOT_TABLES` para cada enemigo correspondiente
- [ ] Nombre del item en `accepts[]` del slot correcto en `EquipmentService`
- [ ] El icono en `icons1.png` existe en el frame indicado
