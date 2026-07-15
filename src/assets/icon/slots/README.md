# Placeholders pixel-art de slots de equipo

PNGs 32×32 (pixel-art, fondo transparente) que se muestran atenuados en los slots
vacíos de la ventana de equipo.

IMPORTANTE: al crear un PNG hay que AÑADIR su entrada `img` en
`equipment.component.ts` → `slotPlaceholders` (ej. `axe: { img:
'assets/icon/slots/axe.png', icon: 'cut-outline' }`). Las entradas de los PNGs
inexistentes se quitaron porque referenciarlos disparaba un 404 por slot al abrir
la pestaña de recolección (el fallback a ionicon funcionaba a base de dejar
fallar la petición).

Nombres exactos esperados (case-sensitive):

| Archivo         | Slot               |
|-----------------|--------------------|
| `pants.png`     | Pantalones         |
| `boots.png`     | Botas              |
| `axe.png`       | Hacha (tala)       |
| `shovel.png`    | Pala               |
| `lantern.png`   | Linterna           |
| `backpack.png`  | Mochila            |
| `gloves.png`    | Guantes            |
| `belt.png`      | Cinturón           |
| `compass.png`   | Brújula            |
| `pet.png`       | Mascota            |

El resto de slots (casco, armadura, arma, collar, anillos, comida, poción, pico,
caña) ya usan frames del spritesheet `assets/icon/icons/icons1.png`, definidos en
`equipment.component.ts` → `slotPlaceholders`.
