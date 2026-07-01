// Parches de tierra y caminos sobre el césped (tileset ground_grasss, firstgid 1).
// Esquema extraído de Glades.tmx por votación de vecinos (ver dump en la sesión):
//  - relleno: 433 (predominante) / 426
//  - borde con hierba al N: 108/213/214 · al S: 2/160/161 · al O: 56 · al E: 54/59
//  - diagonales interiores (como la charca): NW 109, NE 107, SW 3, SE 1
//  - caminos de 2 de ancho: vertical = col izq {56,59} + col dcha {54,59};
//    horizontal = fila arriba {108,213,214} + fila abajo {2,160,161}
//    (los tiles de camino llevan la franja de hierba integrada, como en Glades)
// Los parches son rectángulos redondeados (mismo motivo que el agua: sin arte diagonal
// fiable). Todo va a la capa Base (sin colisión: la tierra se pisa).

const D = {
  first: 1,
  // OJO: 426 (fill alternativo en Glades) es casi transparente — allí funciona
  // porque hay tierra en otra capa debajo; sobre nuestro césped deja un hueco claro.
  fill: [433],
  // lados: caps de esquina (4/5/57/58) en los extremos, medios variados entre ellos.
  // La esquina del rect queda en hierba y el corte se redondea en diagonal (como
  // la esquina NW real de Glades: 4 / 4 107 / …fill).
  n: { c0: 4, mid: [108, 213, 214], c1: 5 },
  s: { c0: 57, mid: [2, 160, 161], c1: 58 },
  w: { c0: 4, mid: [56], c1: 57 },
  e: { c0: 5, mid: [54, 59], c1: 58 },
  innerNW: 107, innerNE: 109, innerSW: 1, innerSE: 3,
};
const K = (x, y) => `${x},${y}`;

function freeGrass(ctx, x, y) {
  const { W, H, base, agua, collision, grassFill } = ctx;
  if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) return false;
  const i = y * W + x;
  // Ojo: no mira `occupied` (el río marca su margen ahí y cortaría el camino del
  // vado); basta con no pisar agua/colisión/otra tierra. Sí ESCRIBE en occupied
  // para que los stamps posteriores no caigan encima.
  return base[i] === grassFill && !agua[i] && !collision.has(K(x, y));
}

// Parche rectangular w×h en (ox,oy): esquinas = hierba, lados con transición, fill dentro.
function tryPlacePatch(rng, ctx, ox, oy, w, h) {
  const { W, base, occupied } = ctx;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
    if (!freeGrass(ctx, ox + x, oy + y)) return false;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const corner = (x === 0 || x === w - 1) && (y === 0 || y === h - 1);
    if (corner) continue;
    let t;
    if (y === 0) t = x === 1 ? D.n.c0 : x === w - 2 ? D.n.c1 : rng.pick(D.n.mid);
    else if (y === h - 1) t = x === 1 ? D.s.c0 : x === w - 2 ? D.s.c1 : rng.pick(D.s.mid);
    else if (x === 0) t = y === 1 ? D.w.c0 : y === h - 2 ? D.w.c1 : rng.pick(D.w.mid);
    else if (x === w - 1) t = y === 1 ? D.e.c0 : y === h - 2 ? D.e.c1 : rng.pick(D.e.mid);
    else if (x === 1 && y === 1) t = D.innerNW;
    else if (x === w - 2 && y === 1) t = D.innerNE;
    else if (x === 1 && y === h - 2) t = D.innerSW;
    else if (x === w - 2 && y === h - 2) t = D.innerSE;
    else t = rng.pick(D.fill);
    base[(oy + y) * W + ox + x] = D.first + t;
  }
  for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) occupied.add(K(ox + x, oy + y));
  return true;
}

/**
 * ctx: { W, H, base, agua, collision, occupied, grassFill }
 * Solo parches de tierra (los caminos se quitaron: no aportaban).
 */
export function generateDirt(rng, ctx) {
  const nPatches = rng.int(2, 3);
  for (let i = 0, tries = 0; i < nPatches && tries < 80; tries++) {
    const w = rng.int(6, 9), h = rng.int(5, 7);   // mínimo 6×5: con menos no queda relleno visible
    const ox = rng.int(2, ctx.W - w - 2), oy = rng.int(2, ctx.H - h - 2);
    if (tryPlacePatch(rng, ctx, ox, oy, w, h)) i++;
  }
}
