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
components/    # Componentes compartidos: layout, status-bar, top-bar, bot-bar, inventory, modal-container, map-selected-cell
enemy/         # Clase Enemy: IA, animaciones, sistema de daño
pages/         # Páginas lazy-loaded:
               #   login/ | character/ | main/ | globalposition/ | map/ | inventory/ | test/
physics/       # GridPhysics (movimiento tile, colisiones, targeting enemigos)
               # GridControls (teclado: flechas) | GridDrops (drops de items)
pnj/player/    # Sprite del jugador, HP, animaciones, ataques
scenes/        # Escenas Phaser:
               #   GameScene (gameplay principal) | MapScene (mapa global 11x11)
services/      # Servicios (ver sección siguiente)
mocks/         # Datos mock (FakeApiService)
```

## Servicios clave

| Servicio | Responsabilidad |
|----------|----------------|
| `AsgardService` | Estado global: personajes activos, player, perfil. Singleton principal. |
| `SupabaseService` | Auth (email/password) + sync con BD (profile, characters, achievements) |
| `StorageService` | Wrapper de Ionic Storage para persistencia local |
| `MapService` | Estado del mapa global (celda seleccionada, exploración) |
| `SceneManager` | Ciclo de vida de escenas Phaser (arranque, cambio, parada) |
| `ProfileService` | HP del jugador y status en tiempo real |
| `GameApiService` | HTTP client → localhost:3000/player (backend auxiliar) |

## Phaser 3

### Configuración (definida en `layout.component.ts`)
- Type: AUTO | Physics: Arcade | Scale: ventana completa con CENTER_BOTH
- Escenas registradas: `[GameScene, MapScene]`
- Parent DOM: `#game`

### GameScene (gameplay)
- Tilemap: `cloud_city.json` (formato Tiled)
- Player: spritesheet 64×64, escala ×3
- TILE_SIZE: 48px, movimiento grid continuo con interpolación de píxeles
- Teclas: flechas = mover, Space = atacar, Click = mover a celda
- Enemigos spawneados en posiciones fijas

### MapScene (mapa global)
- Grid 11×11, tipos de celda: city (centro), mine, forest, sea, crop
- Drag = paneo, Click = selección de celda
- Feedback visual por tipo de celda

### Animaciones
- Nombres: `player_walk_down`, `player_attack_up`, etc.
- Enum de dirección: NONE, LEFT, UP, RIGHT, DOWN
- `AnimationService` gestiona rangos de frames por dirección y estado

## Supabase

### Tablas
| Tabla | Campos principales |
|-------|--------------------|
| `global_data` | id, username, coins, special_coins, exp, lvl, last_modified |
| `characters` | id, profile_id, name, character_class, current_hp, max_hp, lvl, exp, last_modified |
| `achievements` | id (relación con profile) |

### Flujo de auth
1. `signUp()` / `signIn()` con email + password
2. `createFullAccount()` — crea perfil y personajes por defecto (Gutts Warrior, Merlin Mage)
3. `fetchAndSaveLocalData()` — sincroniza datos de Supabase a Ionic Storage

## Base de datos

- `strictNullChecks: false` en tsconfig — tenerlo en cuenta al añadir tipos nuevos.
- Los cambios de esquema en Supabase deben reflejarse en los tipos/interfaces del servicio correspondiente.
- La clave de Supabase (publishable) está en `supabase.service.ts` — no añadir claves secretas al código.

## Convenciones

- Componentes: estructura `.ts` + `.html` + `.scss` + `.spec.ts`
- Páginas: lazy-loaded con `loadChildren` en el router (excepto login y globalposition)
- Estado de juego: siempre pasar por `AsgardService`, no guardar estado en componentes
- Sprites de assets en `assets/` (cuerpos en `body/*.png`, enemigos en tilemaps/test/)
- No usar `ng serve` con `--configuration production` en desarrollo (pierde sourcemaps)

## Arquitectura de capas

```
Ionic/Angular (UI + routing)
    └── AsgardService (estado global)
            ├── SupabaseService (BD remota)
            ├── StorageService (BD local)
            └── SceneManager
                    └── Phaser 3 (GameScene / MapScene)
```

## Notas activas

- `strictNullChecks` desactivado — al migrar hacia strict, revisar servicios uno por uno.
- `GameApiService` apunta a `localhost:3000` — pendiente de definir si se mantiene o se elimina en favor de Supabase directo.
- El sistema de coins fue refactorizado recientemente (ver commits `fix coin`, `coins wrapper`).
- La lógica de logout/cambio de personaje fue añadida en el commit `logout and change player logic`.
