# Sistema de Estadísticas del Personaje

Guía de referencia del sistema de stats, puntos, escalado y regeneración.

## Archivos clave

```
src/app/services/character-stats.service.ts  ← cálculos, observables, BaseStats
src/app/services/regen.service.ts            ← timer HP/MP regen
src/app/services/player-bridge.service.ts    ← healPlayer() — única forma correcta de curar HP
src/app/components/equipment/               ← UI: pestaña Stats (tab 1) y Resumen (tab 2)
src/app/services/save.service.ts            ← persiste baseStats en GameSnapshot
```

## BaseStats

```typescript
interface BaseStats { STR: number; DEX: number; CONST: number; INT: number; MAG: number; CHR: number; }
```

- Todos los stats arrancan en **0** (nunca bajan de 0).
- Se persisten en `GameSnapshot.baseStats` y se restauran con `charStats.restoreStats(stats)`.
- `charStats.resetStats()` los devuelve todos a 0 (usado por "Borrar todo" en ajustes y por personaje nuevo / save sin `baseStats`).

## Puntos de stat

```
Disponibles = (nivel − 1) × POINTS_PER_LEVEL   // 0 al nivel 1, +1 por nivel
Gastados    = sum(STR + DEX + CONST + INT + MAG + CHR)
Libres      = Disponibles − Gastados
```

- `charStats.freePoints$` — observable reactivo (combina `statsChanged$` + `playerState.state$`)
- `charStats.freePoints` — getter síncrono
- `charStats.increment(key)` — falla silenciosamente si `freePoints <= 0`
- `charStats.decrement(key)` — no baja de 0
- En la UI: `*ngIf="{ pts: freePoints$ | async } as vm"` — envolver en objeto para evitar que `0` se trate como falsy

## Escalado de stats → derivados

| Stat | Derivado | Fórmula | Observable |
|------|----------|---------|------------|
| STR | Daño físico | `(10 + STR + equipo plano + talentos) × (1 + Σ damagePercent/100)` | `damage$` |
| INT | Daño mágico | base = 10 + INT; + equipo `magicDamage` + talentos | `magicDamage$` |
| CONST | HP máx | 50 + CONST × 10 + equipo + talentos | `hp$` |
| MAG | MP máx | 50 + MAG × 5 + equipo + talentos | `mp$` |
| DEX | Defensa | `floor(DEX/10)` + equipo + talentos + buffs | `defense$` |
| DEX | Evasión % | misma fórmula DEX + equipo `evasion` + buffs | `evasion$` |
| base 10% | Prob. crítico | + equipo `critChance` + talentos + buffs | `critChance$` |
| base 150% | Daño crítico % | + `floor(STR/5)` + equipo + buffs | `critDamage$` |
| CONST | HP regen max | = CONST + equipo `hpRegen` + talentos; min = floor(max/2) | `hpRegen$` |
| MAG | MP regen max | = MAG + equipo `mpRegen` + talentos; min = floor(max/2) | `mpRegen$` |

## Fuentes de verdad HP vs MP — CRÍTICO

| Dato | Fuente de verdad | Cómo actualizar |
|------|-----------------|-----------------|
| HP barra UI | `playerBridge.player.status$` (Phaser sprite) | `playerBridge.healPlayer(amount)` o `player.resetStatus(hp, hpMax)` |
| HP numérico guardado | `playerState.snapshot().hp` | se sincroniza automáticamente desde `healPlayer()` y `setAttackToPlayer()` |
| MP barra UI | `playerState.state$` | `playerState.setMp(newMp, mpMax)` |

**Nunca** llamar a `playerState.setHp()` directamente para curar — la barra de HP no se actualizará.
Usar siempre `playerBridge.healPlayer(amount)`.

## Regeneración (RegenService)

- Intervalo: **10 segundos**
- HP: roll aleatorio entre `floor(max/2)` y `max` donde `max = CONST + equipo + talentos`
- MP: igual con `MAG`
- Solo aplica si HP/MP están por debajo del máximo
- HP → `playerBridge.healPlayer(gainedHp)` (actualiza Phaser + playerState)
- MP → `playerState.setMp(state.mp + gainedMp, state.mpMax)`
- Emite `regenTick$: Subject<{hp, mp}>` → `GameLogComponent` muestra notificación
- `start()` en `LayoutComponent.ngOnInit`, `stop()` en `ngOnDestroy`

## Cómo añadir un nuevo stat derivado

1. Añadir interface `XBreakdown` en `character-stats.service.ts`
2. Añadir `readonly x$: Observable<XBreakdown>` y getter `get currentX()`
3. Añadir `_calcX()` usando el patrón existente (equipment slots + talent bonus + buffs)
4. Suscribir en el constructor al `trigger$` apropiado
5. Exponer en `equipment.component.ts` con `readonly x$ = this.charStats.x$`
6. Añadir acordeón en tab Resumen del `equipment.component.html`
7. Si afecta a combat: leer en `GameScene` vía `this.reg.charStats?.currentX`

## Notas

- `defTrigger$` = `merge(trigger$, buff.buffs$)` — usar para stats que también dependen de buffs activos
- `trigger$` = `merge(equipment.changes$, statsChanged$, talent.changes$).pipe(startWith(null))`
- El `trigger$` también dispara `syncHpMax()` y `syncMpMax()` para mantener hpMax/mpMax en playerState actualizados
