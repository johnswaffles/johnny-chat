import {ASHEN_HEARTHKIN_PAINTED_ART as art} from '../../src/ashen-hearthkin-painted-art.js?v=20260907-paintedashen1';
export const HEARTHKIN_ART=Object.fromEntries(Object.entries(art).map(([v,actions])=>[v,Object.fromEntries(Object.entries(actions).filter(([a])=>["walk","idle"].includes(a)).map(([a,s])=>[a,{...s,src:'../../'+s.src}]))]));
