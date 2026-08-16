import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('/Users/johnshopinski/Documents/New project/second-brain/node_modules/sharp');

const sheets = [
  {
    input: '/Users/johnshopinski/.codex/generated_images/01a007ae-320d-74a2-b1f1-93af3dba2575/exec-95842463-eeda-4636-af7d-4cd3d829e792.png',
    output: '/Users/johnshopinski/Documents/New project/crownforge/assets/crownforge-environment-atlas-v2.png',
  },
  {
    input: '/Users/johnshopinski/.codex/generated_images/01a007ae-320d-74a2-b1f1-93af3dba2575/exec-aecb91e8-4595-4674-ac91-07bd28f18138.png',
    output: '/Users/johnshopinski/Documents/New project/crownforge/assets/crownforge-building-stages-v2.png',
  },
];

function removeNeutralMatte(data, info) {
  const samplePoints = [
    [2, 2],
    [info.width - 3, 2],
    [2, info.height - 3],
    [info.width - 3, info.height - 3],
  ];
  const background = samplePoints.reduce((sum, [x, y]) => {
    const index = (y * info.width + x) * 4;
    sum[0] += data[index];
    sum[1] += data[index + 1];
    sum[2] += data[index + 2];
    return sum;
  }, [0, 0, 0]).map((channel) => channel / samplePoints.length);

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
    const distance = Math.hypot(red - background[0], green - background[1], blue - background[2]);
    // The generated sheets use a neutral studio matte that shifts subtly around
    // each subject. Remove that neutral range more firmly while preserving the
    // colored foliage, wood, stone texture, and attached contact shadows.
    if (distance < 58 && chroma < 18) {
      data[index + 3] = 0;
    } else if (distance < 88 && chroma < 18) {
      data[index + 3] = Math.max(0, Math.min(255, Math.round((distance - 58) * 8.5)));
    } else if (distance < 34) {
      data[index + 3] = Math.max(0, Math.min(255, Math.round((distance - 12) * 11.6)));
    }
  }
}

for (const sheet of sheets) {
  const { data, info } = await sharp(sheet.input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  removeNeutralMatte(data, info);
  await sharp(data, { raw: info }).png().toFile(sheet.output);
  console.log(`${sheet.output} ${info.width}x${info.height}`);
}
