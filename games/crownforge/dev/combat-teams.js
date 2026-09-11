// Local training scene uses the real controls and combat; no production world changes.
const {simulation:s,renderer:r}=window.crownforge;
s.units=[];s.buildings=[];s.resourcesNodes=[];s.decorations=[];s.projectiles=[];s.navigationVersion++;
s._checkVictory=()=>{};s._updateEnemyAI=()=>{};s._updateEnemyIntent=()=>{};s._updateMilitaryServices=()=>{};s.wildlifeState.nextSpawnAt=Infinity;
const tank=s.addUnit('shieldbearer',180,180,'player'),spear=s.addUnit('spearwarden',177,181,'player'),spear2=s.addUnit('spearwarden',176,182,'player'),healer=s.addUnit('villager',176,179,'player'),bear=s.addUnit('grizzly',184,180,'wildlife');
let running=false,hits=0,protectedHits=0;const applyDamage=s._applyUnitDamage.bind(s);s._applyUnitDamage=(target,amount,attacker,...rest)=>{if(attacker===bear){if(target===tank)hits++;else if(!tank.dead)protectedHits++;}return applyDamage(target,amount,attacker,...rest);};
const updateUnit=s._updateUnit.bind(s);s._updateUnit=(u,dt)=>{if(running){updateUnit(u,dt);if(tank.dead)running=false;}};
bear.maxHp=18000;bear.hp=1800; // Extended-life training target, visibly labeled.
const pick=units=>{s.selectedIds=units.map(u=>u.id);s._syncSelectionFlags();};pick([spear]);
r.camera.zoom=.65;r.zoomMotion=null;r.cameraInitialized=true;const center=r.worldToScreen({x:180,z:180});r.camera.x+=r.width*.62-center.x;r.camera.y+=r.height*.58-center.y;
const bar=document.createElement('section');bar.style='position:fixed;right:12px;bottom:100px;max-width:460px;z-index:8;background:#16271ef2;color:#f4e8c8;padding:12px;border:1px solid #a88c54;border-radius:8px;font:12px system-ui';
bar.innerHTML='<b>Team training · local review</b><p>Training bear has extended health. Production bear health is unchanged.</p><div style="display:flex;gap:5px;flex-wrap:wrap"><button data-pick="spear">Inspect Spearwarden</button><button data-pick="tank">Inspect tank</button><button data-pick="squad">Select squad</button><button data-pick="healer">Inspect Hearthkin</button><button data-start>Start training fight</button><button data-reset>Reset training</button></div><p data-state></p>';
document.body.append(bar);bar.querySelector('[data-pick=spear]').onclick=()=>pick([spear]);bar.querySelector('[data-pick=tank]').onclick=()=>pick([tank]);bar.querySelector('[data-pick=healer]').onclick=()=>pick([healer]);bar.querySelector('[data-pick=squad]').onclick=()=>pick([tank,spear,spear2,healer]);
bar.querySelector('[data-start]').onclick=()=>{running=true;bear.stunTimer=0;bear.command='idle';tank.hp=tank.maxHp;tank.dead=false;for(const u of [tank,spear,spear2])s._sendUnitToAttack(u,bear);};
bar.querySelector('[data-reset]').onclick=()=>location.reload();
setInterval(()=>{bar.querySelector('[data-state]').textContent=`Tank ${Math.ceil(tank.hp)}/${tank.maxHp} HP · Bear target: ${s._getExplicitAttackTarget(bear)?.type??'none'} · Teams: ${s.getCombatTeams().length} · Heals: ${healer.healTargetId?'active':'waiting'} · Tank hits: ${hits} · Other hits before tank fell: ${protectedHits}`;},250);
