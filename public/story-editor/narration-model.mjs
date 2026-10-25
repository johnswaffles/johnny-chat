// Shared validation and cache identity inputs; never includes manuscript text.
export const NARRATION_MODEL='gpt-realtime-2.1-mini';
export const NARRATION_VOICES=['marin','cedar','alloy','ash','ballad','coral','echo','sage','shimmer','verse'];
export const NARRATION_PRESETS={natural:'Read naturally and warmly, with clear diction and restrained emotion.',intimate:'Read quietly and intimately, with a reflective, unhurried delivery.',dramatic:'Read with dramatic tension and expressive character voices, without exaggeration.',bright:'Read with bright, playful energy and an inviting storytelling tone.'};
export const MAX_NARRATION_DIRECTION=2000;
export function narrationOptions(value={}){
 if(value==null)value={};
 if(typeof value!=='object'||Array.isArray(value))throw Object.assign(Error('Choose valid narration settings.'),{status:400});
 const voice=value.voice??'marin',direction=value.direction??NARRATION_PRESETS.natural;
 if(!NARRATION_VOICES.includes(voice))throw Object.assign(Error('Choose a supported narration voice.'),{status:400});
 if(typeof direction!=='string'||direction.length>MAX_NARRATION_DIRECTION)throw Object.assign(Error('Reading directions must be text, up to 2,000 characters. Shorten them before reading.'),{status:400});
 return {model:NARRATION_MODEL,voice,direction:direction.trim()};
}
export function narrationHeader(options){return btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(narrationOptions(options)))));}

export const narrationSignature=options=>JSON.stringify({...narrationOptions(options),parts:'paragraph-v1'});
