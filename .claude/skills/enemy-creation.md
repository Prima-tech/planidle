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

> **No implementado aún. Este es el diseño acordado.**

### Concepto
```
Matar X monstruos normales en el mapa actual
    → spawn de 1 Elite (stats aumentados, mejor loot)

Matar Y Elites (contador acumulado en la sesión del mapa)
    → spawn de 1 Oblivion (jefe, stats muy altos, mejor loot aún)
```

### Dónde implementar

**1. Contador de kills en sesión (GameScene)**
- Añadir `private sessionKills: Record<string, number> = {}` — se resetea en cada `create()`
- Incrementar en el listener `'enemyDied'` existente en `initEnemyAttackListener()`
- Añadir `private eliteKills = 0` para el contador de elites

**2. Trigger de spawn (GameScene)**
```typescript
// Dentro del listener 'enemyDied' en initEnemyAttackListener()
this.events.on('enemyDied', ({ type, position }) => {
  this.killService?.recordKill(mapId, type);

  // Contador de sesión
  this.sessionKills[type] = (this.sessionKills[type] ?? 0) + 1;

  // Spawn elite
  const threshold = MAP_ELITE_THRESHOLD[mapId] ?? 20;
  if (this.sessionKills[type] % threshold === 0) {
    this.spawnElite(type, position);
  }

  // Spawn oblivion
  if (type.endsWith('_elite')) {
    this.eliteKills++;
    const oblivionThreshold = MAP_OBLIVION_THRESHOLD[mapId] ?? 5;
    if (this.eliteKills % oblivionThreshold === 0) {
      this.spawnOblivion(position);
    }
  }
});
```

**3. Definir elites y oblivion como variantes en ENEMY_REGISTRY**
- Naming: `orc1_elite`, `orc1_oblivion`
- Se definen igual que un enemigo normal pero con stats multiplicados
- Loot propio en LOOT_TABLES con `chance` más alta y `maxQty` mayor
- Los elites pueden tener `scale` mayor (ej. `4` en vez de `3`) para distinguirse visualmente
- Los elites y oblivion NO tienen `SpawnConfig` en el mapa — solo se spawnan vía `spawnElite()`/`spawnOblivion()` 

**4. Configuración de umbrales por mapa**
```typescript
// en map-config.ts
export const MAP_ELITE_THRESHOLD: Record<string, number> = {
  '1-1': 20,    // cada 20 kills normales → 1 elite
  '1-2': 15,
};
export const MAP_OBLIVION_THRESHOLD: Record<string, number> = {
  '1-1': 5,     // cada 5 elites → 1 oblivion
};
```

**5. `spawnElite()` / `spawnOblivion()` en GameScene**
- Son variantes de `spawnEnemy()` sin tracker (no tienen maxCount ni respawn automático)
- Se spawnan en la posición de la última muerte + offset aleatorio
- Al morir, solo llaman a `recordKill` — no respawnean

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
