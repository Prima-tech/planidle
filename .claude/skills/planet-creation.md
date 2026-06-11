---
description: Sistema de planetas de la ventana de mapa (tab 2) — cómo crear planetas nuevos, estilos pixel-art, pins de mapas sobre el globo y la vista sistema estelar. Se activa cuando se habla de planetas, globo, sistema estelar, texturas de planeta o estilos pixel-art.
triggers:
  - planeta
  - planet
  - globo
  - sistema estelar
  - textura planeta
  - PlanetDef
  - PLANETS
  - PixelStyle
  - PlanetViewScene
  - agujero negro
  - pin del globo
---

# Sistema de planetas (ventana de mapa, tab 2)

## Arquitectura

| Archivo | Responsabilidad |
|---------|----------------|
| `src/app/scenes/planet-view.scene.ts` | TODO el sistema: registro `PLANETS`, generadores de estilo, vista detalle (globo arrastrable), vista sistema (estrella + órbitas), pins |
| `src/app/components/world-map-panel/world-map-panel.component.ts` | Crea/destruye la mini-instancia Phaser al entrar/salir de la tab 2; registra los callbacks de los pins |

**Mini-instancia Phaser propia**: el panel de mapa es un overlay Angular (el juego principal queda detrás), así que la tab 2 monta un `Phaser.Game` independiente que se **crea al entrar y se destruye al salir** (`createPlanetGame`/`destroyPlanetGame`). No comparte registry ni texturas con el juego principal.

**DPR**: el canvas se crea a `clientWidth × devicePixelRatio` con `zoom: 1/DPR` para texto nítido. En la escena, toda medida en px fijos (fuentes, pins, botón, bordes) se multiplica por la constante `DPR`; las relativas a W/H escalan solas. El globo usa `tileScale = DPR` y el drag divide los deltas por DPR.

### Dos vistas en la misma escena

- **`detail`** (inicial, planeta Tierra): TileSprite con máscara circular — la textura hace scroll al arrastrar, con inercia (`FRICTION`). Borde de 2px×DPR en color `def.halo`. Botón «+» (arriba-izquierda) → zoom-out al sistema.
- **`system`**: estrella central con pulso + planetas orbitando en elipses aplastadas (×0.42). Click en un planeta → zoom-in a su detalle.
- Transiciones: fade de cámara + tween de zoom (`transition()`), flag `transitioning` bloquea input.

## Crear un planeta nuevo (reutilizando un estilo)

Añadir una entrada a `PLANETS` en `planet-view.scene.ts`:

```typescript
{ id: 'toxis', name: 'Toxis', kind: 'pixel', style: 'lava',     // estilo base
  base: '#0d1c08',                                              // color de fondo
  features: ['#1e7a0e', '#2ae850', '#a0ff40'],                  // 3 colores del estilo
  cloudAlpha: 0, halo: 0x6aff2e,                                // borde detalle
  orbit: 0.55,   // radio orbital (0-1 sobre el máximo)
  size: 12,      // radio en px en la vista sistema
  speed: 0.09 }, // rad/s — más cerca de la estrella = más rápido queda natural
```

Eso es todo: la textura, la mini-versión del sistema y la vista detalle se generan solas.

## Estilos pixel-art disponibles

Basados en los sprites de referencia de `Downloads/Planets/` (Terran, Lava, Ice, Baren, Black_hole). Pipeline común en `drawPixelStyle()`: se dibuja a **256px** y se escala **×2 sin suavizado** + filtro `NEAREST` (bloques de 2px nítidos). Significado de `features` por estilo:

| `style` | `features[0]` | `features[1]` | `features[2]` | Patrón |
|---------|--------------|--------------|--------------|--------|
| `terran` | tierra | tierra clara | arena (costa) | Continentes en 2 pasadas (arena debajo) + nubes con sombra |
| `lava` | resplandor | lava | lava brillante | Ríos (random-walk, 3 capas de grosor) + lagos |
| `ice` | sombra suave | sombra fuerte | brillo blanco | Moteado en 3 tonos |
| `baren` | cráter | sombra cráter | borde claro | Cráteres: rim arriba + fondo + sombra desplazada |
| `blackhole` | veta tenue | veta media | acento | Vetas horizontales onduladas (senos de 2 ciclos → empalman) |

## Crear un estilo nuevo

1. Añadir el literal al union `PixelStyle`.
2. Añadir `case 'nuevo': this.styleNuevo(o, LOW, def, wrapCircle); break;` en `drawPixelStyle()`.
3. Escribir `styleNuevo()` junto a los demás. **Regla de oro: todo lo dibujado debe replicarse en ±LOW en ambos ejes** para que la textura tilee al rotar — usa el helper `wrapCircle` o replica los trazos como hace `styleLava.drawPath`/`styleBlackhole.band`.
4. Patrones horizontales (bandas, ondas): usa ciclos enteros de seno sobre LOW para que empalmen en el borde.

## Pins de mapas sobre el globo (solo Tierra)

`TIERRA_PINS`: `{ name, mapId, tx, ty, color }` con `tx/ty` en **coordenadas de textura 0-512**. Se proyectan cada frame en `updatePins()` siguiendo el `tilePosition` (rotan con el globo), se ocultan "al otro lado" y se encogen cerca del limbo (`0.7 + 0.3·√(1−d²)`).

- **Click** → tarjeta de info del mapa (la misma de la tab 0) · **Doble click** (<300ms, también táctil) → teletransporte.
- Comunicación Phaser → Angular vía registry del mini-juego: `PLANET_PIN_SELECT_KEY` y `PLANET_PIN_TELEPORT_KEY`. El componente los registra con `ngZone.run()` (sin esto Angular no repinta).
- Para añadir pins a otro planeta: generalizar el `if (def.id === 'mundo')` de `buildDetailView` a un campo `pins?: SurfacePin[]` en `PlanetDef`.
- Al añadir un mapa nuevo al juego, añadir su pin a `TIERRA_PINS`.

## Errores a evitar

- **No** olvidar el wrap ±LOW en un generador — la costura aparece al rotar.
- **No** usar medidas en px sin multiplicar por `DPR` (texto/bordes borrosos o finísimos en móvil).
- **No** confiar en `setDepth` dentro de los containers: hay que llamar `container.sort('depth')` (la vista sistema lo hace en `positionOrbits` para que los planetas pasen por detrás de la estrella).
- **Planetas oscuros** (tipo blackhole): hornear un anillo en su mini-textura (`createMiniTexture` ya lo hace para `style === 'blackhole'`) o no se ven sobre el fondo espacial.
- El botón «+» y los pins usan `event.stopPropagation()` para no disparar el drag — replicar en cualquier elemento interactivo nuevo de la vista detalle.
- La imagen de referencia de un planeta (sprite esférico ya renderizado) **no sirve como textura del TileSprite** — hay que extraer paleta/patrón y generarla, o conseguir la versión equirectangular.
