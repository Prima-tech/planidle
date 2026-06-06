# new-skill — Añadir una nueva habilidad activable

Guía para crear una habilidad de combate: efecto visual Phaser + entrada en el sistema de skills.

---

## Cómo funciona el sistema (contexto)

- **`SKILL_REGISTRY`** (`skill-config.ts`) — parámetros visuales y de gameplay: rango, cooldown, sprite, tipo de efecto, escala, icono.
- **Nodo de talento** (`talent.service.ts`) — fuente de verdad del **daño** (`effect.base × sphereMult`). El campo `damage` en `SKILL_REGISTRY` es `0` y no se usa.
- **`SkillActivationService`** — bridge Angular↔Phaser. Gestiona cooldown, disponibilidad de target y emite `activate$({ abilityId, damage })`.
- **Footer** — en modo bloqueado (uso), pulsar un slot llama a `request(abilityId, damage)`. Muestra: icono PNG o ion-icon, barrido de cooldown tipo reloj, segundos restantes, flash al activar, opacidad reducida si no hay enemigo en rango.
- **GameScene** — escucha `activate$`, busca el enemigo más cercano en rango y ejecuta `playImpact` o `launchProjectile`. Timer a 500ms actualiza disponibilidad de target para el visual del botón.
- **Panel de equipar** — muestra **todas** las habilidades de tipo `ability` definidas en talent.service.ts, sin importar si están desbloqueadas o tienen esfera equipada.

### Árboles de nodos en talent.service.ts

| Constante | Uso |
|---|---|
| `TALENT_NODES` | Árbol de Combate — nodos con dependencias entre sí |
| `TALENT_NODES_MAGIA` | Árbol de Magia — nodos con dependencias entre sí |
| `TALENT_NODES_FIRE` | Habilidades de fuego — `requires: []`, siempre disponibles |

Para habilidades standalone (sin dependencias en el árbol), añadir a `TALENT_NODES_FIRE` o crear un nuevo array del mismo estilo y añadirlo a `ALL_NODES`.

### Precarga de sprites en gamescene.ts

Los sprites se cargan desde el array `SKILL_SPRITE_SOURCES` definido al inicio del archivo:

```typescript
const SKILL_SPRITE_SOURCES: { key: string; path: string; count: number }[] = [
  { key: 'skill_fire', path: 'assets/sprites/skills/fire/Fire/fire_', count: 6 },
  // ... una línea por skill
];
```

El loop en `preload()` itera este array automáticamente. **Añadir una nueva skill solo requiere una línea aquí.**

### Atención: nombres de archivo irregulares

Al explorar sprites, verificar siempre el nombre exacto del primer archivo — algunos packs no siguen la convención `nombre_N.png`:

- `Fire_hurracane` → `Fire_hurracane1.png` (sin guion bajo antes del número)
- `Lava_paddle` → `lava_padlle_1.png` (typo "padlle")
- `Small_fire` → usa `phoenix_1.png` como nombre de archivo (mismo prefijo que Phoenix)

Si el nombre de archivo no sigue el patrón `{nombre}_{N}.png`, el `path` en `SKILL_SPRITE_SOURCES` debe reflejar el prefijo exacto real.

---

## Instrucciones

Sigue los pasos en orden. No implementes hasta tener todos los datos.

---

### Paso 1 — Ability ID y sprites

Pregunta: "¿Cuál es el ID interno de la habilidad? (ej: `fireball`, `lightning_bolt`) — debe ser único y sin espacios"

Guarda como `{abilityId}`.

Luego **explora** `src/assets/sprites/skills/` y reporta:
- Carpetas disponibles
- Nombre exacto del primer y último frame de la carpeta elegida
- Número total de frames

> ⚠️ Verificar siempre el nombre real del archivo — puede no seguir la convención estándar.

---

### Paso 2 — Tipo de efecto

Pregunta: "¿Cómo se muestra el efecto?"

- **`impact`** — sprite aparece sobre el enemigo y desaparece tras un ciclo
- **`projectile`** — sprite viaja desde el jugador hasta el enemigo

Guarda como `{effectType}`. Si es `projectile`, pregunta también **velocidad en px/s** (referencia: 350–400).

---

### Paso 3 — Stats de gameplay

Pregunta en un solo mensaje:
- Radio en tiles (referencia: 3–4 para impacto, 5–6 para proyectil)
- Cooldown en ms (referencia: 1000–5000)
- Escala visual del sprite (referencia: 1.5–3)

> El daño viene del nodo de talento, no de aquí.

---

### Paso 4 — Icono del botón

Pregunta: "¿Hay un PNG de icono en `src/assets/sprites/skills/icons/`?"

- Si **sí**: `iconPath: 'assets/sprites/skills/icons/{nombre}.png'` — ocupa todo el botón.
- Si **no**: se usará el ion-icon del nodo de talento como fallback.

---

### Paso 5 — Nodo de Talento

Pregunta: "¿Esta habilidad ya tiene un nodo en el árbol, o necesita uno nuevo?"

Lee `src/app/services/talent.service.ts` para ver los nodos existentes.

- Si **ya existe**: confirma que tiene `effect: { type: 'ability', ability: '{abilityId}' }`.
- Si **es nuevo**: pregunta label, ¿con dependencias en el árbol o standalone?, daño base, y si tiene dependencias: posición (col, row) y nodo padre.
  - **Standalone** → añadir a `TALENT_NODES_FIRE` con `requires: []`
  - **Con dependencias** → añadir a `TALENT_NODES` o `TALENT_NODES_MAGIA`

---

### Paso 6 — Implementación

Con todos los datos, implementa en este orden:

#### 6a — `src/app/services/skill-config.ts`

Añadir entrada a `SKILL_REGISTRY`:

```typescript
{abilityId}: {
  abilityId: '{abilityId}',
  effectType: '{effectType}',
  damage: 0,
  range: {range},
  cooldown: {cooldown},
  spriteKey: 'skill_{abilityId}',
  frameCount: {frameCount},
  frameRate: {frameRate},
  scale: {scale},
  iconPath: '{iconPath}',  // omitir si no hay PNG
  // speed: {speed},       // solo si projectile
},
```

#### 6b — `src/app/scenes/gamescene/gamescene.ts`

Añadir una línea al array `SKILL_SPRITE_SOURCES` (al inicio del archivo, antes de la clase):

```typescript
{ key: 'skill_{abilityId}', path: '{ruta_exacta_del_prefijo}', count: {frameCount} },
```

> Usar el prefijo exacto del archivo, incluyendo cualquier irregularidad de nombre.

**No tocar:**
- `registerSkillAnimations()` — itera `SKILL_REGISTRY` automáticamente.
- `executeSkill()` — enruta por `effectType` automáticamente.
- `initSkillTargetChecker()` — cubre todas las skills automáticamente.
- El loop de `preload()` — itera `SKILL_SPRITE_SOURCES` automáticamente.

#### 6c — `src/app/services/talent.service.ts`

Si es standalone, añadir a `TALENT_NODES_FIRE`:

```typescript
{
  id: '{abilityId}', label: '{label}', icon: '{ion-icon-name}',
  col: {col}, row: {row}, requires: [],
  effect: { type: 'ability', base: {daño_base}, ability: '{abilityId}' },
},
```

Si tiene dependencias, añadir al árbol correspondiente con `requires: ['{nodo_padre}']`.

---

### Checklist final

- [ ] Entrada en `SKILL_REGISTRY` con todos los campos
- [ ] Línea en `SKILL_SPRITE_SOURCES` con el prefijo de ruta exacto (verificar nombre real del archivo)
- [ ] Nodo de talento con `effect.ability === '{abilityId}'`
- [ ] PNGs en `src/assets/sprites/skills/{carpeta}/`
- [ ] Icono PNG en `src/assets/sprites/skills/icons/` (si aplica)
- [ ] Si `projectile`: campo `speed` presente
