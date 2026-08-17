import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('/Users/johnshopinski/Documents/New project/second-brain/node_modules/sharp');

const [output = './assets/crownforge-raider-attack-loop-v3.png', ...inputs] = process.argv.slice(2);
if (inputs.length !== 4) {
  throw new Error('Usage: node tools/compose-raider-attack-atlas.mjs <output.png> <row0.png> <row1.png> <row2.png> <row3.png>');
}

const atlasSize = 1254;
const cellSize = atlasSize / 4;

function removeCheckerboardMatte(data) {
  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
    const luminance = (red * 0.2126) + (green * 0.7152) + (blue * 0.0722);
    if (chroma < 24 && luminance > 190) {
      data[index + 3] = 0;
    } else if (chroma < 24 && luminance > 150) {
      data[index + 3] = Math.max(0, Math.min(255, Math.round((190 - luminance) * 6.4)));
    }
  }
}

const composites = [];
function alphaBounds(data, info, left, right) {
  let minX = right;
  let minY = info.height;
  let maxX = left - 1;
  let maxY = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = left; x < right; x += 1) {
      const alpha = data[(y * info.width + x) * info.channels + 3];
      if (alpha <= 8) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxY < minY) throw new Error(`No visible pixels in strip cell ${left}-${right}`);
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

for (let row = 0; row < inputs.length; row += 1) {
  const { data, info } = await sharp(inputs[row])
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  removeCheckerboardMatte(data);
  for (let column = 0; column < 4; column += 1) {
    const left = Math.floor(column * info.width / 4);
    const right = Math.floor((column + 1) * info.width / 4);
    const bounds = alphaBounds(data, info, left, right);
    const frame = await sharp(data, { raw: info })
      .extract(bounds)
      .resize({ width: 270, height: 270, fit: 'inside' })
      .png()
      .toBuffer({ resolveWithObject: true });
    composites.push({
      input: frame.data,
      left: Math.round(column * cellSize + (cellSize - frame.info.width) / 2),
      // A single shared baseline keeps attack, recovery, and direction changes grounded.
      top: Math.round(row * cellSize + cellSize - frame.info.height - 18),
    });
  }
}

await sharp({
  create: { width: atlasSize, height: atlasSize, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite(composites)
  .png()
  .toFile(output);
console.log(`${output} ${atlasSize}x${atlasSize} RGBA`);
