import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('/Users/johnshopinski/Documents/New project/second-brain/node_modules/sharp');

const [, , input, output] = process.argv;
if (!input || !output) throw new Error('Usage: node prepare-neutral-matte.mjs <input> <output>');

const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let removed = 0;
let softened = 0;

for (let offset = 0; offset < info.width * info.height; offset += 1) {
  const index = offset * 4;
  if (data[index + 3] === 0) continue;
  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  const brightness = (red + green + blue) / 3;
  const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);

  // Generated checkerboards can leave fully enclosed white cells between
  // rails and posts. Global neutral-keying removes those cells while warm
  // timber, gold highlights, blue cloth, soil, and contact shadows remain.
  if (brightness >= 205 && chroma <= 28) {
    data[index + 3] = 0;
    removed += 1;
    continue;
  }
  if (brightness >= 180 && chroma <= 18) {
    const edgeAlpha = Math.max(0, Math.min(255, Math.round((205 - brightness) / 25 * 255)));
    if (edgeAlpha < data[index + 3]) {
      data[index + 3] = edgeAlpha;
      softened += 1;
    }
  }
}

await sharp(data, { raw: info }).png().toFile(output);
console.log(`${output} ${info.width}x${info.height}; removed ${removed}; softened ${softened}`);
