'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const main=fs.readFileSync(path.join(__dirname,'../main.cjs'),'utf8');
const position=main.slice(main.indexOf('function positionWindow('),main.indexOf("ipcMain.handle('window-layout'"));
function checkShrink(current,preferred,workArea,small){
 let bounds={...current},saves=0;
 const c={collapsed:false,activeService:null,layout:{normalWidth:680,normalHeight:540,compactWidth:380,centerX:preferred.x,top:preferred.y},screen:{getPrimaryDisplay:()=>({workArea}),getDisplayNearestPoint:()=>({workArea})},win:{getBounds:()=>({...bounds}),setBounds:v=>bounds={...v}},detachService:()=>{},saveLayout:()=>saves++,Math,Number};
 vm.createContext(c);vm.runInContext(position,c);c.positionWindow(small);
 assert.equal(bounds.x+bounds.width/2,current.x+current.width/2,'shrink moved screen-space centre');
 assert.equal(bounds.y,current.y,'shrink moved screen-space top');
 assert.equal(c.layout.centerX,current.x+current.width/2);assert.equal(c.layout.top,current.y);assert.equal(saves,1);
}
const area={x:0,y:0,width:1920,height:1080};
checkShrink({x:0,y:100,width:1040,height:840},{x:200,y:400},area,false);
checkShrink({x:880,y:200,width:1040,height:840},{x:1800,y:500},area,false);
checkShrink({x:0,y:100,width:680,height:540},{x:100,y:400},area,true);
{
 let bounds={x:0,y:100,width:1040,height:840};
 const c={collapsed:false,activeService:null,layout:{normalWidth:680,normalHeight:540,compactWidth:380,centerX:null,top:null},screen:{getPrimaryDisplay:()=>({workArea:area}),getDisplayNearestPoint:()=>({workArea:area})},win:{getBounds:()=>({...bounds}),setBounds:v=>bounds={...v}},detachService:()=>{},saveLayout:()=>{},Math,Number};
 vm.createContext(c);vm.runInContext(position,c);c.positionWindow(false,{preserveAnchor:false});
 assert.equal(bounds.x,(area.width-680)/2,'explicit reset must use default display centre');assert.equal(bounds.y,8,'explicit reset must use default top');
}
console.log('PASS: shrinking uses the visible screen-space centre and top at edges; reset remains explicit');
const snippet=main.slice(main.indexOf("ipcMain.handle('service-transition-snapshot'"),main.indexOf("ipcMain.handle('service-select'"));
let resolveCapture;const image={isEmpty:()=>false,toDataURL:()=> 'data:image/png;base64,AQ=='};
const view={webContents:{isDestroyed:()=>false,capturePage:()=>new Promise(r=>resolveCapture=r)}};
const c={attachedView:view,serviceRect:{x:10,y:20,width:30,height:40},activeService:'ai',trusted:()=>{},handlers:{},ipcMain:{handle:(name,fn)=>c.handlers[name]=fn}};
vm.createContext(c);vm.runInContext(snippet,c);
(async()=>{const handler=c.handlers['service-transition-snapshot'];assert.equal(await handler({},'wrong'),null);let p=handler({},'ai');resolveCapture(image);let result=await p;assert.equal(result.image,'data:image/png;base64,AQ==');assert.equal(result.rect.width,30);p=handler({},'ai');c.attachedView=null;resolveCapture(image);assert.equal(await p,null,'stale service captures must be discarded');console.log('PASS: capture only the attached service and discard stale results');})().catch(e=>{console.error(e);process.exitCode=1});
