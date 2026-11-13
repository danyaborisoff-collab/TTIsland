'use strict';
// Original TTIsland implementation. No shell commands or URIs supplied by the renderer.
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const settingsTargets=Object.freeze({wifi:'ms-settings:network-wifi',bluetooth:'ms-settings:bluetooth',sound:'ms-settings:sound',display:'ms-settings:display',vpn:'ms-settings:network-vpn',network:'ms-settings:network-status',notifications:'ms-settings:notifications',microphone:'ms-settings:privacy-microphone',camera:'ms-settings:privacy-webcam',power:'ms-settings:powersleep',night:'ms-settings:nightlight',theme:'ms-settings:colors'});
const powerActions=Object.freeze({lock:{exe:'rundll32.exe',args:['user32.dll,LockWorkStation'],label:'Заблокировать компьютер'},sleep:{exe:'powershell.exe',args:['-NoProfile','-NonInteractive','-Command','Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Application]::SetSuspendState([System.Windows.Forms.PowerState]::Suspend,$false,$false)'],label:'Перевести компьютер в сон'},restart:{exe:'shutdown.exe',args:['/r','/t','0'],label:'Перезагрузить компьютер'},shutdown:{exe:'shutdown.exe',args:['/s','/t','0'],label:'Выключить компьютер'}});
module.exports=function setupSystemControls(win,trusted){
 const {app,ipcMain,shell,dialog}=require('electron');const file=path.join(app.getPath('userData'),'system-controls.json');let captureProtected=false;
 try{captureProtected=JSON.parse(fs.readFileSync(file,'utf8')).captureProtected===true}catch{}
 if(process.platform==='win32')win.setContentProtection(captureProtected);
 let powerBusy=false;
 ipcMain.handle('system-control',async(event,action,payload)=>{trusted(event);if(process.platform!=='win32')return {ok:false,error:'Доступно только в приложении Windows 10/11'};
 try{
  if(action==='state')return {ok:true,captureProtected,autoStart:app.getLoginItemSettings().openAtLogin,packaged:app.isPackaged};
  if(action==='open'){if(!Object.hasOwn(settingsTargets,payload?.target))return {ok:false,error:'Недопустимый раздел Windows'};await shell.openExternal(settingsTargets[payload.target]);return {ok:true}}
  if(action==='captureProtection'){if(typeof payload?.value!=='boolean')return {ok:false,error:'Некорректное значение'};win.setContentProtection(payload.value);captureProtected=payload.value;fs.writeFileSync(file,JSON.stringify({captureProtected}),{mode:0o600});return {ok:true,captureProtected}}
  if(action==='autoStart'){if(!app.isPackaged)return {ok:false,error:'Автозапуск доступен после установки собранного приложения'};if(typeof payload?.value!=='boolean')return {ok:false,error:'Некорректное значение'};app.setLoginItemSettings({openAtLogin:payload.value,path:process.execPath});return {ok:true,autoStart:app.getLoginItemSettings().openAtLogin}}
  if(action==='power'){if(!Object.hasOwn(powerActions,payload?.action))return {ok:false,error:'Недопустимое действие'};if(powerBusy)return {ok:false,error:'Подтверди или отмени предыдущее действие'};powerBusy=true;try{const command=powerActions[payload.action];const choice=await dialog.showMessageBox(win,{type:'warning',buttons:['Отмена',command.label],defaultId:0,cancelId:0,noLink:true,message:command.label+'?',detail:'Сохрани работу в других приложениях. Действие будет выполнено сразу после подтверждения.'});if(choice.response!==1)return {ok:false,cancelled:true};const root=process.env.SystemRoot||'C:\\Windows';const exe=path.join(root,'System32',command.exe==='powershell.exe'?'WindowsPowerShell\\v1.0\\powershell.exe':command.exe);await new Promise((resolve,reject)=>{const child=spawn(exe,command.args,{windowsHide:true,shell:false,stdio:'ignore'});child.once('error',reject);child.once('close',code=>code===0?resolve():reject(Error('Windows отклонила действие')))});return {ok:true}}finally{powerBusy=false}}
  return {ok:false,error:'Операция запрещена'};
 }catch{return {ok:false,error:'Windows не выполнила действие. Возможно, оно запрещено политикой системы.'}}});
};
module.exports.settingsTargets=settingsTargets;module.exports.powerActions=powerActions;
