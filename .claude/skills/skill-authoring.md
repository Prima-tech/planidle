---
description: Cómo crear/editar skills y commands de Claude en este proyecto (formato, ubicación, frontmatter, triggers, plantilla). Se activa al hablar de crear una skill, documentar un sistema, una nueva guía para Claude, un command o un slash command.
triggers:
  - crear skill
  - nueva skill
  - skill para
  - documentar sistema
  - guía para claude
  - command
  - slash command
  - .claude/skills
  - .claude/commands
  - meta skill
  - skill-authoring
---

# Cómo crear skills y commands de Claude

Este proyecto guía a Claude con dos mecanismos distintos. Elige según el caso.

## Los dos tipos

| Tipo | Ubicación | Cómo se usa | Para qué |
|------|-----------|-------------|----------|
| **Skill de conocimiento** | `.claude/skills/<nombre>.md` | **Auto-activada** por `triggers` cuando la conversación toca el tema | Documentar un sistema vivo (enemigos, minimapa, planetas, minería…). "Dónde está, cómo funciona, cómo extenderlo" |
| **Command** | `.claude/commands/<nombre>.md` | **Invocada** por el usuario con `/<nombre>` (aparece en la lista de skills disponibles) | Receta imperativa paso a paso para una tarea concreta (`/new-weapon`, `/new-enemy`, `/deploy-android`) |

Regla rápida:
- ¿Es **conocimiento de un sistema** que quieres que Claude recuerde y amplíes con el tiempo? → **skill** en `.claude/skills/`.
- ¿Es una **tarea repetible "hazme un X"** que el usuario dispara a mano? → **command** en `.claude/commands/`.

> Nombres en **minúsculas-kebab** (`mining.md`, `enemy-creation.md`). No colisionar con un nombre ya existente (p.ej. `new-skill` ya es el command de skills del JUEGO; una skill para *autoría* se llama distinto).

---

## Skill de conocimiento (`.claude/skills/`)

### Frontmatter (obligatorio)

```yaml
---
description: Una frase. Qué cubre + "Se activa cuando se habla de X, Y, Z".
triggers:
  - palabra clave
  - sinónimo en inglés
  - IdentificadorDeCodigo   # nombres reales del repo: ENEMY_REGISTRY, miningMode…
---
```

- `description`: una sola línea. Empieza por el alcance y termina con "Se activa cuando…". Es lo que Claude lee para decidir si la skill es relevante.
- `triggers`: lista de términos (ES + EN) y **identificadores reales del código** (servicios, constantes, claves del registry). Cuantos más términos certeros, mejor se auto-activa.

### Estructura del cuerpo (convención del repo)

```markdown
# Título del sistema

## Archivos involucrados
| Archivo | Responsabilidad |
|---------|----------------|
| `ruta/archivo.ts` | Qué hace |

## Cómo funciona (estado actual)
…explicación + fragmentos de código reales…

## Cómo añadir / extender X
…pasos concretos con código…

## Constantes / valores clave
…números mágicos, rutas, claves…

## Notas / pendientes
```

Mira `enemy-creation.md`, `minimap.md` o `planet-creation.md` como referencia de estilo (tablas, bloques ```typescript, pasos numerados).

---

## Command (`.claude/commands/`)

Markdown imperativo, normalmente **sin frontmatter** (o solo un título). Se escribe como instrucciones directas a Claude. Suele incluir:

```markdown
# new-cosa — Añadir una cosa

## Argumentos esperados
- Nombre, sprite, stats…

## Paso 1 — …
## Paso 2 — …

## Checklist
- [ ] …
```

Mira `new-weapon.md` o `new-enemy.md` como referencia.

---

## Pasos para crear una skill de conocimiento

1. Crea `.claude/skills/<nombre>.md`.
2. Escribe el frontmatter (`description` + `triggers` con términos reales del código).
3. Rellena: tabla de **Archivos involucrados**, **cómo funciona** (con código real), **cómo extender**, **constantes clave**.
4. Si el sistema es importante, añade también una entrada en la auto-memoria (`MEMORY.md`) apuntando a la skill.
5. Recuerda la regla del proyecto (CLAUDE.md): al ejecutar una skill, di **qué skill y con qué argumentos** antes de empezar.

## Plantilla mínima (copiar)

```markdown
---
description: <alcance>. Se activa cuando se habla de <temas>.
triggers:
  - <es>
  - <en>
  - <IdentificadorReal>
---

# <Sistema>

## Archivos involucrados
| Archivo | Responsabilidad |
|---------|----------------|
| `src/...` |  |

## Cómo funciona

## Cómo extender

## Constantes clave

## Notas
```
