# Crear nuevo enemigo

Guía al usuario para crear un enemigo nuevo en el proyecto paso a paso.

## Instrucciones

Sigue este flujo en orden. No saltes pasos ni implementes nada hasta tener TODOS los datos.

### Paso 1 — Nombre del tipo

Pregunta: "¿Cuál es el ID del enemigo? (ej: `goblin1`, `skeleton2`) — debe ser único y sin espacios"

Guarda la respuesta como `{type}`.

### Paso 2 — Stats

Pregunta en un solo mensaje:
- HP base
- Velocidad en px/s (referencia: orc1 = 96)
- Daño por golpe (referencia: orc1 = 8)
- Cooldown entre ataques en ms (referencia: orc1 = 1500)
- Escala visual (referencia: orc1 normal = 3, orc1 elite = 3.5)

### Paso 3 — Frames de sprites

Explica al usuario: "Todos los sprites tienen 4 filas (una por dirección: abajo, izquierda, arriba, derecha). Dime cuántas **columnas** tiene cada uno."

Pregunta uno a uno esperando respuesta antes de pasar al siguiente:

1. `{type}_idle_full` — ¿cuántas columnas?
2. `{type}_walk_full` — ¿cuántas columnas?
3. `{type}_run_full` — ¿cuántas columnas? (di "no tiene" si no existe)
4. `{type}_attack_full` — ¿cuántas columnas?
5. `{type}_hurt_full` — ¿cuántas columnas? (di "no tiene" si no existe)
6. `{type}_death_full` — ¿cuántas columnas? (este es NO direccional — una sola fila)
7. `{type}_walk_attack_front_full` — ¿cuántas columnas? (di "no tiene" si no existe)
8. `{type}_run_attack_front_full` — ¿cuántas columnas? (di "no tiene" si no existe)

Para sprites que el usuario diga "no tiene", omite esa acción del config.

### Paso 4 — ¿Es variante de otro enemigo?

Pregunta: "¿Este enemigo reutiliza los sprites de otro tipo existente? (ej: elite/oblivion). Si es así, di el tipo base; si no, di 'no'"

Si reutiliza sprites, añade `spriteType: '{tipo_base}'` y opcionalmente pregunta si quiere tint visual (ej: `0xffcc00` dorado, `0xcc00ff` morado).

### Paso 5 — Loot

Pregunta: "¿Qué dropea este enemigo? Dime: monedas sí/no (y rango min-max), y si dropea algún item con nombre y probabilidad (0-1)"

### Paso 6 — Implementación

Con todos los datos recogidos, implementa:

1. **`src/app/enemy/enemy-config.ts`** — añade la constante del enemigo y regístrala en `ENEMY_REGISTRY`
   - Usa `dirFrames(N, DEFAULT_DIR_ORDER)` para sprites direccionales con N columnas
   - Para death/walkAttackFront/runAttackFront: `directional: false`, `frames: { start: 0, end: N-1 }`

2. **`src/app/physics/griddrops.ts`** — añade entrada en `LOOT_TABLES`

3. Informa al usuario de que para añadirlo a un mapa debe editar `SpawnConfig` en `src/app/scenes/gamescene/map-config.ts` y que los assets deben estar en `assets/sprites/enemy/{type}/`

### Notas importantes al implementar

- El campo `type` de `EnemyTypeConfig` debe ser idéntico a la key en `ENEMY_REGISTRY`
- Para variantes elite/oblivion usa spread: `{ ...tipoBase, type: '...', ... }`
- `dirFrames` está importado en `enemy-config.ts` — úsalo, no calcules frames a mano
- Si un sprite es "no tiene", simplemente omite esa key en `actions`
