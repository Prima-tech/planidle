---
description: Modo Exploración / "Modo Mundo" — el runner lateral 2D estilo Idle Slayer (escena Phaser separada del grid). Punto único donde se documenta TODO lo del runner: entrada/salida, auto-run, salto, suelo por chunks, parallax configurable, coleccionables (estrellas/corazones), enemigos (rata/fénix/bola de fuego), distancia/metros, hitos de desbloqueo, muerte, AFK offline y los puntos de integración con Angular. Se activa al hablar de modo exploración, modo mundo, runner, WorldRunScene, correr, saltar, parallax, estrellas, rata, fénix, metros, distancia, explorar.
triggers:
  - modo exploración
  - modo exploracion
  - exploración
  - exploracion
  - modo mundo
  - world run
  - world-run
  - runner
  - WorldRunScene
  - explorar
  - explorando
  - exploring
  - correr
  - saltar
  - salto
  - jump
  - parallax
  - paralax
  - estrella
  - star
  - corazón
  - heart
  - rata
  - rat
  - fénix
  - fenix
  - fireball
  - bola de fuego
  - metros
  - distancia
  - chunk
  - RUN_UNLOCK_POINTS
  - explorationDistanceM
  - worldBestDistanceM
  - run-stats
  - runMode
  - jumpRequest
  - exitRunRequest
  - WORLD_PARALLAX_SETS
---

# Modo Exploración (Modo Mundo / runner lateral)

Runner lateral 2D estilo **Idle Slayer**, **separado** del juego grid top-down (`GameScene`). El jugador corre solo hacia la derecha con gravedad, un **TAP salta** (mantener = más alto), el suelo es infinito por chunks reciclados, y atravesar **hitos de distancia** desbloquea mapas de la cadena de combate normal. Reutiliza los servicios del juego vía `GameRegistry` (HP/MP, monedas, charStats, unlocks, actividad AFK).

> Diseñado/decidido con el usuario 2026-06-19. Es **paralelo** a la cadena de portales de combate (hogar→1-1→…), no la sustituye. Principio del usuario: "se queda almacenado (récord/total) pero empiezas de 0" en cada expedición.

## Archivos involucrados

| Archivo | Responsabilidad |
|---------|----------------|
| `src/app/scenes/worldrun/worldrun.scene.ts` | **`WorldRunScene`** (key `'WorldRunScene'`, `active:false`). TODA la lógica del runner: chunks, jugador, salto, coleccionables, enemigos, parallax, distancia, muerte, entrada/salida |
| `src/app/scenes/worldrun/run-unlock-points.ts` | **`RUN_UNLOCK_POINTS`** — hitos `{distanceM, flag, mapId, firstEver, recruitChar?}`. Módulo plano (sin Phaser) para compartir con `OfflineGainsService` |
| `src/app/scenes/worldrun/parallax-sets.ts` | **`WORLD_PARALLAX_SETS`** — sets de fondo configurables (carpetas `assets/tilemaps/world/paralax/<id>/`), helpers `getWorldParallaxSet`/`worldParallaxKey`/`worldParallaxPath`/`worldParallaxFactor` |
| `src/app/scenes/gamescene/gamescene.ts` | **Entrada** (`checkPortals`: target `'world-run'` → `scene.start('WorldRunScene')`) y **rebote AFK** (`create`: si `activity==='exploring'` rebota a WorldRunScene) |
| `src/app/scenes/gamescene/map-config.ts` | Portal `world-run` en `hogar`; `planetCapitalForMap()` (capital a la que vuelve la salida), `planetNameForMap()`/`PLANET_BY_MAP` |
| `src/app/services/player-bridge.service.ts` | Puente Angular↔escena: `runMode$`, `jumpRequest$`/`jumpReleaseRequest$`, `exitRunRequest$`, `enterMapRequest$`/`mapEntranceDismissed$`, `runDeath$`, `setRunMode`/`requestJump`/`requestExitRun`/`notifyRunDeath`/`promptMapEntrance`/`showMapEntranceHint`/`currentSprintMultiplier` |
| `src/app/services/player-state.service.ts` | Estado persistido: `explorationDistanceM`, `worldBestDistanceM`, `currentKills`/`worldKills`, `currentDeaths`/`totalDeaths`, `stars`. Métodos `collectStars`, `reportWorldDistance`, `addExplorationDistance`, `addWorldKills`, `resetRunKills`, `recordDeath`, `goHomeReset` |
| `src/app/services/activity.service.ts` | Actividad AFK: `'exploring'` (vs `'idle'`/combate). La leen el rebote de GameScene y los rosters |
| `src/app/services/offline-gains.service.ts` | `calculateExploring` — metros AFK (+10 m/min, tope 8 h) y flags de mapas cruzados |
| `src/app/components/run-stats/run-stats.component.*` | HUD del runner (arriba-dcha, solo en runMode): estrellas, kills, mejor distancia, muertes |
| `src/app/components/footer-bar/footer-bar.component.*` | Botón HOME (salir), modal "volver a casa" (`.rh-*`), modal "Has muerto" (`runDeathSub`) |
| `src/app/components/attack-button/attack-button.component.ts` | En runMode el botón de ataque pasa a **saltar** (icono chevron-up) |
| `src/app/components/map-entrance-modal/*` · `map-teleport-hint/*` | Modal de entrada a mapa (primera vez) y hint de botón (ya desbloqueado) en un hito |
| `src/app/components/layout/layout.component.*` | Registra `WorldRunScene` en el array de escenas; oculta minimapa/skills en runMode |
| `src/app/components/top-bar/*` · `pages/globalposition/*` | Rosters de ubicación: muestran "Explorando · {planeta}" si `activity==='exploring'` |
| `assets/tilemaps/world/` | `suelo_01.png`/`suelo_02.png` (suelo), `follow.png` (letrero inicio), `interest_point.png` (pin de hito), `paralax/<id>/` (fondos) |
| `assets/sprites/resources/world_mode/{star,hearth}/` · `assets/sprites/enemy/world/{rat,fenix}/` | Coleccionables y enemigos |

---

## Cómo funciona (estado actual)

### Entrada y salida
- **Entrar:** portal en `hogar` (`map-config.ts`) con `targetMapId:'world-run'`. `GameScene.checkPortals()` lo intercepta ANTES de `setCurrentMap` → `scene.start('WorldRunScene', {entryMapId})` + `scene.stop()`. `'world-run'` **NO** está en `MAP_REGISTRY` a propósito (no es mapa de grid).
- **`init({entryMapId})`:** guarda el mapa de origen y fija `startDistanceM = entryDistanceFor(entryMapId)` (distancia del hito de ese mapa en `RUN_UNLOCK_POINTS`, o 0 → arranca en km 0).
- **Salir ("volver a casa"):** botón HOME del footer (solo runMode) → modal de confirmación (`.rh-*`, "perderás el progreso") → `playerBridge.requestExitRun()` → `exitRunRequest$` → `exitToHome()`. Este: `goHomeReset()` + cura al 100% + `world.setCurrentMap(planetCapitalForMap(entryMapId))` + `activity.set('idle')` + fundido → `scene.start('GameScene')`.
- **Rebote AFK (crítico):** `loadCharacter` restaura `activity` del snapshot. `GameScene.create`, al inicio (antes de montar mapa/jugador), si `reg.activity.current === 'exploring'` → `scene.start('WorldRunScene', {entryMapId})` + `return`. Sin esto, un personaje dejado explorando volvía al combate. **OJO:** las salidas explícitas (`exitToHome`, `enterMap`) deben `activity.set('idle')` ANTES de `scene.start('GameScene')` o reboterían en bucle; NO resetear actividad en el SHUTDOWN del runner (el cambio de personaje también lo dispara y ahí sí queremos el rebote).
- **`emitSceneReady` (crítico):** WorldRunScene.create emite `playerBridge.emitSceneReady()` (delayedCall 300 ms) para ocultar el `loading-cover`. Imprescindible en el rebote (GameScene retorna antes de su propio emit) o el juego se cuelga en "Cargando". Idempotente en la entrada por portal.

### Auto-run, salto y cámara
- `update()`: `setVelocityX(RUN_SPEED * currentSprintMultiplier())` cada frame (re-aplicado por si una colisión lo anuló; durante la embestida manda `DASH_SPEED`). Control manual anulado: los inputs son saltar y las habilidades.
- **Salto variable** (`pressJump`/`updateJump`/`releaseJump`): impulso inicial `JUMP_INITIAL_VELOCITY`, y mientras se mantiene (≤ `JUMP_MAX_HOLD_MS`) se sigue acelerando hacia arriba (`JUMP_HOLD_ACCEL`) hasta el tope `JUMP_MAX_VELOCITY`. Input: tap/hold en el lienzo, barra ESPACIO, **y el botón de ataque de Angular** (`jumpRequest$`/`jumpReleaseRequest$`).

### Habilidades (estilo Idle Slayer, 2026-07-02)
Cuatro habilidades **comprables con estrellas** en el panel de hitos del HUD (run-stats): `RUN_MILESTONES` en `services/run-milestones.ts` — `double_jump` 15★ · `dash` 40★ · `slam` 80★ · `bow` 150★ (+ `sprint` 1★ que ya existía). La escena las gatea con `playerState.hasRunMilestone(id)` (compra a mitad de carrera = activa al instante). **Las estrellas son PERSISTENTES** (moneda del runner): `goHomeReset` ya NO las resetea (decisión del usuario 2026-07-02; el texto GO_HOME_WARN lo refleja). Estado en la escena (`jumpsUsed`/`dashing`/`slamming`/`arrows`…), reseteado en `create()`.
- **Doble salto**: `pressJump` en el aire con `jumpsUsed<2` → segundo impulso (`DOUBLE_JUMP_VELOCITY` 700) + nube (`showDoubleJumpPuff`). `jumpsUsed` se recarga al pisar suelo. Funciona también desde el botón de Angular (dos taps).
- **Embestida / dash** (`startDash`/`endDash`): swipe DERECHA · tecla D o →. Ráfaga horizontal `DASH_SPEED` 1050 durante `DASH_MS` 260 (gravedad off, vy=0), enfriamiento `DASH_COOLDOWN_MS` 2500. **Invulnerable** (`damagePlayer` early-return) y **mata por atropello** (ramas `this.dashing` en `updateRats`/`updateFenixes` con `DASH_KILL_PAD`; revienta bolas de fuego). Estela de fantasmas (`spawnDashGhost` cada 45 ms) + tinte azulado + pose fija.
- **Golpe descendente / slam** (`startSlam`/`slamImpact`): swipe ABAJO · tecla S o ↓, solo en el aire. Cae a `SLAM_SPEED` 1500; atravesar un fénix bajando lo mata (rama `slamming` en el choque). Al aterrizar: sacudida de cámara + anillo expansivo + mata ratas y revienta bolas en `SLAM_KILL_RADIUS` 110. El slam corta un dash en curso.
- **Arco automático** (`updateArrows`): dispara solo cada `ARROW_INTERVAL_MS` 2800 una flecha recta (textura `wr_arrow` GENERADA por código en create, sin asset) a la altura del pecho → corriendo barre ratas, saltando puede flechar a un fénix; también revienta bolas de fuego. `ARROW_SPEED` 900.
- **Gestos** (`checkSwipe` + `swipeStart`/`swipeFired` en `bindInput`): un swipe ≥`SWIPE_MIN_PX` 46 en ≤`SWIPE_MAX_MS` 320 dispara la habilidad UNA vez por toque y anula el "mantener" del salto que arrancó en el pointerdown (el salto queda en el toque mínimo). Horizontal→dash (dx>0), vertical hacia abajo→slam.
- Todas las bajas de habilidades pasan por `killRatAt`/`killFenixAt`/`popFireball` → `addWorldKills()` (cuentan en el HUD).
- **Anim del jugador** (placeholder = cuerpo LPC del personaje, textura `'player'`): en suelo `wr_run` (frames 533-540, fila RUN derecha); en el aire se congela `PLAYER_RUN_AIR_FRAME` (537). `registerAnims` rehace `wr_run`/`wr_death` SIEMPRE (la textura `'player'` se recarga al cambiar de personaje → frames destruidos → crash `sourceSize` si reusas la anim vieja).
- **Cámara:** `startFollow(player, true, 1, 0)` (solo X; lerpY=0). `scrollY=0` se fija DESPUÉS de startFollow (que centra en Y). Offset coloca al jugador al 25% de la izquierda. `roundPixels=true` (anti-borrón).

### Suelo por chunks
- `makeChunk`: 2 `TileSprite` (césped `suelo_01` arriba depth 1 + tierra `suelo_02` debajo depth 0, overdraw 2 tiles para no dejar hueco con el footer) + un `Rectangle` estático invisible como colisionador (hundido `SURFACE_INSET` para pisar sobre la hierba).
- `recycleChunks`: el chunk que sale por la izquierda se reposiciona al final (pool, mundo infinito). Todos los `floor` colisionan con el jugador.

### Parallax configurable
- Varios sets en `WORLD_PARALLAX_SETS` (carpetas `paralax/<id>/`, capas atrás→delante). `fit:'height'` (cielos: cabe entero, repite a lo ancho) o `fit:'cover'` (paisajes con foco: una copia llena el ancho, `anchorY` elige la franja).
- Setting **`worldParallax`** en `GameSettingsService` (persistido localStorage), selector en la 3ª pestaña del panel de ajustes ("Mundo"). La escena **precarga SOLO el set elegido** (VRAM) y se suscribe a `worldParallax$` → `switchParallax` (carga bajo demanda) → `rebuildParallax` (reconstruye en vivo, se puede cambiar corriendo). Factor por profundidad: fondo lento → frente rápido (`worldParallaxFactor`, MIN 0.06 / MAX 0.6).

### Coleccionables (estrellas y corazones)
- **Estrellas** (`star1..star10.png`, anim `wr_star_twinkle`): una cada `STAR_INTERVAL_M` (25 m), altura rotada por `STAR_HEIGHTS`. Overlap con el jugador → `collectStar` → `playerState.collectStars(1)` (persistido) + tween. Se generan por delante (`updateStars`) y se destruyen al quedar atrás.
- **Corazones** (`heart1..10.png`, anim `wr_heart_beat`): uno cada `HEART_INTERVAL_M` (75 m). `collectHeart` → `healPlayer(HEART_HEAL=10, false)` + `showHealEffect` (el "+X" se pinta a mano sobre el sprite del runner, porque `healPlayer` lo dibuja sobre el sprite de GameScene).
- Si los PNG están vacíos/corruptos, Phaser pinta el cuadro verde "textura faltante" pero el item se sigue recogiendo; los anims solo se crean si cargaron frames válidos (si no, `play()` reventaría).

### Enemigos (rata y fénix)
NO usan la clase `Enemy` del grid: son entidades ligeras propias en arrays (`rats`, `fenixes`), generadas por delante y recicladas atrás.
- **Rata** (`rat.png`, hoja 64×32, una cada `RAT_INTERVAL_M` 25 m): plantada en idle a ras de suelo. Telegrafía ataque al acercarte (`RAT_SENSE_PX`). **A ras de suelo te hace daño** (`RAT_DAMAGE`, `feetAbove < RAT_STOMP_LOW`). **Pisotón** (caer sobre el lomo en la franja `RAT_STOMP_LOW..HIGH` bajando) → la matas sin daño + rebote (`RAT_STOMP_BOUNCE`) + `addWorldKills()`.
- **Fénix** (`Phoenixling Sprite Sheet.png`, hoja 64×64, vuela a `FENIX_HEIGHT`, balanceo `FENIX_BOB`, uno cada `FENIX_INTERVAL_M` 50 m desde `FENIX_START_M` 25 m — intercalado con las ratas): al acercarte lanza UNA **bola de fuego** (`spawnFireball`, reusa frames `skill_fireball`) que cae al suelo y rueda hacia ti; la esquivas saltándola (`updateFireballs`, daño `FIREBALL_DAMAGE`). Pisotón (caer encima) → muerte sin daño + rebote; choque de otra forma → `FENIX_DAMAGE`.

### Distancia, hitos y desbloqueos
- **Metros:** `distanceM = floor((player.x - startX) / PX_PER_METER)` (`PX_PER_METER = RT = 48`, 1 tile = 1 m). `startX` se retrasa `startDistanceM` metros para que la carrera arranque ya en la entrada del mapa de origen. Texto en pantalla (HUD central) + `reportWorldDistance` (récord + distancia explorada).
- **Hitos** (`checkUnlockPoints` vs `RUN_UNLOCK_POINTS`): al cruzar `distanceM >= pt.distanceM` por primera vez (su `flag` aún sin marcar) → `unlocks.setFlag(pt.flag,'char')` (idempotente). Si es **primera vez** (mapa no desbloqueado Y `recruitChar` no reclutado) → `promptMapEntrance` + `scene.pause()` (modal de entrada). Si ya estaba → `showMapEntranceHint` (botón, sin pausar). `firedPoints` evita re-evaluar cada frame; los hitos ≤ `startDistanceM` se pre-marcan en `create()` (no re-ofrecer la entrada del mapa del que vienes).
- `createInterestSigns`: planta `interest_point.png` en cada hito; `createStartSign` (`follow.png`) solo en arranque desde km 0.

### Muerte
- `damagePlayer`: si el golpe lleva el HP de `playerBridge.player` a ≤0 → `playerDie()` (NO usa el flujo de combate `death$`/revivir). `playerDie`: `dead=true` (early-return en `update`/`damagePlayer`), `recordDeath()` (sube `totalDeaths`+`currentDeaths`), congela al jugador SIN pausar la escena (la escena debe seguir para que la anim de muerte avance y el fundido de salida funcione), anim `wr_death` (frames 260-265, universal) → `notifyRunDeath()` → `runDeath$`.
- Angular (`footer-bar`, `runDeathSub`) muestra el modal "Has muerto" (`RUN.DEATH_*`, `.rh-*`, solo Aceptar) → `requestExitRun()` → `exitToHome()`. **MORIR = fin de expedición → teletransporte a la capital** (NO respawn-in-place). El reset (`goHomeReset`) se hace al principio de `exitToHome`, no en el callback del fundido (pausar/no-disparar el callback dejaba estrellas/muertes sin reiniciar).

### Estado persistido y "fin de expedición"
- `goHomeReset()` (volver a casa O morir): `stars`, `explorationDistanceM`, `currentDeaths`, `currentKills` → **0**. CONSERVA `worldBestDistanceM` (récord) y `totalDeaths` (total de por vida, estadísticas).
- `currentKills` (HUD de run) vs `worldKills` (total). `addWorldKills` sube ambos; `resetRunKills()` (en `create()`) y `goHomeReset` reinician el de run.

### AFK explorando (offline)
- Estar AFK con `activity==='exploring'` acumula **+10 m/min** (tope 8 h, como el AFK de combate). `OfflineGainsService.calculateExploring` devuelve metros + flags de mapas cruzados (`OfflineGains.kind:'exploring'`).
- `LayoutComponent.collectGains` rama exploring → `addExplorationDistance` + `unlockService.setFlag(flag,'char')` (idempotente) + modal AFK variante exploración.
- `WorldRunScene.create`: `startDistanceM = max(entradaPortal, explorationDistanceM)` → la carrera **resume desde lo explorado** (los spawns/hitos detrás del arranque se saltan).
- `explorationDistanceM` (crece corriendo Y AFK) es DISTINTO de `worldBestDistanceM` (récord, solo en vivo, no incluye AFK).

### Rosters de ubicación
Dos sitios muestran dónde está el personaje y ambos tratan `'exploring'` (el `mapId` del snapshot sigue siendo el último mapa de combate y confundiría): (1) **globalposition** (`charLocation()` → solo el planeta), (2) **top-bar** (`char-roster`, `locationOf()` lee `ActivityService.current` para el activo y `snap.activity` para el resto → antepone "Explorando · {planeta}"). Planeta vía `planetNameForMap(mapId)` (hoy todo 'Tierra').

---

## Constantes / valores clave (worldrun.scene.ts)

| Qué | Constante | Valor |
|-----|-----------|-------|
| Tile de juego / px por metro | `RT` / `PX_PER_METER` | 48 (1 tile = 1 m) |
| Velocidad de carrera | `RUN_SPEED` | 260 px/s |
| Gravedad | `GRAVITY_Y` | 2200 |
| Salto inicial / tope / hold | `JUMP_INITIAL_VELOCITY` / `JUMP_MAX_VELOCITY` / `JUMP_MAX_HOLD_MS` | 480 / 860 / 240 ms |
| Ancho de chunk | `CHUNK_TILES` (×RT) | 16 tiles |
| Inset del colisionador | `SURFACE_INSET` | `RT*0.12` |
| Escala del jugador | `PLAYER_SCALE` | 2.1 |
| Intervalo estrella / corazón | `STAR_INTERVAL_M` / `HEART_INTERVAL_M` | 25 m / 75 m |
| Curación del corazón | `HEART_HEAL` | 10 |
| Intervalo rata / fénix | `RAT_INTERVAL_M` / `FENIX_INTERVAL_M` (desde `FENIX_START_M` 25) | 25 m / 50 m |
| Daño rata / fénix / bola | `RAT_DAMAGE` / `FENIX_DAMAGE` / `FIREBALL_DAMAGE` | 30 / 12 / 12 |
| Doble salto | `DOUBLE_JUMP_VELOCITY` | 700 |
| Embestida | `DASH_SPEED` / `DASH_MS` / `DASH_COOLDOWN_MS` | 1050 / 260 / 2500 |
| Golpe descendente | `SLAM_SPEED` / `SLAM_KILL_RADIUS` | 1500 / 110 |
| Arco automático | `ARROW_INTERVAL_MS` / `ARROW_SPEED` | 2800 / 900 |
| Gestos | `SWIPE_MIN_PX` / `SWIPE_MAX_MS` | 46 / 320 |
| AFK explorando | (offline-gains.service) | 10 m/min, tope 8 h |

---

## Cómo extender

- **Nuevo mapa desbloqueable por distancia:** añade una entrada a `RUN_UNLOCK_POINTS` (`{distanceM, flag, mapId, firstEver, recruitChar?}`). El `flag` desbloquea la feature `map.<id>` (`mapFeatureId`); `firstEver:true` solo en el primerísimo (su modal solo ofrece "Aceptar"). Funciona en vivo (checkUnlockPoints) Y en AFK (offline-gains lo lee del mismo módulo plano). Plantará su pin `interest_point` automáticamente.
- **Nuevo coleccionable:** copia el patrón de estrellas/corazones — keys/files de los frames, `registerAnims` (solo con frames cargados), grupo `physics.add.group({allowGravity:false, immovable:true})`, `physics.add.overlap` con `collectX`, y un `updateX` que genera por delante / destruye atrás por intervalo de metros.
- **Nuevo enemigo:** copia el patrón de la rata (suelo) o el fénix (aire). Carga la hoja en `preload`, define frames/anims en `registerAnims`, un array de instancias, y un `updateX` que: genera por intervalo, recicla atrás, resuelve **pisotón** (caer encima bajando = matar + `addWorldKills` + rebote) y **contacto** (`damagePlayer`). Ratas/fénix reusan spritesheets de `assets/sprites/enemy/world/`.
- **Nuevo set de parallax:** crea `assets/tilemaps/world/paralax/<id>/` con las capas, añade el `WorldParallaxId` y la entrada a `WORLD_PARALLAX_SETS` (`fit`/`anchorY` según cielo o paisaje). Aparece solo en el selector de ajustes.
- **Ajustar feel (verás en juego):** escala/offset del cuerpo de colisión (`body.setSize/ setOffset`), `RUN_SPEED`, constantes de salto, `SURFACE_INSET`, alturas de coleccionables, franjas de pisotón.

## Notas / pendientes / trampas

- **`active:false`** en el constructor (no auto-arranca). Se entra solo por portal o rebote.
- **La instancia de escena se reutiliza** entre start/stop: `create()` resetea TODO el estado (`chunks`, arrays de enemigos, `exiting`, `dead`, índices de spawn…). Si añades estado nuevo, resetéalo ahí.
- **`registerAnims` rehace `wr_run`/`wr_death` cada vez** (no basta `exists`): la textura `'player'` se recrea al cambiar de personaje y dejaría frames destruidos → crash `sourceSize`. Mismo patrón que `player_*` en gamescene (ver memoria `player-anim-stale-frame-crash`).
- **No pausar la escena al morir** (rompe el callback `FADE_OUT_COMPLETE` de la salida). Sí se pausa al mostrar el modal de **entrada** a un mapa (`mapEntranceDismissed$`/`enterMap` la reanudan).
- En el grid hay `strictNullChecks` OFF; el `playerBridge.player` puede no existir → guards `if (p)`.
- El usuario **verifica con `npm start`** (no `tsc`/`build`, OOM). Ver memoria `verify-preference`.
- Memoria relacionada (auto-memoria del proyecto): **`world-run-mode`** tiene el diario de decisiones de diseño; esta skill es la referencia técnica de "dónde está / cómo extenderlo".
- Fases que aún pueden quedar por pulir: variedad procedural (huecos reales/plataformas/biomas), más enemigos, balance de daño/recompensa.
