# Crear nuevo enemigo

Guía al usuario para crear un enemigo nuevo en el proyecto paso a paso.

## Instrucciones

Sigue este flujo en orden. No saltes pasos ni implementes nada hasta tener TODOS los datos.

### Paso 1 — Nombre del tipo

Pregunta: "¿Cuál es el ID del enemigo? (ej: `goblin1`, `skeleton2`) — debe ser único y sin espacios"

Guarda la respuesta como `{type}`.

Luego **explora automáticamente** la carpeta `src/assets/sprites/enemy/{type}/` para ver qué archivos existen. Los nombres de sprite pueden no seguir la convención `{type}_action_full.png` — usa los nombres reales que encuentres. Informa al usuario de los archivos encontrados antes de continuar.

### Paso 2 — Stats

Pregunta en un solo mensaje:
- HP base
- Velocidad en px/s (referencia: orc1 = 96)
- Daño por golpe (referencia: orc1 = 8)
- Cooldown entre ataques en ms (referencia: orc1 = 1500)
- Escala visual (referencia: orc1 normal = 3, orc1 elite = 3.5)

### Paso 3 — Frames de sprites

Primero pregunta:
- ¿Cuánto mide cada frame en píxeles (ancho × alto)? (referencia: orc1 = 64×64)
- ¿En qué orden están las filas de dirección? (referencia orc1: abajo, arriba, izquierda, derecha)

Luego pregunta **uno a uno**, usando los nombres de archivo reales encontrados en Paso 1:

1. `{filename_idle}` — ¿cuántas columnas?
2. `{filename_walk}` — ¿cuántas columnas?
3. `{filename_run}` — ¿cuántas columnas? (di "no tiene" si no existe)
4. `{filename_attack}` — ¿cuántas columnas?
5. `{filename_hurt}` — ¿cuántas columnas? (di "no tiene" si no existe)
6. `{filename_death}` — ¿cuántas columnas? y ¿es direccional? (tiene una fila por dirección, o es una sola fila)
7. `{filename_walk_attack_front}` — ¿cuántas columnas? (di "no tiene" si no existe)
8. `{filename_run_attack_front}` — ¿cuántas columnas? (di "no tiene" si no existe)

Para sprites que el usuario diga "no tiene", omite esa acción del config.

### Paso 4 — ¿Es variante de otro enemigo?

Pregunta: "¿Este enemigo reutiliza los sprites de otro tipo existente? (ej: elite/oblivion). Si es así, di el tipo base; si no, di 'no'"

Si reutiliza sprites, añade `spriteType: '{tipo_base}'` y opcionalmente pregunta si quiere tint visual (ej: `0xffcc00` dorado, `0xcc00ff` morado).

### Paso 5 — Loot

Pregunta: "¿Qué dropea este enemigo? Dime: monedas sí/no (y rango min-max), y si dropea algún item con nombre y probabilidad (0-1)"

### Paso 6 — Mapa

Pregunta: "¿En qué mapa aparece este enemigo?" y si reemplaza a algún enemigo existente en ese mapa.

Actualiza directamente `src/app/scenes/gamescene/map-config.ts` con el spawn correspondiente (misma zona y maxCount que el enemigo que reemplaza, o valores razonables si es nuevo).

### Paso 7 — ¿Variantes elite/oblivion?

Pregunta: "¿Quieres crear variantes elite y oblivion para este enemigo?"

Si sí: créalas usando spread del tipo base con `spriteType: '{type}'`. Stats sugeridos:
- elite: HP ×3, velocidad +10%, daño ×2, cooldown -20%, escala +0.5, tint `0xffcc00`
- oblivion: HP ×8, velocidad +20%, daño ×3.3, cooldown -33%, escala +1, tint `0xcc00ff`

### Paso 8 — Implementación

Con todos los datos recogidos, implementa:

1. **`src/app/enemy/enemy-config.ts`** — añade la constante del enemigo y regístrala en `ENEMY_REGISTRY`
   - Usa `dirFrames(N, DIR_ORDER)` para sprites direccionales con N columnas
   - Para death direccional: `directional: true`, `frames: dirFrames(N, DIR_ORDER)`
   - Para death no direccional: `directional: false`, `frames: { start: 0, end: N-1 }`
   - El campo `filename` debe ser el nombre real del archivo sin extensión `.png`
   - Define una constante `{TYPE}_DIR: DirOrder` con el orden de dirección indicado por el usuario

2. **`src/app/physics/griddrops.ts`** — añade:
   - Entrada en `EXP_REWARDS` (y variantes elite/oblivion si aplica)
   - Entrada en `LOOT_TABLES` (y variantes elite/oblivion si aplica)

3. **`src/app/scenes/gamescene/map-config.ts`** — actualiza el spawn del mapa indicado

### Notas importantes al implementar

- El campo `type` de `EnemyTypeConfig` debe ser idéntico a la key en `ENEMY_REGISTRY`
- Para variantes elite/oblivion usa spread: `{ ...tipoBase, type: '...', spriteType: '{type}', ... }`
- `dirFrames` está importado en `enemy-config.ts` — úsalo, no calcules frames a mano
- Si un sprite es "no tiene", simplemente omite esa key en `actions`
- Los assets deben estar en `src/assets/sprites/enemy/{type}/`
- El sistema de elite/oblivion funciona automáticamente: GameScene busca `{type}_elite` y `{type}_oblivion` en `ENEMY_REGISTRY` al matar un enemigo base — no requiere cambios en la escena
