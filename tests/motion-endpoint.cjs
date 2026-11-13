'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {launchApp}=require('./helpers/motion-api.cjs');
(async()=>{
 const report={version:require('../package.json').version,environment:'Linux Chromium; native window and Windows APIs simulated',phases:[],status:'running'};
 for(const dpr of [1,1.25,2]){
  const {browser,page,errors}=await launchApp({dpr});
  try{
   await page.evaluate(()=>{
    settings.motion='full';settings.vibration='waves';settings.liquidEnabled=true;contourPreview=true;applyMotionSetting();updateWaveAnimation();
    window.ep={capture:false,samples:[],commits:[],writes:[],fades:[]};
    window.epFrame=()=>{const r=$('#island').getBoundingClientRect(),cs=getComputedStyle($('#island'));return {w:r.width,h:r.height,center:r.x+r.width/2-innerWidth/2,y:r.y,radii:TTContours.shape(r.width,r.height,['borderTopLeftRadius','borderTopRightRadius','borderBottomRightRadius','borderBottomLeftRadius'].map(k=>parseFloat(cs[k])||0)).radii,header:$('#compact').getBoundingClientRect().height,nav:getComputedStyle($('#nav button')).minWidth,opacity:+getComputedStyle($('#content')).opacity,cw:$('#content').offsetWidth,held:document.body.classList.contains('island-layout-moving'),busy:islandLayoutBusy}};
    const resize=api.resize;api.resize=async small=>{const a=epFrame(),result=await resize(small);ep.commits.push({a,b:epFrame()});return result};
    const fade=animateTab;animateTab=function(...args){ep.fades.push({busy:islandLayoutBusy});return fade(...args)};
    for(const key of ['width','height']){const d=Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype,key);Object.defineProperty(HTMLCanvasElement.prototype,key,{...d,set(v){if(this.id==='waveCanvas')ep.writes.push(key);return d.set.call(this,v)}})}
    function sample(){if(ep.capture){const f=epFrame();f.running=$('#island').getAnimations().some(a=>a.playState==='running');f.alpha=ep.samples.length%6===0&&$('#island').classList.contains('contour-skin-active')?waveContext.getImageData(Math.floor(waveCanvas.width/2),Math.floor(waveCanvas.height/2),1,1).data[3]:255;ep.samples.push(f)}requestAnimationFrame(sample)}requestAnimationFrame(sample);
   });
   async function phase(name,action){
    await page.waitForTimeout(320);await page.evaluate(()=>{ep.capture=true;ep.samples=[];ep.commits=[];ep.writes=[];ep.fades=[]});
    await action();await page.waitForFunction(()=>{const start=ep.samples.findIndex(f=>f.busy);return start>=0&&ep.samples.slice(start).filter(f=>!f.busy).length>=3},undefined,{timeout:4000});
    const data=await page.evaluate(()=>{ep.capture=false;return {...ep,final:epFrame()}});
    assert(!data.final.busy,name+' unfinished');assert(data.samples.every(f=>Math.abs(f.center)<1),name+' intermediate center drift');
    for(const {a,b} of data.commits){assert(a.held&&b.held,name+' released before native ack');for(const key of ['w','h','center','y','header'])assert(Math.abs(a[key]-b[key])<.1,name+' native commit changed '+key);assert.equal(a.nav,b.nav,name+' changed nav');a.radii.forEach((r,i)=>assert(Math.abs(r-b.radii[i])<.1,name+' changed radius'))}
    const first=data.samples.findIndex(f=>f.busy),idle=data.samples.filter((f,i)=>i>first&&first>=0&&!f.busy);assert(idle.length>=2);assert(idle.every(f=>Math.abs(f.w-data.final.w)<.1&&Math.abs(f.h-data.final.h)<.1&&f.opacity>.99),name+' second end-state jump/fade');
    const moving=data.samples.filter(f=>f.running);if(moving.length>3)assert(Math.max(...moving.map(f=>f.cw))-Math.min(...moving.map(f=>f.cw))<.2,name+' text reflow');
    assert(data.writes.length<=2,name+' repeated canvas allocation');assert(data.samples.every(f=>f.alpha>245),name+' blank sampled surface');if(name.includes('service -> normal'))assert(data.fades.every(f=>f.busy),name+' late fade');
    report.phases.push({name,dpr,nativeCommits:data.commits.length,canvasWrites:data.writes.length,samples:data.samples.length});console.log('PASS:',name,'DPR='+dpr,'canvas writes='+data.writes.length);
   }
   for(const [width,height] of dpr===1?[[560,500],[680,540],[900,700]]:[[680,540]]){
    await page.evaluate(async size=>{mockNormal=size;windowLayout.normalWidth=size.width;windowLayout.normalHeight=size.height;applyWindowLayout();await api.resize(false)},{width,height});
    await phase('normal -> service '+width,()=>page.evaluate(()=>navigate('music')));
    await phase('service -> normal '+width,()=>page.evaluate(()=>navigate('home')));
    await phase('expanded -> compact '+width,()=>page.evaluate(()=>setCollapsed(true)));
    await phase('compact -> expanded '+width,()=>page.evaluate(()=>setCollapsed(false)));
   }
   assert.deepEqual(errors,[]);
   if(dpr===1&&process.env.TTISLAND_ENDPOINT_SHOTS){const dir=process.env.TTISLAND_ENDPOINT_SHOTS;fs.mkdirSync(dir,{recursive:true});await page.screenshot({path:path.join(dir,'normal.png'),omitBackground:true});await page.evaluate(()=>navigate('music'));await page.screenshot({path:path.join(dir,'service.png'),omitBackground:true});await page.evaluate(()=>navigate('home'));await page.evaluate(()=>setCollapsed(true));await page.screenshot({path:path.join(dir,'compact.png'),omitBackground:true});await page.evaluate(()=>{settings.shape='circle';document.body.dataset.shape='circle'});await page.evaluate(()=>setCollapsed(false));await page.evaluate(()=>setCollapsed(true));await page.screenshot({path:path.join(dir,'circle.png'),omitBackground:true});}
  }finally{await browser.close()}
 }
 report.status='passed';if(process.env.TTISLAND_ENDPOINT_REPORT)fs.writeFileSync(process.env.TTISLAND_ENDPOINT_REPORT,JSON.stringify(report,null,2)+'\n');console.log('PASS:',report.phases.length,'strict end-state phases');
})().catch(error=>{console.error(error);process.exitCode=1});
