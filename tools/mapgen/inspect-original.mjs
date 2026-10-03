// Reconstruye Glades preservando cada capa y crea un catálogo ampliado del suelo.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
const dir=path.join(import.meta.dirname,'../../src/assets/tilemaps/biomas/grasslands');
const xml=fs.readFileSync(path.join(dir,'Glades.tmx'),'utf8');
const W=43,H=29;
const layers=[];
for(const match of xml.matchAll(/<layer\b([^>]*)>([\s\S]*?)<\/layer>/g)) {
  const name=match[1].match(/name="([^"]+)"/)?.[1];
  const data=new Array(W*H).fill(0);
  for(const c of match[2].matchAll(/<chunk x="(-?\d+)" y="(-?\d+)" width="(\d+)" height="(\d+)">([\s\S]*?)<\/chunk>/g)) {
    const cx=+c[1],cy=+c[2],cw=+c[3],nums=(c[5].match(/-?\d+/g)||[]).map(Number);
    for(let i=0;i<nums.length;i++) {
      const x=cx+i%cw,y=cy+Math.floor(i/cw);
      if(x>=0&&y>=0&&x<W&&y<H) data[y*W+x]=nums[i];
    }
  }
  layers.push({name,type:'tilelayer',width:W,height:H,data,visible:!/visible="0"/.test(match[1])});
}
const tilesets=[];
for(const t of xml.matchAll(/<tileset\b([^>]*)>([\s\S]*?)<\/tileset>/g)) {
  const a=t[1],img=t[2].match(/<image\b[^>]*source="([^"]+)"/);
  if(img) tilesets.push({firstgid:+a.match(/firstgid="(\d+)"/)[1],name:a.match(/name="([^"]+)"/)[1],columns:+a.match(/columns="(\d+)"/)[1],image:img[1]});
}
for(const t of xml.matchAll(/<tileset\b[^>]*firstgid="(\d+)"[^>]*source="([^"]+)"\s*\/>/g)) {
  const tsx=fs.readFileSync(path.join(dir,t[2]),'utf8');
  tilesets.push({firstgid:+t[1],name:tsx.match(/<tileset\b[^>]*name="([^"]+)"/)[1],
    columns:+tsx.match(/columns="(\d+)"/)[1],image:tsx.match(/<image\b[^>]*source="([^"]+)"/)[1]});
}
fs.writeFileSync(path.join(import.meta.dirname,'glades-reference.tmj'),JSON.stringify({width:W,height:H,layers,tilesets}));
console.log('Capas originales:',layers.map(l=>l.name).join(', '));
// Catálogo de las primeras 5 filas: incluye transiciones y piezas de caminos.
const src=PNG.sync.read(fs.readFileSync(path.join(dir,'ground_grasss.png')));
const out=new PNG({width:53*48,height:5*64});out.data.fill(0);
const digits=['111101101101111','010110010010111','111001111100111','111001111001111','101101111001001','111100111001111','111100111101111','111001010010010','111101111101111','111101111001111'];
for(let row=0;row<5;row++) for(let col=0;col<53;col++) {
  for(let y=0;y<16;y++) for(let x=0;x<16;x++) {
    const si=((row*16+y)*src.width+col*16+x)*4;
    for(let dy=0;dy<3;dy++) for(let dx=0;dx<3;dx++) {
      const di=((row*64+y*3+dy)*out.width+col*48+x*3+dx)*4;
      for(let c=0;c<4;c++)out.data[di+c]=src.data[si+c];
    }
  }
  const label=String(row*53+col);
  for(let i=0;i<label.length;i++)for(let y=0;y<5;y++)for(let x=0;x<3;x++)if(digits[+label[i]][y*3+x]==='1')
    for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++) {
      const di=((row*64+51+y*2+dy)*out.width+col*48+2+i*8+x*2+dx)*4;
      out.data[di]=out.data[di+1]=out.data[di+2]=out.data[di+3]=255;
    }
}
fs.writeFileSync(path.join(import.meta.dirname,'_ground-study.png'),PNG.sync.write(out));
const candidates=[1,2,3,4,5,54,56,57,58,59,107,108,109,160,161,213,214,433];
for(const tile of candidates) {
  const ratios=[];
  for(const [qx,qy] of [[0,0],[8,0],[0,8],[8,8]]) {
    let soil=0;
    for(let y=qy;y<qy+8;y++)for(let x=qx;x<qx+8;x++) {
      const i=((Math.floor(tile/53)*16+y)*src.width+(tile%53)*16+x)*4;
      if(src.data[i+3]>128&&src.data[i]>src.data[i+1]+8)soil++;
    }
    ratios.push(soil/64);
  }
  console.log('Suelo local',tile,'cuadrantes NO NE SO SE',ratios);
}
// Distribución de tiles de suelo y vecindarios relevantes en la capa principal.
for(const l of layers.filter(l=>['main space','ground shadow','grass shadow'].includes(l.name))) {
  const counts=new Map();for(const g of l.data)if(g)counts.set(g,(counts.get(g)||0)+1);
  console.log(l.name,JSON.stringify([...counts].sort((a,b)=>b[1]-a[1]).slice(0,25)));
}
