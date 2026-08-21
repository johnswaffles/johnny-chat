import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('/Users/johnshopinski/Documents/New project/second-brain/node_modules/sharp');

const [, , input, output] = process.argv;
if (!input || !output) {
  throw new Error('Usage: node tools/prepare-hit-atlases.mjs <input.png> <output.png>');
}

const GRID = 4;
const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

function isStudioMatte(index) {
  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  const alpha = data[index + 3];
  const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
  const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
  return alpha > 0 && chroma < 24 && luminance > 180;
}

function clearCellMatte(cellX, cellY) {
  const startX = Math.floor(cellX * info.width / GRID);
  const endX = Math.floor((cellX + 1) * info.width / GRID);
  const startY = Math.floor(cellY * info.height / GRID);
  const endY = Math.floor((cellY + 1) * info.height / GRID);
  const cellWidth = endX - startX;
  const cellHeight = endY - startY;
  const queue = [];
  const visited = new Uint8Array(cellWidth * cellHeight);
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= cellWidth || y >= cellHeight) return;
    const key = y * cellWidth + x;
    if (visited[key]) return;
    visited[key] = 1;
    queue.push([x, y]);
  };

  for (let x = 0; x < cellWidth; x += 1) {
    push(x, 0);
    push(x, cellHeight - 1);
  }
  for (let y = 1; y < cellHeight - 1; y += 1) {
    push(0, y);
    push(cellWidth - 1, y);
  }

  while (queue.length) {
    const [localX, localY] = queue.pop();
    const absoluteX = startX + localX;
    const absoluteY = startY + localY;
    const index = (absoluteY * info.width + absoluteX) * 4;
    if (!isStudioMatte(index)) continue;
    data[index + 3] = 0;
    push(localX - 1, localY);
    push(localX + 1, localY);
    push(localX, localY - 1);
    push(localX, localY + 1);
  }
}

for (let cellY = 0; cellY < GRID; cellY += 1) {
  for (let cellX = 0; cellX < GRID; cellX += 1) clearCellMatte(cellX, cellY);
}

// The generator can enclose checkerboard islands inside a painted contact
// shadow. Remove the unmistakable near-white checker colors globally after
// the flood fill, while leaving darker metal highlights and the warm shadows
// that belong to the character.
for (let index = 0; index < data.length; index += 4) {
  if (data[index + 3] === 0) continue;
  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
  const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
  if (chroma < 14 && luminance > 224) data[index + 3] = 0;
}

await sharp(data, { raw: info }).png().toFile(output);
console.log(`${output} ${info.width}x${info.height} RGBA hit atlas`);
