// Isolated first-level preview tuning. No campaign or later-level defaults.
export const LEVEL1={staffInterval:.98,blinkInterval:3.8,blinkGuard:.85,ringSpeed:.25,hitStop:.035,hitStopGap:.3,maxProjectiles:96,maxEffects:48,maxParticles:420,
 spells:{ember:{name:'Ember Orb',max:6,damage:66,radius:120,burnDamage:6,burnDuration:2.4,burnInterval:.6,cooldown:.6},frost:{name:'Frost Fan',max:6,damage:16,shards:5,freeze:1.1,slow:.5,slowDuration:1.6,shatter:24,cooldown:.5},chain:{name:'Chain Spark',max:6,damage:45,targets:4,range:470,jumpRange:230,stagger:.3,cooldown:.55},flask:{name:'Healing Flask',max:3,heal:65,cooldown:.5}},
 staff:{thresholds:[0,6,15],damage:[36,46,38],bolts:[1,1,3]},overflowScore:75};
export const SOLIDS=[]; // This level uses one-way platforms; no invented solid walls.
export function segmentBlocked(a,b,solids=SOLIDS){return solids.some(s=>{const lo=Math.min(a.x,b.x)-16,hi=Math.max(a.x,b.x)+16;return hi>s.x&&lo<s.x+s.w&&Math.max(a.y,b.y)>s.y&&Math.min(a.y,b.y)-100<s.y+s.h;});}
