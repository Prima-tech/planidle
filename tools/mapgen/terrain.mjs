// Tierra del pack Glades. Máscara de cuatro vértices, no de cuatro lados.
// Bits: NO=1, NE=2, SO=4, SE=8. Locales contrastados con ground_grasss.png.
export const DIRT_CORNERS = {
  0:55, 1:58, 2:57, 3:2, 4:5, 5:54, 7:1,
  8:4, 10:56, 11:3, 12:108, 13:107, 14:109, 15:433,
};
const key=(x,y)=>`${x},${y}`;
export function dirtMask(vertices,x,y) {
  return (vertices.has(key(x-1,y-1))?1:0)|(vertices.has(key(x,y-1))?2:0)|
    (vertices.has(key(x-1,y))?4:0)|(vertices.has(key(x,y))?8:0);
}
export function resolveDirtSaddles(vertices,W,H) {
  // El pack no contiene un tile de tierra para dos esquinas opuestas aisladas.
  // Unirlas en la máscara antes de dibujar, manteniendo vértices compartidos.
  for(let pass=0;pass<W*H;pass++) {
    let changes=0;
    for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++) {
      const mask=dirtMask(vertices,x,y);
      if(mask!==6&&mask!==9)continue;
      for(const [dx,dy] of [[-1,-1],[0,-1],[-1,0],[0,0]]) {
        const k=key(x+dx,y+dy);if(!vertices.has(k)){vertices.add(k);changes++;}
      }
    }
    if(!changes)return;
  }
  throw new Error('No convergió la máscara de terreno');
}
export function dirtTile(vertices,x,y) {
  const mask=dirtMask(vertices,x,y);
  if(DIRT_CORNERS[mask]===undefined)throw new Error(`Esquinas de tierra sin pieza: ${mask}`);
  return DIRT_CORNERS[mask]+1;
}
