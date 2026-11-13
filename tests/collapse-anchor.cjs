const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const main=fs.readFileSync(require('node:path').join(__dirname,'..','main.cjs'),'utf8');
const fn=main.slice(main.indexOf('function positionWindow('),main.indexOf("ipcMain.handle('window-layout'"));
function run(x,width,preferred,small=true){
 let bounds={x,y:20,width,height:540},saved=0;
 const area={x:0,y:0,width:1920,height:1080};
 const ctx={collapsed:false,activeService:null,layout:{normalWidth:680,normalHeight:540,compactWidth:380,centerX:preferred,top:20},screen:{getPrimaryDisplay:()=>({workArea:area}),getDisplayNearestPoint:()=>({workArea:area})},win:{isDestroyed:()=>false,getBounds:()=>({...bounds}),setBounds:b=>{bounds=b}},detachService:()=>{},saveLayout:()=>saved++,Number,Math};
 vm.createContext(ctx);vm.runInContext(fn,ctx);ctx.positionWindow(small);return {bounds,ctx,saved};
}
for(const [x,preferred] of [[0,100],[1240,1850],[620,960]]){const r=run(x,680,preferred);assert.equal(r.bounds.x+r.bounds.width/2,x+340,'collapse must keep current center');assert.equal(r.ctx.layout.centerX,x+340);assert.equal(r.saved,1)}
const r=run(0,680,100);r.ctx.positionWindow(true);assert.equal(r.saved,1,'repeated compact resize must not overwrite anchor');
console.log('PASS: compact window keeps actual center near both screen edges and persists the anchor');
