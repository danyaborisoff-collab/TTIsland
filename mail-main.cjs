'use strict';
module.exports=function setupMail(win,trusted){
 const {ipcMain,app,safeStorage,Notification}=require('electron'),path=require('node:path');
 const {createMailController}=require('./mail-controller.cjs');
 const controller=createMailController({storage:safeStorage,file:path.join(app.getPath('userData'),'mail-profile.enc'),clientFactory:options=>{const {ImapFlow}=require('imapflow');return new ImapFlow(options)},notify:(added,total)=>{if(Notification.isSupported())new Notification({title:'TTIsland · Почта',body:`Непрочитанных писем: ${total} (+${added})`}).show()},emit:state=>{if(!win.isDestroyed())win.webContents.send('mail-state',state)}});
 ipcMain.handle('mail-state',e=>{trusted(e);return controller.state()});ipcMain.handle('mail-connect',(e,p)=>{trusted(e);return controller.configure(p)});ipcMain.handle('mail-refresh',e=>{trusted(e);return controller.refresh()});ipcMain.handle('mail-disconnect',e=>{trusted(e);return controller.disconnect()});
 const timer=setInterval(()=>{if(controller.state().configured)controller.refresh()},180000);timer.unref();if(controller.state().configured)setTimeout(()=>controller.refresh(),5000).unref();app.on('will-quit',()=>clearInterval(timer));
};
