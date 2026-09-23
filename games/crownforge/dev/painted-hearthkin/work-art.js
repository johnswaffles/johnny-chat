import {HEARTHKIN_PAINTED_ART as art} from '../../src/hearthkin-painted-art.js?v=20260923-toolbar3';
export const WORK_ART=Object.fromEntries(Object.entries(art).map(([v,actions])=>[v,Object.fromEntries(Object.entries(actions).filter(([a])=>!["walk","idle"].includes(a)).map(([a,s])=>[a,{...s,src:'../../'+s.src}]))]));
