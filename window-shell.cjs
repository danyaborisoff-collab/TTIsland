'use strict';
// Window lifetime and drag logic are deliberately separate from media/recording lifetime.
module.exports=function setupWindowShell(win,trusted,{positionWindow,saveLayout,getLayout,beforeShow=()=>{}}){
 const {app,ipcMain,screen,globalShortcut,Tray,Menu,nativeImage,dialog}=require('electron'),path=require('node:path');let tray=null,quitting=false,drag=null,shortcut=false,hideTimer=null,hidePending=false,hideGeneration=0;
 function savePosition(){const b=win.getBounds(),layout=getLayout();layout.centerX=b.x+b.width/2;layout.top=b.y;saveLayout()}
 function finishDrag(){if(drag){drag=null;savePosition()}}
 function show(){if(win.isDestroyed())return;clearTimeout(hideTimer);hideTimer=null;hidePending=false;++hideGeneration;if(win.isMinimized())win.restore();beforeShow();win.setSkipTaskbar(false);win.show();win.focus();win.webContents.send('window-show')}
 function finishHide(ticket=hideGeneration){if(!hidePending||ticket!==hideGeneration||win.isDestroyed())return false;clearTimeout(hideTimer);hideTimer=null;hidePending=false;win.webContents.send('window-hidden');win.hide();win.setSkipTaskbar(true);return true}
 function hide(){if(win.isDestroyed())return false;finishDrag();if(!tray&&!shortcut){dialog.showMessageBox(win,{type:'warning',message:'Нельзя скрыть остров: трей недоступен, а Alt+Space занята.',detail:'Окно оставлено открытым, чтобы приложение не потерялось. Освободи сочетание или перезапусти приложение.'});return false}if(hidePending||!win.isVisible())return true;hidePending=true;const ticket=++hideGeneration;win.webContents.send('window-hiding',ticket);hideTimer=setTimeout(()=>finishHide(ticket),240);return true}
 function move(phase){if(phase==='start'){if(!win.isVisible())return false;const cursor=screen.getCursorScreenPoint(),bounds=win.getBounds();drag={dx:bounds.x-cursor.x,dy:bounds.y-cursor.y};return true}if(phase==='end'||phase==='cancel'){finishDrag();return true}if(phase!=='move'||!drag)return false;const cursor=screen.getCursorScreenPoint(),area=screen.getDisplayNearestPoint(cursor).workArea,bounds=win.getBounds();const x=Math.round(Math.max(area.x,Math.min(area.x+Math.max(0,area.width-bounds.width),cursor.x+drag.dx))),y=Math.round(Math.max(area.y,Math.min(area.y+Math.max(0,area.height-bounds.height),cursor.y+drag.dy)));win.setPosition(x,y);return true}
 ipcMain.handle('window-drag',(event,phase)=>{trusted(event);return move(phase)});
 ipcMain.handle('window-hide',event=>{trusted(event);return hide()});
 ipcMain.handle('window-hide-ready',(event,ticket)=>{trusted(event);return finishHide(ticket)});
 ipcMain.handle('window-shell-info',event=>{trusted(event);return {tray:!!tray,shortcut,hotkey:'Alt+Space'}});
 try{const icon=nativeImage.createFromPath(path.join(__dirname,'assets','tray.png'));if(icon.isEmpty())throw Error('Missing tray icon');tray=new Tray(icon);tray.setToolTip('TTIsland · Alt+Space — показать');tray.setContextMenu(Menu.buildFromTemplate([{label:'Показать остров · Alt+Space',click:show},{label:'Скрыть в трей',click:hide},{type:'separator'},{label:'Выйти полностью',click:()=>app.quit()}]));tray.on('click',show);tray.on('double-click',show)}catch{tray=null}
 shortcut=globalShortcut.register('Alt+Space',()=>{if(!win.isVisible()||win.isMinimized())show();else{win.focus();win.webContents.send('toggle')}});
 // Recording's before-quit listener runs first and may cancel a real exit.
 app.on('before-quit',event=>{quitting=!event.defaultPrevented});
 win.on('close',event=>{if(quitting)return;event.preventDefault();hide()});
 win.on('minimize',event=>{event?.preventDefault?.();hide()});
 win.on('blur',finishDrag);
 app.on('will-quit',()=>{quitting=true;clearTimeout(hideTimer);hidePending=false;finishDrag();if(shortcut)globalShortcut.unregister('Alt+Space');tray?.destroy()});
 return {show,hide,move,hasTray:()=>!!tray,isQuitting:()=>quitting};
};
