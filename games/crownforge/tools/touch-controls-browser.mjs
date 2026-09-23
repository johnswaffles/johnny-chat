// Run with PLAYWRIGHT_MODULE pointing to an installed Playwright entry and optional CHROME_PATH.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
try{
 const context=await browser.newContext({viewport:{width:1024,height:768},hasTouch:true,isMobile:true,deviceScaleFactor:1});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.CROWNFORGE_URL||'http://127.0.0.1:8891/?review=touch1',{waitUntil:'domcontentloaded'});
 await page.locator('#loading-veil').waitFor({state:'hidden',timeout:180000});
 assert(await page.evaluate(()=>crownforge.touchControls.enabled));
 await page.locator('[data-touch="pause"]').tap();
 const clock=await page.evaluate(()=>crownforge.simulation.clock);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>crownforge.simulation.clock),clock);
 await page.locator('[data-select-class="all"]').tap();await page.locator('[data-touch="move"]').tap();await page.touchscreen.tap(520,370);
 assert(await page.evaluate(()=>crownforge.simulation.selectedEntities.every(u=>u.command==='move')));
 const runningOrders=await page.evaluate(()=>JSON.stringify(crownforge.simulation.units.map(u=>[u.id,u.command,u.path])));
 await page.locator('[data-touch="deselect"]').tap();
 assert.equal(await page.evaluate(()=>crownforge.simulation.selectedIds.length),0);
 assert.equal(await page.evaluate(()=>JSON.stringify(crownforge.simulation.units.map(u=>[u.id,u.command,u.path]))),runningOrders);
 const buildingPoint=await page.evaluate(()=>{const {simulation:s,renderer:r}=crownforge;const hall=s.buildings.find(b=>b.faction==='player');const p=r.worldToScreen(hall);r.panBy(500-p.x,400-p.y);for(let y=180;y<450;y+=10)for(let x=300;x<700;x+=10){const hit=r.getEntityAtScreen(s,{x,y},'select');if(hit?.id===hall.id)return {x,y};}throw Error('No visible building');});
 await page.touchscreen.tap(buildingPoint.x,buildingPoint.y);
 assert(await page.evaluate(()=>crownforge.simulation.selectedEntities.some(u=>u.kind==='building')));
 await page.locator('#train-menu-toggle').waitFor({state:'visible'});
 await page.locator('#train-menu-toggle').tap();await page.locator('#train-menu').waitFor({state:'visible'});
 await page.locator('#train-menu-toggle').tap();
 await page.locator('[data-select-class="all"]').tap();
 const cdp=await context.newCDPSession(page);
 const send=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([id,x,y])=>({id,x,y}))});
 const orders=await page.evaluate(()=>JSON.stringify(crownforge.simulation.selectedEntities.map(u=>[u.id,u.command,u.path])));
 const camera=await page.evaluate(()=>({...crownforge.renderer.camera}));
 await send('touchStart',[[1,500,300]]);await send('touchMove',[[1,560,340]]);await send('touchEnd',[]);
 assert.notDeepEqual(await page.evaluate(()=>({...crownforge.renderer.camera})),camera);
 assert.equal(await page.evaluate(()=>JSON.stringify(crownforge.simulation.selectedEntities.map(u=>[u.id,u.command,u.path]))),orders);
 const zoom=await page.evaluate(()=>crownforge.renderer.camera.zoom);
 await send('touchStart',[[1,440,320],[2,580,320]]);await send('touchMove',[[1,400,320],[2,620,320]]);await send('touchEnd',[]);
 assert((await page.evaluate(()=>crownforge.renderer.camera.zoom))>zoom);
 assert.equal(await page.evaluate(()=>JSON.stringify(crownforge.simulation.selectedEntities.map(u=>[u.id,u.command,u.path]))),orders);
 // Center an open building site; construction must wait for explicit confirmation.
 await page.evaluate(()=>{const {simulation:s,renderer:r}=crownforge;r.zoomMotion=null;let site;for(let x=135;x<200&&!site;x+=10)for(let z=90;z<190;z+=10)if(s.getBuildingPlacementPreview('barracks',{x,z}).valid){site={x,z};break;}if(!site)throw Error('No test site');const p=r.worldToScreen(site);r.panBy(510-p.x,310-p.y);});
 await page.locator('#build-menu-toggle').tap();await page.locator('[data-build-type="barracks"]').tap();
 const count=await page.evaluate(()=>crownforge.simulation.buildings.length);
 await page.touchscreen.tap(510,374);assert.equal(await page.evaluate(()=>crownforge.simulation.buildings.length),count);
 assert.equal(await page.locator('[data-touch="place"]').isDisabled(),false);
 await page.locator('[data-touch="place"]').tap();assert.equal(await page.evaluate(()=>crownforge.simulation.buildings.length),count+1);
 // Attack mode should order an attack instead of replacing the selection with the enemy.
 await page.evaluate(()=>{const s=crownforge.simulation,r=crownforge.renderer;s.units=[];s.buildings=[];s.resourcesNodes=[];s.decorations=[];s.navigationVersion++;const u=s.addUnit('soldier',150,100,'player'),b=s.addUnit('grizzly',158,100,'wildlife');s.selectEntity(u);const p=r.worldToScreen(b);r.panBy(510-p.x,340-p.y);window.touchTestBear=b;});
 await page.waitForTimeout(150);await page.locator('[data-touch="attack"]').tap();await page.touchscreen.tap(510,330);
 assert(await page.evaluate(()=>crownforge.simulation.selectedEntities[0].attackTarget===touchTestBear.id));
 // Area select and cancelled gestures never leave a drag active.
 await page.locator('[data-touch="area"]').tap();await send('touchStart',[[1,200,160]]);await send('touchMove',[[1,700,430]]);await send('touchEnd',[]);
 assert.equal(await page.evaluate(()=>crownforge.simulation.selectedIds.length),1);
 await send('touchStart',[[1,400,300]]);await send('touchCancel',[]);assert.equal(await page.evaluate(()=>crownforge.input.drag),null);
 await page.locator('[data-touch="more"]').tap();await page.locator('[data-touch="save1"]').tap();await page.evaluate(()=>{crownforge.simulation.selectedIds=[];crownforge.simulation._syncSelectionFlags();});await page.locator('[data-touch="squad1"]').tap();assert.equal(await page.evaluate(()=>crownforge.simulation.selectedIds.length),1);
 await page.locator('[data-touch="more"]').tap();
 await page.screenshot({path:'/private/tmp/touch-landscape.png'});
 await page.setViewportSize({width:768,height:1024});await page.waitForTimeout(150);await page.screenshot({path:'/private/tmp/touch-portrait.png'});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.locator('#control-mode').tap();assert.equal(await page.evaluate(()=>crownforge.touchControls.enabled),false);
 assert.equal(await page.locator('.touch-order-bar').isVisible(),false);
 await page.reload();await page.waitForFunction(()=>window.crownforge,{timeout:180000});assert.equal(await page.evaluate(()=>crownforge.touchControls.enabled),false);
 assert.deepEqual(errors,[]);console.log('PASS: touch defaults, saved original mode, movement, pan, pinch, pause, placement confirmation, attacks, area selection, cancellation, squads and both iPad layouts.');
}finally{await browser.close();}
