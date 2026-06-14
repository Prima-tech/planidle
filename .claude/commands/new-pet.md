# new-pet — Añadir una mascota (y referencia del sistema de mascotas)

Guía para crear una mascota nueva y referencia de TODO lo que hace el sistema de
mascotas (nivel, experiencia, recogida de drops, rango, vínculo a personaje).

## Argumentos esperados

- **Nombre de la mascota** (ej. `Panda Rojo`)
- **id** en kebab/snake (ej. `red_panda`)
- **Ruta del spritesheet** (ej. `assets/sprites/pets/red_panda/red_panda.png`)
- **Tamaño de frame** y **nº de columnas** (suele ser 32×32, 8 cols)
- Filas de animación (Aseprite: Idle, Idle2, Movement, Attack, Damage, Death, Sleep)

---

## Qué es una mascota

Una mascota es un **`InventoryItem` con `petId`** (no un tipo aparte). Se equipa en el
slot `pet` de la pestaña de **recolección** (`GatheringEquipmentService`). En el mapa la
representa la clase `Pet` (`pnj/pet/pet.ts`), un sprite que sigue al jugador y va a por
los drops.

Archivos clave:
- `src/app/pnj/pet/pet-config.ts` — `PET_REGISTRY`, constantes y fórmulas (nivel, exp, rango)
- `src/app/pnj/pet/pet.ts` — sprite que sigue al jugador / busca drops
- `src/app/physics/griddrops.ts` — `_pet()` (catálogo), `activeDrops`, `nearestCollectableDrop`
- `src/app/scenes/gamescene/gamescene.ts` — preload, `initPet`/`syncPet`, `updatePet`
- `src/app/services/gathering-equipment.service.ts` — slot `pet`, `addEquippedPetExp`, `canEquip` (vínculo)
- `src/app/components/item-detail/item-detail.component.*` — pantalla de info de la mascota
- `src/app/components/equipment/equipment.component.*` — drop al slot + modal de vínculo

---

## Paso 1 — Registrar la mascota en `PET_REGISTRY`

Archivo: `pnj/pet/pet-config.ts`. Cada fila del sheet es una animación (start = `row*cols`).

```typescript
red_panda: {
  id: 'red_panda', name: 'Panda Rojo',
  textureKey: 'pet_red_panda',
  sheetPath: 'assets/sprites/pets/red_panda/red_panda.png',
  frameWidth: 32, frameHeight: 32, cols: 8, scale: 3.3,
  anims: {
    idle:   { row: 0, frames: 6, frameRate: 8,  repeat: -1 },
    move:   { row: 2, frames: 8, frameRate: 12, repeat: -1 },
    // ... attack/damage/death/sleep listos para el futuro
  },
},
```

> Cuenta los frames REALES por fila: algunas filas tienen frames finales vacíos
> (idle 6/8, damage 5/8). Incluirlos provoca parpadeo.

**El preload es automático:** `gamescene` recorre `PET_REGISTRY` y carga cada `sheetPath`
como spritesheet (no hay que tocar preload). `Pet` solo usa `idle` + `move`.

## Paso 2 — Añadir la mascota al catálogo de drops/invocación

Archivo: `griddrops.ts`. El helper `_pet(cfg)` ya construye el `LootEntry` desde el
`PetConfig` (categoría `'Mascota'`, `petId`, icono = frame 0 del sheet). Se mapea solo:

```typescript
const PETS_CATALOG: LootEntry[] = Object.values(PET_REGISTRY).map(_pet);
```

Aparece en la pestaña **Pets** del panel de invocación (`summon`). Al invocarla,
`summon.givePet()` crea el `InventoryItem` con `petLevel: 1, petExp: 0`.

## Paso 3 — Icono (¡el arte va en la mitad inferior del frame!)

El arte de la mascota suele ocupar la **mitad inferior** del frame de 32px (la parte de
arriba está vacía) → sin ajuste "sale muy abajo". Ya existe el modificador
`item-icon-sheet--pet` (`translateY` negativo) aplicado con
`[class.item-icon-sheet--pet]="...category === 'Mascota'"` en **inventario, equipo y
summon**, y `detail-icon-box--pet` en el panel de detalle. Si el arte de tu mascota está
centrado distinto, ajusta el `translateY` de esas clases.

---

## Sistema de mascotas (lo que YA hace — referencia)

### Nivel y experiencia

- Datos en el propio ítem: `InventoryItem.petLevel` (1..`PET_MAX_LEVEL = 10`) y `petExp`.
- Curva: `petExpNeeded(level) = level * 100` (en `pet-config.ts`).
- **Sube de nivel matando enemigos**: la mascota EQUIPADA gana **+1 exp por cada enemigo
  que mata el jugador**. Hook en `gamescene` handler `enemyDied` →
  `this.reg.gathering.addEquippedPetExp(1)`. El método (en `GatheringEquipmentService`)
  sube de nivel en bucle hasta el máximo, emite `changes$` (refresca UI + auto-save).
  Solo gana exp si está en el slot `pet`; al nivel máximo deja de ganar.

### Rango de recogida (stat que escala con nivel)

- `petPickupRange(level) = PET_PICKUP_RANGE_BASE(260) + PET_PICKUP_RANGE_PER_LEVEL(20)*(level-1)`.
- `gamescene.updatePet` lo lee del nivel de la pet equipada CADA frame (refleja level-ups
  al instante). Es el radio de DETECCIÓN de drops.

### Recogida de drops

- `GridDrops` mantiene `activeDrops[]` (alta al spawnear, baja al recoger) y expone
  `nearestCollectableDrop(x, y, radius)`.
- `gamescene.updatePet`: si hay drop recogible en el radio (= rango de recogida), la
  mascota va a por él con `Pet.update(..., stopDist=0)` y lo recoge dentro de
  `PET_COLLECT_DIST = 44` (margen por el desfase: la pet se ancla en los pies y el drop en
  su centro). Si no hay, sigue al jugador.
  - ⚠️ Bug evitado: si `stopDist === PET_COLLECT_DIST`, la pet se para justo en el borde
    (por el guard `MOVE_EPS`) y no recoge. Por eso `stopDist=0` (se acerca del todo).
- **Oro**: siempre se recoge. **Objetos**: solo si `InventoryService.hasSpaceFor(loot)`
  (hay celda libre o pila apilable). Inventario lleno → la mascota deja de recoger objetos
  (los deja en el suelo); el oro lo sigue cogiendo.
- Sin doble recogida: jugador y mascota comparten el guard `collected` por drop.

### Pantalla de info de la mascota (`app-item-detail`)

Para mascotas (`isPet`) el panel muestra **solo**: icono+nombre, "Vinculado con: X",
**nivel**, **barra de exp** y **rango de recogida**. El resto (stats, descripción,
botones) se oculta con `*ngIf="!isPet"`. Getters: `isPet`, `petLevel`, `petMaxLevel`,
`petIsMaxLevel`, `petExp`, `petExpNeeded`, `petExpRatio`, `petPickupRange`, `boundCharName`.

### Vínculo a personaje

- `InventoryItem.boundCharId` + `boundCharName`.
- Al arrastrar una mascota SIN vincular al slot `pet`, `equipment.onGatheringDrop` abre un
  modal (`petBindModalOpen`). **Vincular** (`confirmPetBind`) fija
  `boundCharId = String(asgard.selectedPlayer.id)` + `boundCharName` y equipa. **Cancelar**
  no equipa (vuelve al inventario). El vínculo es permanente.
- Enforcement: `GatheringEquipmentService.canEquip` rechaza una mascota cuyo `boundCharId`
  no coincide con `currentCharId` (lo fija `SaveService.loadCharacter`). Esto bloquea
  también el drop por CDK (el predicado usa `canEquip`).

### Persistencia

Todo (`petLevel`, `petExp`, `boundCharId`, `boundCharName`) viaja en el propio
`InventoryItem`, así que se guarda solo en el inventario y en el loadout de recolección.

---

## i18n

Bloque `PET` en `en.json`/`es.json`: `LEVEL`, `MAX_LEVEL`, `PICKUP_RANGE`, `BOUND_TO`,
`BIND_TITLE`, `BIND_MESSAGE` (params `{{pet}}`/`{{char}}`), `BIND_CONFIRM`, `BIND_CANCEL`.

## Checklist

- [ ] Entrada en `PET_REGISTRY` con frames REALES por fila (sin frames vacíos)
- [ ] PNG en `assets/sprites/pets/<id>/` (preload automático desde el registry)
- [ ] Aparece en summon → pestaña Pets (vía `PETS_CATALOG`)
- [ ] Icono bien centrado (ajustar `--pet` translateY si el arte está descentrado)
- [ ] Verificado en juego (`npm start`): sigue al jugador, recoge drops, sube de nivel,
      el panel muestra nivel/exp/rango, y el modal de vínculo funciona
