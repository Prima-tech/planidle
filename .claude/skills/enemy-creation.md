---
description: Guía completa para crear monstruos en este proyecto. Se activa cuando se habla de crear enemigos, monstruos, spawn, elite, oblivion, loot de enemigos, tipos de enemigo o animaciones de enemigo.
triggers:
  - enemigo
  - monstruo
  - spawn
  - elite
  - oblivion
  - enemy
  - monster
  - loot enemigo
  - nuevo tipo
  - ENEMY_REGISTRY
  - SpawnConfig
---

# Sistema de creación de monstruos

## Archivos involucrados

| Archivo | Responsabilidad |
|---------|----------------|
| `src/app/enemy/enemy-config.ts` | Define `EnemyTypeConfig` y `ENEMY_REGISTRY` + tablas de loot |
| `src/app/enemy/enemy.ts` | Clase `Enemy`: comportamiento, daño, muerte, HP bar |
| `src/app/physics/griddrops.ts` | `LOOT_TABLES` — qué dropea cada tipo |
| `src/app/scenes/gamescene/gamescene.ts` | `spawnEnemy()`, `initSpawns()`, listeners de kills |
| `src/app/scenes/gamescene/map-config.ts` | `SpawnConfig` por mapa en `MAP_REGISTRY` |
| `assets/sprites/enemy/{type}/` | Spritesheets del enemigo |

---

## Paso 1 — Definir el tipo en ENEMY_REGISTRY (`enemy-config.ts`)

```typescript
const miEnemigo: EnemyTypeConfig = {
  type: 'nombre_unico',   // debe coincidir con la key del registry y con las rutas de assets
  hp: 80,
  scale: 3,
  speed: 96,              // px/s
  damage: 10,
  attackCooldown: 1500,   // ms entre ataques
  actions: {
    idle:   { filename: 'nombre_idle_full',   frameWidth: 64, frameHeight: 64, frameRate: 4,  repeat: -1, directional: true,  frames: dirFrames(4) },
    walk:   { filename: 'nombre_walk_full',   frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: -1, directional: true,  frames: dirFrames(8) },
    run:    { filename: 'nombre_run_full',    frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: -1, directional: true,  frames: dirFrames(8) },
    attack: { filename: 'nombre_attack_full', frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: 0,  directional: true,  frames: dirFrames(6) },
    hurt:   { filename: 'nombre_hurt_full',   frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: 0,  directional: true,  frames: dirFrames(3) },
    death:  { filename: 'nombre_death_full',  frameWidth: 64, frameHeight: 64, frameRate: 6,  repeat: 0,  directional: false, frames: { start: 0, end: 5 } },
  },
};

export const ENEMY_REGISTRY: Record<string, EnemyTypeConfig> = {
  orc1: orc1,
  nombre_unico: miEnemigo,   // ← añadir aquí
};
```

### Convención de nombres de animaciones Phaser
- Textura cargada: `{type}_{action}` → ej. `orc1_idle`
- Animación direccional: `{type}_{action}_{dir}` → ej. `orc1_idle_down`
- Animación no-direccional: `{type}_{action}` → ej. `orc1_death`
- `dirFrames(n)` es un helper que genera los frame ranges para las 4 direcciones (DOWN, LEFT, UP, RIGHT)

---

## Paso 2 — Añadir tabla de loot (`griddrops.ts`)

```typescript
const LOOT_TABLES: Record<string, LootEntry[]> = {
  orc1: [ /* ... */ ],

  nombre_unico: [
    { name: 'Oro',    type: 'currency', chance: 0.9, minQty: 2, maxQty: 8,
      mergeable: true,  texture: 'drop_coin',   animKey: 'coin_spin', scale: 3, order: 10 },
    { name: 'Espada', type: 'item',     chance: 0.2, minQty: 1, maxQty: 1,
      mergeable: false, texture: 'sword',        icon: 'assets/icon/weapons/sword8.png', scale: 3, order: 1 },
  ],
};
```

### Campos de LootEntry
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `name` | string | Nombre del item |
| `type` | `'currency'` \| `'item'` | Monedas van a PlayerState, items al Inventario |
| `chance` | 0–1 | Probabilidad de drop |
| `minQty` / `maxQty` | number | Rango de cantidad |
| `mergeable` | boolean | Si puede apilarse en inventario |
| `texture` | string | Key de Phaser para el sprite del drop en suelo |
| `icon` | string | Ruta de imagen para el inventario Angular |
| `animKey` | string? | Animación Phaser que se reproduce en suelo |
| `scale` | number | Escala del sprite en suelo |
| `order` | number | Orden de apilado en inventario (mayor = arriba) |

---

## Paso 3 — Añadir spawn en un mapa (`map-config.ts`)

```typescript
{
  id: '1-1',
  spawns: [
    {
      enemyType: 'nombre_unico',
      zone: { tileX: 5, tileY: 5, width: 8, height: 8 },
      maxCount: 3,
      behavior: 'aggressive',   // 'passive' | 'aggressive'
      visionRadius: 6,          // solo relevante si aggressive
    },
  ],
}
```

### Comportamientos
- `passive` — solo persigue si recibe daño (`startChasing()` en `takeDamage`)
- `aggressive` — comprueba distancia al player cada frame; si < `visionRadius` tiles, persigue

---

## Paso 4 — Assets

Crear carpeta `assets/sprites/enemy/{type}/` con los spritesheets:
- Un `.png` por acción: `{type}_{action}_full.png`
- Formato: strip horizontal, todos los frames seguidos (DOWN → LEFT → UP → RIGHT si es direccional)
- Resolución frame: coincidir con `frameWidth` y `frameHeight` en la config

---

## Sistema de progresión: Elite y Oblivion

> **IMPLEMENTADO.** Ficheros: `enemy-config.ts`, `gamescene.ts`, `griddrops.ts`, `map-config.ts`, `map-stats.service.ts`

### Concepto
```
Matar X monstruos normales en el mapa (sesión)
    → spawn de 1 Elite (stats ×3, tint dorado, mejor loot)

Matar Y Elites (contador de sesión del mapa)
    → spawn de 1 Oblivion (stats ×8, tint morado, loot premium)
```

### Campos adicionales en EnemyTypeConfig

```typescript
tint?: number;       // tint visual (0xRRGGBB) — se aplica en initSprite()
spriteType?: string; // tipo base cuyos sprites se reusan — clave para animaciones y sprite inicial
```

### Cómo definir un elite/oblivion (patrón spread)

```typescript
const orc1_elite: EnemyTypeConfig = {
  ...orc1,              // hereda todas las acciones y frames
  type: 'orc1_elite',
  hp: 150, scale: 3.5, speed: 110, damage: 15, attackCooldown: 1200,
  tint: 0xffcc00,
  spriteType: 'orc1',  // usa los sprites de orc1, no carga assets nuevos
};
```

- `spriteType` hace que `registerEnemyAnimations()` use `orc1_idle` como textura en vez de `orc1_elite_idle` (que no existe)
- Las animaciones se registran con key `orc1_elite_idle_down` etc. apuntando a frames de `orc1_idle`
- Las animaciones de elite/oblivion se registran automáticamente en `registerEnemyAnimations()` para todos los tipos en spawns del mapa

### Spawn (GameScene.spawnSpecial)

```typescript
private spawnSpecial(enemyType: string, nearPosition: Phaser.Math.Vector2): void
```

- NO tiene tracker ni respawn automático
- Se spawna cerca de la posición de muerte (±2 tiles de offset)
- Siempre `behavior: 'aggressive'`, `visionRadius: 8`
- Se llama desde `initEnemyAttackListener()` cuando se alcanzan los umbrales

### Umbrales por mapa

```typescript
// map-config.ts
MAP_ELITE_THRESHOLD:    { '1-1': 10, '1-2': 12, ..., '1-8': 25 }
MAP_OBLIVION_THRESHOLD: { '1-1': 3,  '1-2': 3,  ..., '1-8': 6  }
```

- Los contadores `sessionKills` y `eliteKills` se resetean en cada `create()` (cada vez que se entra al mapa)
- `sessionKills` se publica a `MapStatsService.updateSessionKills()` tras cada baja — disponible en `MapKillsComponent`
- Los elites y oblivion NO tienen entrada en `SpawnConfig` del mapa

---

## Ciclo de vida completo (resumen)

```
ENEMY_REGISTRY → define stats + animaciones
LOOT_TABLES    → define drops
SpawnConfig    → dónde y cuántos en el mapa

gamescene.preload()  → carga spritesheets
gamescene.create()   → registerEnemyAnimations() + initSpawns()
enemy.update()       → movimiento, visión, ataque
enemy.takeDamage()   → reduce HP, guard isDead
enemy.die()          → animación muerte → emite 'enemyDied'
GridDrops            → escucha 'enemyDied' → rollDrops() → spawnDrop()
onDeath callback     → splicing del array, tracker.count--, respawn 3s
```
