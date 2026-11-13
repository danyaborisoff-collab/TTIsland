// Real Chromium Media Session fixture; no third-party login or network access.
const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage(); await page.route('**/*',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Fixture</title><button id="wave">Моя волна</button>'})); await page.goto('https://music.yandex.ru/');
 const preload=fs.readFileSync(path.join(__dirname,'..','music-preload.cjs'),'utf8');const hook=preload.slice(preload.indexOf('function installMediaHook()'),preload.lastIndexOf('\ntry{'));
 await page.evaluate('(()=>{'+hook+';installMediaHook()})()');
 await page.evaluate(()=>{window.invoked=[];navigator.mediaSession.metadata=new MediaMetadata({title:'Test One',artist:'Artist'});navigator.mediaSession.playbackState='paused';navigator.mediaSession.setPositionState({duration:120,position:5,playbackRate:1});for(const action of ['play','pause','nexttrack','previoustrack','seekto'])navigator.mediaSession.setActionHandler(action,details=>{window.invoked.push(action);if(action==='play')navigator.mediaSession.playbackState='playing';if(action==='pause')navigator.mediaSession.playbackState='paused';if(action==='nexttrack')navigator.mediaSession.metadata=new MediaMetadata({title:'Test Two',artist:'Artist'});if(action==='previoustrack')navigator.mediaSession.metadata=new MediaMetadata({title:'Test One',artist:'Artist'});if(action==='seekto')navigator.mediaSession.setPositionState({duration:120,position:details.seekTime,playbackRate:1})})});
 const wc={getURL:()=>page.url(),isDestroyed:()=>false,isLoadingMainFrame:()=>false,executeJavaScript:(script)=>page.evaluate(script),loadURL:url=>page.goto(url)};const published=[];
 const yandex=require('../music-controller.cjs')(()=>wc,s=>published.push(s));
 assert.equal((await yandex.state()).title,'Test One');assert.equal((await yandex.perform('toggle')).ok,true);assert.equal((await yandex.perform('next')).ok,true);assert.equal((await yandex.perform('previous')).ok,true);assert.equal((await yandex.perform('toggle')).ok,true);
 const {create}=require('../provider-controller.cjs'); await page.route('https://soundcloud.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:'fixture'}));
 // The generic adapter uses the same sandboxed media hook; retain the fixture document and simulate the service host in the controller.
 const genericWc={...wc,getURL:()=> 'https://soundcloud.com/'}; const generic=create('soundcloud',()=>({webContents:genericWc}),()=>{});
 assert.equal((await generic.perform('toggle')).ok,true);const state=await generic.state();assert.equal(state.canSeek,true);const key=[state.title,state.artist,Math.round(state.duration||0)].join('\n');assert.equal((await generic.seek(40,key)).ok,true);assert((await generic.state()).position>=40);assert.equal((await generic.perform('pause')).ok,true);
 const inv=await page.evaluate(()=>window.invoked);for(const command of ['play','pause','nexttrack','previoustrack','seekto'])assert(inv.includes(command),command);
 await browser.close();console.log('PASS: Yandex controller and SoundCloud generic controller use real Media Session handlers (play, pause, previous, next, seek) on offline fixture.');
})().catch(e=>{console.error(e);process.exit(1)});
