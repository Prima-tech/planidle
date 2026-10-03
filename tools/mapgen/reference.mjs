// Propuesta visual independiente: no sustituye ningún mapa del juego.
// node tools/mapgen/reference.mjs
import path from 'node:path';
import { generateMap } from './generate.mjs';
import { loadStamp, writeTmj } from './tmj.mjs';
import { makeRng } from './rng.mjs';
import { buildPond } from './water.mjs';
import { dirtMask, dirtTile, resolveDirtSaddles } from './terrain.mjs';

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
    // Sustituir el recorte incompleto por una charca completa del mismo pack.
    // No arrastrar pilares, matas ni fragmentos de orillas de la escena original.
    const pond=buildPond(makeRng('charca-inferior-completa'),s.w,s.h);
    s.layers={Base:new Array(s.w*s.h).fill(0),Agua:new Array(s.w*s.h).fill(0)};
    s.collision=new Set(pond.fill);
    for(const k of pond.fill) {
      const [x,y]=k.split(',').map(Number);s.layers.Base[y*s.w+x]=2459;
    }
    for(const [k,tile] of pond.coast) {
      const [x,y]=k.split(',').map(Number);s.layers.Agua[y*s.w+x]=743+tile;
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
  if(name==='glades_pond') for(let y=0;y<s.h;y++) for(let x=0;x<s.w;x++) {
    layers.Agua[(sy+y)*W+sx+x]=0;
    layers.Deco[(sy+y)*W+sx+x]=0;
  }
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
let ruinSite;
for(const [name,x,y] of landmarks) {
  let done=false;
  for(let r=0;r<=20&&!done;r++) for(let dy=-r;dy<=r&&!done;dy++) for(let dx=-r;dx<=r&&!done;dx++) {
    done=place(name,x+dx,y+dy);
    if(done) {
      destinations.push(name==='glades_pond'
        ? {x:x+dx-3,y:y+dy+Math.floor(stamp(name).h/2)}
        : {x:x+dx+Math.floor(stamp(name).w/2),y:y+dy+stamp(name).h});
      if(name==='glades_ruin') ruinSite={x:x+dx,y:y+dy};
    }
  }
  if(!done) throw new Error(`No se pudo colocar ${name}`);
}
// Reservar el patio de la ruina para conectarlo al sendero.
const ruinCourt=new Set();
for(let y=ruinSite.y+2;y<=ruinSite.y+10;y++) for(let x=ruinSite.x-3;x<=ruinSite.x+9;x++) {
  if(((x-ruinSite.x-3)/6.5)**2+((y-ruinSite.y-6)/4.5)**2<=1) {
    ruinCourt.add(`${x},${y}`);
    occupied.add(`${x},${y}`);
  }
}
// Sin árboles: el usuario los coloca aparte; no deben tapar los caminos.
const seen=reachable(blocked);
if(!portals.every(p=>seen.has(`${p.x},${p.y}`))) throw new Error('Portal inaccesible');
// Caminos sobre suelo transitable, conectados a las entradas de cada hito.
const road=new Set();
// Separar los senderos de las orillas: la máscara de esquinas ocupa también
// el tile siguiente, por lo que se reservan dos celdas alrededor del agua.
const shoreBuffer=new Set();
for(let y=1;y<H-2;y++) for(let x=1;x<W-1;x++) {
  const g=layers.Base[y*W+x]&0x1FFFFFFF,a=layers.Agua[y*W+x]&0x1FFFFFFF;
  if(!(g>=743&&g<5345||a>=743&&a<2459)) continue;
  for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++) shoreBuffer.add(`${x+dx},${y+dy}`);
}
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
      if(nx<1||ny<1||nx>=W-1||ny>=H-2||blocked.has(k)||shoreBuffer.has(k)||parents.has(k)) continue;
      parents.set(k,key);queue.push([nx,ny]);
    }
  }
  if(!end) throw new Error('No hay camino al punto de interés');
  for(let k=end;k;k=parents.get(k)) {
    const [x,y]=k.split(',').map(Number);
    for(let dy=0;dy<=0;dy++) for(let dx=0;dx<=0;dx++) {
      const nx=x+dx,ny=y+dy,key=`${nx},${ny}`;
      if(nx>0&&ny>0&&nx<W-1&&ny<H-2&&!blocked.has(key)&&!occupied.has(key)) road.add(key);
    }
  }
}
// Suelo gastado bajo el edificio y patio frente a la entrada, unido al sendero.
// La máscara también cuenta bajo la ruina para evitar un borde de césped artificial.
for(const k of ruinCourt) road.add(k);
// Retirar los parches aleatorios antiguos: solo conservar tierra en los
// senderos y el patio, sin manchas que se peguen a la charca o al marco.
const dirtTiles=new Set([434,109,214,215,3,161,162,57,55,60,5,6,58,59,108,110,2,4]);
for(let y=1;y<H-2;y++) for(let x=1;x<W-1;x++) {
  const k=`${x},${y}`;
  if(!occupied.has(k)&&!blocked.has(k)&&dirtTiles.has(layers.Base[y*W+x])) {
    layers.Base[y*W+x]=56;
  }
}
resolveDirtSaddles(road,W,H);
for(let y=1;y<H-2;y++)for(let x=1;x<W-1;x++) {
  const key=`${x},${y}`,i=y*W+x;
  if(!dirtMask(road,x,y))continue;
  const ground=layers.Base[i]&0x1FFFFFFF,overlay=layers.Agua[i]&0x1FFFFFFF;
  // Mantener el suelo continuo bajo copas, troncos y ruinas. Sólo el agua y sus
  // orillas están protegidas: excluir rectángulos de prefabs cortaba el camino.
  if(ground>=743&&ground<5345||overlay>=743&&overlay<2459)continue;
  layers.Base[i]=dirtTile(road,x,y);
  if(!occupied.has(key)||ruinCourt.has(key)&&!blocked.has(key)) {
    layers.Agua[i]=0;layers.Deco[i]=0;
  }
}
// Matas en el margen del patio: transición entre suelo pisado y pradera.
const tuft=stamp('deco_detail2');
for(const [dx,dy] of [[-3,5],[-2,8],[0,10],[7,9],[9,6],[8,3]]) {
  const sx=ruinSite.x+dx,sy=ruinSite.y+dy;
  for(const data of Object.values(tuft.layers)) for(let y=0;y<tuft.h;y++) for(let x=0;x<tuft.w;x++) {
    const px=sx+x,py=sy+y,k=`${px},${py}`,gid=data[y*tuft.w+x];
    if(gid&&px>0&&py>0&&px<W-1&&py<H-2&&!blocked.has(k)&&!layers.Deco[py*W+px])
      layers.Deco[py*W+px]=gid;
  }
}
const finalSeen=reachable(blocked);
if(!destinations.every(p=>finalSeen.has(`${p.x},${p.y}`))) throw new Error('Acceso a hito bloqueado');
for (const ts of map.tilesets) ts.image = `../../src/assets/tilemaps/biomas/grasslands/${path.basename(ts.image)}`;
writeTmj(path.join(import.meta.dirname,'reference.tmj'),map);
console.log(`Referencia: sin árboles, 3 hitos, portales accesibles (${seen.size} celdas).`);
