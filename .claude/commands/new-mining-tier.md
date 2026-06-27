# new-mining-tier — Añadir un tier de minería (mena + drop + minimapa) y asignarlo a un mapa

Crea un tier de minería nuevo: sprite de la mena en el mundo, item que suelta, icono
del minimapa, y lo asigna a uno o varios mapas. La arquitectura ya existe (se montó con
el tier 2); esta skill solo replica el patrón con datos nuevos.

## Argumentos esperados

El usuario te dará, por **rol**, el icono de las hojas de referencia del panel de
invocación (pestañas Icons = #0–199, Objects = #200–331):

- **rock** (la mena en el mundo) — normalmente de Objects (#≥200), a veces Icons.
- **drop** (el mineral que cae / icono de inventario) — de Icons.
- **map** (el punto de la roca en el minimapa) — de Icons, **debe ser un icono pequeño 16×16**.
- **bar / bar_mini** — de momento solo referencia visual en la pestaña Mining (no tienen lógica).
- **Mapa(s)** que usarán este tier (ej. `1-3`).

## Cómo obtener la caja `{x,y,w,h}` de un `#`

No la calcules a mano: ya está en `summon.component.ts`.
- **Icons.png** (#0–199, hoja `assets/icon/icons/Icons.png`, 480×320): la caja es `iconsSheetList[#]`.
- **Objects.png** (#200–331, hoja `assets/icon/icons/Objects.png`, 656×272): la caja es `objectsSheetList[# − 200]`.

## Archivos que se tocan

| Paso | Archivo |
|------|---------|
| Extraer sprites | PowerShell (System.Drawing) → `assets/...` |
| Item del drop | `src/app/physics/griddrops.ts` (RESOURCES_CATALOG) |
| Preload texturas | `src/app/scenes/gamescene/gamescene.ts` |
| Registro del tier | `src/app/scenes/gamescene/harvest-config.ts` (`MINING_TIERS`) |
| Asignar a mapa | `src/app/scenes/gamescene/map-config.ts` (`mineTier`) |
| Panel de referencia (opcional) | `src/app/components/summon/summon.component.ts` (`miningTiers`) |

---

## Paso 1 — Extraer los sprites a PNG

Extrae **rock** y **drop** a archivos propios (recortando su caja). Hazlo siempre con
archivo (no spritesheet) para evitar problemas de alineación de los iconos grandes.

```powershell
Add-Type -AssemblyName System.Drawing
function Crop($srcPath,$x,$y,$w,$h,$out){
  $s=[System.Drawing.Image]::FromFile($srcPath)
  $c=New-Object System.Drawing.Bitmap $w,$h
  $g=[System.Drawing.Graphics]::FromImage($c)
  $g.DrawImage($s,(New-Object System.Drawing.Rectangle 0,0,$w,$h),(New-Object System.Drawing.Rectangle $x,$y,$w,$h),[System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose(); $c.Save($out,[System.Drawing.Imaging.ImageFormat]::Png); $c.Dispose(); $s.Dispose()
}
# rock (ej. Objects #210 → objectsSheetList[10] = {338,7,27,23})
Crop "...\assets\icon\icons\Objects.png" 338 7 27 23 "...\assets\sprites\map\skills\rocks\tierN_rock.png"
# drop (ej. Icons #21 = {16,32,32,32})
Crop "...\assets\icon\icons\Icons.png" 16 32 32 32 "...\assets\icon\resources\mining\tierN_drop.png"
```

Usa rutas absolutas reales (`C:\Users\...\src\...`).

## Paso 2 — Item del drop (`griddrops.ts`)

En `RESOURCES_CATALOG`, junto a los otros minerales:

```typescript
{
  name: 'Mineral Tier N',
  category: 'Recurso',
  type: 'item',
  chance: 1, minQty: 1, maxQty: 1, mergeable: true,
  texture: 'mineral_tierN',
  icon: 'assets/icon/resources/mining/tierN_drop.png',
  scale: 2, order: 6,
  description: 'Mineral de tier N obtenido al minar menas del mapa X-Y.',
},
```

## Paso 3 — Preload de texturas (`gamescene.ts`)

Junto a `rock_tier1`/`rock_tier2` (sección "Menas por tier"):

```typescript
this.load.image('rock_tierN', 'assets/sprites/map/skills/rocks/tierN_rock.png');
this.load.image('mineral_tierN', 'assets/icon/resources/mining/tierN_drop.png');
```

## Paso 4 — Registrar el tier (`harvest-config.ts`)

Añade la entrada a `MINING_TIERS`:

```typescript
N: { rockTexture: 'rock_tierN', dropName: 'Mineral Tier N', mmFrame: <FRAME> },
```

`mmFrame` = frame del icono **map** en `Icons.png` tratada como spritesheet de **16px**
(el minimapa la carga así). Fórmula a partir de la caja `{x,y}` del icono map:

```
mmFrame = (y / 16) * 30 + (x / 16)        // 30 = 480/16 columnas
```

Ej.: map = Icons #2 `{48,16}` → 1×30 + 3 = **33**. map = Icons #0 `{0,16}` → **30**.
El icono map debe ser pequeño (16×16) y queda 16-alineado, así que la fórmula siempre da entero.

## Paso 5 — Asignar el tier a un mapa (`map-config.ts`)

En el `genLevel({...})` del mapa, añade `mineTier: N`:

```typescript
'1-3': genLevel({ id: '1-3', ..., mineTier: N }),
```

Sin `mineTier`, un mapa usa el tier 1 por defecto. Varios mapas pueden compartir tier.

## Paso 6 (opcional) — Panel de referencia (`summon.component.ts`)

Añade el grupo a `miningTiers` para verlo en la pestaña Mining (icono = recorte de hoja,
no archivo). `sheet: 'objects'` si la caja es de Objects; por defecto Icons:

```typescript
{
  title: 'tierN',
  items: [
    { name: 'rock', box: { x: 338, y: 7, w: 27, h: 23 }, sheet: 'objects' },
    { name: 'map',  box: { x: 0,  y: 16, w: 16, h: 16 } },
    { name: 'drop', box: { x: 16, y: 32, w: 32, h: 32 } },
    { name: 'bar_mini', box: { ... } },
    { name: 'bar',      box: { ... } },
  ],
},
```

---

## Cómo funciona (ya implementado — no hay que tocarlo)

`gamescene.ts` resuelve el tier del mapa actual (`miningTier(currentMapConfig.mineTier)`) en:
- **spawnNode / initHarvestNodes**: sprite de la roca = `rockTexture` del tier.
- **destroyNode**: item soltado = `dropName` del tier (con el multiplicador de talento `miningDrop`).
- **getMinimapNodes**: pasa `frame` (el `mmFrame`) al minimapa; `mobile-hud.scene.ts` pinta la roca con ese frame.
- `offline-gains.service.ts` también usa `miningTier(map.mineTier).dropName` para el AFK.

## Checklist

- [ ] `tierN_rock.png` y `tierN_drop.png` extraídos (rutas correctas)
- [ ] Item `Mineral Tier N` en `RESOURCES_CATALOG`
- [ ] `rock_tierN` y `mineral_tierN` precargados en `gamescene.ts`
- [ ] Entrada `N` en `MINING_TIERS` con `mmFrame` correcto (fórmula del paso 4)
- [ ] `mineTier: N` en el/los mapa(s) en `map-config.ts`
- [ ] (Opc.) grupo `tierN` en `miningTiers` del panel
- [ ] Verificado con `npm start`: minar en el mapa suelta el mineral correcto y el minimapa muestra el icono del tier
