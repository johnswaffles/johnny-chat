import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('/Users/johnshopinski/Documents/New project/second-brain/node_modules/sharp');

const input = new URL('../assets/crownforge-palisade-gate-atlas-v1.png', import.meta.url).pathname;
const output = new URL('../assets/crownforge-palisade-gate-atlas-v1-clean.png', import.meta.url).pathname;

function removeNeutralMatte(data) {
  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
    const luminance = (red * 0.2126) + (green * 0.7152) + (blue * 0.0722);
    if (chroma < 22 && luminance > 176) {
      data[index + 3] = 0;
    } else if (chroma < 22 && luminance > 154) {
      data[index + 3] = Math.max(0, Math.min(255, Math.round((176 - luminance) * 11.6)));
    }
  }
}

const { data, info } = await sharp(input)
  .ensureAlpha()
  .resize(1254, 1254, { fit: 'fill' })
  .raw()
  .toBuffer({ resolveWithObject: true });
removeNeutralMatte(data);
await sharp(data, { raw: info }).png().toFile(output);
console.log(`${output} ${info.width}x${info.height}`);
