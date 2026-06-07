# Sistema de Talentos

Guía para añadir nodos nuevos a un árbol existente o crear un árbol de talentos completamente nuevo.

## Arquitectura del sistema

```
src/app/services/talent.service.ts          ← datos: nodos, esferas, lógica
src/app/components/equipment/
  equipment.component.ts                    ← UI: tab activa, getter/setter, métodos picker
  equipment.component.html                  ← árbol SVG + nodos + picker flotante
  equipment.component.scss                  ← estilos .tnode, .talent-tree, .talent-picker-flyout
src/app/services/character-stats.service.ts ← aplica talentBonus a damage$, hp$, mp$, defense$
src/app/services/save.service.ts            ← persiste TalentSnapshot en GameSnapshot
```

### Tipos clave en `talent.service.ts`

```typescript
export type SphereType = 'common' | 'normal' | 'rare' | 'epic' | 'legendary';
// Multiplicadores de poder: 1× / 2× / 4× / 8× / 16×

export interface TalentEffect {
  type:     'atk' | 'hp' | 'mp' | 'defense' | 'ability';
  base:     number;       // valor con esfera common (×1)
  ability?: string;       // solo si type === 'ability' (ej: 'area_attack')
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

| type | Qué hace | Suma a | Cómo se aplica |
|------|----------|--------|----------------|
| `'atk'` | `base × mult` puntos de ataque | `CharacterStatsService.damage$` | `_calcDamage()` usa `talent.getBonus().atk` |
| `'hp'` | `base × mult` puntos de vida máx | `CharacterStatsService.hp$` | `_calcHp()` usa `talent.getBonus().hp` |
| `'mp'` | `base × mult` puntos de maná máx | `CharacterStatsService.mp$` | `_calcMp()` usa `talent.getBonus().mp` |
| `'defense'` | `base × mult` puntos de defensa | `CharacterStatsService.defense$` | `_calcDefense()` usa `talent.getBonus().defense` |
| `'ability'` | Desbloquea habilidad (+ `base × mult` ATK) | `talent.getBonus().abilities[]` | La clave se lee desde GameScene |

La defensa resta daño directo por ataque de enemigo en `GameScene.initEnemyAttackListener()`.

### `getBonus()` — retorno actual

```typescript
getBonus(): { atk: number; hp: number; mp: number; defense: number; abilities: string[] }
```

### Breakdowns en `CharacterStatsService`

```typescript
interface DefenseBreakdown { dex: number; equipment: number; talents: number; buffs: number; total: number; }
interface DamageBreakdown  { base: number; equipment: number; talents: number; total: number; }
interface HpBreakdown      { base: number; equipment: number; talents: number; total: number; }
interface MpBreakdown      { base: number; equipment: number; talents: number; total: number; }
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
- **Efecto**: tipo (`atk`, `hp`, `mp`, `defense` o `ability`), valor base con esfera común, y si es ability su clave

### Paso 2 — Verificar posición libre

Lee `TALENT_NODES` (o el array correspondiente) en `talent.service.ts` y confirma que no hay otro nodo en `(col, row)`.
Avisa si la posición está ocupada y pide una alternativa.

### Paso 3 — Implementar

**`src/app/services/talent.service.ts`**:
- Añade la entrada al array del árbol correspondiente (`TALENT_NODES`, `TALENT_NODES_MAGIA`, etc.)
- Asegúrate de que los `requires` apunten a IDs existentes

**No hay que tocar `SaveService`**: el sistema lo persiste automáticamente.

**`CharacterStatsService` solo necesita cambios si se añade un tipo de efecto nuevo** (distinto a los 5 ya existentes). Para tipos ya soportados (`atk`, `hp`, `mp`, `defense`, `ability`), todo se aplica solo.

---

## Flujo B — Crear árbol de talentos nuevo

Un árbol nuevo vive como un **conjunto separado de nodos** dentro del mismo tab de Talentos, accesible mediante sub-tabs.

### Paso 1 — Nombre e intención

Pregunta:
- **Nombre del árbol** (ej: `Magia`, `Sigilo`, `Combate`)
- **Descripción breve** de su temática
- **Nodos iniciales** (puede pedir que los proponga el asistente basándose en la temática)

### Paso 2 — Diseño de nodos

Para cada nodo recoge:
- ID, label, icon, col, row, requires, effect (igual que Flujo A — Paso 1)

El árbol nuevo tiene su propia cuadrícula de 5 columnas. Las filas empiezan en 0 independientemente.

### Paso 3 — Implementar en `talent.service.ts`

Añade una **constante de exportación separada** para el nuevo árbol:

```typescript
export const TALENT_NODES_NUEVO: TalentNodeConfig[] = [
  { id: 'nodo_raiz', label: 'Nodo\nRaíz', icon: 'flash-outline', col: 2, row: 0, requires: [], effect: { type: 'atk', base: 4 } },
  // ... más nodos
];
```

Incluye el nuevo array en `ALL_NODES`:

```typescript
const ALL_NODES = [...TALENT_NODES, ...TALENT_NODES_MAGIA, ...TALENT_NODES_NUEVO, /* resto */];
```

> `getBonus()`, `isUnlocked()`, `hasDependents()`, `getSnapshot()`, `restoreFromSnapshot()` usan `this.nodes = ALL_NODES` — no necesitan cambios.

### Paso 4 — Sub-tab en el componente

**`equipment.component.ts`** — añade entrada a `talentTrees`:

```typescript
import { TALENT_NODES_NUEVO } from 'src/app/services/talent.service';

readonly talentTrees = [
  { label: 'Combate', icon: 'shield-half-outline',  nodes: TALENT_NODES       },
  { label: 'Magia',   icon: 'sparkles-outline',     nodes: TALENT_NODES_MAGIA },
  { label: 'NombreNuevo', icon: 'el-icono',         nodes: TALENT_NODES_NUEVO },
  { label: 'Skills',  icon: 'rocket-outline',       nodes: []                 },
];
```

El HTML y la lógica de sub-tabs ya iteran sobre `talentTrees` dinámicamente — no necesitan cambios.

---

## Notas generales

- **IDs únicos globales**: no puede haber dos nodos con el mismo ID en ningún árbol.
- **Nunca usar posiciones duplicadas** `(col, row)` dentro del mismo árbol.
- **`requires: []`** → nodo raíz, siempre desbloqueable.
- **Esferas** son compartidas entre todos los árboles. El inventario inicial es 10 de cada tipo.
- Las esferas se guardan y restauran automáticamente via `SaveService` (campo `talents` en `GameSnapshot`).
- La barra de bonos activos en el UI (`talent-bonus-bar`) muestra ATK, HP, MP y DEF cuando son > 0.
- Para eliminar un nodo: quitar del array correspondiente. Esferas guardadas en snapshots viejos son ignoradas silenciosamente por `restoreFromSnapshot()`.
