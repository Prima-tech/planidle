# CLAUDE.md — Idle RPG Incremental

## Reglas

- **NUNCA preguntes si enviar al móvil.** Solo deploy si el usuario lo pide explícitamente.
- **Al ejecutar una skill**, muestra qué skill y con qué argumentos antes de empezar.

## Stack

| Capa | Tecnología |
|------|-----------|
| UI | Angular 19 + Ionic 8 |
| Juego | Phaser 3.88.2 |
| Backend | Supabase 2.93.3 |
| Mobile | Capacitor 7.4.4 |
| Lenguaje | TypeScript 5.6 (strictNullChecks **OFF**) |
| i18n | ngx-translate (`assets/i18n/en.json`, `es.json`) |

## Comandos

```bash
npm start       # Dev server (ng serve)
npm run build   # Build → www/
npm test        # Karma unit tests
```

## Servicios clave

| Servicio | API importante |
|----------|---------------|
| `PlayerStateService` | Fuente de verdad: coins, exp, lvl, hp, mp. `collectCoins()`, `setHp()`, `setMp()` |
| `PlayerBridgeService` | Puente Phaser: `healPlayer(n)` (sprite+state), `restartGameScene()` |
| `CharacterStatsService` | Observables: `damage$`, `hp$`, `mp$`, `defense$`, `evasion$`, `critChance$`, `critDamage$`, `hpRegen$`, `mpRegen$`, `dropRate$`, `freePoints$`. `increment()`/`decrement()`/`restoreStats()` para BaseStats |
| `SaveService` | Persistencia. `isRestoring` bloquea auto-save. `pendingGains$` para offline |
| `InventoryService` | Grid 4×4×5. `addDroppedItem()`, `changes$` |
| `AsgardService` | Sesión: roster, personaje seleccionado. NO maneja Phaser |
| `WorldService` | `currentMap$` — mapa actual |
| `RegenService` | Timer 10s. `start()`/`stop()` en LayoutComponent ngOnInit/ngOnDestroy |
| `KillService` | `charKills` + `globalKills` por mapa/tipo |
| `MapStatsService` | `activeGroups$`, `sessionKills$` (se resetea en cada `create()`) |

## Bridge Angular ↔ Phaser

**GameRegistry** (`scenes/game-registry.ts`) — wrapper tipado. Usar siempre en lugar de `game.registry.get()` raw.

```typescript
// En preload() de escena Phaser:
this.reg = new GameRegistry(this.game);
// .playerBridge  .world  .inventory  .playerState  .kill  .map  .mapStats
```

**Reglas críticas:**
- Clases `Phaser.Scene` **nunca `@Injectable`** — Phaser las gestiona, Angular no.
- `LayoutComponent.registerServices()` registra servicios al arrancar (solo una vez).
- Cambio de personaje → `playerBridge.restartGameScene()` (Phaser ya corre).
- Usar `REGISTRY_KEYS`, nunca strings raw en registry.

## Persistencia (SaveService)

```typescript
interface GameSnapshot {
  playerState: PlayerState;           // coins, exp, lvl, hp, hpMax, mp, mpMax
  inventory: (InventoryItem|null)[][][];
  equipment: EquipmentSnapshot;       // set ACTIVO (roster/mapa leen el sprite de aquí)
  equipmentLoadouts?: { active: number; sets: (EquipmentSnapshot|null)[] }; // 3 sets por personaje
  mapId: string;
  kills: KillMap;                     // { mapId: { enemyType: count } }
  talents?: TalentSnapshot;
  skillSlots?: SkillSlotsSnapshot;
  baseStats?: BaseStats;              // STR/DEX/CONST/INT/MAG/CHR
  lastSeen: string;                   // ISO — última actividad real
}
```

- `isRestoring = true` durante `loadCharacter()` → bloquea auto-save (debounce 2s)
- Drops: `currency` → `playerState.collectCoins()` | `item` → `inventoryService.addDroppedItem()`

## HP vs MP — fuentes de verdad

- **Barra HP** lee `playerBridge.player.status$` (sprite Phaser), **NO** playerState
- **Barra MP** lee `playerState.state$`
- Curar HP: `playerBridge.healPlayer(amount)` — actualiza sprite + playerState
- Curar MP: `playerState.setMp(newMp, mpMax)` directamente

## Stats (BaseStats: STR/DEX/CONST/INT/MAG/CHR, base 0)

| Stat | Derivado | Fórmula |
|------|----------|---------|
| STR | Daño físico | (10 + STR + equipo) × (1 + damagePercent/100) |
| INT | Daño mágico | (10 + INT + equipo) × (1 + magicDamagePercent/100) |
| CONST | HP máx / regen | (50 + ×10 + equipo) × (1 + hpPercent/100) / regen=[CONST/2, CONST] |
| MAG | MP máx / regen | 50 + ×5 / regen=[MAG/2, MAG] |
| DEX | Defensa / Evasión% | floor(DEX/10), mín 0 |
| DEX | Vel. de ataque | +1%/punto (+ equipo `attackSpeed` + buffs), cap +100% |
| STR | Crit extra | +1% daño crít por cada 5 STR |

- Stats arrancan en **0** (mín 0). HP/MP base 50, daño base 10 con todo a 0.
- Puntos: `(lvl−1)` totales (0 al nivel 1, +1 por nivel), gastados = `sum(stats)`
- Combate: `effectiveDmg = max(0, dmg − defense)`. Evasión: roll < evasion% → "EVADE". Crítico base 10%. Daño del jugador con varianza ±10%. Golpe básico: cono ~90° al enemigo más cercano (3 tiles).
- **Sin decimales**: daño (con % de arma y crítico) y demás stats se truncan con `Math.floor` (jugador y enemigo).

## Enemigos

- Jerarquía: `enemy1` → `enemy1_elite` (tras N kills) → `enemy1_oblivion` (tras N kills elite)
- Cada tipo tiene entrada en `ENEMY_REGISTRY` y en `LOOT_TABLES`
- **Dificultad incremental por `tier`** (= nº de mapa, 1-8): vida `tierHp(t)` = 100×1.35^(t−1), daño `tierDamage(t)` = 7×1.25^(t−1) (enemy-config); EXP derivada = 6×1.45^(t−1), élite ×5 / oblivion ×14 (EXP_REWARDS en griddrops); oro `COIN_TIER(t)`/`_ELITE`/`_OBLIVION`. No poner números a mano: asignar tier
- Bonus de botín (CHR/equipo/mapa) con desbordamiento: chance×mult > 1 → floor copias + decimal% de otra (solo items, no oro)
- **Guard crítico:** `if (this.isDead) return` en `takeDamage()` y `die()` — evita doble muerte
- Spawn escalonado 1 cada 2s al entrar al mapa; respawn tras 3s al morir
- Esquiva posicional: si el jugador sale del rango durante el wind-up del golpe enemigo → "MISS". Leash 12 tiles: abandona la caza y se cura al máximo (`dropChase()`)
- Arquetipos de ataque (`attackKind` en config): `melee` (default), `ranged` (proyectil desde 4 tiles + kiting: retrocede si te acercas, ej. gnoll1), `slam` (área telegrafiada, ej. golem1), `charge` (embestida en línea telegrafiada con empujón, ej. lizard1). `windUpMs` = telegrafía hasta el impacto (la anim se sincroniza vía timeScale). Efectos procedurales; con arte propio usar `projectileSpriteKey`/`slamSpriteKey` (keys ya cargadas)
- Élite/oblivion (por sufijo, automático en `enemy.ts`): wind-up ×0.85/×0.75, aplomo (`noFlinch`: sin hurt/retroceso; golem también por config); élite melee → slam cada 3 golpes; oblivion melee → slam cada 4 + proyectil si el jugador está lejos
- Enrage (opt-in con `enrages: true`, solo orc1): bajo 30% de vida → wind-up y cooldown ×0.8, "ENRAGE" + tinte rojizo; se le pasa al curarse por leash
- Portales: detectados en `GameScene.checkPortals()` cada frame → fade → `WorldService.setCurrentMap()` → `scene.restart()`

## Paneles del footer

- Abrir un panel cierra el del **mismo lado**. Método: `closeOtherOnSide(side, except)` en FooterBarComponent
- Panel nuevo → registrarlo en `groups` de `closeOtherOnSide()`
- `bottom: 53-54px` en paneles laterales (altura del footer: botones 40px + padding + viga de piedra 5px ≈ 51px)

## Convenciones

- Estado de juego: `PlayerStateService` | Player Phaser: `PlayerBridgeService` | Inventario: `InventoryService`
- Mapa: `WorldService` | Persistencia: `SaveService` (nunca `StorageService` directo)
- Bridge: `GameRegistry` + `REGISTRY_KEYS`, nunca strings raw
- Suscripciones: `ngOnDestroy` + `unsubscribe()` o `takeUntil`
- Páginas: lazy-loaded con `loadChildren` (excepto login y globalposition)
- `sprite.once(ANIMATION_COMPLETE, ...)` en ataques — nunca `on()` (acumula listeners)

## Notas activas

- `OFFLINE_MODE = true` en `save.service.ts` — cambiar cuando Supabase esté listo
- `strictNullChecks` OFF — al migrar a strict, revisar servicio a servicio
- `GameApiService` apunta a `localhost:3000` — pendiente eliminar
- `FakeApiService.getUserData()` tiene delay 1s — reemplazar por Supabase auth real
