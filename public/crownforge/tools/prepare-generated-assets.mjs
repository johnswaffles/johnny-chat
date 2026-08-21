import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('/Users/johnshopinski/Documents/New project/second-brain/node_modules/sharp');

const [, , input, output, mode = 'unit'] = process.argv;

if (!input || !output) {
  throw new Error('Usage: node prepare-generated-assets.mjs <input> <output> [unit|field]');
}

function cleanPixel(data, index, cleanupMode) {
  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  const alpha = data[index + 3];

  if (alpha < 24) {
    data[index + 3] = 0;
    return;
  }

  // The image model occasionally leaves red/magenta matte fragments around
  // transparent silhouettes. Crownforge's palette has no red edge matte, so
  // removing those pixels is safer than allowing a colored fringe into play.
  const redMatte = red > 150 && red > green * 1.34 && red > blue * 1.34 && blue < 125;
  if (cleanupMode === 'unit' && redMatte) {
    data[index + 3] = 0;
    return;
  }

  // Keep the warm painted contact shadows, but discard translucent neutral or
  // yellow studio-edge pixels that read as a glow against the meadow.
  const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
  const yellowEdge = alpha < 224 && red > 175 && green > 155 && blue < 108;
  const neutralEdge = alpha < 150 && chroma < 24 && red > 150;
  if (yellowEdge || neutralEdge) data[index + 3] = 0;
}

const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for (let index = 0; index < data.length; index += 4) cleanPixel(data, index, mode);

await sharp(data, { raw: info }).png().toFile(output);
console.log(`${output} ${info.width}x${info.height} ${mode}`);
