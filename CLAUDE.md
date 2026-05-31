# CLAUDE.md — Idle RPG Incremental

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
classes/       # Clase Character (datos: nombre, clase, HP, exp, equipo)
components/    # layout, status-bar, top-bar, footer-bar, inventory,
               # modal-container, map-selected-cell, map-label, game-log
enemy/         # Clase Enemy: IA, comportamiento, barra de vida, spawning
pages/         # login/ | character/ | main/ | globalposition/ | map/ | inventory/ | settings/ | test/
physics/       # GridPhysics | GridControls | GridDrops (drops → PlayerState o Inventory)
pnj/player/    # Sprite del jugador, HP, animaciones, ataques
scenes/        # GameScene (gameplay) | MapScene (mapa global 11×11)
               # map-config.ts — registro de mapas (MAP_REGISTRY)
services/      # Ver tabla de servicios
mocks/         # FakeApiService
```

## Servicios clave

| Servicio | Responsabilidad |
|----------|----------------|
| `AsgardService` | Estado global: personajes activos, player, perfil. Llama a SaveService al cambiar de personaje. |
| `PlayerStateService` | Fuente única de verdad para coins, exp, lvl. BehaviorSubject reactivo. `collectCoins()` emite para el game-log. |
| `SaveService` | Orquesta toda la persistencia. Snapshot por personaje (`snapshot_char_<id>`). Auto-save local con debounce 2s. `forceSave()` para el botón manual. |
| `WorldService` | Mapa actual del jugador. BehaviorSubject `currentMap$` → actualiza `MapLabelComponent`. |
| `InventoryService` | Grid 4×4×5. `addDroppedItem()` → emite `itemDropped$`. `changes$` alimenta el debounce de SaveService. |
| `SupabaseService` | Auth + sync remota. `OFFLINE_MODE=true` en SaveService desactiva sync. `autoRefreshToken: false` para evitar POSTs automáticos. |
| `StorageService` | Wrapper de Ionic Storage (IndexedDB/SQLite). |
| `SceneManager` | Ciclo de vida de escenas Phaser. |
| `MapService` | Estado del mapa global (celda seleccionada, exploración). |

## Flujo de datos de juego

```
Supabase / Storage
    → AsgardService.getProfile() → PlayerStateService.setFromProfile()
    → SaveService.loadCharacter(id) → PlayerStateService + InventoryService + WorldService

Cambio en juego (monedas, items)
    → PlayerStateService / InventoryService (BehaviorSubject)
    → UI actualiza (async pipe)
    → debounce 2s → SaveService.saveLocal() → StorageService

Botón "Guardar partida" (Settings)
    → SaveService.forceSave() → local + Supabase (solo campos cambiados)
```

### Separación drops por tipo

- `loot.type === 'currency'` → `PlayerStateService.collectCoins()` → suma + emite `coinDropped$`
- `loot.type === 'item'` → `InventoryService.addDroppedItem()` → grid + emite `itemDropped$`

## Persistencia local (SaveService)

- **Clave por personaje**: `snapshot_char_<id>` y `snapshot_char_<id>_synced`
- **GameSnapshot**: `{ playerState, inventory, mapId, lastModified }`
- Al **seleccionar personaje**: `loadCharacter(id)` carga su snapshot o inicia en vacío
- Al **cambiar personaje**: `saveCurrentCharacter()` guarda antes de navegar
- Al **guardar remoto**: compara con `_synced`, solo envía campos cambiados a Supabase
- `OFFLINE_MODE = true` en `save.service.ts` para desarrollo sin Supabase

## Sistema de mapas

### Jerarquía
Planeta → Mundo (bosque, nieve…) → Mapas (1-1, 1-2…)

### MapConfig (`scenes/gamescene/map-config.ts`)
```typescript
interface MapConfig {
  id, name,
  tilemapKey, tilemapJson, tilesetKey, tilesetImage, tilesetName,
  spawns: SpawnConfig[],   // sistema de spawn por zona
  portals: PortalConfig[]  // teletransporte a otro mapa
}
```
- El registro `MAP_REGISTRY` contiene todos los mapas
- Hogar: sin enemigos, portal en (17,17) → 1-1
- 1-1: zona spawn orcos (4×4 tiles), portal en (2,2) → Hogar

### Portales
- Se detectan en `GameScene.checkPortals()` cada frame
- Fade out → `WorldService.setCurrentMap()` → `scene.restart()` → fade in
- `WorldService` notifica a `MapLabelComponent` vía `currentMap$`
- `SaveService` guarda el `mapId` en el snapshot → se restaura al volver al personaje

### Cambio de tileset por mapa
Cada `MapConfig` tiene sus propias rutas de tileset. `preload()` las carga dinámicamente. Al cambiar de mapa con `scene.restart()`, Phaser re-ejecuta `preload()` con el nuevo tileset.

## Sistema de enemigos

### SpawnConfig
```typescript
interface SpawnConfig {
  enemyType: string;
  zone: { tileX, tileY, width, height }; // área en tiles
  maxCount: number;
  behavior: 'passive' | 'aggressive';
  visionRadius: number; // tiles, solo en aggressive
}
```

### Comportamientos
- `passive`: solo persigue si le atacan (`startChasing()` llamado en `takeDamage`)
- `aggressive`: comprueba distancia al player cada frame; si < `visionRadius` tiles, empieza a perseguir

### Ciclo de vida
- `initSpawns()` spawna enemigos escalonados (uno cada 2s) al entrar al mapa
- Al morir: callback `onDeath` → splice del array (GridPhysics mantiene referencia), `tracker.count--`, respawn tras 3s
- **Guard crítico**: `if (this.isDead) return` en `takeDamage()` y `die()` — evita que múltiples golpes durante la animación de muerte disparen `onDeath` varias veces

### Muerte visual
1. Tint rojo + giro 90° + aplana (280ms) — parece que cae
2. Cadáver visible 2 segundos
3. Fade out (500ms) → destrucción del sprite + evento `enemyDied`

### Barra de vida
- Aparece al primer golpe (`ensureHPBar()`)
- Se redibuja cada frame en `update()` siguiendo el sprite
- Colores: verde (>50%), amarillo (>25%), rojo (≤25%)
- Se destruye en `die()` antes de la animación

## Phaser 3

### Configuración
- Type: AUTO | Physics: Arcade | Scale: ventana completa CENTER_BOTH
- Escenas: `[GameScene, MapScene]` | Parent DOM: `#game`
- Servicios Angular → Phaser via `game.registry`: `asgardService`, `inventoryService`, `worldService`, `playerStateService`

### GameScene
- Tilemap: formato Tiled (configurable por mapa)
- TILE_SIZE: 48px | Escala: ×3 | Zoom cámara: 0.4
- Teclas: flechas/WASD = mover, Space = atacar
- `initSpawns()` reemplaza el antiguo `initEnemies()` — los enemigos vienen siempre del sistema de spawn

### Animaciones
- Nombres: `player_walk_down`, `player_attack_up`, etc.
- Enum de dirección: NONE, LEFT, UP, RIGHT, DOWN
- `AnimationService.createDieAnimation()` — tween de muerte (no spritesheet)

## i18n

- `TranslateModule` importado y exportado en `ComponentModule` → disponible en todos los componentes
- Claves en `assets/i18n/es.json` y `en.json`: `LOGIN`, `GLOBAL_POSITION`, `SETTINGS`, `INVENTORY`, `CHARACTER`, `MAP`, `GAME_LOG`, `COMMON`
- En TypeScript: usar `TranslateService.instant('CLAVE')` o definir arrays de claves y aplicar `| translate` en el template
- Para añadir idioma: crear `assets/i18n/<lang>.json` y llamar `translate.use('<lang>')`

## Supabase

### Tablas
| Tabla | Campos principales |
|-------|--------------------|
| `global_data` | id, username, coins, special_coins, exp, lvl, last_modified |
| `characters` | id, profile_id, name, character_class, current_hp, max_hp, lvl, exp, last_modified |
| `achievements` | id (relación con profile) |

### Configuración actual
- `autoRefreshToken: false`, `persistSession: false` — sin POSTs automáticos de auth
- Solo hace llamadas remotas cuando el usuario pulsa "Guardar partida" en Settings
- Inventario: aún sin tabla propia en Supabase, pendiente de normalizar

### Flujo de auth
1. `signUp()` / `signIn()` con email + password
2. `createFullAccount()` — crea perfil y roster de 11 personajes
3. `fetchAndSaveLocalData()` — sincroniza Supabase → Ionic Storage

## Convenciones

- Componentes: `.ts` + `.html` + `.scss` + `.spec.ts`
- Páginas: lazy-loaded con `loadChildren` (excepto login y globalposition)
- **Estado numérico de juego** (coins, exp, lvl): siempre a través de `PlayerStateService`
- **Inventario**: siempre a través de `InventoryService`
- **Estado de mapa**: a través de `WorldService`
- **Persistencia**: a través de `SaveService` — no llamar a `StorageService` directamente para datos de juego
- Sprites de assets en `assets/` (cuerpos en `body/*.png`, enemigos en tilemaps/test/)
- No usar `ng serve` con `--configuration production` en desarrollo

## Arquitectura de capas

```
Ionic/Angular (UI + routing)
    └── AsgardService (personajes, player)
            ├── PlayerStateService (coins, exp, lvl) ← reactivo
            ├── InventoryService (grid de items) ← reactivo
            ├── WorldService (mapa actual) ← reactivo
            ├── SaveService (persistencia local + remota)
            │       ├── StorageService (IndexedDB local)
            │       └── SupabaseService (remoto, solo on-demand)
            └── SceneManager
                    └── Phaser 3 (GameScene / MapScene)
```

## Notas activas

- `strictNullChecks` desactivado — al migrar hacia strict, revisar servicios uno por uno.
- `GameApiService` apunta a `localhost:3000` — pendiente de eliminar en favor de Supabase directo.
- Inventario en Supabase pendiente de normalizar (actualmente solo en local).
- `OFFLINE_MODE = true` en `save.service.ts` — cambiar a `false` cuando Supabase esté listo para sync de datos de juego.
