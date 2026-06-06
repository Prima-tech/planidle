# new-skill — Añadir una nueva habilidad activable

Guía para crear una habilidad de combate: efecto visual Phaser + entrada en el sistema de skills.

## Cómo funciona el sistema (contexto)

- **`SKILL_REGISTRY`** (`skill-config.ts`) — fuente de verdad de parámetros visuales y de gameplay (rango, cooldown, sprite, etc.)
- **Nodo de talento** (`talent.service.ts`) — fuente de verdad del **daño** (`effect.base × sphereMult`). El daño NO viene de `SKILL_REGISTRY`.
- **`SkillActivationService`** — bridge Angular↔Phaser. Gestiona cooldown, disponibilidad de target y emite `activate$({ abilityId, damage })`.
- **Footer** — en modo bloqueado (uso), al pulsar un slot equipado llama a `request(abilityId, damage)`. Muestra: icono personalizado, barrido de cooldown, segundos restantes, efecto flash al activar, opacidad reducida si no hay enemigo en rango.
- **GameScene** — escucha `activate$`, busca el enemigo más cercano dentro del rango y ejecuta `playImpact` o `launchProjectile`. Un timer a 500ms actualiza si hay target en rango (para el estado visual del botón).

---

## Instrucciones

Sigue los pasos en orden. No implementes hasta tener todos los datos.

---

### Paso 1 — Ability ID

Pregunta: "¿Cuál es el ID interno de la habilidad? (ej: `fireball`, `lightning_bolt`) — debe ser único y sin espacios"

Guarda como `{abilityId}`.

Luego **explora** `src/assets/sprites/skills/` para ver qué carpetas/archivos existen e informa al usuario.

---

### Paso 2 — Tipo de efecto

Pregunta: "¿Cómo se muestra el efecto?"

- **`impact`** — el sprite aparece directamente sobre el enemigo y desaparece tras un ciclo (ej: explosión, llamarada)
- **`projectile`** — el sprite viaja desde el jugador hasta el enemigo (ej: bola de fuego, flecha mágica)

Guarda como `{effectType}`.

Si es `projectile`, pregunta también la **velocidad en px/s** (referencia: 400).

---

### Paso 3 — Stats de gameplay

Pregunta en un solo mensaje:
- Radio en tiles (referencia: 4). El mismo radio controla tanto el alcance de activación como el botón de "no target".
- Cooldown en ms (referencia: 1500). Se muestra como barrido de reloj en el botón.
- Escala visual del sprite del efecto (referencia: 2).

> **El daño NO se configura aquí** — viene del nodo de talento (`effect.base × multiplicador de esfera`). El campo `damage` en `SKILL_REGISTRY` es solo un fallback sin uso real.

---

### Paso 4 — Sprites del efecto

Pregunta:
- ¿Qué carpeta/archivo de sprites usa? (ej: `skills/lightning/bolt_` + frames numerados)
- ¿Cuántos frames tiene la animación?
- ¿A qué velocidad se reproduce (frameRate)? (referencia: 12)
- ¿Los frames son PNGs individuales numerados (`bolt_1.png`, `bolt_2.png`…) o un spritesheet único?

> Si son PNGs individuales: el sistema los carga como `{spriteKey}_1`, `{spriteKey}_2`…  
> Si es un spritesheet: hay que añadir lógica específica — informa al usuario.

Guarda `{spriteKey}` (ej: `skill_lightning`), `{spritePath}` (ej: `assets/sprites/skills/lightning/bolt_`).

---

### Paso 5 — Icono del botón

Pregunta: "¿Hay un PNG de icono para el botón en `src/assets/sprites/skills/icons/`?"

- Si **sí**: guarda la ruta como `{iconPath}` (ej: `assets/sprites/skills/icons/lightning.png`). El icono ocupa todo el botón del footer.
- Si **no**: se usará el ion-icon del nodo de talento como fallback.

---

### Paso 6 — Nodo de Talento

Pregunta: "¿Esta habilidad ya tiene un nodo en el árbol de talentos, o necesita uno nuevo?"

Lee `src/app/services/talent.service.ts` para ver los nodos existentes.

- Si **ya existe**: confirma que el nodo tiene `effect: { type: 'ability', ability: '{abilityId}' }`. El `effect.base` es el daño base.
- Si **es nuevo**: pregunta label, árbol (Combate / Magia), posición (col, row), nodo padre (`requires`) y daño base. Luego añádelo.

---

### Paso 7 — Implementación

Con todos los datos, implementa en este orden:

#### 7a — `src/app/services/skill-config.ts`

Añade una entrada a `SKILL_REGISTRY`:

```typescript
{abilityId}: {
  abilityId: '{abilityId}',
  effectType: '{effectType}',
  damage: 0,               // no usado — el daño viene del nodo de talento
  range: {range},
  cooldown: {cooldown},
  spriteKey: '{spriteKey}',
  frameCount: {frameCount},
  frameRate: {frameRate},
  scale: {scale},
  iconPath: '{iconPath}',  // omitir si no hay icono PNG
  // speed: {speed},       // solo si effectType === 'projectile'
},
```

#### 7b — `src/app/scenes/gamescene/gamescene.ts`

En `preload()`, junto al bloque de `skill_fire`, añade la carga de los nuevos frames:

```typescript
for (let i = 1; i <= {frameCount}; i++) {
  if (!this.textures.exists('{spriteKey}_' + i)) {
    this.load.image('{spriteKey}_' + i, '{spritePath}' + i + '.png');
  }
}
```

**No tocar:**
- `registerSkillAnimations()` — itera `SKILL_REGISTRY` automáticamente.
- `executeSkill()` — enruta por `effectType` automáticamente.
- `initSkillTargetChecker()` — comprueba el rango de todas las skills automáticamente.

#### 7c — `src/app/services/talent.service.ts` (solo si se creó nodo nuevo)

Añade el nodo al árbol correspondiente (`TALENT_NODES` o `TALENT_NODES_MAGIA`):

```typescript
{
  id: '{nodeId}', label: '{label}', icon: '{ion-icon-name}',
  col: {col}, row: {row}, requires: ['{nodo_padre}'],
  effect: { type: 'ability', base: {daño_base}, ability: '{abilityId}' },
},
```

---

### Checklist final

- [ ] Entrada en `SKILL_REGISTRY` con todos los campos requeridos
- [ ] Sprites cargados en `preload()` con guard `textures.exists`
- [ ] Nodo de talento existente o creado, con `effect.ability === '{abilityId}'`
- [ ] PNGs de efecto en `src/assets/sprites/skills/{carpeta}/`
- [ ] Icono PNG en `src/assets/sprites/skills/icons/` (si aplica)
- [ ] Si `projectile`: campo `speed` presente en el config
