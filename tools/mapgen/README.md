# Generador de mapas

Genera mapas `.tmj` aleatorios pero coherentes, con colisiones, a partir de:
- una **base de césped uniforme**, y
- **stamps** (prefabs) que TÚ pintas en Tiled.

No se esparce ningún tile "al azar": toda la decoración viene de stamps deliberados.

## Uso

```bash
npm run gen:maps      # genera 1-1..1-8 en src/assets/tilemaps/generated/
```

Determinista: el mismo nivel sale igual siempre. Cambia `SEED` en `manifest.mjs`
para rebarajar todos los mapas a la vez.

## Crear un stamp (árbol, rocas, muro, lago…)

1. **Copia** `stamps/_TEMPLATE.tmj` y renómbralo, p.ej. `stamps/tree01.tmj`.
2. **Ábrelo en Tiled** y píntalo:
   - Capa **`Base`**: todo lo que va sobre el césped (tronco, copa, roca, muro…).
   - Capa **`Agua`**: solo agua (para lagos/charcas). Si tu stamp no tiene agua, déjala vacía.
   - Capa **`Colisiones`** (objetos): dibuja rectángulos sobre lo que el jugador NO puede pisar
     (el tronco de un árbol, una roca, el interior de un lago). Lo demás se puede caminar.
3. **Ajusta el tamaño** del stamp (Map ▸ Resize Map) al de tu pieza. Hazlo pequeño:
   un árbol 2×3, una roca 1×1, un muro 4×1… Cuanto más pequeño, más natural se reparte.
4. **Regístralo** en `biomes.mjs`, dentro de `stamps`:
   ```js
   stamps: [
     { file: 'pond01', weight: 1 },
     { file: 'tree01', weight: 4 },   // weight = sale más a menudo
     { file: 'rock01', weight: 2 },
   ]
   ```
5. `npm run gen:maps`.

### Reglas
- Nombres de capa EXACTOS: `Base`, `Agua`, `Colisiones`.
- La capa `Colisiones` debe tener la propiedad `collides = true` (la plantilla ya la trae).
- El motor lee esas colisiones tal cual (`buildCollisionTiles`), sin cambios.
- Si un stamp parte el camino a un portal, el generador lo descarta solo (flood-fill).

## Archivos

| Archivo | Qué es |
|---------|--------|
| `manifest.mjs` | Qué mapas, tamaño y densidad. Tamaños tipo home01 (50×40 → 64×54). |
| `biomes.mjs` | Por bioma: tile de césped + lista de stamps. Añadir bioma = entrada nueva. |
| `stamps/*.tmj` | Tus prefabs pintados en Tiled. `_TEMPLATE.tmj` y nombres con `_` no se cargan salvo que los registres. |
| `generate.mjs` | Motor: base + dispersa stamps sin solapar + colisiones + conectividad. |
| `rng.mjs` | RNG con seed. |
| `cli.mjs` | Escribe los `.tmj`. |

## Densidad
En `manifest.mjs`, `density` = stamps por cada 100 tiles (aprox). Empieza bajo (0.1–0.25);
súbelo cuando tengas stamps pequeños y quieras mapas más poblados.
