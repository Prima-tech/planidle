# Placeholders pixel-art de slots de equipo

PNGs 32×32 (pixel-art, fondo transparente) que se muestran atenuados en los slots
vacíos de la ventana de equipo. Mientras un archivo no exista, el slot cae a un
ionicon de respaldo automáticamente (no se rompe nada).

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
