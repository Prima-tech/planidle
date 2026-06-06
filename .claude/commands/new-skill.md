# new-skill — Añadir una nueva habilidad activable

Guía para crear una habilidad de combate: efecto visual Phaser + entrada en el sistema de skills.

## Instrucciones

Sigue los pasos en orden. No implementes hasta tener todos los datos.

---

### Paso 1 — Ability ID

Pregunta: "¿Cuál es el ID interno de la habilidad? (ej: `ranged_attack`, `fireball`, `lightning_bolt`) — debe ser único y sin espacios"

Guarda como `{abilityId}`.

Luego **explora** `src/assets/sprites/skills/` para ver qué carpetas/archivos de sprites existen e informa al usuario.

---

### Paso 2 — Tipo de efecto

Pregunta: "¿Cómo se muestra el efecto?"

- **`impact`** — el sprite aparece directamente sobre el enemigo y desaparece tras un ciclo (ej: explosión, descarga, llamarada)
- **`projectile`** — el sprite viaja desde el jugador hasta el enemigo (ej: bola de fuego, flecha mágica, rayo)

Guarda como `{effectType}`.

Si es `projectile`, pregunta también la **velocidad en px/s** (referencia: `ranged_attack` = 400).

---

### Paso 3 — Stats

Pregunta en un solo mensaje:
- Daño base
- Radio en tiles (referencia: `ranged_attack` = 4)
- Cooldown en ms (referencia: `ranged_attack` = 1500)
- Escala visual del sprite (referencia: `ranged_attack` = 2)

---

### Paso 4 — Sprites

Pregunta:
- ¿Qué carpeta/archivo de sprites usa? (ej: `skills/fire/Fire/fire_` + frames numerados)
- ¿Cuántos frames tiene la animación?
- ¿A qué velocidad se reproduce (frameRate)? (referencia: `ranged_attack` = 12)
- ¿Los frames son PNGs individuales numerados (`fire_1.png`, `fire_2.png`…) o un spritesheet único?

> Si son PNGs individuales: el sistema los carga como `{spriteKey}_1`, `{spriteKey}_2`…  
> Si es un spritesheet: hay que añadir lógica específica — informa al usuario.

Guarda `{spriteKey}` (ej: `skill_fire`), `{spritePath}` (ej: `assets/sprites/skills/fire/Fire/fire_`).

---

### Paso 5 — Nodo de Talento

Pregunta: "¿Esta habilidad ya tiene un nodo en el árbol de talentos, o necesita uno nuevo?"

Lee `src/app/services/talent.service.ts` para ver los nodos existentes.

- Si **ya existe**: confirma qué nodo tiene `effect.ability === '{abilityId}'`. No hay que tocar nada.
- Si **es nuevo**: pregunta nombre para el label, árbol (Combate / Magia), posición (col, row) y nodo padre (`requires`). Luego añádelo.

---

### Paso 6 — Implementación

Con todos los datos, implementa en este orden:

#### 6a — `src/app/services/skill-config.ts`

Añade una entrada a `SKILL_REGISTRY`:

```typescript
{abilityId}: {
  abilityId: '{abilityId}',
  effectType: '{effectType}',   // 'impact' | 'projectile'
  damage: {damage},
  range: {range},
  cooldown: {cooldown},
  spriteKey: '{spriteKey}',
  frameCount: {frameCount},
  frameRate: {frameRate},
  scale: {scale},
  // speed: {speed},            // solo si effectType === 'projectile'
},
```

#### 6b — `src/app/scenes/gamescene/gamescene.ts`

En `preload()`, junto al bloque de `skill_fire`, añade la carga de los nuevos frames:

```typescript
for (let i = 1; i <= {frameCount}; i++) {
  if (!this.textures.exists('{spriteKey}_' + i)) {
    this.load.image('{spriteKey}_' + i, '{spritePath}' + i + '.png');
  }
}
```

> `registerSkillAnimations()` ya itera `SKILL_REGISTRY` automáticamente — no hay que tocarlo.  
> `executeSkill()` ya enruta por `effectType` — tampoco hay que tocarlo.

#### 6c — `src/app/services/talent.service.ts` (solo si se creó nodo nuevo)

Añade el nodo al árbol correspondiente (`TALENT_NODES` o `TALENT_NODES_MAGIA`):

```typescript
{
  id: '{abilityId_nodo}', label: '{label}', icon: '{ion-icon-name}',
  col: {col}, row: {row}, requires: ['{nodo_padre}'],
  effect: { type: 'ability', base: {base}, ability: '{abilityId}' },
},
```

---

### Checklist final

- [ ] Entrada en `SKILL_REGISTRY` con todos los campos
- [ ] Sprites cargados en `preload()` con guard `textures.exists`
- [ ] Nodo de talento existente o creado apunta a `ability: '{abilityId}'`
- [ ] PNGs en la ruta correcta dentro de `src/assets/sprites/skills/`
- [ ] Si `projectile`: campo `speed` presente en el config
