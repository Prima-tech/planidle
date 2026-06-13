# new-quest — Añadir una misión nueva

Sistema de misiones del juego: pestaña **Misiones** (icono libro) en la ventana
de equipo. Dos grupos en acordeón — **Disponibles** (en curso) y **Completadas**.
Cada misión es a su vez una tarjeta-acordeón: al desplegarla muestra descripción,
barra de progreso, botón **Activar** y recompensa.

Una misión disponible puede **activarse** (fijarse): las activas aparecen en el
**rastreador del HUD** (arriba-izquierda, bajo el widget de personaje), mostrando
solo qué hay que hacer y el progreso. Máximo **5 activas** a la vez. Activar es
ortogonal al progreso: una misión avanza esté o no fijada; activar solo decide
qué se ve en el HUD.

## Arquitectura

```
src/app/services/quest.service.ts         ← QUESTS (registro) + lógica + persistencia + activación
src/app/services/kill.service.ts          ← killDetail$ (evento tipado: { mapId, enemyType })
src/app/components/equipment/             ← UI: tab 6 (secciones + tarjetas-acordeón + botón Activar)
src/app/components/quest-tracker/         ← rastreador del HUD (lee quests.active$)
src/app/components/achievement-toast/     ← toast compartido (logro + misión completada)
src/assets/i18n/{es,en}.json              ← bloque QUESTS (chrome de la UI)
```

### Principio clave: el progreso se CUENTA DESDE QUE EMPIEZA

A diferencia de los **logros** (que derivan su progreso en vivo de contadores
acumulativos), una misión **no se autocompleta con bajas previas**:

- **Progreso**: se incrementa con cada evento real (`KillService.killDetail$`,
  que solo emite en bajas reales, nunca en `restoreCharKills`) y se persiste por
  personaje en `quests_char_<id>` → `{ progress, completed, active }`. Al alcanzar
  el `goal` el progreso **deja de contar** (no rebasa el objetivo).
- **Reclamable, NO autocompletada**: al llegar al `goal` la misión sigue en
  *Disponibles* con un botón **Completar**, y se enciende el aviso
  `badges.flag('equip.quests')` (mismo notif-dot que el punto de stats al subir
  de nivel).
- **Completado**: el jugador pulsa **Completar** → `claim()` entrega la recompensa
  una sola vez, marca el set `completed` (persistido), lanza el toast y la pasa a
  *Completadas*. Como el set está persistido, al recargar no se re-entrega.

### El cobro es MANUAL (flujo reclamable)

`claim(def)` solo actúa si `isClaimable(def)` (`progreso >= goal && !completada`).
La recompensa **no** se entrega sola: el botón Completar aparece en la tarjeta
cuando la misión está reclamable. Avisos (idénticos al sistema de stats):

- `onKill` hace `badges.flag('equip.quests')` justo al cruzar el `goal`.
- El notif-dot sube solo al botón de equipo del footer (`has('equip')`) y a la
  pestaña Misiones (`has('equip.quests')`).
- Se limpia al abrir la pestaña (tab 6): `badges.clear('equip.quests')`.
- `hasClaimable()` está disponible por si quieres avisos en otro sitio.

## Receta: añadir una misión

### 1. Entrada en el registro

En `QUESTS` (quest.service.ts). El orden del array es el orden de presentación:

```typescript
{
  id: 'slimes_10',                     // único, sin espacios
  name: 'Plaga de babosas',
  desc: 'Acaba con 10 babosas en los caminos.',
  icon: 'water-outline',               // cualquier ion-icon
  track: 'Mata babosas',               // etiqueta corta del HUD (opcional; cae a `name`)
  objective: { type: 'kill', family: 'slime', goal: 10 },
  reward: { coins: 150, exp: 60 },     // opcional
},
```

`track` es lo que se ve en el rastreador del HUD ("lo que hay que hacer"). Mantenlo
corto; si se omite, el HUD muestra `name`.

**No hay que tocar la UI**: las secciones y tarjetas se generan del registro.

### 2. El objetivo (`QuestObjective`)

Hoy solo existe el tipo `kill`. Filtra qué bajas cuentan:

| Campo | Efecto |
|-------|--------|
| `enemyTypes: ['orc1','orc1_elite']` | Solo esos tipos exactos (prioridad sobre `family`) |
| `family: 'slime'` | Cualquier tipo cuyo id empiece por `slime` (slime1, slime2, slime1_elite…) |
| *(ninguno)* | Cualquier enemigo |

> Los ids de tipo viven en `ENEMY_REGISTRY` (enemy-config.ts). Las variantes
> usan sufijos `_elite` / `_oblivion`, por eso `family` casa por prefijo.

`goal` es la cantidad a alcanzar.

### 3. La recompensa (`QuestReward`, opcional)

```typescript
reward: { coins: 200, exp: 80 }
```

Se entrega en `grantReward()` vía `PlayerStateService.collectCoins()` y `addExp()`.
Para recompensar con otra cosa (ítem, esfera de talento…), añadir el campo a
`QuestReward` y manejarlo en `grantReward()`.

## Añadir un TIPO de misión nuevo (no solo de matar)

Ejemplo: "alcanza nivel 10", "gasta 1000 monedas", "consigue X ítem".

1. **Extender la unión** `QuestObjective` con un nuevo `type`:
   ```typescript
   export type QuestObjective = KillObjective | ReachLevelObjective;
   export interface ReachLevelObjective { type: 'reachLevel'; goal: number; }
   ```
2. **Enganchar la fuente del evento** en el constructor de `QuestService`
   (igual que `kills.killDetail$` para `kill`). Suscribirse al observable que
   marca el avance (p. ej. `playerState.levelUp$`) e incrementar/fijar el
   `progress` de las misiones de ese tipo, completando si llega al `goal`.
   - Para métricas **acumulativas que ya existen** (nivel, monedas de por vida)
     puedes fijar `progress[id] = valorActual` en lugar de sumar 1.
3. **Cubrir el matcher**: si el tipo necesita filtrado (como `matchesKill`),
   añade su helper. Reusa `onKill` como plantilla del bucle: saltar completadas,
   comprobar `type`, comprobar match, incrementar, completar, persistir.
4. La UI ya funciona: usa `progressOf`/`goalOf`/`ratio`, agnósticos al tipo.

## Activación y rastreador del HUD

- Estado `activeSet` (persistido en `active: string[]`), **máximo 5**
  (`MAX_ACTIVE_QUESTS`). Métodos: `activate` / `deactivate` / `toggleActive`,
  más `isActive`, `canActivate`, `activeCount`, `active()`.
- `active$` (BehaviorSubject) re-emite en **cada** `notify()` — incluido el
  avance de progreso — así el rastreador refleja progreso en vivo sin lógica
  extra. Llama siempre a `notify()` (no a `changes$.next()` suelto) cuando
  cambies estado, para mantener `active$` sincronizado.
- Al **completarse**, una misión se quita de `activeSet` automáticamente.
- El botón **Activar** vive en la tarjeta (solo misiones disponibles); se
  deshabilita si ya hay 5 activas. El rastreador (`quest-tracker`) es de **solo
  lectura**: icono + `track` + `progressOf/goalOf`.

## Persistencia y ciclo de vida

- `SaveService.loadCharacter()` → `await quests.loadForChar(charId)`.
- `SaveService.clearCurrentCharacter()` → `await quests.clearAll()`.
- Las escrituras de progreso van **agrupadas** cada 3 s (`schedulePersist`),
  como `KillService`; los completados y los cambios de activación se guardan al
  instante (`persistNow`).
- `QuestSave` persiste `{ progress, completed, active }` por personaje.
- Estado **por personaje** (no en `GameSnapshot`, igual que los logros). Si una
  misión debe ser global a la cuenta, replicar el patrón `global_kills`.

## UI (referencia)

- Tab 6 de la ventana de equipo (icono `reader-outline`); badge `equip.quests`
  se enciende al volverse **reclamable** una misión y se limpia al abrir la pestaña.
- `.quest-section` (cabecera plegable Disponibles/Completadas) → `.quest-card`
  (tarjeta-acordeón por misión, plantilla `#questTpl`). Pin dorado si está activa;
  borde dorado pulsante + notif-dot + botón **Completar** (`.quest-claim-btn`) si
  está reclamable; botón Activar/Quitar en el cuerpo si aún no lo está.
- Rastreador del HUD: `app-quest-tracker` en `layout.component.html`, posición
  absoluta `top: 86px; left: 8px` (cuelga bajo el top-bar de 72px).
- Toast de completado: `AchievementToastComponent` escucha `quests.completed$`.

## Misiones existentes

| id | objetivo | goal | track | recompensa |
|----|----------|------|-------|------------|
| plaga_babosas | kill (cualquiera) | 1 | Mata 1 enemigo | 150 monedas + 60 exp |
| kill_50 | kill (cualquiera) | 50 | Mata enemigos | 300 monedas + 150 exp |
| orcs_5 | kill family `orc` | 5 | Mata orcos | 200 monedas + 80 exp |

Al añadir una misión, **actualizar esta tabla**.
