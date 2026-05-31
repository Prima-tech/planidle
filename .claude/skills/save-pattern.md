---
description: Reglas de guardado para este proyecto. Se activa cuando se habla de guardar datos, persistencia, Supabase, StorageService, SaveService, snapshots o sincronización.
triggers:
  - guardar
  - guardado
  - guardar datos
  - persistencia
  - persistir
  - supabase
  - storage
  - snapshot
  - sincronizar
  - sincronizacion
  - save
  - offline mode
---

# Patrón de guardado — Idle RPG

## Regla crítica: Supabase NUNCA se llama automáticamente

```
OFFLINE_MODE = true  ← NO cambiar este valor salvo que el usuario lo indique explícitamente
```

El flag está en `src/app/services/save.service.ts` línea 16. Si está en `true`, el botón "Guardar" solo escribe en local y Supabase nunca recibe nada. **No cambiar esto a `false` sin instrucción explícita del usuario.**

---

## Flujo de guardado

```
Cambio en juego (monedas, items, mapa, kills)
    ↓
PlayerStateService / InventoryService / WorldService / KillService
    ↓  (BehaviorSubject, reactivo)
SaveService — debounce 2s → saveLocal() → StorageService (IndexedDB)

Botón "Guardar partida" (Settings)
    ↓
SaveService.forceSave()
    ↓
  1. saveLocal()          → siempre
  2. syncRemote()         → solo si OFFLINE_MODE === false
```

---

## Qué servicio usar para qué

| Dato | Servicio correcto | Nunca hacer |
|------|------------------|-------------|
| Monedas, exp, lvl | `PlayerStateService` | Llamar a StorageService directamente |
| Items del inventario | `InventoryService` | Guardar items a mano |
| Mapa actual | `WorldService` | Mutar `currentMapConfig` sin WorldService |
| Bajas/kills | `KillService` | |
| Persistir todo | `SaveService` | Llamar a StorageService para datos de juego |
| Auth + sync remota | `SupabaseService` (solo vía SaveService) | Llamar a Supabase directamente desde componentes o escenas |

---

## Estructura del snapshot (GameSnapshot)

```typescript
{
  playerState:  PlayerState,          // coins, exp, lvl, hp
  inventory:    (InventoryItem|null)[][][],  // grid 4×4×5
  mapId:        string,               // id del mapa actual
  kills:        KillMap,              // bajas por mapa y tipo
  lastSeen:     string,               // ISO — última actividad
  lastModified: string,               // ISO — última modificación
}
```

Clave de storage por personaje: `snapshot_char_<id>`

---

## Cuándo se guarda automáticamente

- Cada 2 segundos tras un cambio (debounce) → **solo local**
- Al cambiar de personaje (`saveCurrentCharacter()`) → **solo local**
- Al pulsar el botón "Guardar partida" → **local + remoto si OFFLINE_MODE=false**

---

## Lo que NO se debe hacer

- `this.storageService.set(...)` para datos de juego → usar SaveService
- `this.supabaseService.*(...)` desde componentes/escenas → solo SaveService lo llama
- Cambiar `OFFLINE_MODE` a `false` sin instrucción explícita
- Guardar campos sueltos en Supabase sin pasar por `buildDiff()` de SaveService
