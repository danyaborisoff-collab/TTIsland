'use strict';
// Renderer/native hand-off regression. Native window and IPC are simulated.
const assert=require('node:assert/strict');
const {launchApp}=require('./helpers/motion-api.cjs');
(async()=>{
 const {browser,page,errors}=await launchApp();
 try{
  await page.evaluate(()=>{
   settings.motion='full';applyMotionSetting(); window.trace=[]; window.tracing=false;
   function sample(){if(tracing){const island=$('#island'),r=island.getBoundingClientRect(),content=$('#content'),cr=content.getBoundingClientRect(),card=$('.home-grid .card'),exp=$('.expanded');window.trace.push({busy:islandLayoutBusy,port:$('#islandViewport').clientWidth,center:r.x+r.width/2-innerWidth/2,canvasWidth:waveCanvas.getBoundingClientRect().width,canvasMax:getComputedStyle(waveCanvas).maxWidth,w:r.width,h:r.height,opacity:+getComputedStyle(exp).opacity,contentOpacity:+getComputedStyle(content).opacity,cw:cr.width,ch:cr.height,layoutHeight:content.offsetHeight,card:card?.offsetWidth||0,home:tab==='home'});}requestAnimationFrame(sample)}requestAnimationFrame(sample);
  });
  async function trace(fn){await page.evaluate(()=>{window.trace=[];window.tracing=true});await fn();await page.waitForTimeout(100);return page.evaluate(()=>{tracing=false;return window.trace})}
  let frames=await trace(()=>page.evaluate(()=>setCollapsed(true)));
  const visible=frames.filter(f=>f.busy&&f.opacity>.05);
  assert(visible.length>=4,'home fade not sampled');
  assert(visible.every(f=>f.port===680),'home breakpoint changed before the dashboard faded');
  assert(Math.max(...visible.map(f=>f.card))-Math.min(...visible.map(f=>f.card))<1,'visible dashboard reflowed');
  assert(Math.max(...visible.map(f=>f.layoutHeight))-Math.min(...visible.map(f=>f.layoutHeight))<1,'dashboard laid out repeatedly during collapse');
  assert(frames.every(f=>Math.abs(f.center)<1),'collapse lost centre');
  assert(frames.filter(f=>f.busy).every(f=>f.canvasMax==='none'),'canvas width was constrained during home collapse');
  assert.equal(page.viewportSize().width,380); console.log('PASS home -> compact: no visible breakpoint switch or repeated home layout');
  await page.evaluate(()=>setCollapsed(false));
  await page.evaluate(()=>navigate('ai'));
  frames=await trace(()=>page.evaluate(()=>navigate('home')));
  const active=frames.filter(f=>f.busy&&f.home),reveal=active.filter(f=>f.contentOpacity>.05);
  assert(active.some(f=>f.contentOpacity<.01),'dashboard was not hidden before target layout');
  assert(reveal.length>=3,'home reveal not sampled');
  assert(reveal.every(f=>Math.abs(f.cw-614)<1&&Math.abs(f.ch-332)<1),'dashboard geometry changed while visible');
  assert(frames.every(f=>Math.abs(f.center)<1),'service to home lost centre');
  assert.equal(page.viewportSize().width,680); console.log('PASS service -> home: dashboard revealed at stable target size');
  await page.evaluate(()=>navigate('ai'));
  frames=await trace(()=>page.evaluate(()=>setCollapsed(true)));
  assert.equal(page.viewportSize().width,380);assert(frames.every(f=>Math.abs(f.center)<1),'service -> compact lost centre');
  assert(frames.filter(f=>f.busy).every(f=>f.canvasMax==='none'),'canvas width was constrained during service collapse');
  const shrinking=frames.filter(f=>f.busy);assert(shrinking.length>4);for(let i=1;i<shrinking.length;i++)assert(shrinking[i].w<=shrinking[i-1].w+1&&shrinking[i].h<=shrinking[i-1].h+1,'service -> compact bounced');
  console.log('PASS service -> compact: remains centred and monotonic');
  await page.evaluate(async()=>{await setCollapsed(false);await navigate('home');const a=setCollapsed(true);await new Promise(r=>setTimeout(r,45));const b=setCollapsed(false);await Promise.all([a,b])});
  assert.equal(page.viewportSize().width,680);assert.equal(await page.evaluate(()=>collapsed),false);
  assert.deepEqual(errors,[]);console.log('PASS rapid reversal and no renderer exceptions');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
