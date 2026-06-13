# new-unlock — Configurar desbloqueos, condiciones y acciones

Sistema de desbloqueos del juego: personajes, botones del footer y, en general,
cualquier "cosa" que empiece oculta y se gane jugando. Generaliza el patrón de
logros (`new-achievement`): las **reglas** viven en código, el **desbloqueo** se
persiste, y el **estado** del que dependen las condiciones se deriva en vivo.

Usa esta skill para: crear algo nuevo que desbloquear, cambiar la condición de un
desbloqueo, o añadir/disparar una acción que desbloquea.

## Arquitectura

```
src/app/services/unlock-config.ts    ← FEATURES (registro) + tipos. SOLO reglas, estáticas.
src/app/services/unlock.service.ts   ← UnlockService: persiste, evalúa, expone consultas.
src/app/components/progress-panel/    ← Ventana 🚀 del footer: botones "Desbloquear" (data-driven).
```

Cableado existente (no hay que tocarlo para una feature normal):
- `SaveService.loadCharacter` → `unlocks.loadForChar(charId)` (carga char + global).
- `SaveService.clearCurrentCharacter` → `unlocks.clearForChar()`.
- `GlobalpositionPage` (login) y `TopBarComponent` (selector del HUD) filtran el
  roster con `isCharacterUnlocked(name)`.

### Principio clave: el estado se DERIVA, el desbloqueo se PERSISTE

- **Condiciones**: no se almacenan. Cada feature declara `requires` (fuentes) y el
  servicio las evalúa en vivo (`PlayerStateService`, `KillService`,
  `AchievementService`, flags).
- **Desbloqueo**: al cumplirse, se fija en un Set monotónico (una vez true, nunca
  vuelve a false) y se persiste por scope. Es lo que se sincronizará con Supabase.

## Conceptos

| Concepto | Valores | Significado |
|----------|---------|-------------|
| `scope` | `char` \| `global` | Por personaje (cada uno su Set) o por cuenta. Una feature `global` solo debe usar fuentes globales. |
| `display` | `hidden` \| `locked` | `hidden`: si no está desbloqueado, **no se renderiza**. `locked`: se ve con candado pero no se usa. **Hoy todo el juego usa `hidden`** (sin candados). |
| `requires` | `UnlockSource[]` | Condiciones en **AND**. `[]` ⇒ desbloqueado desde el inicio. |

### Fuentes disponibles (`UnlockSource`)

| type | Campos | Cumple cuando | Scopes |
|------|--------|---------------|--------|
| `level` | `value` | `playerState.snapshot().lvl >= value` | solo char |
| `kills` | `value`, `scope` | `totalCharKills()` / `totalGlobalKills() >= value` | char y global |
| `achievement` | `id` | el logro de ese id está desbloqueado | char y global |
| `mission` | `id` | (TODO) hoy siempre false — pendiente `MissionService` | — |
| `flag` | `id` | el flag se marcó con `setFlag(id, scope)` | char y global |

> `flag` es el comodín para "evento puntual por definir" (recompensa, misión,
> compra, lo que sea). Marca el flag desde donde ocurra el evento y la feature se
> reevalúa sola.

## Receta A — Crear algo nuevo que desbloquear

### 1. Entrada en el registro

En `FEATURES` (`unlock-config.ts`):

```typescript
{ id: 'panel.chest', scope: 'char', display: 'hidden',
  requires: [{ type: 'level', value: 3 }], name: 'Cofre de ciudad' },
```

- `id` único, sin espacios. Convención: `categoria.cosa` (`char.gutts`, `panel.chest`).
- Para un personaje del roster usa `char.<nombre en minúsculas>` — debe coincidir
  con `ROSTER_TEMPLATE` (lo conecta `characterFeatureId(name)`).

### 2. Consumir el desbloqueo en la UI

Lo que **no** está en `FEATURES` siempre está disponible. Para lo que sí:

```html
<!-- Mostrar/ocultar (display 'hidden' ⇒ isVisible == isUnlocked) -->
<div *ngIf="unlocks.isVisible('panel.chest')" (click)="openChest()"> … </div>

<!-- Con candado (solo si display 'locked') -->
<div *ngIf="unlocks.isVisible('x')" [class.locked]="unlocks.isLocked('x')"> … </div>
```

Inyecta el servicio en el componente: `unlocks = inject(UnlockService);`
API de consulta: `isUnlocked(id)`, `isVisible(id)`, `isLocked(id)`,
`isCharacterUnlocked(name)`.

> La ventana de progreso (`progress-panel`) lista **sola** cualquier feature de
> `FEATURES` con un botón "Desbloquear" — no hay que tocarla.

## Receta B — Configurar / cambiar la condición

Edita el `requires` de la feature en `unlock-config.ts`. Ejemplos:

```typescript
requires: []                                            // libre desde el inicio
requires: [{ type: 'level', value: 5 }]                 // nivel 5 del personaje
requires: [{ type: 'kills', value: 500, scope: 'global' }]
requires: [{ type: 'achievement', id: 'gkills_10000' }] // ver new-achievement
requires: [{ type: 'flag', id: 'char_merlin' }]         // evento manual (Receta C)
requires: [                                             // AND de varias
  { type: 'level', value: 10 },
  { type: 'kills', value: 1000, scope: 'char' },
]
```

Si necesitas una fuente nueva (p. ej. "monedas de por vida"): añade el literal a
`UnlockSource`, su `case` en `UnlockService.isSourceMet()` leyendo el contador
correspondiente, y —si el contador no existe— créalo siguiendo el patrón de
`KillService` (acumular en estado persistido, nunca contador suelto).

## Receta C — Disparar un desbloqueo (acciones)

Desde donde ocurra el evento, inyecta `UnlockService` y llama según el caso:

```typescript
// 1) Marcar un flag (lo natural para misiones/recompensas/compras).
//    Reevalúa toda feature que dependa de ese flag.
this.unlocks.setFlag('char_merlin', 'global');

// 2) Conceder directamente, saltándose las condiciones (botón "Desbloquear",
//    cheats, recompensa garantizada). Es lo que usa la ventana de progreso.
this.unlocks.grantById('char.merlin');

// 3) Reevaluar todo tras un cambio de estado relevante (subir de nivel, etc.).
//    Normalmente NO hace falta: isUnlocked() hace commit perezoso al consultarse.
this.unlocks.refresh();        // char + global
this.unlocks.refreshGlobal();  // solo global (pantalla de selección)
```

- Cada desbloqueo emite `unlocks.changes$` (úsalo para badges/notificaciones, ver
  `notif-badge`), salvo los commits perezosos silenciosos de `isUnlocked()`.
- Persiste al instante; no espera al debounce del snapshot.

## Persistencia

Claves en `StorageService` (Sets serializados como array):

| Clave | Contenido |
|-------|-----------|
| `unlocks_global` / `unlocks_char_<id>` | features desbloqueadas |
| `flags_global` / `flags_char_<id>` | flags marcados |

## Supabase (cuando salga de OFFLINE_MODE)

`UnlockService.syncRemote()` es el punto único de sincronización — hoy es un stub
(mismo patrón que `SaveService.saveRemote` y `AchievementService.syncRemote`). Al
activar el backend: tabla `unlocks` (`user_id`, `char_id` null si global,
`feature_id`, `unlocked_at`), upsert con conflict en la tripleta, y en el login
fusionar remoto → local (unión de sets). Append-only: nunca se borra un desbloqueo.

## Features existentes

| id | scope | display | requires |
|----|-------|---------|----------|
| char.gutts | global | hidden | — (libre) |
| char.merlin | global | hidden | flag `char_merlin` |
| char.aldric | global | hidden | flag `char_aldric` |
| char.seraphel | global | hidden | flag `char_seraphel` |
| char.malachar | global | hidden | flag `char_malachar` |
| char.solmara | global | hidden | achievement `gkills_10000` |
| panel.chest | char | hidden | level 3 |

Al añadir una feature, **actualiza esta tabla**.

## Checklist

- [ ] `FeatureDef` añadida a `FEATURES` (`id`, `scope`, `display`, `requires`)
- [ ] UI que la consume usa `isVisible`/`isLocked`/`isUnlocked` (o el roster ya filtra por `isCharacterUnlocked`)
- [ ] Si la condición es `flag`: hay una acción que llama `setFlag(...)` donde ocurre el evento
- [ ] Si la fuente es nueva: literal en `UnlockSource` + `case` en `isSourceMet()` + contador existente
- [ ] Tabla "Features existentes" actualizada
