# new-achievement — Añadir un logro nuevo

Sistema de logros del juego: cuadrícula en la ventana de equipo (pestaña trofeo),
con dos ámbitos — logros de **personaje** y logros **globales** (toda la cuenta).

## Arquitectura

```
src/app/services/achievement.service.ts   ← ACHIEVEMENTS (registro) + lógica
src/app/services/kill.service.ts          ← contadores de bajas (char + global)
src/app/components/equipment/             ← UI: tab 4 (grid + panel de info)
```

### Principio clave: el progreso se DERIVA, el desbloqueo se PERSISTE

- **Progreso**: no se almacena. Cada logro declara una `metric` y el servicio la
  lee en vivo de los contadores existentes (`KillService`, `PlayerStateService`).
- **Desbloqueo**: al llegar al `goal` se registra en StorageService
  (`achievements_char_<id>` o `achievements_global`) y queda fijado aunque el
  contador cambie. Es lo que se sincronizará con Supabase.

### Métricas disponibles (`AchievementMetric`)

| metric | Mide | Scopes válidos | Fuente |
|--------|------|----------------|--------|
| `kills` | Enemigos matados (total, todos los mapas) | `char` y `global` | `KillService.totalCharKills()` / `totalGlobalKills()` |
| `level` | Nivel del personaje | solo `char` | `PlayerStateService.snapshot().lvl` |
| `lifetimeCoins` | Monedas acumuladas de por vida | solo `char` | `snapshot().lifetimeCoins` |
| `deaths` | Muertes totales | solo `char` | `snapshot().totalDeaths` |

> Solo `kills` tiene contador global. Para un logro global con otra métrica,
> primero hay que crear el contador de cuenta (patrón `global_kills` de
> KillService: storage compartido + persist agrupado).

## Receta: añadir un logro

### 1. Entrada en el registro

En `ACHIEVEMENTS` (achievement.service.ts):

```typescript
{ id: 'kills_5000', name: 'Leyenda', desc: 'Mata 5000 enemigos con este personaje.',
  scope: 'char', metric: 'kills', goal: 5000, icon: 'ribbon-outline' },
```

- `id` único global, sin espacios. Convención: `<metrica>_<goal>` (global: prefijo `g`).
- `icon`: cualquier ion-icon. Variar los iconos entre logros (la cuadrícula los
  muestra apagados hasta desbloquear, dorados al conseguirlos).
- **No hay que tocar la UI**: la cuadrícula y el panel de info se generan del registro.

### 2. ¿Métrica nueva?

1. Añadir el literal a `AchievementMetric`.
2. Añadir su caso en `progress()` leyendo el contador correspondiente.
3. Si el contador no existe aún, crearlo donde se produce el evento
   (p. ej. `PlayerStateService` ya acumula `lifetimeCoins` en `collectCoins()` —
   seguir ese patrón: acumular en el estado persistido, nunca contador suelto).

### 3. Supabase (cuando salga de OFFLINE_MODE)

`AchievementService.syncRemote()` es el punto único de sincronización — hoy es un
stub (mismo patrón que `SaveService.saveRemote`). Al activar el backend:

- Tabla `achievements`: `user_id`, `char_id` (null si scope global),
  `achievement_id`, `unlocked_at`. Upsert con conflict en la tripleta.
- En el login, fusionar remoto → local (unión de sets) en `loadForChar()`.
- Los logros son append-only: nunca se borra un desbloqueo en la sincronización.

## UI (referencia)

- Tab 4 de la ventana de equipo (icono trofeo), sub-tabs Personaje/Globales
  (reutilizan `.talent-tree-tab`).
- Grid: `.ach-grid` 4 columnas; celda apagada → dorada al desbloquear;
  selección en púrpura.
- Panel de info a la derecha: `.ach-flyout` (usa el marco y posición de
  `.stats-flyout`): icono + nombre, descripción, barra de progreso
  `actual / goal` y estado Conseguido/Pendiente.

## Logros existentes

| id | scope | metric | goal |
|----|-------|--------|------|
| kills_100 | char | kills | 100 |
| kills_1000 | char | kills | 1000 |
| level_10 | char | level | 10 |
| coins_10000 | char | lifetimeCoins | 10000 |
| deaths_10 | char | deaths | 10 |
| gkills_1000 | global | kills | 1000 |
| gkills_10000 | global | kills | 10000 |

Al añadir un logro, **actualizar esta tabla**.
