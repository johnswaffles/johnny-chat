const glyphs={
 spearwardenOath:'M12 2l4 7-4 3-4-3Z M12 12v10 M5 16l3 3 M19 16l-3 3',
 shieldbearerOath:'M3 21V5h5V2h8v3h5v16 M8 21V10h8v11 M9 5l3 2 3-2',
 eventidePassage:'M9 3C1 4 1 20 9 21 M15 3c8 1 8 17 0 18 M8 12h8m-3-3 3 3-3 3 M5 5l2 2 M17 17l2 2',
 distantStar:'M2 19h20 M4 16l4-5 4 5 M16 2l2 5 4 2-4 2-2 5-2-5-4-2 4-2Z',
 elderbloodSpellward:'M12 2 3 6v7q1 6 9 9 8-3 9-9V6Z M14 5l-6 8h5l-2 6 7-10h-5Z M5 4l14 16',
 heavenrend:'M2 5l7 3 3-6 3 6 7-3-4 9-5-3-2 5-3-2Z M14 13l-4 6h4l-3 4',stormwardCovenant:'M12 2 3 6v7q1 6 9 9 8-3 9-9V6Z M14 6l-6 7h5l-2 5 6-8h-5Z',skybreakerFavor:'m14 2-9 12h7l-2 8 10-13h-8Z',unboundSovereign:'M2 4l8 5 2-6 2 6 8-5-5 13-5-4-5 4Z',

 starveilOath:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z',starshard:'m3 21 9-19 2 8 8 2Z M3 15l6-6',fallingConstellation:'m4 3 3 5-3 5 M12 2l3 5-3 5 M20 5l-3 5 3 5 M4 21l8-4 8 4',astralMantle:'M12 2 3 6v6q0 7 9 10 9-3 9-10V6Z M8 12l4-5 4 5-4 5Z',
 lastCrownMercy:'M12 2 3 6v6q0 7 9 10 9-3 9-10V6Z M12 7v10 M7 12h10 M7 4l2 3 3-4 3 4 2-3',
 beyondFirstOath:'M12 2 3 6v6q0 7 9 10 9-3 9-10V6Z M13 5 8 12h5l-2 7 6-9h-5Z',
 lastLightChorus:'M12 21S1 14 3 7q4-5 9 1 5-6 9-1 2 7-9 14Z M12 9v8 M8 13h8 M2 3h3 M19 3h3',
 crownsAegis:'M12 3 4 6v7q0 6 8 9 8-3 8-9V6Z M8 12h8 M12 8v9',
 oathboundStride:'m5 18 6-7-2-5 5-3 3 7-5 7 7 2 M3 21h8',
 kingsbaneHunger:'m3 7 4 3 5-6 5 6 4-3-3 11H6Z M8 14l8 5 M16 14l-8 5',
 falteringCrown:'M2 12q10-13 20 0-10 13-20 0Z M12 8v8 M9 12h6',
 greatwoodDefiance:'m12 2-7 9h4l-5 6h6v5h4v-5h6l-5-6h4Z',
 greatwoodColossus:'m3 21 2-12 5-6h4l5 6 2 12 M7 20v-8 M17 20v-8 M8 7h8',
 bloodclawReckoning:'M7 3 3 21l6-9 M14 3 9 21l7-10 M21 3l-5 18 6-10',
 crownsLastBastion:'M4 21V8h4V4h3v4h3V4h3v4h3v13Z M10 21v-6h4v6',
 unbrokenWild:'M12 21S1 14 3 7q4-5 9 1 5-6 9-1 2 7-9 14Z M12 9v9m-4-5 4 2 4-2',
 deathlessHeart:'M12 21S1 14 3 7q4-5 9 1 5-6 9-1 2 7-9 14Z M9 11l6 6m0-6-6 6 M12 1v3',
 crushingClaws:'m4 3 1 8 4 3 M11 2l1 9 4 3 M18 3l2 9-3 8-9 1-5-6',
 firstCondemnation:'M12 2 3 7v10l9 5 9-5V7Z M8 7l8 10 M16 7 8 17 M6 12h12',
 elderhide:'m4 3 8 3 8-3v9q0 7-8 10-8-3-8-10Z M7 10l10 7 M17 10 7 17',
 thickHide:'m3 7 9-5 9 5-9 5Z M3 12l9 5 9-5 M3 17l9 5 9-5',
 bearLineage:'M8 13q4-4 8 0l4 6q-8 5-16 0Z M4 7v3 M9 3v5 M15 3v5 M20 7v3',
 ward:'M12 2v20 M2 12h20 M5 5l14 14 M19 5 5 19 M8 8h8v8H8Z',
 lastLight:'M7 4h10v9l-5 8-5-8Z M9 8l6 5 M15 8l-6 5',
 greatwoodFury:'M12 2q-7 8-6 11l-3-2q-1 11 9 11 11 0 8-14l-4 5q2-5-4-11Z',
 stun:'m12 2 2 7 8-2-6 6 5 7-8-3-5 5 1-9-7-3 8-1Z',
 stunImmunity:'M12 3 4 6v7q0 6 8 9 8-3 8-9V6Z M8 12l3 3 5-6'
};
export const isDebuff=s=>s.id==='lastLight'||s.id==='stun'||s.rune==='curse'||s.kind?.toLowerCase().includes('impairment');
export function effectIcon(status){
 const colors={kingsbaneHunger:18,falteringCrown:330,greatwoodDefiance:140,greatwoodColossus:35,bloodclawReckoning:0,unbrokenWild:155,deathlessHeart:280,crushingClaws:28,firstCondemnation:270,elderhide:45,thickHide:195,bearLineage:40,elderbloodSpellward:220,greatwoodFury:8,starveilOath:46,starshard:190,fallingConstellation:275,eventidePassage:285,distantStar:205,astralMantle:225,heavenrend:195,stormwardCovenant:180,skybreakerFavor:42,unboundSovereign:260};
 const hue=colors[status.id]??(isDebuff(status)?'315':status.rune==='fury'?'22':status.rune==='divine'?'46':'165');
 return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="hsl(${hue} 85% 72%)" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" style="--sigil-hue:${hue}"><path d="${glyphs[status.id]??'m12 2 9 10-9 10-9-10Z M12 7v10 M7 12h10'}"/></svg>`;
}
