'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',args:['--no-sandbox']});let checks=0;const errors=[];
 for(const dpr of [1,1.25,1.5,2]){
  const context=await browser.newContext({viewport:{width:680,height:700},deviceScaleFactor:dpr});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(__dirname,'..','index.html')).href);
  await page.evaluate(()=>{settings.motion='off';settings.vibration='off';document.body.classList.add('motion-off')});
  for(const palette of ['dark','sand','burgundy'])for(const width of [390,680])for(const nativePreview of [false,true]){
   await page.setViewportSize({width,height:700});await page.evaluate(({palette,nativePreview})=>{applyPalette(palette);document.body.classList.toggle('native',nativePreview)}, {palette,nativePreview});
   for(const shape of ['island','capsule','circle','square','cloud'])for(const collapsed of [false,true]){
    await page.evaluate(async({shape,collapsed})=>{settings.shape=shape;document.body.dataset.shape=shape;await setCollapsed(collapsed)}, {shape,collapsed});
    const hidden=shape==='circle'&&collapsed;assert.equal(await page.locator('#hideIsland').isVisible(),!hidden);
    if(hidden)continue;
    for(const mode of ['idle','hover','active','focus']){
     const button=page.locator('#hideIsland');
     if(mode==='idle')await page.mouse.move(1,690);
     if(mode==='hover')await button.hover();
     if(mode==='active')await page.mouse.down();
     if(mode==='focus')await button.focus();
     const g=await button.evaluate(el=>{const b=el.getBoundingClientRect(),h=el.parentNode.getBoundingClientRect(),i=el.querySelector('svg').getBoundingClientRect(),s=getComputedStyle(el);return {w:b.width,h:b.height,dx:(i.left+i.width/2)-(b.left+b.width/2),dy:(i.top+i.height/2)-(b.top+b.height/2),headerDy:(b.top+b.height/2)-(h.top+h.height/2),inside:b.left>=h.left&&b.right<=h.right&&b.top>=h.top&&b.bottom<=h.bottom,iw:i.width,ih:i.height,padding:s.padding,scroll:el.scrollHeight<=el.clientHeight}});
     assert.equal(g.w,28);assert.equal(g.h,28);assert.equal(g.iw,12);assert.equal(g.ih,12);assert(Math.abs(g.dx)<.1&&Math.abs(g.dy)<.1&&Math.abs(g.headerDy)<.1,JSON.stringify(g));assert(g.inside&&g.scroll,JSON.stringify(g));assert.equal(g.padding,'0px');checks++;
     if(mode==='active'){await page.mouse.move(1,690);await page.mouse.up()}
    }
   }
  }
  await page.evaluate(async()=>{document.body.classList.remove('native');document.body.dataset.shape='island';settings.shape='island';applyPalette('burgundy');await setCollapsed(false)});
  await page.locator('#hideIsland').click();assert.equal(await page.evaluate(()=>collapsed),false,'Close must not bubble and collapse the panel');assert.match(await page.locator('#toast').textContent(),/Windows/);
  await page.locator('#hideIsland').focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>collapsed),false);
  if(dpr===1){await page.setViewportSize({width:680,height:700});await page.evaluate(()=>document.body.classList.add('native'));await page.locator('#hideIsland').hover();await page.locator('#hideIsland').evaluate(e=>e.blur());await page.screenshot({path:'/data/close-fixed-expanded.png'});await page.evaluate(()=>setCollapsed(true));await page.locator('#hideIsland').hover();await page.screenshot({path:'/data/close-fixed-mini.png'});await page.locator('#compact').screenshot({path:'/data/close-fixed-header.png'})}
  await context.close();
 }
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: '+checks+' geometry checks; three palettes, five shapes, two widths, browser/native CSS, DPR 1/1.25/1.5/2; hover/pressed/focus; click and keyboard behavior. Native Windows API not executed.');
})().catch(e=>{console.error(e);process.exit(1)});
