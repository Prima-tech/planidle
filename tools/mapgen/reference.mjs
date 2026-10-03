// Propuesta visual independiente: no sustituye ningún mapa del juego.
// node tools/mapgen/reference.mjs
import path from 'node:path';
import { generateMap } from './generate.mjs';
import { loadStamp, writeTmj } from './tmj.mjs';
import { makeRng } from './rng.mjs';

const W = 80, H = 50;
const spawn = { x: 40, y: 25 };
const portals = [{ x: 2, y: 2 }, { x: 77, y: 2 }];
const map = generateMap({ id: 'reference', seed: 'claro-01', width: W, height: H,
  biome: 'grasslands', spawn, portals, stampDensity: 7, lake: false });
const layers = Object.fromEntries(map.layers.filter(l => l.type === 'tilelayer').map(l => [l.name, l.data]));
if (!layers.Deco) {
  layers.Deco = new Array(W * H).fill(0);
  map.layers.push({ id: 4, name: 'Deco', type: 'tilelayer', visible: true, opacity: 1,
    x: 0, y: 0, width: W, height: H, data: layers.Deco });
}
map.nextlayerid = 5;
// Los detalles del generador antiguo están en Base: separarlos del suelo.
for(let i=0;i<W*H;i++) if((layers.Base[i]&0x1FFFFFFF)>=5889) {
  layers.Deco[i]=layers.Base[i]; layers.Base[i]=56;
}
const objects = map.layers.find(l => l.name === 'Colisiones').objects;
const blocked = new Set();
for (const o of objects) for (let y = o.y / 16; y < (o.y + o.height) / 16; y++)
  for (let x = o.x / 16; x < (o.x + o.width) / 16; x++) blocked.add(`${x},${y}`);
const occupied = new Set();
const rng = makeRng('bosquetes-referencia');
const stamps = new Map();
const stamp = name => {
  if (!stamps.has(name)) stamps.set(name, loadStamp(path.join(import.meta.dirname, 'stamps', `${name}.tmj`)));
  // La ruina es una pieza completa del atlas, sin el acantilado del recorte original.
  if(name==='glades_ruin') {
    const s=stamps.get(name);
    s.layers={Base:new Array(42).fill(0),Agua:new Array(42).fill(0),
      Deco:Array.from({length:42},(_,i)=>5345+(24+Math.floor(i/6))*16+10+i%6)};
  }
  if(name==='glades_pond') {
    const s=stamps.get(name);
    // El recorte arrastraba fragmentos de talud ajenos a la charca.
    for(const data of Object.values(s.layers)) for(let i=0;i<data.length;i++) {
      const g=data[i]&0x1FFFFFFF;
      if(g>0&&g<743&&g!==56) data[i]=0;
    }
  }
  return stamps.get(name);
};
// Corredores anchos entre el claro y las salidas; el espacio inferior sigue abierto.
const segments = [[40,25,24,14], [24,14,2,2], [40,25,57,14], [57,14,77,2]];
function reserved(x, y) {
  if (((x-40)/11)**2 + ((y-25)/8)**2 < 1) return true;
  return segments.some(([ax,ay,bx,by]) => {
    const t = Math.max(0, Math.min(1, ((x-ax)*(bx-ax)+(y-ay)*(by-ay))/((bx-ax)**2+(by-ay)**2)));
    return Math.hypot(x-ax-t*(bx-ax), y-ay-t*(by-ay)) < 3;
  });
}
function reachable(test) {
  const seen = new Set([`${spawn.x},${spawn.y}`]), q = [[spawn.x,spawn.y]];
  while(q.length) {
    const [x,y] = q.pop();
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx=x+dx, ny=y+dy, k=`${nx},${ny}`;
      if(nx<0||ny<0||nx>=W||ny>=H||seen.has(k)||test.has(k)) continue;
      seen.add(k); q.push([nx,ny]);
    }
  }
  return seen;
}
function place(name, sx, sy) {
  const s = stamp(name);
  for(let y=0;y<s.h;y++) for(let x=0;x<s.w;x++) {
    const px=sx+x, py=sy+y, k=`${px},${py}`;
    if(px<2||py<2||px>=W-2||py>=H-3||occupied.has(k)||blocked.has(k)||reserved(px,py)) return false;
    const g=layers.Base[py*W+px]&0x1FFFFFFF;
    if(g!==56) return false;
  }
  const test=new Set(blocked);
  for(const k of s.collision) { const [x,y]=k.split(',').map(Number); test.add(`${sx+x},${sy+y}`); }
  const seen=reachable(test);
  if(!portals.every(p=>seen.has(`${p.x},${p.y}`))) return false;
  for(const [name,data] of Object.entries(s.layers)) for(let y=0;y<s.h;y++) for(let x=0;x<s.w;x++) {
    const g=data[y*s.w+x];
    if(g) layers[name][(sy+y)*W+sx+x]=g;
  }
  for(let y=0;y<s.h;y++) for(let x=0;x<s.w;x++) occupied.add(`${sx+x},${sy+y}`);
  for(const k of s.collision) {
    const [x,y]=k.split(',').map(Number); blocked.add(`${sx+x},${sy+y}`);
    objects.push({id:map.nextobjectid++,name:'',type:'',visible:true,rotation:0,x:(sx+x)*16,y:(sy+y)*16,width:16,height:16});
  }
  return true;
}
const landmarks = [['glades_ruin',17,29], ['glades_tower',60,29], ['glades_pond',48,36]];
const destinations=[...portals];
for(const [name,x,y] of landmarks) {
  let done=false;
  for(let r=0;r<=20&&!done;r++) for(let dy=-r;dy<=r&&!done;dy++) for(let dx=-r;dx<=r&&!done;dx++) {
    done=place(name,x+dx,y+dy);
    if(done) destinations.push({x:x+dx+Math.floor(stamp(name).w/2),y:y+dy+stamp(name).h});
  }
  if(!done) throw new Error(`No se pudo colocar ${name}`);
}
let trees=0;
// Bosquetes asimétricos, con claros entre grupos.
for(const [cx,cy,rx,ry,count] of [[12,12,10,8,12],[40,7,13,5,11],[67,15,9,10,13],[12,39,10,7,12],[69,40,9,7,11],[34,42,9,5,7]]) {
  let done=0;
  for(let i=0;i<300&&done<count;i++) {
    const x=rng.int(cx-rx,cx+rx),y=rng.int(cy-ry,cy+ry);
    if(((x-cx)/rx)**2+((y-cy)/ry)**2>1) continue;
    if(place(rng.int(0,4)===0?'tree_apple':'tree_green',x,y)) {done++;trees++;}
  }
}
const seen=reachable(blocked);
if(!portals.every(p=>seen.has(`${p.x},${p.y}`))) throw new Error('Portal inaccesible');
// Caminos sobre suelo transitable, conectados a las entradas de cada hito.
const road=new Set();
for(const target of destinations) {
  const start=`${spawn.x},${spawn.y}`, parents=new Map([[start,null]]), queue=[[spawn.x,spawn.y]];
  let end;
  for(let head=0;head<queue.length;head++) {
    const [x,y]=queue[head],key=`${x},${y}`;
    if(x===target.x&&y===target.y) {end=key;break;}
    const dirs=[[1,0],[-1,0],[0,1],[0,-1]].sort((a,b)=>
      Math.hypot(x+a[0]-target.x,y+a[1]-target.y)-Math.hypot(x+b[0]-target.x,y+b[1]-target.y));
    for(const [dx,dy] of dirs) {
      const nx=x+dx,ny=y+dy,k=`${nx},${ny}`;
      if(nx<1||ny<1||nx>=W-1||ny>=H-2||blocked.has(k)||parents.has(k)) continue;
      parents.set(k,key);queue.push([nx,ny]);
    }
  }
  if(!end) throw new Error('No hay camino al punto de interés');
  for(let k=end;k;k=parents.get(k)) {
    const [x,y]=k.split(',').map(Number);
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) {
      const nx=x+dx,ny=y+dy,key=`${nx},${ny}`;
      if(nx>0&&ny>0&&nx<W-1&&ny<H-2&&!blocked.has(key)&&!occupied.has(key)) road.add(key);
    }
  }
}
// Unir los caminos al terreno de tierra existente antes de vestir los bordes.
const dirtTiles=new Set([434,109,214,215,3,161,162,57,55,60,5,6,58,59,108,110,2,4]);
for(let y=1;y<H-2;y++) for(let x=1;x<W-1;x++) {
  const k=`${x},${y}`;
  if(!occupied.has(k)&&!blocked.has(k)&&dirtTiles.has(layers.Base[y*W+x])) road.add(k);
}
for(const key of road) {
  const [x,y]=key.split(',').map(Number),i=y*W+x;
  const n=!road.has(`${x},${y-1}`),s=!road.has(`${x},${y+1}`),w=!road.has(`${x-1},${y}`),e=!road.has(`${x+1},${y}`);
  let tile=433;
  if(n&&w) tile=4; else if(n&&e) tile=5; else if(s&&w) tile=57; else if(s&&e) tile=58;
  else if(n) tile=108; else if(s) tile=2; else if(w) tile=56; else if(e) tile=54;
  else if(!road.has(`${x-1},${y-1}`)) tile=107;
  else if(!road.has(`${x+1},${y-1}`)) tile=109;
  else if(!road.has(`${x-1},${y+1}`)) tile=1;
  else if(!road.has(`${x+1},${y+1}`)) tile=3;
  layers.Base[i]=tile+1;layers.Agua[i]=0;layers.Deco[i]=0;
}
for (const ts of map.tilesets) ts.image = `../../src/assets/tilemaps/biomas/grasslands/${path.basename(ts.image)}`;
writeTmj(path.join(import.meta.dirname,'reference.tmj'),map);
console.log(`Referencia: ${trees} árboles, 3 hitos, portales accesibles (${seen.size} celdas).`);
