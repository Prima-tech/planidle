# CLAUDE.md — Idle RPG Incremental

## Reglas de comportamiento

- **NUNCA preguntes si enviar la app al móvil.** Solo ejecuta el build/deploy de Android si el usuario lo pide explícitamente.
- **Cuando ejecutes una skill**, muestra siempre por consola (texto al usuario) qué skill se está ejecutando y con qué argumentos antes de empezar. Ejemplo: `> Ejecutando skill: new-enemy (gnoll4)`

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework UI | Angular 19 + Ionic 8 |
| Motor de juego | Phaser 3.88.2 |
| Backend / Auth | Supabase 2.93.3 |
| Mobile bridge | Capacitor 7.4.4 |
| Lenguaje | TypeScript 5.6.3 (strict mode, strictNullChecks OFF) |
| i18n | ngx-translate (en.json, es.json en assets/i18n/) |

## Comandos

```bash
npm start          # Dev server Angular (ng serve)
npm run build      # Build producción → www/
npm test           # Karma unit tests
npm run lint       # ESLint
```

## Estructura de src/app/

```
classes/       # Clase Character (datos RPG: nombre, clase, HP, exp, equipo)
components/    # layout, status-bar, top-bar, footer-bar, inventory,
               # modal-container, map-selected-cell, map-label, game-log,
               # offline-gains-modal, map-stats, map-kills
enemy/         # Clase Enemy: IA, comportamiento, barra de vida, spawning
pages/         # login/ | character/ | main/ | globalposition/ | map/ | inventory/ | settings/ | test/
physics/       # GridPhysics | GridControls | GridDrops (drops → PlayerState o Inventory)
pnj/player/    # Sprite del jugador, HP, animaciones, ataques
scenes/        # GameScene (gameplay) | MapScene (mapa global 11×11)
               # game-registry.ts — REGISTRY_KEYS + GameRegistry (wrapper tipado)
               # map-config.ts — MAP_REGISTRY, MAP_ELITE_THRESHOLD, MAP_OBLIVION_THRESHOLD
services/      # Ver tabla de servicios
mocks/         # FakeApiService
```

## Servicios clave

| Servicio | Responsabilidad |
|----------|----------------|
| `AsgardService` | **Solo sesión y roster**: personaje seleccionado, lista de personajes, perfil, `closeMenu$`. NO maneja Phaser. |
| `PlayerBridgeService` | **Puente Angular↔Phaser**: instancia `Player`, `setInitialSprites()`, `setAttackToPlayer()` (sincroniza HP a `PlayerStateService`), `healPlayer(amount)` (regen — actualiza sprite Phaser + playerState), `restartGameScene()`. |
| `PlayerStateService` | Fuente única de verdad para coins, exp, lvl, hp, hpMax, **mp, mpMax**. BehaviorSubject reactivo. `collectCoins()` emite `coinDropped$`. `setHp/setMp` sincronizan HP/MP. |
| `CharacterStatsService` | Calcula todos los stats derivados de `BaseStats` + equipo + talentos + buffs. Observables: `damage$`, `magicDamage$`, `hp$`, `mp$`, `defense$`, `evasion$`, `critChance$`, `critDamage$`, `hpRegen$`, `mpRegen$`, `freePoints$`. Getters síncronos: `currentDefense`, `currentEvasion`, `currentCritChance`, `currentCritDamage`, `currentMagicDamage`, `currentHpRegen`, `currentMpRegen`. Gestiona `BaseStats` (STR/DEX/CONST/INT/MAG/CHR): `increment()`, `decrement()`, `resetStats()`, `restoreStats()`. |
| `RegenService` | Timer de 10s. Recupera HP (base=CONST) y MP (base=MAG) aleatorios entre min–max. HP vía `playerBridge.healPlayer()`, MP vía `playerState.setMp()`. Emite `regenTick$` para el game-log. `start()`/`stop()` en `LayoutComponent.ngOnInit/ngOnDestroy`. |
| `SaveService` | Orquesta toda la persistencia. Snapshot por personaje. Auto-save con debounce 2s. Flag `isRestoring` bloquea auto-save durante `loadCharacter()`. `pendingGains$` para ganancias offline. |
| `OfflineGainsService` | Calcula ganancias AFK: tasa de kills por spawn × tiempo offline × monedas por kill. Mínimo 2 min, máximo 8h. |
| `WorldService` | Mapa actual del jugador. BehaviorSubject `currentMap$` → actualiza `MapLabelComponent`. |
| `InventoryService` | Grid 4×4×5. `addDroppedItem()` → emite `itemDropped$`. `changes$` alimenta debounce de SaveService. `restoreFromSnapshot()` emite `changes$`. |
| `SupabaseService` | Auth + sync remota. `OFFLINE_MODE=true` en SaveService desactiva sync. `autoRefreshToken: false`. |
| `StorageService` | Wrapper de Ionic Storage (IndexedDB/SQLite). |
| `SceneManager` | Ciclo de vida de escenas Phaser. `setGame(null)` en `ngOnDestroy` de LayoutComponent. |
| `MapService` | Estado del mapa global (celda seleccionada, exploración). |
| `KillService` | Registro de bajas por mapa y tipo. `charKills` (por personaje) + `globalKills` (global). |
| `MapStatsService` | Estado del mapa en-juego. `activeGroups$` (enemigos vivos), `totalMax$` (máximo configurable), `sessionKills$` (kills de la sesión actual por tipo, se resetea en cada `create()`). Actualizado por GameScene cada frame/kill. |

## Arquitectura de capas

```
Ionic/Angular (UI + routing)
    ├── AsgardService (sesión: personaje seleccionado, roster, perfil)
    │       └── PlayerBridgeService (puente Phaser: Player sprite, ataques, restart escena)
    ├── PlayerStateService (coins, exp, lvl, hp, hpMax) ← reactivo
    ├── InventoryService (grid de items) ← reactivo
    ├── WorldService (mapa actual) ← reactivo
    ├── SaveService (persistencia local + remota)
    │       ├── StorageService (IndexedDB local)
    │       ├── SupabaseService (remoto, solo on-demand)
    │       └── OfflineGainsService (cálculo de ganancias AFK)
    └── SceneManager
            └── Phaser 3 (GameScene / MapScene)
                        ↑
                   GameRegistry (wrapper tipado del game.registry)
```

## Bridge Angular ↔ Phaser

### GameRegistry (`scenes/game-registry.ts`)
Wrapper tipado sobre `game.registry`. **Siempre usar en lugar de `game.registry.get()` raw.**

```typescript
// En preload() de cualquier escena Phaser:
this.reg = new GameRegistry(this.game);
this.reg.playerBridge  // PlayerBridgeService
this.reg.world         // WorldService
this.reg.inventory     // InventoryService
this.reg.playerState   // PlayerStateService
this.reg.kill          // KillService
this.reg.map           // MapService
this.reg.mapStats      // MapStatsService
```

### REGISTRY_KEYS
Constantes para los `registry.set()` en `LayoutComponent.registerServices()`. Nunca usar strings raw.

### Regla crítica — Phaser Scenes
**Las clases que extienden `Phaser.Scene` NO deben tener `@Injectable`.** Angular crearía una instancia inútil paralela a la de Phaser. `GameScene` y `MapScene` son clases TypeScript normales gestionadas exclusivamente por Phaser.

### Registro de servicios
`LayoutComponent.registerServices()` crea el juego Phaser y registra los servicios Angular en el registry. Esto solo ocurre una vez (primer arranque). En cambios de personaje, Phaser ya está corriendo — se usa `PlayerBridgeService.restartGameScene()`.

## Flujo de datos de juego

```
Primer arranque:
  getUserData() [1s delay]
    → playerBridge.createPlayer()
    → asgard.getSelectedPlayer() → saveService.loadCharacter(id)
    → registerServices() → new Phaser.Game()

Selección de personaje (desde globalposition):
  asgard.setSelectedPlayer(char)
    → saveService.loadCharacter(id)   ← isRestoring=true durante la carga
    → playerBridge.resetPlayerStatus(hp, hpMax)
    → playerBridge.restartGameScene() ← preload() ve el mapa correcto

Cambio en juego (monedas, items):
  PlayerStateService / InventoryService (BehaviorSubject)
    → UI actualiza (async pipe)
    → filter(!isRestoring) → debounce 2s → SaveService.saveLocal() → StorageService

Botón "Guardar partida":
  SaveService.forceSave() → local + Supabase (solo campos cambiados)
```

### Separación drops por tipo
- `loot.type === 'currency'` → `PlayerStateService.collectCoins()` → suma + emite `coinDropped$`
- `loot.type === 'item'` → `InventoryService.addDroppedItem()` → grid + emite `itemDropped$`

## Persistencia local (SaveService)

### Claves de storage por personaje
- `snapshot_char_<id>` — estado completo del personaje
- `snapshot_char_<id>_synced` — última versión sincronizada con Supabase
- `first_seen_char_<id>` — timestamp de primera aparición en pantalla de selección (para timer offline de personajes no jugados)

### GameSnapshot
```typescript
interface GameSnapshot {
  playerState: PlayerState;   // coins, exp, lvl, hp, hpMax, mp, mpMax
  inventory: (InventoryItem | null)[][][];
  equipment: EquipmentSnapshot;
  mapId: string;
  kills: KillMap;             // { mapId: { enemyType: count } }
  talents?: TalentSnapshot;
  skillSlots?: SkillSlotsSnapshot;
  baseStats?: BaseStats;      // STR/DEX/CONST/INT/MAG/CHR — persiste asignación de puntos
  lastSeen: string;           // ISO — se actualiza en cada save (auto o manual)
  lastModified: string;       // ISO — mismo valor que lastSeen
}
```

### Comportamiento del auto-save
- `isRestoring = true` durante `loadCharacter()` — bloquea el pipe del auto-save
- Solo dispara cuando el jugador hace algo real (mata enemigo, recoge moneda)
- `lastSeen` refleja la última actividad real, no la carga del personaje

### Ganancias offline
- `SaveService.pendingGains$` — BehaviorSubject que emite tras `loadCharacter()` si hay ganancias
- `LayoutComponent` se suscribe reactivamente (no lee `.value` puntual)
- `OfflineGainsModalComponent` muestra las ganancias, botón "Recoger" llama `playerState.collectCoins()`
- Condición: > 2 min offline, mapa con spawns (no Hogar), máximo 8h acumuladas
- Tasa: `spawn.maxCount × (60 / 12s)` kills/min × 1 moneda/kill

## Sistema de mapas

### MapConfig (`scenes/gamescene/map-config.ts`)
```typescript
interface MapConfig {
  id, name,
  tilemapKey, tilemapJson, tilesetKey, tilesetImage, tilesetName,
  spawns: SpawnConfig[],   // sistema de spawn por zona
  portals: PortalConfig[]  // teletransporte a otro mapa
}
```
- `MAP_REGISTRY` contiene todos los mapas (hogar + 1-1 a 1-8)
- `MAP_ELITE_THRESHOLD` — kills para spawnear elite por mapa
- `MAP_OBLIVION_THRESHOLD` — kills elite para spawnear oblivion por mapa

### Portales
- Se detectan en `GameScene.checkPortals()` cada frame
- Fade out → `WorldService.setCurrentMap()` → `scene.restart()` → fade in
- `SaveService` guarda el `mapId` en el snapshot → se restaura al volver al personaje

## Sistema de enemigos

### SpawnConfig
```typescript
interface SpawnConfig {
  enemyType: string;
  zone: { tileX, tileY, width, height };
  maxCount: number;
  behavior: 'passive' | 'aggressive';
  visionRadius: number;
}
```

### Jerarquía de tipos de enemigo
- `orc1` → base
- `orc1_elite` → spawna tras N kills base en el mapa
- `orc1_oblivion` → spawna tras N kills elite en el mapa
- Cada tipo tiene su entrada en `ENEMY_REGISTRY` y en `LOOT_TABLES`

### Ciclo de vida
- `initSpawns()` spawna enemigos escalonados (uno cada 2s) al entrar al mapa
- Al morir: `onDeath` callback → splice del array, `tracker.count--`, respawn tras 3s
- **Guard crítico**: `if (this.isDead) return` en `takeDamage()` y `die()` — evita doble muerte

## Phaser 3

### Configuración
- Type: AUTO | Physics: Arcade | Scale: ventana completa CENTER_BOTH
- Escenas: `[GameScene, MapScene]` | Parent DOM: `#game`
- `LayoutComponent.ngOnDestroy()` llama `phaserGame.destroy(true)` y `sceneManager.setGame(null)`

### GameScene
- Tilemap: formato Tiled (configurable por mapa)
- TILE_SIZE: 48px | Escala: ×3 | Zoom cámara: 0.4
- Teclas: flechas/WASD = mover, Space = atacar
- Servicios accesibles vía `this.reg` (GameRegistry) — nunca `game.registry.get()` raw

### Player (pnj/player)
- `Player.resetStatus(hp, hpMax)` — llamar siempre al cambiar de personaje y al curar
- `Player.setHP(n)` — **suma** `n` al HP actual (negativo = daño, positivo = curación) y emite `status$`
- `sprite.once(ANIMATION_COMPLETE, ...)` en ataques — nunca `on()` (acumula listeners)

### Fuentes de verdad HP vs MP
- **Barra de HP** (`top-bar`) lee de `playerBridge.player.status$` (sprite Phaser) — **NO** de `playerState`
- **Barra de MP** lee de `playerState.state$`
- Al curar HP: usar siempre `playerBridge.healPlayer(amount)` — actualiza sprite + playerState
- Al curar MP: usar `playerState.setMp(newMp, mpMax)` directamente

## Pantalla de selección de personaje (globalposition)

- Muestra: icono de clase, nombre, HP bar, **mapa actual**, **timer offline** (cuenta hacia arriba)
- Timer: `setInterval` cada 1s actualiza `this.now` → `timeSince(charId)` recalcula
- Mapa: leído de `snapshot_char_<id>.mapId` en `ngOnInit`
- Timer source: `snapshot.lastSeen` (si jugado) o `first_seen_char_<id>` (si nunca jugado)
- Roster actual: 6 personajes (Warrior, Mage, Hunter, Priest, Necron, Ancestral)

## Supabase

### Tablas
| Tabla | Campos principales |
|-------|--------------------|
| `global_data` | id, username, coins, special_coins, exp, lvl, last_modified |
| `characters` | id, profile_id, name, character_class, current_hp, max_hp, lvl, exp, last_modified |
| `achievements` | id (relación con profile) |

### Payload de sync (buildSupabasePayload)
Incluye: `global_data` (coins, exp, lvl), `inventory` (pendiente de tabla), `characters` (last_seen).
`OFFLINE_MODE = true` en `save.service.ts` — cambiar a `false` cuando Supabase esté listo.

## Sistema de paneles del footer

`FooterBarComponent` gestiona paneles laterales vía `ModalContainerComponent`. Regla: abrir un panel cierra cualquier otro del **mismo lado**.

| Lado | Tipo CSS | Paneles |
|------|----------|---------|
| Izquierda | `character` | Personaje (character) |
| Derecha | `menu` / `map-stats` / `map-kills` | Ajustes, Estadísticas mapa, Bajas mapa |
| Centro | `inventory` | Inventario (no tiene exclusión por lado) |

- `bottom: 56px` en paneles laterales — número exacto de la altura del `ion-toolbar` de Ionic
- `border-radius: 12px 12px 0 0` — solo esquinas superiores, las inferiores tocan el footer
- `closeOtherOnSide(side, except)` en FooterBarComponent — cierra el panel abierto en ese lado antes de abrir el nuevo
- Para añadir un panel nuevo: añadir a la lista del lado correspondiente en `groups` dentro de `closeOtherOnSide()`

## Convenciones

- **Phaser Scenes**: nunca `@Injectable` — son clases TS normales gestionadas por Phaser
- **Bridge Angular↔Phaser**: siempre via `GameRegistry` y `REGISTRY_KEYS`, nunca strings raw
- **Estado numérico de juego** (coins, exp, lvl, hp): siempre a través de `PlayerStateService`
- **Phaser player**: siempre a través de `PlayerBridgeService`
- **Inventario**: siempre a través de `InventoryService`
- **Estado de mapa**: a través de `WorldService`
- **Persistencia**: a través de `SaveService` — no llamar a `StorageService` directamente
- **Auto-save**: no disparar manualmente; el debounce+filter de SaveService lo gestiona
- **Suscripciones en componentes**: siempre con `ngOnDestroy` + `unsubscribe()` o `takeUntil`
- Componentes: `.ts` + `.html` + `.scss` + `.spec.ts`
- Páginas: lazy-loaded con `loadChildren` (excepto login y globalposition)

## Sistema de estadísticas del personaje

### BaseStats
```typescript
interface BaseStats { STR: number; DEX: number; CONST: number; INT: number; MAG: number; CHR: number; }
```
Todos los stats arrancan en **10**. No hay mínimo inferior a 10 (decrement guarda el floor).

### Puntos de stat
- Total disponible: `8 + (lvl − 1)`
- Gastados: `sum(all stats) − 60` (60 = 6 stats × 10 base)
- Libres: `total − gastados` → expuesto como `charStats.freePoints$`
- `increment()` falla silenciosamente si `freePoints <= 0`
- `decrement()` no baja de 10
- Persistidos en `GameSnapshot.baseStats`; restaurados con `charStats.restoreStats()`

### Escalado de stats → stats derivados

| Stat | Derivado | Fórmula |
|------|----------|---------|
| STR | Daño físico | base = STR, 1:1 |
| INT | Daño mágico | base = INT, 1:1 |
| CONST | HP máx | CONST × 10 |
| CONST | HP regen max | = CONST; min = floor(CONST/2) |
| MAG | MP máx | MAG × 5 |
| MAG | MP regen max | = MAG; min = floor(MAG/2) |
| DEX | Defensa | floor((DEX−10)/10), mín 0 — primeros 10 pts no cuentan |
| DEX | Evasión % | misma fórmula que defensa |
| STR ≥ 20 | Daño crítico extra | +1% por cada 5 STR sobre 20 |

### Combate avanzado (GameScene)

- **Defensa** — resta daño por ataque enemigo: `effectiveDmg = max(0, dmg − defense)`. Si = 0 → muestra "IMMUNE"
- **Evasión** — roll antes de aplicar daño: `if (random()*100 < evasion) → "EVADE"`, sin daño
- **Crítico físico** — `rollAttack()` en GameScene: base 10% + talentos/equipo/buffs. Multiplicador = `critDamage%/100`. Número en naranja oscuro `#b85c00`, 48px
- **Daño mágico** — `playerMagicDamage` en GameScene suscrito a `charStats.magicDamage$`. Pendiente de integrar en hechizos

### Sistema de regeneración (RegenService)

- Intervalo: **10 segundos**
- HP: regen entre `floor(hpRegenMax/2)` y `hpRegenMax` (base = CONST + equipo + talentos). Solo si HP < HPMax
- MP: misma lógica con MAG
- HP curado vía `playerBridge.healPlayer()` (actualiza sprite + playerState)
- MP curado vía `playerState.setMp()`
- Notificación en game-log: "HP rec: +X" en rojo `#e74c3c`, "MP rec: +X" en azul `#3498db`
- `RegenService.start()` en `LayoutComponent.ngOnInit`, `stop()` en `ngOnDestroy`

### Game log (GameLogComponent)
- Posición: `fixed`, `bottom: 60px`, `left: 4px`
- Sin fondo — solo texto con `text-shadow` en las 4 diagonales para legibilidad
- Tipos: `'drop'` (dorado), `'coin'` (amarillo claro), `'regen-hp'` (rojo), `'regen-mp'` (azul)
- Entradas mergeables (mismo `name`, no fading) acumulan `sum` y reinician timer

## Notas activas

- `strictNullChecks` desactivado — al migrar a strict, revisar servicios uno por uno
- `GameApiService` apunta a `localhost:3000` — pendiente de eliminar
- Inventario en Supabase pendiente de normalizar (actualmente solo en local)
- `OFFLINE_MODE = true` en `save.service.ts` — cambiar cuando Supabase esté listo
- `FakeApiService.getUserData()` tiene delay de 1s — reemplazar por auth real de Supabase
