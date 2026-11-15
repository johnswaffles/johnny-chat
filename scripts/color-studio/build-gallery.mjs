import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {catalog} from '../../public/color-studio/art.js';
import {makePuzzle} from '../../public/color-studio/engine.js';
import {alpineOptions} from './alpine-options.mjs';

const raw=process.argv[2];
if(!raw)throw new Error('Usage: node scripts/color-studio/build-gallery.mjs <raw-pixel-directory>');
const out=resolve('public/color-studio/puzzles');await mkdir(out,{recursive:true});
const report=[];
for(const file of catalog.map(a=>a.id+'.rgba').sort()){
  const id=file.slice(0,-5),pixels=new Uint8ClampedArray(await readFile(resolve(raw,file)));
  const art=catalog.find(a=>a.id===id),alpine=id==='alpine-retreat-v2';
  const puzzle=makePuzzle(pixels,600,600,alpine?alpineOptions:{colors:32,minArea:30,maxRegions:1900});
  if(alpine)puzzle.artworkRevision=5;
  await writeFile(resolve('public/color-studio',art.puzzleSource),JSON.stringify(puzzle));
  const item={id,colors:puzzle.palette.length,regions:puzzle.regions.length};report.push(item);console.log(JSON.stringify(item));
}
await writeFile(resolve(out,'manifest.json'),JSON.stringify(report,null,2)+'\n');
