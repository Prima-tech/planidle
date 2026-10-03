# Referencia técnica de caminos y orillas

## Imágenes

- `_preview-glades.png`: mapa original del pack, reconstruido conservando sus capas visuales y el tileset externo de detalles de agua.
- `_ground-study.png`: primeros cinco renglones del tileset de suelo, ampliados con números de tile local (no GID).
- `_preview-terrain-study.png`: ocho ejemplos de caminos (rectas, curva, T, cruce, diagonal, curva interior y claro) y tres charcas completas.
- `_preview-reference.png`: propuesta independiente actualizada. No sustituye los mapas del juego.

## Qué se corrigió

El método anterior elegía tierra según los lados expuestos de cada celda y confundía piezas que representan esquinas con piezas que representan lados. Ahora `terrain.mjs` interpreta cada tile mediante sus cuatro vértices: NO, NE, SO y SE. Tiles vecinos comparten los mismos vértices, de modo que las transiciones interiores y exteriores se corresponden.

La tabla de tiles se contrastó con `ground_grasss.png` y con la composición de `Glades.tmx`. Los dos casos de tierra en esquinas opuestas se unen antes de dibujar: el conjunto de piezas utilizado no tiene una pieza individual que resuelva esos casos.

Los caminos ya no omiten el rectángulo completo de una pieza decorativa. El suelo continúa bajo los árboles y ruinas, manteniendo sus capas y colisiones. El agua y las orillas siguen protegidas.

La charca inferior utiliza una composición completa de `buildPond`, sin recortes de columnas ni vegetación incompleta de Glades.

La reconstrucción original incluye `Water_detilazation2.tsx`, que es un tileset externo; omitirlo hacía aparecer negro el agua. El render de inspección también compone el alfa de cada píxel y respeta el orden de capas.

## Regenerar las referencias

```text
node tools/mapgen/inspect-original.mjs
node tools/mapgen/render.mjs glades "0,0" tools/mapgen/glades-reference.tmj
node tools/mapgen/terrain-study.mjs
node tools/mapgen/render.mjs terrain-study "0,0" tools/mapgen/terrain-study.tmj
node tools/mapgen/reference.mjs
node tools/mapgen/render.mjs reference "40,25;2,2;77,2" tools/mapgen/reference.tmj
```

`terrain-study.mjs` verifica los vértices compartidos y el perímetro completo de las charcas. `reference.mjs` comprueba acceso desde el inicio a ambos portales y a las entradas de los hitos. Estas comprobaciones no sustituyen una prueba dentro de Phaser.

## Alcance

La nueva composición de caminos se aplica a la propuesta independiente. El generador principal y los ocho mapas activos todavía no se han migrado a este método. El mapa original es una referencia de uso de las piezas, no un mapa nuevo para jugar.
