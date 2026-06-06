# Sistema de Talentos

Guía para añadir nodos nuevos a un árbol existente o crear un árbol de talentos completamente nuevo.

## Arquitectura del sistema

```
src/app/services/talent.service.ts          ← datos: nodos, esferas, lógica
src/app/components/equipment/
  equipment.component.ts                    ← UI: tab activa, getter/setter, métodos picker
  equipment.component.html                  ← árbol SVG + nodos + picker flotante
  equipment.component.scss                  ← estilos .tnode, .talent-tree, .talent-picker-flyout
src/app/services/character-stats.service.ts ← aplica talentBonus.atk y talentBonus.hp
src/app/services/save.service.ts            ← persiste TalentSnapshot en GameSnapshot
```

### Tipos clave en `talent.service.ts`

```typescript
export type SphereType = 'common' | 'normal' | 'rare' | 'epic' | 'legendary';
// Multiplicadores de poder: 1× / 2× / 4× / 8× / 16×

export interface TalentEffect {
  type:     'atk' | 'hp' | 'ability';
  base:     number;       // valor con esfera common (×1)
  ability?: string;       // solo si type === 'ability' (ej: 'area_attack')
}

export interface TalentNodeConfig {
  id:       string;       // único, sin espacios
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
- SVG width: `220px` fijo. SVG height: `rows_total × 64` px
- Centro de nodo `(col, row)` en SVG: `x = col*44+22`, `y = row*64+21`
- Las líneas SVG se generan automáticamente desde `node.requires`

### Efectos disponibles

| type | Qué hace | Suma a |
|------|----------|--------|
| `'atk'` | `base × mult` puntos de ataque | `CharacterStatsService.damage$` |
| `'hp'`  | `base × mult` puntos de vida máx | `CharacterStatsService.hp$` |
| `'ability'` | Desbloquea habilidad (+ `base × mult` ATK) | `talent.getBonus().abilities[]` |

Para type `'ability'`, el campo `ability` define la clave que se puede leer desde `PlayerBridgeService` o `GameScene` en el futuro (ej: `'area_attack'`, `'ranged_attack'`).

---

## Flujo A — Añadir nodo al árbol existente

### Paso 1 — Recoger datos del nodo

Pregunta en un solo mensaje:
- **ID** del nodo (único, sin espacios, ej: `critico_mortal`)
- **Label** para mostrar (puede ser dos líneas con `\n`, máx ~10 chars/línea)
- **Icono** ion-icon (ej: `skull-outline`)
- **Posición** en la cuadrícula: col (0–4) y row
- **Requiere**: IDs de nodos padre (vacío = nodo raíz)
- **Efecto**: tipo (`atk`, `hp` o `ability`), valor base con esfera común, y si es ability su clave

### Paso 2 — Verificar posición libre

Lee `TALENT_NODES` en `talent.service.ts` y confirma que no hay otro nodo en `(col, row)`.  
Avisa si la posición está ocupada y pide una alternativa.

### Paso 3 — Implementar

**`src/app/services/talent.service.ts`**:
- Añade la entrada a `TALENT_NODES[]`
- Asegúrate de que los `requires` apunten a IDs existentes

Si el árbol tiene más de 4 filas, actualiza en `equipment.component.html` el `height` del SVG y del `.talent-tree`:
- `height = total_rows × 64` px

No hay que tocar `SaveService` ni `CharacterStatsService`: el sistema los aplica automáticamente.

---

## Flujo B — Crear árbol de talentos nuevo

Un árbol nuevo vive como un **conjunto separado de nodos** dentro del mismo tab de Talentos, accesible mediante sub-tabs (igual que Slimes / Miscelánea en el summon).

### Paso 1 — Nombre e intención

Pregunta:
- **Nombre del árbol** (ej: `Magia`, `Sigilo`, `Combate`)
- **Descripción breve** de su temática
- **Nodos iniciales** (puede pedir que los proponga el asistente basándose en la temática)

### Paso 2 — Diseño de nodos

Para cada nodo recoge:
- ID, label, icon, col, row, requires, effect (igual que Flujo A — Paso 1)

El árbol nuevo puede tener su propia cuadrícula de 5 columnas. Las filas empiezan en 0 para cada árbol independientemente.

### Paso 3 — Implementar en `talent.service.ts`

Añade una **constante de exportación separada** para el nuevo árbol:

```typescript
export const TALENT_NODES_MAGIA: TalentNodeConfig[] = [
  { id: 'magia_base', label: 'Magia\nBase', icon: 'sparkles-outline', col: 2, row: 0, requires: [], effect: { type: 'atk', base: 4 } },
  // ... más nodos
];
```

Añade los IDs de los nuevos nodos al constructor de `TalentService`:

```typescript
constructor() {
  for (const n of [...TALENT_NODES, ...TALENT_NODES_MAGIA]) this.slotted[n.id] = null;
}
```

Y actualiza todos los métodos que iteran sobre `this.nodes` para incluir el nuevo array. La forma más limpia es hacer que `this.nodes` sea la unión de todos los arrays:

```typescript
readonly nodes = [...TALENT_NODES, ...TALENT_NODES_MAGIA];
```

> IMPORTANTE: `getBonus()`, `isUnlocked()`, `hasDependents()`, `getSnapshot()`, `restoreFromSnapshot()` ya usan `this.nodes` — no necesitan cambios si se actualiza `this.nodes`.

### Paso 4 — Sub-tabs en el componente

**`equipment.component.ts`**:

```typescript
import { TALENT_NODES, TALENT_NODES_MAGIA } from 'src/app/services/talent.service';

readonly talentTrees = [
  { label: 'Combate', nodes: TALENT_NODES        },
  { label: 'Magia',   nodes: TALENT_NODES_MAGIA  },
];
activeTalentTree = 0;
```

Cuando cambia `activeTalentTree`, cierra el picker: `this.selectedNodeId = null`.

**`equipment.component.html`** — dentro de `.talent-panel`, antes del árbol:

```html
<div class="talent-tree-tabs">
  <button *ngFor="let tree of talentTrees; let i = index"
          class="talent-tree-tab"
          [class.active]="i === activeTalentTree"
          (click)="activeTalentTree = i; selectedNodeId = null">
    {{ tree.label }}
  </button>
</div>
```

El árbol y el getter `treeLines` deben filtrar por `talentTrees[activeTalentTree].nodes`:

```typescript
get activeTreeNodes() { return this.talentTrees[this.activeTalentTree].nodes; }

get treeLines() {
  const nodes = this.activeTreeNodes;
  // ... usa nodes en vez de this.talent.nodes
}
```

Y en el `*ngFor` del HTML: `*ngFor="let node of activeTreeNodes"`.

**`equipment.component.scss`** — añade:

```scss
.talent-tree-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
}
.talent-tree-tab {
  flex: 1;
  padding: 4px;
  border: 1px solid #444;
  border-radius: 4px;
  font-size: 0.65em;
  text-align: center;
  cursor: pointer;
  color: #888;
  background: #1a1a2e;
  &.active { background: #3498db; border-color: #3498db; color: #fff; }
}
```

### Paso 5 — Actualizar SVG height si el nuevo árbol tiene más filas

Lee cuántas filas tiene el árbol más alto y ajusta el `height` del SVG y `.talent-tree` en el HTML/SCSS.

---

## Notas generales

- **Nunca usar posiciones duplicadas** `(col, row)` dentro del mismo árbol.
- **`requires: []`** → nodo raíz, siempre desbloqueable.
- **Esferas** son compartidas entre todos los árboles. El inventario inicial es 10 de cada tipo.
- Las esferas se guardan y restauran automáticamente via `SaveService` (campo `talents` en `GameSnapshot`).
- **CharacterStatsService** suma `talent.getBonus().atk` y `.hp` a todos los breakdowns automáticamente — no necesita cambios al añadir nodos.
- Los bonos de `type: 'ability'` solo suman ATK; la implementación de la mecánica en GameScene es trabajo aparte.
- Para eliminar un nodo: quitar de `TALENT_NODES` (o del array correspondiente). Si tenía esferas guardadas en snapshots viejos, serán ignoradas silenciosamente por `restoreFromSnapshot()`.
