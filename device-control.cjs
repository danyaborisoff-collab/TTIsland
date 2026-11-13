'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const tasks=new Set(['wifiSnapshot','wifiPower','wifiConnect','wifiDisconnect','wifiForget','bluetoothState','bluetoothPower','bluetoothPair','bluetoothUnpair','vpnState','vpnConnect','vpnDisconnect','networkState','appearanceState','appearanceSet','privacyState','audioState','audioVolume','audioMute']);
function validate(task,payload){
 if(!tasks.has(task))throw Error('Операция запрещена');const p=payload&&typeof payload==='object'?payload:{};const out={task};
 const text=(key,max,pattern,optional=false)=>{const v=p[key];if(optional&&(v===undefined||v===''))return '';if(typeof v!=='string'||!v.length||v.length>max||v.includes('\0')||pattern&&!pattern.test(v))throw Error('Некорректное поле '+key);return v};
 const bool=key=>{if(typeof p[key]!=='boolean')throw Error('Некорректное значение '+key);return p[key]};
 if(task==='wifiSnapshot')out.scan=p.scan===true;
 if(['wifiPower','wifiConnect','wifiDisconnect','wifiForget'].includes(task))out.adapterId=text('adapterId',36,/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i);
 if(task==='wifiPower'||task==='bluetoothPower')out.value=bool('value');
 if(task==='wifiConnect'){out.ssidHex=text('ssidHex',64,/^(?:[a-f\d]{2}){1,32}$/i).toUpperCase();out.profile=text('profile',255,null,true);out.password=text('password',63,null,true);if(out.password&&out.password.length<8)throw Error('Пароль должен содержать 8–63 символа');out.remember=bool('remember')}
 if(task==='wifiForget')out.profile=text('profile',255);
 if(task==='bluetoothPair'||task==='bluetoothUnpair')out.id=text('id',2048,/^Bluetooth/i);
 if(task==='vpnConnect'||task==='vpnDisconnect'){out.name=text('name',255);if(/[\r\n]/.test(out.name)||out.name.startsWith('/'))throw Error('Некорректное имя VPN')}
 if(task==='appearanceSet'){if(!['appsLight','systemLight','notifications'].includes(p.target))throw Error('Недопустимый параметр');out.target=p.target;out.value=bool('value')}
 if(task==='audioVolume'||task==='audioMute'){if(![0,1].includes(p.flow))throw Error('Некорректный аудиоканал');out.flow=p.flow;if(task==='audioMute')out.value=bool('value');else{if(!Number.isInteger(p.value)||p.value<0||p.value>100)throw Error('Громкость должна быть от 0 до 100');out.value=p.value}}
 return out;
}
function resolveNativeDirectory(baseDir=__dirname){return path.join(/\.asar$/i.test(baseDir)?baseDir+'.unpacked':baseDir,'native')}
function createDeviceRunner({platform=process.platform,launch=spawn,nativeDir=resolveNativeDirectory()}={}){const pending=new Set(),children=new Set();let closed=false;
 async function run(task,payload){let request;try{request=validate(task,payload)}catch(e){return {ok:false,error:e.message}}
  if(platform!=='win32')return {ok:false,error:'Управление устройствами доступно в приложении Windows 10/11'};if(closed)return {ok:false,error:'Приложение закрывается'};const group=task.match(/^(wifi|bluetooth|vpn|audio|appearance|privacy|network)/)[0];if(pending.has(group))return {ok:false,error:'Предыдущее действие ещё выполняется. Подожди обновления.'};pending.add(group);
  try{const script=fs.readFileSync(path.join(nativeDir,'device-control.ps1'),'utf8'),exe=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');return await new Promise(resolve=>{let text='',done=false,timer;const finish=result=>{if(done)return;done=true;clearTimeout(timer);children.delete(child);resolve(result)};const child=launch(exe,['-NoProfile','-NonInteractive','-STA','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,shell:false,stdio:['pipe','pipe','ignore'],env:{...process.env,TTISLAND_NATIVE_DIR:nativeDir}});children.add(child);timer=setTimeout(()=>{child.kill();finish({ok:false,error:'Windows не ответила вовремя. Обнови список, прежде чем повторять действие.'})},task==='wifiConnect'||group==='bluetooth'?65000:35000);child.stdout.setEncoding('utf8');child.stdout.on('data',s=>{text+=s;if(text.length>1024*1024){child.kill();finish({ok:false,error:'Слишком большой ответ Windows'})}});child.once('error',()=>finish({ok:false,error:'Не удалось запустить системный контроллер Windows'}));child.once('close',()=>{try{const value=JSON.parse(text.replace(/^\uFEFF/,'').trim());finish(value&&typeof value.ok==='boolean'?value:{ok:false,error:'Некорректный ответ Windows'})}catch{finish({ok:false,error:'Контроллер Windows не вернул данные. Проверь доступность Windows PowerShell и политики выполнения.'})}});child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(request));request.password=undefined;});}catch{return {ok:false,error:'Не удалось подготовить системный контроллер'}}finally{pending.delete(group)}
 }
 return {run,dispose(){closed=true;for(const child of children)child.kill();children.clear()}};
}
module.exports=function setupDeviceControl(win,trusted){const {app,ipcMain}=require('electron');const runner=createDeviceRunner();ipcMain.handle('device-control',(event,task,payload)=>{trusted(event);return runner.run(task,payload)});app.on('will-quit',()=>runner.dispose())};
module.exports.validate=validate;module.exports.createDeviceRunner=createDeviceRunner;

module.exports.resolveNativeDirectory=resolveNativeDirectory;
