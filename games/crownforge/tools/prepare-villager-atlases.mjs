import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('/Users/johnshopinski/Documents/New project/second-brain/node_modules/sharp');

const sheets = [
  {
    input: '/Users/johnshopinski/.codex/generated_images/01a007ae-320d-74a2-b1f1-93af3dba2575/exec-a419a028-9c75-4bbd-825c-6d8e19919c4b.png',
    output: '/Users/johnshopinski/Documents/New project/crownforge/assets/villager-motion-atlas.png',
  },
  {
    input: '/Users/johnshopinski/.codex/generated_images/01a007ae-320d-74a2-b1f1-93af3dba2575/exec-8c48591d-84ba-42a2-9c81-15d70f605646.png',
    output: '/Users/johnshopinski/Documents/New project/crownforge/assets/villager-task-atlas.png',
  },
  {
    input: '/Users/johnshopinski/.codex/generated_images/01a007ae-320d-74a2-b1f1-93af3dba2575/exec-b4c8ad84-a788-44c8-9907-0ad23915de84.png',
    output: '/Users/johnshopinski/Documents/New project/crownforge/assets/villager-carry-atlas.png',
  },
  {
    input: '/Users/johnshopinski/.codex/generated_images/01a007ae-320d-74a2-b1f1-93af3dba2575/exec-98688e97-f7da-4869-a5be-20ea996d39a2.png',
    output: '/Users/johnshopinski/Documents/New project/crownforge/assets/villager-combat-atlas.png',
  },
];

function removeNeutralMatte(data) {
  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
    const luminance = (red * 0.2126) + (green * 0.7152) + (blue * 0.0722);

    // The generated sheets use a flat neutral matte (or a neutral checkerboard).
    // Keep the painted, darker ground shadows while removing only the light neutral field.
    if (chroma < 22 && luminance > 176) {
      data[index + 3] = 0;
    } else if (chroma < 22 && luminance > 154) {
      data[index + 3] = Math.max(0, Math.min(255, Math.round((176 - luminance) * 11.6)));
    }
  }
}

for (const sheet of sheets) {
  const { data, info } = await sharp(sheet.input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  removeNeutralMatte(data);
  await sharp(data, { raw: info }).png().toFile(sheet.output);
  console.log(`${sheet.output} ${info.width}x${info.height}`);
}
