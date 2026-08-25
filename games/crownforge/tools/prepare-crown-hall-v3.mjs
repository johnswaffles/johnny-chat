import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('/Users/johnshopinski/Documents/New project/second-brain/node_modules/sharp');

const [, , input, output] = process.argv;
if (!input || !output) throw new Error('Usage: node prepare-crown-hall-v3.mjs <input> <output>');

const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const visited = new Uint8Array(info.width * info.height);
const queue = [];
const isStudioMatte = (x, y) => {
  const index = (y * info.width + x) * 4;
  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  const brightness = (red + green + blue) / 3;
  const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
  return brightness >= 176 && chroma < 28;
};

const enqueue = (x, y) => {
  if (x < 0 || y < 0 || x >= info.width || y >= info.height) return;
  const offset = y * info.width + x;
  if (visited[offset] || !isStudioMatte(x, y)) return;
  visited[offset] = 1;
  queue.push(offset);
};

for (let x = 0; x < info.width; x += 1) {
  enqueue(x, 0);
  enqueue(x, info.height - 1);
}
for (let y = 0; y < info.height; y += 1) {
  enqueue(0, y);
  enqueue(info.width - 1, y);
}

for (let cursor = 0; cursor < queue.length; cursor += 1) {
  const offset = queue[cursor];
  const x = offset % info.width;
  const y = Math.floor(offset / info.width);
  data[offset * 4 + 3] = 0;
  enqueue(x - 1, y - 1);
  enqueue(x, y - 1);
  enqueue(x + 1, y - 1);
  enqueue(x - 1, y);
  enqueue(x + 1, y);
  enqueue(x - 1, y + 1);
  enqueue(x, y + 1);
  enqueue(x + 1, y + 1);
}

await sharp(data, { raw: info }).png().toFile(output);
console.log(`${output} ${info.width}x${info.height}; removed ${queue.length} matte pixels`);
