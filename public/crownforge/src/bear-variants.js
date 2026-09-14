// Approved Greatwood bloodlines. Identity is saved on each bear, never rerolled on draw.
export const BEAR_VARIANTS=Object.freeze({
 'black-oath':{name:'The Black Oath',kind:'Keepers of the Broken Grove',summary:'Their watch began with a betrayal.',
 lore:'Before the Crownlands had a name, a grove of black firs sheltered the voices of the sleeping gods. Its keepers trusted the great bears to watch the paths. Hunger broke that trust. The bears opened the grove to the first kings, and no living keeper saw another spring. The old gods bound their bloodline to the ruined sanctuary. Their descendants wear the Black Oath beneath every scar: to stand watch over what their ancestors surrendered, until the last root forgets the axe.',
 resilience:'The Black Oath endures through patience and living roots. Its watch will outlast the kingdoms that broke the grove.'},
 'cindermaw':{name:'The Cindermaw',kind:'Children of the Judgment Fire',summary:'The fire ended. Its sentence did not.',
 lore:'When the star-grove burned, the bears that fed beside its embers would not leave their feast. The old gods drew the blaze into their hides and sealed it there. Centuries of rain have never quenched that judgment. Their descendants prowl the charcoal hollows with heat buried beneath the fur and a temper that wakes at the sound of steel. The Cindermaw do not carry a passing enchantment. The fire is a clause of the First Condemnation, written into their blood before mortal sorcery had a name.',
 resilience:'The Cindermaw carries embers that no rain can extinguish. Beneath its hide, the judgment fire still burns.'},
 'ashen-grudge':{name:'The Ashen Grudge',kind:'Rememberers Beneath the Ash',summary:'Every pale hair remembers a name.',
 lore:'After the burning, ash fell through the Greatwood for seven winters. The bears that had abandoned the grove’s keepers slept beneath that gray shroud, and the old gods allowed them no forgetting. Their descendants are born with pale guard hairs and the weight of an ancient grief. The Ashen Grudge haunt the quietest stands, listening for voices their bloodline failed to save. The First Condemnation keeps those names alive beneath their hides; no younger spell can silence a judgment older than the kingdoms.',
 resilience:'The Ashen Grudge remembers every winter beneath the gray boughs. Its ancient grief has never found rest.'},
});
export const BEAR_VARIANT_IDS=Object.freeze(Object.keys(BEAR_VARIANTS));
export function bearVariantId(unit){return Object.hasOwn(BEAR_VARIANTS,unit?.bearVariant)?unit.bearVariant:BEAR_VARIANT_IDS[Math.abs(Math.trunc(unit?.id??0))%BEAR_VARIANT_IDS.length];}
export function bearVariant(unit){const id=bearVariantId(unit);return {...BEAR_VARIANTS[id],id,art:`./assets/cursed-bears/${id}-lore-v1.png`};}
