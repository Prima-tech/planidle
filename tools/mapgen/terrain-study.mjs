// Banco visual y comprobación de esquinas compartidas de caminos.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { DIRT_CORNERS, dirtMask, dirtTile, resolveDirtSaddles } from './terrain.mjs';
import { GRASSLANDS_TILESETS } from './biomes.mjs';
import { buildPond } from './water.mjs';
import { makeRng } from './rng.mjs';
const W=64,H=40,vertices=new Set(),K=(x,y)=>`${x},${y}`;
const line=(ax,ay,bx,by)=>{
  const steps=Math.max(Math.abs(bx-ax),Math.abs(by-ay));
  for(let i=0;i<=steps;i++)vertices.add(K(Math.round(ax+(bx-ax)*i/steps),Math.round(ay+(by-ay)*i/steps)));
};
// Fila 1: rectas horizontal, vertical, curva y unión T.
line(3,6,13,6);line(20,3,20,12);
line(28,3,28,10);line(28,10,37,10);
line(45,6,57,6);line(51,6,51,12);
// Fila 2: cruce, diagonal, curva interior y ensanchamiento de un claro.
line(3,22,13,22);line(8,17,8,28);
line(19,18,28,27);
line(35,18,35,25);line(35,25,42,25);line(42,25,42,18);
line(49,22,59,22);
for(let y=19;y<=26;y++)for(let x=52;x<=58;x++)if(((x-55)/3.5)**2+((y-22.5)/4)**2<1)vertices.add(K(x,y));
resolveDirtSaddles(vertices,W,H);
const data=new Array(W*H).fill(56);
let shared=0;
for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++) {
  const m=dirtMask(vertices,x,y);
  assert.ok(DIRT_CORNERS[m]!==undefined);
  data[y*W+x]=dirtTile(vertices,x,y);
  const r=dirtMask(vertices,x+1,y),b=dirtMask(vertices,x,y+1);
  assert.equal((m>>1)&1,r&1);assert.equal((m>>3)&1,(r>>2)&1);
  assert.equal((m>>2)&1,b&1);assert.equal((m>>3)&1,(b>>1)&1);shared+=4;
}
const coast=new Array(W*H).fill(0);
for(const [ox,oy,w,h] of [[4,32,7,5],[20,31,10,6],[39,31,6,6]]) {
  const pond=buildPond(makeRng(`muestra-${ox}`),w,h);
  assert.equal(pond.fill.size,w*h-4);
  for(const k of pond.fill) {
    const [x,y]=k.split(',').map(Number);data[(oy+y)*W+ox+x]=2459;
  }
  for(const [k,tile] of pond.coast) {
    const [x,y]=k.split(',').map(Number);coast[(oy+y)*W+ox+x]=743+tile;
    assert.ok(x>=0&&x<w&&y>=0&&y<h);
    assert.ok(tile>=0&&tile<1716);
  }
  // Todas las casillas del perímetro, excepto esquinas vacías, tienen orilla.
  for(let x=1;x<w-1;x++) {assert.ok(pond.coast.has(K(x,0)));assert.ok(pond.coast.has(K(x,h-1)));}
  for(let y=1;y<h-1;y++) {assert.ok(pond.coast.has(K(0,y)));assert.ok(pond.coast.has(K(w-1,y)));}
}
fs.writeFileSync(path.join(import.meta.dirname,'terrain-study.tmj'),JSON.stringify({width:W,height:H,
  tilesets:GRASSLANDS_TILESETS,layers:[{type:'tilelayer',name:'Base',data},{type:'tilelayer',name:'Agua',data:coast}]}));
console.log(`8 muestras de caminos y 3 charcas; ${shared} comprobaciones de vértices compartidos correctas; orillas completas.`);
