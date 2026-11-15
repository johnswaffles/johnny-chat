import {readFile,writeFile} from 'node:fs/promises';
import {makePuzzle} from '../../public/color-studio/engine.js';
import {alpineOptions} from './alpine-options.mjs';

const raw=process.argv[2];if(!raw)throw new Error('Usage: node scripts/color-studio/build-alpine.mjs <600x600 RGBA file>');
const pixels=new Uint8ClampedArray(await readFile(raw));
if(pixels.length!==600*600*4)throw new Error('Expected 600×600 RGBA pixels.');
const puzzle=makePuzzle(pixels,600,600,alpineOptions);
puzzle.artworkRevision=5;
await writeFile('public/color-studio/puzzles/alpine-retreat-v5.json',JSON.stringify(puzzle));
console.log(JSON.stringify({regions:puzzle.regions.length,colors:puzzle.palette.length,thin:puzzle.regions.filter(r=>r.radius<2).length,under3:puzzle.regions.filter(r=>r.radius<3).length,curves:puzzle.boundaries.reduce((n,c)=>n+c.commands.filter(s=>s[0]==='Q').length,0)}));
