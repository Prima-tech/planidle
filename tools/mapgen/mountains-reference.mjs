// Variante independiente del mapa aprobado. No escribe reference.tmj.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { writeTmj } from './tmj.mjs';

const source=path.join(import.meta.dirname,'reference.tmj');
const original=fs.readFileSync(source);
const map=JSON.parse(original);
const W=map.width,H=map.height;
const layers=Object.fromEntries(map.layers.filter(l=>l.type==='tilelayer').map(l=>[l.name,l.data]));
const objects=map.layers.find(l=>l.name==='Colisiones').objects;
const blocked=new Set();
for(const o of objects) for(let y=o.y/16;y<(o.y+o.height)/16;y++)
  for(let x=o.x/16;x<(o.x+o.width)/16;x++) blocked.add(`${x},${y}`);

// Mesetas de hierba con frente de roca de tres filas. Índices locales del
// bloque elevado de ground_grasss.png (53 columnas), revisados en el atlas.
const sites=[{x:26,y:4,w:14,h:9},{x:3,y:25,w:8,h:15},{x:67,y:35,w:10,h:9}];
for(const {x:sx,y:sy,w,h} of sites) {
  // No borrar caminos, agua ni edificios de la base para encajar una montaña.
  for(let y=sy;y<sy+h+3;y++) for(let x=sx;x<sx+w;x++) {
    const i=y*W+x;
    const overlay=layers.Agua[i]&0x1FFFFFFF;
    if(x<2||y<2||x>=W-2||y>=H-3||blocked.has(`${x},${y}`)||layers.Base[i]!==56||(overlay>0&&overlay<5889))
      throw new Error(`La montaña invade terreno reservado en ${x},${y}`);
  }
  for(let y=0;y<h+3;y++) for(let x=0;x<w;x++) {
    const px=sx+x,py=sy+y,i=py*W+px;
    let tile=55;
    if(y===0) tile=x===0?24:x===w-1?26:25;
    else if(y<h-1) tile=x===0?77:x===w-1?79:55;
    else if(y===h-1) tile=x===0?130:x===w-1?132:131;
    else if(y===h) tile=x===0?183:x===w-1?185:184;
    else if(y===h+1) tile=x===0?236:x===w-1?238:237;
    else continue;
    layers.Base[i]=56;
    layers.Agua[i]=tile+1;
    layers.Deco[i]=0;
    blocked.add(`${px},${py}`);
  }
  objects.push({id:map.nextobjectid++,name:'Meseta rocosa',type:'',visible:true,
    rotation:0,x:sx*16,y:sy*16,width:w*16,height:(h+2)*16});
}
// Verificar que las montañas no cortan la circulación existente.
const seen=new Set(['40,25']),queue=[[40,25]];
for(let head=0;head<queue.length;head++) {
  const [x,y]=queue[head];
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const nx=x+dx,ny=y+dy,k=`${nx},${ny}`;
    if(nx<0||ny<0||nx>=W||ny>=H||blocked.has(k)||seen.has(k))continue;
    seen.add(k);queue.push([nx,ny]);
  }
}
for(const k of ['2,2','77,2']) if(!seen.has(k))throw new Error(`Portal bloqueado: ${k}`);
map.properties=[...(map.properties??[]),{name:'referencia',type:'string',value:'Variante montañosa de reference.tmj; mesetas no transitables, sin árboles.'}];
writeTmj(path.join(import.meta.dirname,'mountains-reference.tmj'),map);
const hash=b=>createHash('sha256').update(b).digest('hex');
if(hash(original)!==hash(fs.readFileSync(source)))throw new Error('La base ha cambiado');
console.log(`Variante: ${sites.length} mesetas, portales accesibles; base original intacta.`);
