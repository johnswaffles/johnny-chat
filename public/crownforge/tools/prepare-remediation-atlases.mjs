import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('/Users/johnshopinski/Documents/New project/second-brain/node_modules/sharp');

const sheets = [
  {
    input: '/Users/johnshopinski/.codex/generated_images/01a007ae-320d-74a2-b1f1-93af3dba2575/exec-62691ec3-4a82-4a8b-9f55-0cf7788dd725.png',
    output: '/Users/johnshopinski/Documents/New project/crownforge/assets/villager-carry-wood-loop-v1.png',
  },
  {
    input: '/Users/johnshopinski/.codex/generated_images/01a007ae-320d-74a2-b1f1-93af3dba2575/exec-20fd820d-3211-4f34-a225-4f14ae1c095f.png',
    output: '/Users/johnshopinski/Documents/New project/crownforge/assets/villager-carry-food-loop-v1.png',
  },
  {
    input: '/Users/johnshopinski/.codex/generated_images/01a007ae-320d-74a2-b1f1-93af3dba2575/exec-afdb1ead-e6c1-41f6-a0f6-f1a72e95292f.png',
    output: '/Users/johnshopinski/Documents/New project/crownforge/assets/villager-carry-stone-loop-v1.png',
  },
  {
    input: '/Users/johnshopinski/.codex/generated_images/01a007ae-320d-74a2-b1f1-93af3dba2575/exec-4eac36b0-56e8-4fb1-b863-eb86aebee16f.png',
    output: '/Users/johnshopinski/Documents/New project/crownforge/assets/villager-carry-supplies-loop-v1.png',
  },
  {
    input: '/Users/johnshopinski/.codex/generated_images/01a007ae-320d-74a2-b1f1-93af3dba2575/exec-f63e1161-9156-459b-8d05-95ccc36638e4.png',
    output: '/Users/johnshopinski/Documents/New project/crownforge/assets/crownforge-soldier-attack-loop-v1.png',
  },
  {
    input: '/Users/johnshopinski/.codex/generated_images/01a007ae-320d-74a2-b1f1-93af3dba2575/exec-677415df-0c4c-44c2-b6eb-9ff839648a06.png',
    output: '/Users/johnshopinski/Documents/New project/crownforge/assets/crownforge-raider-attack-loop-v1.png',
  },
];

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

for (const sheet of sheets) {
  const { data, info } = await sharp(sheet.input).ensureAlpha().resize(1254, 1254, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  removeNeutralMatte(data);
  await sharp(data, { raw: info }).png().toFile(sheet.output);
  console.log(`${sheet.output} ${info.width}x${info.height}`);
}
