// RNG determinista con seed. Mismo seed → mismo mapa siempre.
// mulberry32: rápido, suficiente para generación de mapas.

export function makeRng(seed) {
  let a = hashStr(String(seed)) >>> 0;
  const next = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,                                   // [0,1)
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min, // ambos inclusivos
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    // elige un item según su .weight
    weighted: (items) => {
      const total = items.reduce((s, it) => s + (it.weight ?? 1), 0);
      let r = next() * total;
      for (const it of items) { r -= (it.weight ?? 1); if (r <= 0) return it; }
      return items[items.length - 1];
    },
  };
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h;
}
