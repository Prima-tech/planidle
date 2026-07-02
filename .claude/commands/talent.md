# Sistema de Talentos

Guía para añadir nodos nuevos a un árbol existente o crear un árbol de talentos completamente nuevo.

## Arquitectura del sistema

```
src/app/services/talent.service.ts          ← datos: nodos, esferas, lógica
src/app/components/equipment/
  equipment.component.ts                    ← UI: tab activa, getter/setter, métodos picker
  equipment.component.html                  ← árbol SVG + nodos + picker flotante
  equipment.component.scss                  ← estilos .tnode, .talent-tree, .talent-picker-flyout
src/app/services/character-stats.service.ts ← aplica talentBonus a todos los derivados
src/app/services/save.service.ts            ← persiste TalentSnapshot en GameSnapshot
```

### Tipos clave en `talent.service.ts`

```typescript
export type SphereType = 'normal' | 'rare' | 'epic';
// Multiplicadores: sin gema ×1 (solo desbloqueado) · normal ×2 · rare ×3 · epic ×5

export interface TalentEffect {
  type:     'atk' | 'magicAtk' | 'hp' | 'mp' | 'defense' | 'evasion' | 'critChance'
          | 'hpRegen' | 'mpRegen' | 'dropRate' | 'miningEfficiency' | 'miningDrop'
          | 'attackSpeed' | 'exploration' | 'alchemy' | 'ability';
  base:     number;       // valor sin gema (×1)
  ability?: string;       // solo si type === 'ability' (clave de SKILL_REGISTRY)
  school?:  'physical' | 'magic';  // ability: a qué daño suma su base (default magic)
}

export interface TalentNodeConfig {
  id:       string;       // único global entre todos los árboles, sin espacios
  label:    string;       // puede tener '\n' para salto de línea en tooltip
  icon:     string;       // nombre de ion-icon (ej: 'flash-outline')
  col:      number;       // columna 0–4 (5 columnas, 44px cada una)
  row:      number;       // fila 0–N (64px cada una)
  requires: string[];     // IDs de nodos que deben tener esfera para desbloquear este
  effect:   TalentEffect;
}
```

### Coordenadas del árbol

- Cuadrícula: **5 columnas × N filas**, celdas de **44 × 64 px**
- SVG width: `220px` fijo. SVG height: calculado automáticamente por `treeHeight` getter
- Centro de nodo `(col, row)` en SVG: `x = col*44+22`, `y = row*64+21`
- Las líneas SVG se generan automáticamente desde `node.requires`

### Efectos disponibles

| type | Qué hace | Suma a |
|------|----------|--------|
| `'atk'` | `base × mult` puntos de ataque físico | `CharacterStatsService.damage$` via `talent.getBonus().atk` |
| `'hp'` | `base × mult` puntos de vida máx | `CharacterStatsService.hp$` via `talent.getBonus().hp` |
| `'mp'` | `base × mult` puntos de maná máx | `CharacterStatsService.mp$` via `talent.getBonus().mp` |
| `'defense'` | `base × mult` puntos de defensa plana | `CharacterStatsService.defense$` via `talent.getBonus().defense` |
| `'critChance'` | `base × mult` % probabilidad crítico | `CharacterStatsService.critChance$` via `talent.getBonus().critChance` |
| `'hpRegen'` | `base × mult` puntos extra de HP regen max | `RegenService` via `talent.getBonus().hpRegen` |
| `'mpRegen'` | `base × mult` puntos extra de MP regen max | `RegenService` via `talent.getBonus().mpRegen` |
| `'magicAtk'` | `base × mult` puntos de daño mágico | `magicDamage$` |
| `'evasion'` | `base × mult` % de evasión | `evasion$` |
| `'dropRate'` | `base × mult` % de tasa de botín | `dropRate$` |
| `'miningEfficiency'` / `'miningDrop'` | minería (eficiencia % / botín extra ×) | menas en gamescene |
| `'attackSpeed'` | `base × mult` % velocidad de ataque básico | `attackSpeed$` (cap +100 global) |
| `'exploration'` | `base × mult` % de metros en expediciones AFK del Modo Mundo | `offline-gains.calculateExploring` |
| `'alchemy'` | `base × mult` % creación de pociones — **efecto pendiente de implementar** | solo suma en getBonus() |
| `'ability'` | Desbloquea habilidad (+ `base × mult` a su `school`: physical→ATK, magic→M.ATK) | `talent.getBonus().abilities[]` |

**Estructura del árbol principal (`TALENT_NODES`)**: hub `c0` en (10,5) con 6 ramas temáticas de 5 nodos + 2 sub-ramas de 3 desde el nodo 2: STR (dcha: atk/crit + sub minería), VIT (abajo-dcha: hp/def/regen), CHR (abajo-izq: dropRate + sub exploración), INT (izq: magicAtk + sub alquimia), MAG (arriba-izq: mp/regen), DEX (arriba-dcha: evasión/attackSpeed). Nodos grandes = habilidades (máx 2 por rama); pequeños (`small: true` o filler) = atributos. Al añadir tipos nuevos: actualizar también `effectLabel()` en `equipment.component.ts` y `getBonus()`.

### `getBonus()` — retorno actual

```typescript
getBonus(): {
  atk: number;
  hp: number;
  mp: number;
  defense: number;
  critChance: number;
  hpRegen: number;
  mpRegen: number;
  abilities: string[];
}
```

### Breakdowns en `CharacterStatsService`

```typescript
interface DamageBreakdown      { base: number; equipment: number; talents: number; total: number; }
interface MagicDamageBreakdown { base: number; equipment: number; talents: number; total: number; }
interface HpBreakdown          { base: number; equipment: number; talents: number; total: number; }
interface MpBreakdown          { base: number; equipment: number; talents: number; total: number; }
interface DefenseBreakdown     { dex: number; equipment: number; talents: number; buffs: number; total: number; }
interface EvasionBreakdown     { dex: number; equipment: number; buffs: number; total: number; }
interface CritChanceBreakdown  { base: number; equipment: number; talents: number; buffs: number; total: number; }
interface CritDamageBreakdown  { base: number; str: number; equipment: number; buffs: number; total: number; }
interface RegenBreakdown       { base: number; equipment: number; talents: number; total: number; min: number; }
```

---

## Flujo A — Añadir nodo al árbol existente

### Paso 1 — Recoger datos del nodo

Pregunta en un solo mensaje:
- **ID** del nodo (único global, sin espacios, ej: `critico_mortal`)
- **Label** para mostrar (puede ser dos líneas con `\n`, máx ~10 chars/línea)
- **Icono** ion-icon (ej: `skull-outline`)
- **Posición** en la cuadrícula: col (0–4) y row
- **Requiere**: IDs de nodos padre (vacío = nodo raíz)
- **Efecto**: tipo (ver tabla arriba), valor base con esfera común, y si es ability su clave

### Paso 2 — Verificar posición libre

Lee el array correspondiente en `talent.service.ts` y confirma que no hay otro nodo en `(col, row)`.
Avisa si la posición está ocupada y pide una alternativa.

### Paso 3 — Implementar

**`src/app/services/talent.service.ts`**:
- Añade la entrada al array del árbol correspondiente (`TALENT_NODES`, `TALENT_NODES_MAGIA`, etc.)
- Asegúrate de que los `requires` apunten a IDs existentes

**No hay que tocar `SaveService`** ni `CharacterStatsService`: el sistema los aplica automáticamente vía `getBonus()`.

---

## Flujo B — Crear árbol de talentos nuevo

Un árbol nuevo vive como un **conjunto separado de nodos** dentro del mismo tab de Talentos, accesible mediante sub-tabs.

### Paso 1 — Nombre e intención

Pregunta: nombre del árbol, temática, nodos iniciales.

### Paso 2 — Implementar en `talent.service.ts`

Añade una **constante de exportación separada**:

```typescript
export const TALENT_NODES_NUEVO: TalentNodeConfig[] = [
  { id: 'nodo_raiz', label: 'Nodo\nRaíz', icon: 'star-outline', col: 2, row: 0, requires: [], effect: { type: 'atk', base: 4 } },
];
```

Añade los IDs al constructor e incluye el array en `this.nodes`:

```typescript
readonly nodes = [...TALENT_NODES, ...TALENT_NODES_MAGIA, ...TALENT_NODES_NUEVO];
```

### Paso 3 — Sub-tabs en `equipment.component.ts`

```typescript
import { TALENT_NODES_NUEVO } from 'src/app/services/talent.service';

readonly talentTrees = [
  { label: 'Combate', icon: 'shield-half-outline', nodes: TALENT_NODES       },
  { label: 'Magia',   icon: 'sparkles-outline',    nodes: TALENT_NODES_MAGIA },
  { label: 'Nuevo',   icon: 'star-outline',         nodes: TALENT_NODES_NUEVO },
  { label: 'Skills',  icon: 'rocket-outline',       nodes: []                 },
];
```

---

## Notas generales

- **Nunca usar posiciones duplicadas** `(col, row)` dentro del mismo árbol.
- **`requires: []`** → nodo raíz, siempre desbloqueable.
- **Esferas** son compartidas entre todos los árboles.
- `type: 'ability'` también suma `base × mult` a ATK; la mecánica real en GameScene es trabajo aparte.
- Para eliminar un nodo: quitar del array. Las esferas guardadas en snapshots viejos se ignoran silenciosamente.
- El nodo `nodeEffectLabel()` en `equipment.component.ts` muestra el label del picker — actualizar si se añaden tipos nuevos.
