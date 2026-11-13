'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function fixture({tray=true,shortcut=true}={}){
 const calls=[],handlers={},events={},appEvents={},timers=new Map();let nextTimer=0,visible=true;
 const win={isDestroyed:()=>false,isVisible:()=>visible,isMinimized:()=>false,getBounds:()=>({x:620,y:20,width:680,height:540}),
  show:()=>{visible=true;calls.push(['show'])},hide:()=>{visible=false;calls.push(['hide'])},focus:()=>calls.push(['focus']),
  setSkipTaskbar:value=>calls.push(['taskbar',value]),setPosition:()=>{},on:(name,fn)=>events[name]=fn,
  webContents:{send:(...args)=>calls.push(args)}};
 const electron={
  app:{on:(name,fn)=>appEvents[name]=fn,quit:()=>calls.push(['quit'])},
  ipcMain:{handle:(name,fn)=>handlers[name]=fn},screen:{getCursorScreenPoint:()=>({x:800,y:40}),getDisplayNearestPoint:()=>({workArea:{x:0,y:0,width:1920,height:1080}})},
  globalShortcut:{register:()=>shortcut,unregister:()=>{}},
  Tray:class{constructor(){if(!tray)throw Error('No tray')}setToolTip(){}setContextMenu(){}on(){}destroy(){}},
  Menu:{buildFromTemplate:items=>items},nativeImage:{createFromPath:()=>({isEmpty:()=>false})},dialog:{showMessageBox:()=>calls.push(['warning'])}
 };
 const sandbox={module:{exports:{}},require:name=>name==='electron'?electron:require(name),__dirname:path.join(__dirname,'..'),
  setTimeout:fn=>{const id=++nextTimer;timers.set(id,fn);return id},clearTimeout:id=>timers.delete(id)};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../window-shell.cjs'),'utf8'),sandbox);
 const shell=sandbox.module.exports(win,()=>calls.push(['trusted']),{positionWindow:()=>calls.push(['resize']),saveLayout:()=>{},getLayout:()=>({})});
 return {shell,calls,handlers,events,appEvents,timers,visible:()=>visible};
}
let f=fixture();
assert(f.shell.hide());assert(f.visible(),'hide must wait for the renderer fade');
const first=f.calls.find(x=>x[0]==='window-hiding')[1];
assert(!f.calls.some(x=>x[0]==='hide'));
assert(f.handlers['window-hide-ready']({},first));assert(!f.visible());assert(f.calls.some(x=>x[0]==='window-hidden'));
f.shell.show();assert(f.visible());assert(!f.calls.some(x=>x[0]==='resize'),'show must not resize before the renderer freezes geometry');
assert(f.calls.some(x=>x[0]==='window-show'));
f.shell.hide();const second=f.calls.filter(x=>x[0]==='window-hiding').at(-1)[1];
f.shell.show();assert.equal(f.handlers['window-hide-ready']({},second),false);assert(f.visible(),'stale hide acknowledgement must not hide a reopened window');
f.shell.hide();const third=f.calls.filter(x=>x[0]==='window-hiding').at(-1)[1];
assert.equal(f.handlers['window-hide-ready']({},second),false);assert(f.visible());
assert(f.handlers['window-hide-ready']({},third));assert(!f.visible());
f.shell.show();f.shell.hide();assert.equal(f.timers.size,1);[...f.timers.values()][0]();assert(!f.visible(),'timeout must hide if the renderer stops replying');
f=fixture({tray:false,shortcut:false});assert.equal(f.shell.hide(),false);assert(f.visible());assert(f.calls.some(x=>x[0]==='warning'));
f=fixture();let prevented=false;f.events.close({preventDefault:()=>prevented=true});assert(prevented);assert(f.visible());
f.appEvents['before-quit']({defaultPrevented:false});prevented=false;f.events.close({preventDefault:()=>prevented=true});assert(!prevented,'actual quit must not be converted to hide');f.appEvents['will-quit']();assert.equal(f.timers.size,0);
console.log('PASS: fade handshake, viewport ownership, stale acknowledgements, show/hide reversal, fallback and quit safety');
