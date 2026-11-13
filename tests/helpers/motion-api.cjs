'use strict';
const {chromium}=require('playwright');
const path=require('node:path'),{pathToFileURL}=require('node:url');
async function launchApp(options={}){
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:680,height:540},deviceScaleFactor:options.dpr||1});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.exposeFunction('__nativeResize',async size=>{await page.setViewportSize(size);return size});
 await page.addInitScript(()=>{
  window.calls=[];window.callbacks={};window.mockSmall=false;window.mockService=null;window.mockNormal={width:680,height:540};window.mockLatency=0;
  const delay=()=>new Promise(resolve=>setTimeout(resolve,mockLatency));
  const log=(name,value)=>(...args)=>{calls.push([name,...args]);return Promise.resolve(typeof value==='function'?value(...args):value)};
  const resize=async small=>{mockSmall=!!small;return __nativeResize(mockSmall?{width:380,height:120}:mockService?{width:1040,height:840}:mockNormal)};
  const api={
   resize:async small=>{calls.push(['resize',small]);await delay();return resize(small)},
   selectService:async(id,defer=false)=>{calls.push(['selectService',id,defer]);mockService=id||null;if(!defer||mockSmall)await resize(mockSmall);await delay();return !!id},
   prepareCollapse:log('prepareCollapse',true),
   serviceBounds:log('serviceBounds',rect=>{calls.push(['attachedAt',typeof islandLayoutBusy!=='undefined'&&islandLayoutBusy,typeof windowVisibilityBusy!=='undefined'&&windowVisibilityBusy,rect]);return true}),
   serviceVisible:log('serviceVisible',true),hoverBounds:log('hoverBounds',true),
   windowLayout:log('windowLayout',{normalWidth:680,normalHeight:540,compactWidth:380}),
   getHistory:log('history',[]),getClipboardEnabled:log('clipboard',false),pin:log('pin',true),musicProvider:log('musicProvider',{ok:true}),
   mailState:log('mailState',{configured:false,unseen:null}),monitorSnapshot:log('monitor',{cpu:25,ram:40,ramUsed:4,ramTotal:10,gpu:'Test GPU',gpuLoad:10,temperature:null,internet:true}),
   brightnessGet:log('brightnessGet',{ok:true,brightness:67}),weatherSnapshot:log('weather',{ok:true,temp:'+7°',cond:'Ясно',city:'Москва'}),
   windowShellInfo:log('shell',{tray:true,shortcut:true}),stats:log('stats',{cpus:4,memory:40,platform:'Windows'}),
   systemControl:log('systemControl',{ok:false,error:'Windows API mocked'}),desktopTools:log('desktopTools',{ok:true,devices:[]}),
   deviceControl:log('deviceControl',{ok:false,error:'Device API mocked'}),hideWindow:log('hideWindow',true),windowHideReady:log('windowHideReady',true)
  };
  window.islandAPI=new Proxy(api,{get(target,name){if(name in target)return target[name];if(typeof name==='string'&&name.startsWith('on'))return fn=>{callbacks[name]=fn};return log(String(name),{ok:true})}});
 });
 const root=process.env.TTISLAND_ROOT||path.join(__dirname,'../..');
 await page.goto(pathToFileURL(path.join(root,'index.html')).href);
 await page.waitForTimeout(650);
 return {browser,page,errors};
}
module.exports={launchApp};
