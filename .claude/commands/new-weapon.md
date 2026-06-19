# new-weapon — Añadir un nueva arma equipable

Guía para crear un arma con sprites Phaser, drop de enemigos y slot de equipamiento.

## Argumentos esperados

- **Nombre del arma** (ej. `Cimitar`, `Espada Larga`)
- **Ruta del spritesheet** (ej. `weapons1/cimitar.png`)
- **Enemigos que la dropean** y **% de drop**
- **Stats** (ej. `damage: 9`)
- **JSON del generador LPC** (si lo hay) — es CLAVE para saber el formato (ver abajo).

---

## ⭐ Espadas LPC universales (`equip/weapons/swords/`) — flujo validado

La mayoría de armas nuevas vienen del **Universal LPC Spritesheet Generator**
(liberatedpixelcup). **Pide siempre el JSON del generador**: te dice el formato sin
adivinar. Mira:
- `layers[].source.spritePath` → p.ej. `weapon/sword/arming/universal/fg/walk/brass.png`
- `layers[].yPos` → fila donde empieza el arma. **`yPos:512` ⇒ fila 8 ⇒ frame de 64px**
  (512/64). Si fuera 128px, walk empezaría en y=1024.
- `layers[].supportedAnimations` → qué animaciones trae la hoja (walk/idle/slash…).
- Hay **dos capas**: `fg` (delante del cuerpo) y `bg` (detrás). En las hojas que nos
  pasan suelen venir fusionadas: fg en cols 0‑12, bg en cols 13‑25 (de ahí 26 cols).

### Cómo analizar una hoja desconocida (sin Python — usa .NET por PowerShell)

```powershell
Add-Type -AssemblyName System.Drawing
$b=New-Object System.Drawing.Bitmap("ruta.png"); "$($b.Width)x$($b.Height)"
# 1664x4992 ⇒ a 64px son 26 cols × 78 filas; a 128px son 13 cols × 39 filas
```
Mapa de densidad por celda (qué filas/cols tienen píxeles) para localizar walk/slash:
recorre celdas leyendo el canal alfa con `LockBits` y marca `.`/`#`. (Ver historial de
git de esta feature para el script completo.) Verifica visualmente recortando filas con
`DrawImage` + rejilla y leyéndolas como imagen.

### Dos formatos y sus helpers (`equip-layer-registry.ts`)

**A) Hoja estándar 13 cols, todo 64px** (walk filas 8‑11, slash 12‑15, idle 22‑25).
Usa `swordLayer64('swordNN', 'sword_NN.png')`. Es el caso limpio (camina y ataca bien
de una). Frame index = `fila × 13`.

**B) "Arming sword" oversize — frames MIXTOS en el mismo PNG:**
- walk/idle a **64px** (rejilla 26 cols): walk filas 8‑11, idle filas 22‑25.
- slash a **128px** (rejilla 13 cols, "oversize" porque el arco es grande): filas 27‑30.

Usa `swordLayerArming('swordNN', 'sword_NN.png')`. Carga el MISMO PNG con **dos claves**
(`swordNN_main` 64px para walk/idle, `swordNN_slash` 128px para attack) y marca:
```typescript
oversizeSheetKey: 'swordNN_slash',
oversizeOffsetY: 80,   // = 32 × escala_jugador(2.5); el personaje va centrado en el frame de 128
```
El slash usa **5 frames** (cols 0‑4); la col 5 es follow-through y sobra.

### Mecánica clave (ya implementada en `player.ts syncLayers`)

- **Offset dinámico**: si el cuerpo está atacando y la capa tiene `oversizeSheetKey`,
  aplica `oversizeOffsetY` (80). Se basa en `currentAnimKey.startsWith(playerTags.ATTACK)`,
  NO en el frame ya pintado (si no, hay un salto de 1 frame al empezar/terminar).
- **Sync por progreso en el ataque**: el ataque del CUERPO es de 6 frames; el slash del
  arma puede tener 5. Durante el ataque, la capa se conduce con
  `layer.anims.setProgress(sprite.anims.getProgress())` CADA frame (no a su propio ritmo),
  así no se descuelga ni se reinicia el último frame. Walk/idle siguen el sync normal.
- **bg/fg**: con una sola capa solo pintamos el fg; parte del slash que va detrás del
  cuerpo no se ve. Es aceptable. Para perfección habría que componer bg+fg (dos capas).

### Icono del panel de invocación (¡importante!)

El arma dentro del frame LPC es pequeña y descentrada → un recorte directo de la hoja se
ve diminuto. **Genera un PNG de icono dedicado** auto-recortado (bbox + centrado en 64×64,
NearestNeighbor) en `equip/weapons/swords/icons/sword_NN_icon.png` y úsalo con `icon:`
(NO `iconSheet:`). Frame bueno: una pose de perfil (espada recta) o el pico del slash
(hoja curva). Inventario/equipo/summon/detalle soportan `icon` plano (`<img>`).

### Previews del personaje (`player-preview` y `character-sprite`)

Renderizan un loop de andar en `<canvas>`. DEBEN usar las **columnas reales** de la hoja
(`img.naturalWidth / frameSize`), NO el nº de frames de walk, y el `frameSize` real de
cada hoja (64 ó 128). Cada capa cicla solo sus frames de walk (`frameIdx % frameCount`).
Si no, mapean mal las hojas combinadas/oversize y muestran frames de slash en la pantalla
de equipo. Centran el frame: `dOff=(size - frameSize*scale)/2`.

---

## Paso 1 — Analizar el spritesheet (formato `weapons1/` legacy)

Las armas suelen venir en **hojas combinadas** (ej. `weapons1.png`) con múltiples armas en distintas filas.

Identifica:
- **Tamaño de frame**: normalmente 128×128px (aunque el arte real del arma solo ocupa los 64×64 superiores del frame)
- **Nº de columnas** del sheet (ej. 9)
- **Fila de inicio** del arma en la hoja (contar desde 0, visualmente)
- **Distribución de filas**: walk ocupa 4 filas (9 frames/dir), attack ocupa 4 filas (6 frames/dir)

```
F = fila_inicio × cols        // primer frame global del arma
walk_up:    F      → F+8
walk_left:  F+9    → F+17
walk_down:  F+18   → F+26
walk_right: F+27   → F+35
attack_up:  F+36   → F+41     // 6 frames (endFrame = startFrame + 5)
attack_left:F+45   → F+50
attack_down:F+54   → F+59
attack_right:F+63  → F+68
idle = primer frame de cada dirección walk (F, F+9, F+18, F+27)
```

---

## Paso 2 — Registrar en `equip-layer-registry.ts`

Archivo: `src/app/pnj/player/equip-layer-registry.ts`

```typescript
'NombreArma': {
  frameWidth: 128, frameHeight: 128, depth: 4, mode: 'anim',
  layerScale: 2.5,    // arte real 64px × 2.5 = 160px = altura del jugador (64×2.5)
  layerOffsetY: 80,   // frame 128×2.5 centra en y±160; +80 baja para alinear tope en y−80
  depthWhenUp: 1.5,   // detrás del jugador (depth 2) en up/left/right; delante solo en down
  playerPrefix: 'player_', layerPrefix: 'nombre_', fallbackAnim: 'nombre_idle_down',
  sheets: [{
    key: 'nombre_main',
    path: 'assets/sprites/player/equip/weapons1/nombre.png',
    frameWidth: 128, frameHeight: 128,
    anims: [
      { key: 'nombre_idle_up',      startFrame: F,    endFrame: F,    frameRate: 2,  repeat: -1 },
      { key: 'nombre_idle_left',    startFrame: F+9,  endFrame: F+9,  frameRate: 2,  repeat: -1 },
      { key: 'nombre_idle_down',    startFrame: F+18, endFrame: F+18, frameRate: 2,  repeat: -1 },
      { key: 'nombre_idle_right',   startFrame: F+27, endFrame: F+27, frameRate: 2,  repeat: -1 },
      { key: 'nombre_walk_up',      startFrame: F,    endFrame: F+8,  frameRate: 10, repeat: -1 },
      { key: 'nombre_walk_left',    startFrame: F+9,  endFrame: F+17, frameRate: 10, repeat: -1 },
      { key: 'nombre_walk_down',    startFrame: F+18, endFrame: F+26, frameRate: 10, repeat: -1 },
      { key: 'nombre_walk_right',   startFrame: F+27, endFrame: F+35, frameRate: 10, repeat: -1 },
      { key: 'nombre_attack_up',    startFrame: F+36, endFrame: F+41, frameRate: 10, repeat: 0 },
      { key: 'nombre_attack_left',  startFrame: F+45, endFrame: F+50, frameRate: 10, repeat: 0 },
      { key: 'nombre_attack_down',  startFrame: F+54, endFrame: F+59, frameRate: 10, repeat: 0 },
      { key: 'nombre_attack_right', startFrame: F+63, endFrame: F+68, frameRate: 10, repeat: 0 },
    ],
  }],
},
```

### Por qué estos valores

| Parámetro | Valor | Razón |
|-----------|-------|-------|
| `layerScale` | `2.5` | El arte real ocupa ~64px del frame de 128px. 64×2.5=160px = tamaño visual del jugador. Usar 1.25 haría que el arma se vea a mitad de tamaño. |
| `layerOffsetY` | `80` | Con scale 2.5 y origin (0.5,0.5), el tope del frame queda en y−160. El offset +80 lo baja a y−80, igual que el resto de capas. |
| `depthWhenUp` | `1.5` | En un RPG top-down el arma va detrás del jugador (depth 2) en todas las direcciones excepto DOWN. 1.5 queda entre la sombra (depth 1) y el jugador (depth 2). |

### Comportamiento automático de `syncLayers`

El sistema en `player.ts` gestiona automáticamente cada frame:
- **Posición**: `sprite.x, sprite.y + layerOffsetY`
- **Depth**: `depthWhenUp` si la animación no termina en `_down`, `depth` si es `_down`
- **Sync de frames**: al cambiar de dirección, `layer.anims.setProgress(sprite.anims.getProgress())` para que el ciclo del arma no empiece desde 0 y no se vea "al revés"

> **NO marcar `splitLegsOnSlash`** en las armas. Ese flag es solo para las capas de
> cuerpo/armadura alineadas 1:1 (casco/torso/botas/pantalones; ver `/new-equipment`): en
> el slash de espada parte el sprite por la cintura para que las piernas sigan caminando.
> El swing del arma (hoja oversize) va **entero con el torso**, no se parte. Las armas ya
> quedan excluidas por tener `depthWhenUp` y no llevar el flag.

---

## Paso 3 — Añadir el drop en `griddrops.ts`

Archivo: `src/app/physics/griddrops.ts`

```typescript
{
  name: 'NombreArma', category: 'Arma', type: 'item',
  chance: 1, minQty: 1, maxQty: 1, mergeable: false,
  texture: 'nombre_main', frame: F+18, scale: 1.5, order: 2,
  iconSheet: 'assets/sprites/player/equip/weapons1/nombre.png',
  iconFrame: F+18,      // frame idle_down
  iconFrameSize: 128,   // tamaño físico del frame en la imagen
  iconFrameCols: 9,     // columnas del spritesheet
  iconContentSize: 64,  // tamaño real del arte dentro del frame
  stats: { damage: 9 },
},
```

> **`iconContentSize` es obligatorio** cuando el arte no llena el frame físico. Sin él el icono en inventario/equipamiento se verá a mitad de tamaño. El sistema lo usa para calcular `background-size` y `background-position` correctos en inventory, equipment y summon.

Repetir la entrada en `orc1_elite`, `orc1_oblivion`, etc. con sus propias chances.

---

## Paso 4 — El slot `weapon` ya existe

`EquipmentService` tiene el slot `{ id: 'weapon', accepts: ['Arma'] }`. No hay que tocarlo siempre que el item tenga `category: 'Arma'`.

---

## Checklist

- [ ] Frame de inicio `F` calculado correctamente (`fila_inicio × cols`)
- [ ] Claves de animación en **minúsculas** (`nombre_walk_down`, nunca mayúsculas)
- [ ] `layerScale: 2.5`, `layerOffsetY: 80`, `depthWhenUp: 1.5` presentes
- [ ] `iconContentSize: 64` en el drop de `griddrops.ts`
- [ ] `category: 'Arma'` en la entrada de `griddrops.ts`
- [ ] PNG existe en `src/assets/sprites/player/equip/weapons1/`

### Checklist espadas LPC (`weapons/swords/`)

- [ ] Pedido el **JSON** del generador y confirmado el formato (64px estándar vs arming oversize 64+128)
- [ ] Usado `swordLayer64` (estándar) o `swordLayerArming` (mixto) según el caso
- [ ] Si arming: `oversizeSheetKey` + `oversizeOffsetY: 80` y slash con 5 frames (cols 0‑4)
- [ ] **Icono dedicado** generado en `swords/icons/` y referenciado con `icon:` (no `iconSheet:`)
- [ ] Entrada en `WEAPON_CATALOG` (griddrops.ts) con `category: 'Arma'` → aparece en el panel de invocación (tab Items → Weapons). El drop usa `texture: 'swordNN_main'` + `frame` (idle_down) ya precargado por el registry
- [ ] Verificado en juego (`npm start`): camina, ataca sincronizado, e icono correcto en el panel
