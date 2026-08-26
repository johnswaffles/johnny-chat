import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('/Users/johnshopinski/Documents/New project/second-brain/node_modules/sharp');

const [, , input, output, gridArgument = '4', maximumScaleArgument = '0.92', matteArgument = 'none'] = process.argv;
if (!input || !output) {
  throw new Error('Usage: node tools/prepare-cell-safe-atlas.mjs <generated.png> <output.png> [grid] [maximum-scale]');
}

const GRID = Number.parseInt(gridArgument, 10);
const MAXIMUM_SCALE = Number.parseFloat(maximumScaleArgument);
const ATLAS_SIZE = 1254;
const VISIBLE_ALPHA = 8;
const MIN_COMPONENT_PIXELS = 8;
const HORIZONTAL_GUTTER = 10;
const TOP_GUTTER = 12;
const BOTTOM_GUTTER = 14;

if (!Number.isInteger(GRID) || GRID < 2 || GRID > 6) throw new Error(`Invalid grid: ${gridArgument}`);
if (!Number.isFinite(MAXIMUM_SCALE) || MAXIMUM_SCALE <= 0 || MAXIMUM_SCALE > 1.5) {
  throw new Error(`Invalid maximum scale: ${maximumScaleArgument}`);
}

const { data, info } = await sharp(input)
  .ensureAlpha()
  .resize(ATLAS_SIZE, ATLAS_SIZE, { fit: 'fill' })
  .raw()
  .toBuffer({ resolveWithObject: true });

if (matteArgument === 'neutral') {
  // Image generation can preview transparency as a baked light checkerboard.
  // Remove only that high-value neutral matte; preserve dark painted contact
  // shadows and the warm gray cloth, bone, fur, iron, and timber palette.
  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const brightness = (red + green + blue) / 3;
    const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
    if (brightness >= 222 && chroma <= 18) {
      data[index + 3] = 0;
    } else if (brightness >= 204 && chroma <= 12) {
      data[index + 3] = Math.min(
        data[index + 3],
        Math.max(0, Math.min(255, Math.round((222 - brightness) / 18 * 255))),
      );
    }
  }
}
if (matteArgument === 'green') {
  // A deliberate chroma-key plate gives the cleanest enclosed transparency
  // for hair, limbs, weapons, and clothing. Feather only the green-dominant
  // edge pixels, then neutralize residual spill before component packing.
  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const dominance = green - Math.max(red, blue);
    if (green >= 90 && dominance >= 42) {
      data[index + 3] = 0;
    } else if (green >= 70 && dominance >= 12) {
      data[index + 3] = Math.min(
        data[index + 3],
        Math.max(0, Math.min(255, Math.round((42 - dominance) / 30 * 255))),
      );
      data[index + 1] = Math.min(green, Math.max(red, blue) + 4);
    }
  }
}

const totalPixels = info.width * info.height;
const labels = new Uint32Array(totalPixels);
const stack = new Int32Array(totalPixels);
const components = [];
const visible = (pixel) => data[pixel * 4 + 3] > VISIBLE_ALPHA;

for (let seed = 0; seed < totalPixels; seed += 1) {
  if (labels[seed] || !visible(seed)) continue;
  const id = components.length + 1;
  let head = 0;
  let tail = 0;
  stack[tail++] = seed;
  labels[seed] = id;
  let count = 0;
  let minX = info.width;
  let maxX = -1;
  let minY = info.height;
  let maxY = -1;
  let sumX = 0;
  let sumY = 0;

  while (head < tail) {
    const pixel = stack[head++];
    const x = pixel % info.width;
    const y = Math.floor(pixel / info.width);
    count += 1;
    sumX += x;
    sumY += y;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);

    for (let deltaY = -1; deltaY <= 1; deltaY += 1) {
      for (let deltaX = -1; deltaX <= 1; deltaX += 1) {
        if (!deltaX && !deltaY) continue;
        const nextX = x + deltaX;
        const nextY = y + deltaY;
        if (nextX < 0 || nextX >= info.width || nextY < 0 || nextY >= info.height) continue;
        const next = nextY * info.width + nextX;
        if (labels[next] || !visible(next)) continue;
        labels[next] = id;
        stack[tail++] = next;
      }
    }
  }

  if (count < MIN_COMPONENT_PIXELS) continue;
  components.push({
    id,
    count,
    left: minX,
    top: minY,
    right: maxX,
    bottom: maxY,
    centerX: sumX / count,
    centerY: sumY / count,
  });
}

const sourceCellWidth = info.width / GRID;
const sourceCellHeight = info.height / GRID;
const expectedFrames = GRID * GRID;
const substantial = [...components]
  .sort((first, second) => second.count - first.count)
  .slice(0, expectedFrames)
  .sort((first, second) => first.centerY - second.centerY);
if (substantial.length !== expectedFrames) {
  throw new Error(`Expected ${expectedFrames} complete subjects, found ${substantial.length}`);
}

const frames = [];
for (let row = 0; row < GRID; row += 1) {
  const rowSubjects = substantial
    .slice(row * GRID, (row + 1) * GRID)
    .sort((first, second) => first.centerX - second.centerX);
  for (let column = 0; column < GRID; column += 1) {
    const main = rowSubjects[column];
    frames.push({ row, column, main, components: [main] });
  }
}

const mainIds = new Set(frames.map((frame) => frame.main.id));
const satelliteLimit = Math.hypot(sourceCellWidth, sourceCellHeight) * 0.48;
for (const component of components) {
  if (mainIds.has(component.id)) continue;
  let nearest = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const frame of frames) {
    const separation = Math.hypot(
      component.centerX - frame.main.centerX,
      component.centerY - frame.main.centerY,
    );
    if (separation < nearestDistance) {
      nearest = frame;
      nearestDistance = separation;
    }
  }
  if (nearest && nearestDistance <= satelliteLimit) nearest.components.push(component);
}

for (const frame of frames) {
  frame.left = Math.min(...frame.components.map((component) => component.left));
  frame.top = Math.min(...frame.components.map((component) => component.top));
  frame.right = Math.max(...frame.components.map((component) => component.right));
  frame.bottom = Math.max(...frame.components.map((component) => component.bottom));
  frame.width = frame.right - frame.left + 1;
  frame.height = frame.bottom - frame.top + 1;
  frame.componentIds = new Set(frame.components.map((component) => component.id));
}

const outputCellWidth = ATLAS_SIZE / GRID;
const outputCellHeight = ATLAS_SIZE / GRID;
const maximumWidth = Math.floor(outputCellWidth - HORIZONTAL_GUTTER * 2);
const maximumHeight = Math.floor(outputCellHeight - TOP_GUTTER - BOTTOM_GUTTER);
const uniformScale = Math.min(MAXIMUM_SCALE, ...frames.flatMap((frame) => [
  maximumWidth / frame.width,
  maximumHeight / frame.height,
]));

const composites = [];
for (const frame of frames) {
  const framePixels = Buffer.alloc(frame.width * frame.height * 4);
  for (let localY = 0; localY < frame.height; localY += 1) {
    for (let localX = 0; localX < frame.width; localX += 1) {
      const sourceX = frame.left + localX;
      const sourceY = frame.top + localY;
      const sourcePixel = sourceY * info.width + sourceX;
      if (!frame.componentIds.has(labels[sourcePixel])) continue;
      const sourceIndex = sourcePixel * 4;
      const targetIndex = (localY * frame.width + localX) * 4;
      data.copy(framePixels, targetIndex, sourceIndex, sourceIndex + 4);
    }
  }
  const targetWidth = Math.max(1, Math.floor(frame.width * uniformScale));
  const targetHeight = Math.max(1, Math.floor(frame.height * uniformScale));
  const targetCellLeft = Math.ceil(frame.column * outputCellWidth);
  const targetCellTop = Math.ceil(frame.row * outputCellHeight);
  const targetCellRight = Math.floor((frame.column + 1) * outputCellWidth);
  const targetCellBottom = Math.floor((frame.row + 1) * outputCellHeight);
  const targetCellWidth = targetCellRight - targetCellLeft;
  const sprite = await sharp(framePixels, {
    raw: { width: frame.width, height: frame.height, channels: 4 },
  })
    .resize(targetWidth, targetHeight, { fit: 'fill' })
    .png()
    .toBuffer();
  composites.push({
    input: sprite,
    left: targetCellLeft + Math.floor((targetCellWidth - targetWidth) / 2),
    top: Math.max(targetCellTop + TOP_GUTTER, targetCellBottom - BOTTOM_GUTTER - targetHeight),
  });
}

await sharp({
  create: {
    width: ATLAS_SIZE,
    height: ATLAS_SIZE,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(composites)
  .png()
  .toFile(output);

console.log(JSON.stringify({
  input,
  output,
  grid: `${GRID}x${GRID}`,
  dimensions: `${ATLAS_SIZE}x${ATLAS_SIZE}`,
  uniformScale: Number(uniformScale.toFixed(4)),
  frames: frames.map((frame) => ({
    row: frame.row,
    column: frame.column,
    width: frame.width,
    height: frame.height,
    components: frame.components.length,
  })),
  gutter: { horizontal: HORIZONTAL_GUTTER, top: TOP_GUTTER, bottom: BOTTOM_GUTTER },
}, null, 2));
