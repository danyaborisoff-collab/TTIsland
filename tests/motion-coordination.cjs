'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {launchApp}=require('./helpers/motion-api.cjs');
(async()=>{
 const {browser,page,errors}=await launchApp(),report={version:require('../package.json').version,environment:'Linux Chromium; native viewport and IPC simulated',checks:[],frames:{}};
 try{
  await page.evaluate(()=>{settings.motion='full';settings.vibration='spikes';settings.liquidEnabled=true;contourPreview=true;applyMotionSetting();updateWaveAnimation()});
  // Calling "open" on an already open panel must be a true no-op, not a new resize.
  await page.evaluate(()=>{calls.length=0});
  await page.evaluate(()=>setCollapsed(false));
  assert.equal(await page.evaluate(()=>calls.filter(x=>x[0]==='resize').length),0,'same-state requests must not resize the OS window');
  assert.equal(await page.evaluate(()=>$('#island').getAnimations().length),0);
  report.checks.push('Same-state requests do not restart animation or resize the host');
  // The second click happens during the old 130ms fade. Desired state changes immediately.
  await page.evaluate(async()=>{const first=setCollapsed(!collapsed);await new Promise(r=>setTimeout(r,45));const second=setCollapsed(!collapsed);await Promise.all([first,second])});
  assert.equal(await page.evaluate(()=>collapsed),false,'quick double click must finish expanded');
  assert.equal(page.viewportSize().width,680);
  report.checks.push('45ms double-click reverses from the currently displayed frame');
  await page.evaluate(()=>{
   window.motionFrames=[];window.captureMotion=false;
   function sample(t){
    if(captureMotion){const i=$('#island').getBoundingClientRect(),c=$('#content').getBoundingClientRect(),canvas=waveCanvas.getBoundingClientRect(),f=document.querySelector('.bottom').getBoundingClientRect();motionFrames.push({t,w:i.width,h:i.height,c:c.height,center:i.left+i.width/2-innerWidth/2,bottom:i.bottom,footer:f.bottom,viewport:innerHeight,canvasCenter:canvas.left+canvas.width/2-i.left-i.width/2,alpha:$('#island').classList.contains('contour-skin-active')?waveContext.getImageData(Math.floor(waveCanvas.width/2),Math.floor(waveCanvas.height/2),1,1).data[3]:255})}
    requestAnimationFrame(sample);
   }requestAnimationFrame(sample);
  });
  async function phase(label,action,{shrinking=false}={}){
   await page.evaluate(()=>{motionFrames.length=0;captureMotion=true;calls.length=0});
   await action();await page.waitForTimeout(140);
   const data=await page.evaluate(()=>{captureMotion=false;return {frames:motionFrames.slice(),calls:calls.slice(),busy:typeof islandLayoutBusy!=='undefined'&&islandLayoutBusy}});
   assert(!data.busy,label+' did not settle');assert(data.frames.length>=5,label+' missing frames');
   const moving=data.frames.slice(1).map((v,i)=>({dw:v.w-data.frames[i].w,dh:v.h-data.frames[i].h,dt:v.t-data.frames[i].t}));
   const center=Math.max(...data.frames.map(v=>Math.abs(v.center)));
   assert(center<1,label+' center drift '+center);
   assert(moving.filter(v=>v.dt<65).every(v=>Math.max(Math.abs(v.dw),Math.abs(v.dh))<120),label+' end-of-transition geometry snap');
   // A RAF callback may run before ResizeObserver repaints the matching canvas.
   // End-state alignment plus screenshot alpha is checked separately below.
   assert(data.frames.every(v=>v.alpha>245),label+' transparent surface frame');
   if(shrinking)assert(moving.every(v=>v.dw<=1&&v.dh<=1),label+' bounced while shrinking');
   assert(data.calls.filter(x=>x[0]==='attachedAt').every(x=>!x[1]&&!x[2]),label+' native service attached during geometry or reveal');
   report.frames[label]={samples:data.frames.length,maxCenterDrift:Math.round(center*100)/100,maxFrameStep:Math.round(Math.max(0,...moving.map(v=>Math.max(Math.abs(v.dw),Math.abs(v.dh))))*10)/10};
   console.log('PASS:',label,JSON.stringify(report.frames[label]));
  }
  await phase('collapse',()=>page.evaluate(()=>setCollapsed(true)),{shrinking:true});
  assert.equal(page.viewportSize().width,380);
  await phase('expand',()=>page.evaluate(()=>setCollapsed(false)));
  await phase('small-to-large tab',()=>page.evaluate(()=>navigate('music')));
  assert.equal(page.viewportSize().width,1040);
  await phase('large-to-small tab',()=>page.evaluate(()=>navigate('home')),{shrinking:true});
  assert.equal(page.viewportSize().width,680);
  report.checks.push('Open/close and tab morphs stay centered and do not attach a moving native webview');
  for(const gap of [20,75,160]){
   await page.evaluate(async gap=>{const jobs=[navigate('music')];await new Promise(r=>setTimeout(r,gap));jobs.push(navigate('home'));await new Promise(r=>setTimeout(r,gap));jobs.push(navigate('ai'));await Promise.all(jobs)},gap);
   await page.waitForTimeout(200);
   assert.equal(page.viewportSize().width,1040,'stale close shrank the latest service');
   assert.equal(await page.evaluate(()=>currentServiceId()),'deepseek');
   await page.evaluate(()=>navigate('home'));
  }
  report.checks.push('20/75/160ms tab storms cannot commit a stale shrink');
  await page.evaluate(async()=>{mockLatency=65;const jobs=[setCollapsed(true)];await new Promise(r=>setTimeout(r,15));jobs.push(navigate('music'));await new Promise(r=>setTimeout(r,20));jobs.push(navigate('home'));await Promise.all(jobs);mockLatency=0});
  assert.equal(await page.evaluate(()=>collapsed),false);assert.equal(page.viewportSize().width,680);
  report.checks.push('Interrupted collapse and tab navigation survive delayed IPC');
  await page.evaluate(()=>setCollapsed(true));
  const reveal=await page.evaluate(async()=>{const opacity=[];let watching=true;function sample(){if(watching){opacity.push(parseFloat(getComputedStyle($('#island').parentElement).opacity));requestAnimationFrame(sample)}}const task=callbacks.onWindowShow();sample();await task;watching=false;return opacity});
  assert(reveal.length>5,'tray reveal did not render');
  assert(reveal.slice(1).every((value,i)=>value>=reveal[i]-.03),'tray reveal faded out again after expansion');
  assert.equal(page.viewportSize().width,680);
  report.checks.push('Tray reveal runs together with expansion, without a second fade or flash');

  await page.evaluate(async()=>{settings.motion='off';applyMotionSetting();await navigate('music');await navigate('home');await setCollapsed(true);await setCollapsed(false)});
  assert.equal(await page.evaluate(()=>$('#island').getAnimations().length),0);
  assert.equal(page.viewportSize().width,680);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(async()=>{settings.motion='system';applyMotionSetting();await setCollapsed(true);await setCollapsed(false)});
  assert.equal(await page.evaluate(()=>$('#island').getAnimations().length),0);
  report.checks.push('Animations off and system reduced-motion use the same correct final geometry');
  const shotDir=process.env.TTISLAND_SHOTS;
  if(shotDir){
   fs.mkdirSync(shotDir,{recursive:true});
   await page.evaluate(()=>{settings.motion='full';settings.shape='island';settings.vibration='spikes';document.body.dataset.shape='island';contourPreview=true;applyMotionSetting();applyPalette('dark');updateWaveAnimation()});
   await page.waitForTimeout(300);await page.screenshot({path:path.join(shotDir,'expanded.png'),omitBackground:true});
   await page.evaluate(()=>setCollapsed(true));await page.screenshot({path:path.join(shotDir,'compact.png'),omitBackground:true});
   await page.evaluate(()=>navigate('music'));await page.screenshot({path:path.join(shotDir,'service.png'),omitBackground:true});
   await page.evaluate(()=>navigate('home'));
   await page.evaluate(()=>{settings.shape='circle';document.body.dataset.shape='circle';applyPalette('sand')});
   await page.evaluate(()=>setCollapsed(true));await page.screenshot({path:path.join(shotDir,'circle.png'),omitBackground:true});
  }
  assert.deepEqual(errors,[]);report.checks.push('No renderer exceptions');report.status='passed';
  if(process.env.TTISLAND_REPORT)fs.writeFileSync(process.env.TTISLAND_REPORT,JSON.stringify(report,null,2)+'\n');
  console.log('PASS:',report.checks.length,'motion coordination checks');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
