import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('/Users/johnshopinski/Documents/New project/second-brain/node_modules/sharp');

const input = process.argv[2];
const output = process.argv[3] ?? './assets/crownforge-raider-attack-loop-v3.png';
if (!input) {
  throw new Error('Usage: node tools/prepare-raider-attack-atlas.mjs <input.png> [output.png]');
}

function removeCheckerboardMatte(data) {
  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
    const luminance = (red * 0.2126) + (green * 0.7152) + (blue * 0.0722);
    // The built-in image output represents transparency with a light checkerboard.
    // Remove only neutral, bright matte pixels so the raider, steel, red sash, and
    // soft contact shadows remain intact.
    if (chroma < 24 && luminance > 190) {
      data[index + 3] = 0;
    } else if (chroma < 24 && luminance > 150) {
      data[index + 3] = Math.max(0, Math.min(255, Math.round((190 - luminance) * 6.4)));
    }
  }
}

const { data, info } = await sharp(input)
  .ensureAlpha()
  .resize(1254, 1254, { fit: 'fill' })
  .raw()
  .toBuffer({ resolveWithObject: true });
removeCheckerboardMatte(data);
const cellWidth = 1254 / 4;
const cellHeight = 1254 / 4;
const composites = [];
for (let row = 0; row < 4; row += 1) {
  for (let column = 0; column < 4; column += 1) {
    const left = Math.ceil(column * cellWidth);
    const top = Math.ceil(row * cellHeight);
    const right = Math.floor((column + 1) * cellWidth);
    const bottom = Math.floor((row + 1) * cellHeight);
    const source = await sharp(data, { raw: info })
      .extract({ left, top, width: right - left, height: bottom - top })
      .resize(Math.floor((right - left) * 0.9), Math.floor((bottom - top) * 0.9), { fit: 'fill' })
      .png()
      .toBuffer();
    composites.push({
      input: source,
      left: Math.round(column * cellWidth + (cellWidth - (right - left) * 0.9) / 2),
      top: Math.round(row * cellHeight + (cellHeight - (bottom - top) * 0.9) / 2),
    });
  }
}
await sharp({
  create: { width: 1254, height: 1254, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite(composites)
  .png()
  .toFile(output);
console.log(`${output} ${info.width}x${info.height} RGBA`);
