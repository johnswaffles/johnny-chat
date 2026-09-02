import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const [sourceArgument, outputArgument, sharpModuleArgument, ...cliArguments] = process.argv.slice(2);

if (!sourceArgument || !outputArgument) {
  console.error('Usage: node prepare-roster-animation-atlases.mjs <strip-directory> <output-directory> [sharp-module-path]');
  process.exit(1);
}

const sharp = require(sharpModuleArgument || 'sharp');
const sourceRoot = path.resolve(sourceArgument);
const outputRoot = path.resolve(outputArgument);
const optionValue = (name, fallback = null) => {
  const index = cliArguments.indexOf(name);
  return index >= 0 ? cliArguments[index + 1] : fallback;
};
const selectedUnit = optionValue('--unit');
const selectedAnimation = optionValue('--animation');
const sourceVersion = optionValue('--source-version', '1');
const outputVersion = optionValue('--output-version', sourceVersion);

const units = [
  'crown-hearthkin',
  'crown-guard',
  'crown-scout',
  'crown-spearwarden',
  'crown-militia',
  'crown-shieldbearer',
  'ashen-hearthkin',
  'ashen-raider',
  'ashen-outrider',
  'thorn-spear',
  'hearth-levy',
  'ashen-hidewall',
];

const animations = {
  walk: 3,
  attack: 3,
  death: 4,
};

// Crownforge's animation direction indices are front, right, back, left.
const directions = ['south', 'east', 'north', 'west'];
const sourceCell = { width: 720, height: 724 };
// 360 pixels keeps a two-pixel source sample for every production pixel and
// remains comfortably above the largest in-game unit render size (190px).
const outputCell = { width: 360, height: 362 };

await mkdir(outputRoot, { recursive: true });

for (const unit of units.filter((entry) => !selectedUnit || entry === selectedUnit)) {
  for (const [animation, frameCount] of Object.entries(animations)) {
    if (selectedAnimation && animation !== selectedAnimation) continue;
    const composites = [];
    for (const [row, direction] of directions.entries()) {
      const source = path.join(sourceRoot, `${unit}-${animation}-${direction}-${frameCount}phase-v${sourceVersion}.png`);
      const metadata = await sharp(source).metadata();
      const expectedWidth = sourceCell.width * frameCount;
      if (metadata.width !== expectedWidth || metadata.height !== sourceCell.height) {
        throw new Error(`${path.basename(source)} is ${metadata.width}x${metadata.height}; expected ${expectedWidth}x${sourceCell.height}`);
      }

      for (let frame = 0; frame < frameCount; frame += 1) {
        const input = await sharp(source)
          .extract({
            left: frame * sourceCell.width,
            top: 0,
            width: sourceCell.width,
            height: sourceCell.height,
          })
          .resize(outputCell.width, outputCell.height, { fit: 'fill', kernel: 'lanczos3' })
          .png({ compressionLevel: 9, effort: 10 })
          .toBuffer();
        composites.push({ input, left: frame * outputCell.width, top: row * outputCell.height });
      }
    }

    const width = outputCell.width * frameCount;
    const height = outputCell.height * directions.length;
    const filename = `crownforge-roster-v${outputVersion}-${unit}-${animation}.png`;
    await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite(composites)
      .png({ compressionLevel: 9, effort: 10 })
      .toFile(path.join(outputRoot, filename));
    console.log(`${filename}: ${width}x${height} (${frameCount} frames x 4 directions)`);
  }
}
