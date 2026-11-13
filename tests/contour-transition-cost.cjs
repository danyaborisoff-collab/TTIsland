'use strict';
const assert=require('node:assert/strict'),{launchApp}=require('./helpers/motion-api.cjs');
(async()=>{const {browser,page,errors}=await launchApp();try{
 await page.evaluate(()=>{settings.motion='full';settings.vibration='waves';settings.liquidEnabled=true;contourPreview=true;applyMotionSetting();updateWaveAnimation();window.cost={active:false,frames:0,draws:0};const draw=drawWaveFrame;drawWaveFrame=function(...args){if(cost.active)cost.draws++;return draw(...args)};function tick(){if(cost.active)cost.frames++;requestAnimationFrame(tick)}requestAnimationFrame(tick)});
 for(const phase of ['home-collapse','service-home']){
  await page.evaluate(async phase=>{if(collapsed)await setCollapsed(false);if(currentServiceId())await navigate('home');if(phase==='service-home')await navigate('ai');await new Promise(r=>setTimeout(r,200));cost.frames=0;cost.draws=0;cost.active=true},phase);
  if(phase==='home-collapse')await page.evaluate(()=>setCollapsed(true));else await page.evaluate(()=>navigate('home'));
  await page.waitForTimeout(80);const {frames,draws}=await page.evaluate(()=>{cost.active=false;return {...cost}});
  assert(frames>10,phase+' missing frames');assert(draws<=frames+7,phase+' painted the contour twice per frame: '+draws+' / '+frames);
  console.log('PASS:',phase,'draws:',draws,'frames:',frames);
 }
 assert.deepEqual(errors,[]);
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
