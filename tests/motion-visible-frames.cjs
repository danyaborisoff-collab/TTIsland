'use strict';
// Frames in Chromium with the native window and IPC mocked; not a Windows test.
const assert=require('node:assert/strict'),{launchApp}=require('./helpers/motion-api.cjs');
(async()=>{const {browser,page,errors}=await launchApp();try{
 await page.evaluate(()=>{settings.motion='full';applyMotionSetting();window.trace=[];window.traceOn=false;function record(t){if(traceOn){let i=$('#island').getBoundingClientRect(),n=$('#nav'),e=$('.expanded'),c=$('#content');trace.push({t,w:i.width,h:i.height,busy:islandLayoutBusy,exp:+getComputedStyle(e).opacity,contentOpacity:+getComputedStyle(c).opacity,contentWidth:c.offsetWidth,navOverflow:getComputedStyle(n).overflowX,navClient:n.clientWidth,navScroll:n.scrollWidth,clock:$('#clock').getBoundingClientRect().width?+getComputedStyle($('#clock')).opacity:0,mini:$('#miniControls').getBoundingClientRect().width?+getComputedStyle($('#miniControls')).opacity:0})}requestAnimationFrame(record)}requestAnimationFrame(record)});
 async function sample(action){await page.evaluate(()=>{trace=[];traceOn=true});await action();await page.waitForTimeout(60);return page.evaluate(()=>{traceOn=false;return trace})}
 await page.evaluate(()=>navigate('forecast'));
 let rows=await sample(()=>page.evaluate(()=>setCollapsed(true))),moving=rows.filter(x=>x.busy&&x.h>300&&x.h<450);
 assert(moving.length>=3,'missing collapse samples');assert(moving.some(x=>x.exp>.5),'content vanishes while panel remains large');
 assert(rows.filter(x=>x.busy&&x.exp>.1).every(x=>x.navOverflow==='hidden'||x.navScroll<=x.navClient+1),'visible temporary scrollbar');
 assert(rows.some(x=>x.busy&&x.clock>0&&x.clock<1),'clock did not fade');assert(rows.some(x=>x.busy&&x.mini>0&&x.mini<1),'controls did not fade');
 rows=await sample(()=>page.evaluate(()=>setCollapsed(false)));assert(rows.filter(x=>x.busy&&x.exp>.1).every(x=>x.navOverflow==='hidden'||x.navScroll<=x.navClient+1),'expansion scrollbar');
 await page.evaluate(()=>navigate('music'));
 await page.evaluate(()=>{window.snapshotCalls=0;api.serviceTransitionSnapshot=async()=>{snapshotCalls++;let c=document.createElement('canvas');c.width=c.height=1;return {image:c.toDataURL(),rect:{x:60,y:170,width:920,height:530}}}});
 rows=await sample(()=>page.evaluate(()=>navigate('forecast')));assert.equal(await page.evaluate(()=>snapshotCalls),1,'service to forecast not captured');
 const visible=rows.filter(x=>x.busy&&x.contentOpacity>.05);assert(visible.length>3);assert(Math.max(...visible.map(x=>x.contentWidth))-Math.min(...visible.map(x=>x.contentWidth))<=1,'destination reflowed');
 await page.evaluate(()=>navigate('ai'));await page.evaluate(()=>{api.serviceTransitionSnapshot=()=>new Promise(resolve=>setTimeout(()=>resolve(null),250))});let state=await page.evaluate(async()=>{const p=navigate('home');await new Promise(r=>setTimeout(r,190));let result={tab,elapsed:190};await p;return result});assert.equal(state.tab,'ai','slow capture was abandoned too early');
 assert.deepEqual(errors,[]);console.log('PASS: collapse visibility, scrollbar, header fade, service-to-panel and slow capture');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
