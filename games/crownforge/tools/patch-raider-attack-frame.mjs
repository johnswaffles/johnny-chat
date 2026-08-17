import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('/Users/johnshopinski/Documents/New project/second-brain/node_modules/sharp');

const [atlasPath, framePath, outputPath = atlasPath] = process.argv.slice(2);
if (!atlasPath || !framePath) {
  throw new Error('Usage: node tools/patch-raider-attack-frame.mjs <atlas.png> <standalone-frame.png> [output.png]');
}

const atlasSize = 1254;
const cellSize = atlasSize / 4;
const targetRow = 2;
const targetColumn = 2;

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

function alphaBounds(data, info) {
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * info.channels + 3] <= 8) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxY < minY) throw new Error('No visible pixels found in standalone frame.');
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

const { data: frameData, info: frameInfo } = await sharp(framePath)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
removeCheckerboardMatte(frameData);
const bounds = alphaBounds(frameData, frameInfo);
const frame = await sharp(frameData, { raw: frameInfo })
  .extract(bounds)
  .resize({ width: 270, height: 270, fit: 'inside' })
  .png()
  .toBuffer({ resolveWithObject: true });

const recoveryCell = await sharp(atlasPath)
  .extract({ left: 0, top: Math.floor(targetRow * cellSize), width: Math.floor(cellSize), height: Math.floor(cellSize) })
  .png()
  .toBuffer();
const replacementCell = await sharp({
  create: { width: Math.floor(cellSize), height: Math.floor(cellSize), channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([{
    input: frame.data,
    left: Math.round((cellSize - frame.info.width) / 2),
    top: Math.round(cellSize - frame.info.height - 18),
  }])
  .png()
  .toBuffer();

// Rebuild the atlas on a transparent canvas. This makes the replacement a true
// cell replacement instead of alpha-compositing over the defective source cell.
const composites = [];
for (let row = 0; row < 4; row += 1) {
  for (let column = 0; column < 4; column += 1) {
    const left = Math.floor(column * cellSize);
    const top = Math.floor(row * cellSize);
    const right = Math.floor((column + 1) * cellSize);
    const bottom = Math.floor((row + 1) * cellSize);
    let input;
    if (row === targetRow && column === targetColumn) {
      input = replacementCell;
    } else if (row === targetRow && column === 3) {
      input = recoveryCell;
    } else {
      input = await sharp(atlasPath)
        .extract({ left, top, width: right - left, height: bottom - top })
        .png()
        .toBuffer();
    }
    composites.push({ input, left, top });
  }
}

const outputTarget = outputPath === atlasPath ? `${outputPath}.tmp` : outputPath;
await sharp({
  create: { width: atlasSize, height: atlasSize, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite(composites)
  .png()
  .toFile(outputTarget);

if (outputTarget !== outputPath) {
  const { rename } = await import('node:fs/promises');
  await rename(outputTarget, outputPath);
}

console.log(`${outputPath} patched row=${targetRow} column=${targetColumn} with ${frame.info.width}x${frame.info.height} frame`);
