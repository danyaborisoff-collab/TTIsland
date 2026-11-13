'use strict';
// Chromium renderer simulation: a DOM stand-in for the native child view.
// This does NOT test Electron/Windows native compositing.
const assert=require('node:assert/strict'),{launchApp}=require('./helpers/motion-api.cjs');
(async()=>{const {browser,page,errors}=await launchApp();try{
 await page.evaluate(()=>{
  settings.motion='full';applyMotionSetting();window.events=[];window.frames=[];window.trace=false;
  const nativeNode=document.createElement('div');nativeNode.id='mock-native';Object.assign(nativeNode.style,{position:'fixed',left:'60px',top:'170px',width:'500px',height:'300px',background:'#22aa55',zIndex:'999',display:'none',pointerEvents:'none'});document.body.append(nativeNode);
  const bounds=api.serviceBounds;api.serviceBounds=async r=>{nativeNode.style.display='block';events.push(['attach',performance.now()]);return bounds(r)};
  const select=api.selectService;api.selectService=async(...args)=>{if(nativeNode.style.display!=='none')events.push(['detach',performance.now(),!!serviceTransitionImage,!!serviceTransitionImage?.complete,serviceTransitionImage?.naturalWidth||0]);nativeNode.style.display='none';return select(...args)};
  api.serviceTransitionSnapshot=async()=>{events.push(['capture',performance.now(),nativeNode.style.display]);const c=document.createElement('canvas');c.width=c.height=8;const x=c.getContext('2d');x.fillStyle='#22aa55';x.fillRect(0,0,8,8);return {image:c.toDataURL(),rect:{x:60,y:170,width:500,height:300}}};
  function sample(){if(trace){const e=$('.expanded'),i=$('#island').getBoundingClientRect(),c=$('#content'),img=serviceTransitionImage;frames.push({busy:islandLayoutBusy,tab,scale:getComputedStyle(e).scale,outerWidth:i.width,outerHeight:i.height,content:+getComputedStyle(c).opacity,expanded:+getComputedStyle(e).opacity,overlay:img?+getComputedStyle(img).opacity:0,overlayPresent:!!img,native:nativeNode.style.display})}requestAnimationFrame(sample)}requestAnimationFrame(sample);
 });
 async function record(fn){await page.evaluate(()=>{frames=[];events=[];trace=true});await fn();await page.waitForTimeout(200);return page.evaluate(()=>{trace=false;return {frames,events}})}
 await page.evaluate(()=>navigate('music'));await page.waitForTimeout(100);
 let r=await record(()=>page.evaluate(()=>navigate('home')));
 const d=r.events.find(e=>e[0]==='detach');assert(d&&d[2]&&d[3]&&d[4]>0,'native view detached before a decoded bridge image was staged');assert.equal(r.events.find(e=>e[0]==='capture')?.[2],'block','capture happened after native detach');
 assert(!r.frames.some(f=>f.tab==='home'&&f.content>.05&&f.overlay>.05),'old site overlapped visible destination');assert(r.frames.some(f=>f.overlay>.9),'missing bridge frames');assert.equal(await page.evaluate(()=>tab),'home');
 r=await record(()=>page.evaluate(()=>setCollapsed(true)));const scaled=r.frames.filter(f=>f.busy&&f.expanded>.05&&f.scale!=='none');assert(scaled.length>2,'no visible scaled frames');for(const f of scaled){const parts=f.scale.split(' ').map(Number);assert(parts.length===1||Math.abs(parts[0]-parts[1])<.001,'nonuniform horizontal stretch')}
 await page.evaluate(()=>setCollapsed(false));await page.evaluate(()=>navigate('ai'));await page.waitForTimeout(100);
 r=await record(()=>page.evaluate(()=>setCollapsed(true)));const dc=r.events.find(e=>e[0]==='detach');assert(dc&&dc[2]&&dc[3]&&dc[4]>0,'service collapsed without staged snapshot');assert(r.frames.some(f=>f.busy&&f.overlayPresent&&f.content<.01),'service placeholder could leak through collapse');
 await page.evaluate(()=>setCollapsed(false));await page.waitForTimeout(100);
 await page.evaluate(async()=>{let resolve;api.serviceTransitionSnapshot=()=>new Promise(r=>resolve=r);const a=setCollapsed(true);await new Promise(r=>setTimeout(r,30));const b=setCollapsed(false);resolve(null);await Promise.all([a,b])});assert.equal(await page.evaluate(()=>collapsed),false,'stale capture overrode reversal');
 await page.evaluate(async()=>{await navigate('home');const a=setCollapsed(true);await new Promise(r=>setTimeout(r,110));const b=setCollapsed(false);await Promise.all([a,b])});assert.equal(await page.evaluate(()=>collapsed),false);assert.equal(await page.evaluate(()=>getComputedStyle($('.expanded')).scale),'none');
 assert.deepEqual(errors,[]);console.log('PASS: decoded handoff, non-overlapping destination, uniform scale and reversals (mocked native view)');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
