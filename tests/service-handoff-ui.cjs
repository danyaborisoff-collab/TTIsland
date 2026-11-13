'use strict';
const assert=require('node:assert/strict'),{launchApp}=require('./helpers/motion-api.cjs');
(async()=>{const {page,browser,errors}=await launchApp();try{
 await page.evaluate(()=>{settings.motion='full';applyMotionSetting()});await page.evaluate(()=>navigate('ai'));
 await page.evaluate(()=>{window.snapshotCalls=0;api.serviceTransitionSnapshot=async id=>{snapshotCalls++;const c=document.createElement('canvas');c.width=2;c.height=2;const x=c.getContext('2d');x.fillStyle='#6976a3';x.fillRect(0,0,2,2);return {image:c.toDataURL(),rect:{x:60,y:170,width:920,height:530}}};const original=api.selectService;api.selectService=async(...a)=>{await new Promise(r=>setTimeout(r,80));return original(...a)}});
 await page.evaluate(()=>{window.job=navigate('home')});await page.waitForTimeout(35);
 let state=await page.evaluate(()=>({snapshot:!!serviceTransitionImage,tab,snapshotCalls,opacity:serviceTransitionImage?getComputedStyle(serviceTransitionImage).opacity:null}));assert(state.snapshot,'no bridge image before native detach');assert.equal(state.tab,'home');assert.equal(state.snapshotCalls,1);
 await page.evaluate(()=>job);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>!!serviceTransitionImage),false,'temporary image was not removed');
 await page.evaluate(()=>navigate('ai'));await page.evaluate(()=>{api.serviceTransitionSnapshot=()=>new Promise(r=>setTimeout(()=>r({image:'data:image/png;base64,AQ==',rect:{x:0,y:0,width:5,height:5}}),100));window.oldJob=navigate('home')});await page.waitForTimeout(15);await page.evaluate(()=>navigate('timer'));await page.evaluate(()=>oldJob);assert.equal(await page.evaluate(()=>tab),'timer','late capture overrode newer navigation');assert.equal(await page.evaluate(()=>!!serviceTransitionImage),false);
 assert.deepEqual(errors,[]);console.log('PASS: in-memory snapshot fades after native detach and late captures are ignored');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
