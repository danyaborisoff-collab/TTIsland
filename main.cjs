const {app,BrowserWindow,WebContentsView,ipcMain,screen,globalShortcut,clipboard,desktopCapturer,dialog,nativeImage,Notification,shell,Tray,Menu}=require('electron');
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
app.setPath('userData',path.join(app.getPath('appData'),'island-lab'));app.setName('TTIsland');if(process.platform==='win32')app.setAppUserModelId('local.island.lab');
const windowIcon=path.join(__dirname,'assets',process.platform==='win32'?'island.ico':'island.png');
const providerModule=require('./provider-controller.cjs');const {catalog,musicIds}=providerModule;let selectedMusic='yandex';let providerControllers={};
let layout={normalWidth:680,normalHeight:540,compactWidth:380,centerX:null,top:null};let windowShell=null;
let win,tray,history=[],clipEnabled=false,lastClip='',collapsed=false,historyPath,preferencesPath;
const safeRead=(p,d)=>{try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return d}};
const persist=()=>{try{fs.writeFileSync(historyPath,JSON.stringify(history),{mode:0o600});fs.writeFileSync(preferencesPath,JSON.stringify({clipEnabled}),{mode:0o600})}catch{}};
function saveLayout(){try{fs.writeFileSync(path.join(app.getPath('userData'),'window-layout.json'),JSON.stringify(layout))}catch{}}
function positionWindow(small){collapsed=small;if(small)detachService();const primary=screen.getPrimaryDisplay().workArea;const area=Number.isFinite(layout.centerX)&&Number.isFinite(layout.top)?screen.getDisplayNearestPoint({x:Math.round(layout.centerX),y:Math.round(layout.top)}).workArea:primary;const wide=!small&&!!activeService;const width=Math.min(small?layout.compactWidth:wide?1040:layout.normalWidth,area.width),height=Math.min(small?100:wide?840:layout.normalHeight,area.height);const center=Number.isFinite(layout.centerX)?layout.centerX:area.x+area.width/2;const top=Number.isFinite(layout.top)?layout.top:area.y+8;win.setBounds({width,height,x:Math.round(Math.max(area.x,Math.min(area.x+area.width-width,center-width/2))),y:Math.round(Math.max(area.y,Math.min(area.y+area.height-height,top)))});}
ipcMain.handle('window-layout', (event,request)=>{trusted(event);if(request){for(const [key,min,max] of [['normalWidth',560,1000],['normalHeight',500,800],['compactWidth',340,600]])if(Number.isFinite(request[key]))layout[key]=Math.round(Math.max(min,Math.min(max,request[key])));if(request.reset){layout={normalWidth:680,normalHeight:540,compactWidth:380,centerX:null,top:null}}saveLayout();positionWindow(collapsed)}return {...layout}});

if(!app.requestSingleInstanceLock())app.quit();
app.on('second-instance',()=>{if(windowShell)windowShell.show();else if(win){win.show();win.focus()}});
app.whenReady().then(()=>{
 const storedLayout=safeRead(path.join(app.getPath('userData'),'window-layout.json'),{});for(const [key,min,max] of [['normalWidth',560,1000],['normalHeight',500,800],['compactWidth',340,600]])if(Number.isFinite(storedLayout[key]))layout[key]=Math.max(min,Math.min(max,storedLayout[key]));for(const k of ['centerX','top'])if(Number.isFinite(storedLayout[k]))layout[k]=storedLayout[k];
 historyPath=path.join(app.getPath('userData'),'clipboard-history.json');preferencesPath=path.join(app.getPath('userData'),'preferences.json');history=safeRead(historyPath,[]).filter(x=>x&&typeof x.text==='string').slice(0,50);clipEnabled=!!safeRead(preferencesPath,{}).clipEnabled;lastClip=clipboard.readText();
 win=new BrowserWindow({title:'TTIsland',icon:windowIcon,width:664,height:520,frame:false,transparent:true,alwaysOnTop:true,resizable:false,hasShadow:false,skipTaskbar:false,backgroundColor:'#00000000',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 require('./recording.cjs')(win,trusted);require('./desktop-tools.cjs')(win,trusted,decodeImage);require('./voice.cjs')(win,trusted);win.on('will-move',(_,bounds)=>{layout.centerX=bounds.x+bounds.width/2;layout.top=bounds.y;saveLayout()});win.loadFile(path.join(__dirname,'index.html'));positionWindow(false);
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());
 windowShell=require('./window-shell.cjs')(win,trusted,{positionWindow,saveLayout,getLayout:()=>layout});

 setInterval(()=>{if(!clipEnabled||win.isDestroyed())return;if(activeService){lastClip=clipboard.readText();return}const focused=win.webContents.executeJavaScript("document.activeElement?.type === 'password'").catch(()=>true);focused.then(blocked=>{if(blocked)return;pollClipboard()});},800).unref();
 function pollClipboard(){if(win.isDestroyed())return;const text=clipboard.readText();if(text===lastClip)return;lastClip=text;if(!text.trim()||text.length>100000)return;history=[{text,id:Date.now()},...history.filter(c=>c.text!==text)].slice(0,50);persist();win.webContents.send('clipboard',text)}
});
app.on('will-quit',()=>globalShortcut.unregisterAll());app.on('window-all-closed',()=>app.quit());app.on('will-quit',()=>{for(const v of Object.values(services)){if(!v.webContents.isDestroyed())v.webContents.close()}});
ipcMain.handle('resize',(event,small)=>{trusted(event);positionWindow(!!small)});ipcMain.handle('pin',(_,value)=>win.setAlwaysOnTop(!!value));
ipcMain.handle('copy-text',(_,text)=>{if(typeof text==='string')clipboard.writeText(text.slice(0,100000))});
ipcMain.handle('history',()=>history);ipcMain.handle('clear-history',()=>{history=[];lastClip=clipboard.readText();persist()});
ipcMain.handle('clip-enabled',(_,value)=>{clipEnabled=!!value;lastClip=clipboard.readText();persist()});ipcMain.handle('get-clip-enabled',()=>clipEnabled);
ipcMain.handle('stats',()=>({cpus:os.cpus().length,memory:Math.round((1-os.freemem()/os.totalmem())*100),platform:process.platform==='win32'?'Windows':process.platform}));
ipcMain.handle('settings',async(_,type)=>{if(process.platform!=='win32')return;const targets={wifi:'ms-settings:network-wifi',bluetooth:'ms-settings:bluetooth',sound:'ms-settings:sound',display:'ms-settings:display'};if(targets[type])await shell.openExternal(targets[type])});
ipcMain.handle('capture',async()=>{const wasVisible=win.isVisible();try{win.hide();await new Promise(r=>setTimeout(r,250));const display=screen.getPrimaryDisplay();const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:Math.round(display.size.width*display.scaleFactor),height:Math.round(display.size.height*display.scaleFactor)}});const source=sources.find(s=>s.display_id===String(display.id))||sources[0];if(!source||source.thumbnail.isEmpty())throw Error('Capture unavailable');return source.thumbnail.toDataURL()}finally{if(wasVisible){win.show();positionWindow(false)}}});
function decodeImage(data){if(typeof data!=='string'||!data.startsWith('data:image/png;base64,')||data.length>60000000)throw Error('Invalid image');const img=nativeImage.createFromDataURL(data);if(img.isEmpty())throw Error('Empty image');return img;}
ipcMain.handle('copy-image',(_,data)=>clipboard.writeImage(decodeImage(data)));
ipcMain.handle('save-image',async(_,data)=>{const img=decodeImage(data);const result=await dialog.showSaveDialog(win,{defaultPath:'island-screenshot.png',filters:[{name:'PNG',extensions:['png']}]});if(result.canceled||!result.filePath)return false;await fs.promises.writeFile(result.filePath,img.toPNG());return true});
ipcMain.handle('notify',(_,title,body)=>{if(Notification.isSupported())new Notification({title:String(title).slice(0,120),body:String(body).slice(0,500)}).show()});ipcMain.handle('quit',()=>app.quit());

// Third-party services live in sandboxed WebContentsViews, never in the local renderer.
let services={},activeService=null,attachedView=null,serviceRect=null;
const serviceURLs=Object.fromEntries(Object.entries(catalog).map(([id,info])=>[id,info.url]));
function trusted(event){if(!win||event.sender.id!==win.webContents.id||event.senderFrame!==win.webContents.mainFrame)throw Error('Untrusted sender')}
function detachService(){if(attachedView&&win&&!win.isDestroyed()){win.contentView.removeChildView(attachedView);attachedView=null}}
function serviceEvent(id,state){if(win&&!win.isDestroyed())win.webContents.send('service-state',{id,...state})}
function allowedURL(url){try{const u=new URL(url);return u.protocol==='https:'}catch{return false}}
function getService(id){if(!Object.hasOwn(serviceURLs,id))throw Error('Unknown service');if(services[id]&&!services[id].webContents.isDestroyed())return services[id];const v=new WebContentsView({webPreferences:{partition:'persist:island-'+id,preload:musicIds.includes(id)?path.join(__dirname,'music-preload.cjs'):undefined,contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,backgroundThrottling:false}});services[id]=v;v.setBackgroundColor('#151515');v.setBounds({x:0,y:0,width:1200,height:800});const wc=v.webContents;
wc.on('will-navigate',(e,url)=>{if(!allowedURL(url))e.preventDefault()});wc.on('will-redirect',(e,url)=>{if(!allowedURL(url))e.preventDefault()});
wc.setWindowOpenHandler(({url})=>activeService===id&&allowedURL(url)?{action:'allow',overrideBrowserWindowOptions:{autoHideMenuBar:true,webPreferences:{partition:'persist:island-'+id,contextIsolation:true,nodeIntegration:false,sandbox:true}}}:{action:'deny'});
wc.on('did-create-window',child=>{child.webContents.on('will-navigate',(event,url)=>{if(!allowedURL(url))event.preventDefault()});child.webContents.on('will-redirect',(event,url)=>{if(!allowedURL(url))event.preventDefault()});child.webContents.setWindowOpenHandler(()=>({action:'deny'}))});
wc.session.setPermissionRequestHandler((_,permission,callback)=>callback(false));wc.session.setPermissionCheckHandler(()=>false);
wc.on('did-start-loading',()=>serviceEvent(id,{loading:true}));wc.on('did-stop-loading',()=>serviceEvent(id,{loading:false,url:wc.getURL()}));
wc.on('did-fail-load',(_,code,description,url,isMainFrame)=>{if(isMainFrame&&code!==-3)serviceEvent(id,{loading:false,error:'Сервис не загрузился. Проверь интернет или нажми «Обновить».'})});
wc.on('before-input-event',(event,input)=>{if(input.type==='keyDown'&&input.key==='Escape'){event.preventDefault();detachService();win.webContents.send('service-collapse')}});
wc.loadURL(serviceURLs[id]).catch(()=>{});return v;}
function layoutService(rect){if(!activeService||collapsed)return false;const v=getService(activeService);const [w,h]=win.getContentSize();const x=Math.max(8,Math.min(Math.floor(Number(rect.x)||0),w-50)),y=Math.max(100,Math.min(Math.floor(Number(rect.y)||0),h-90));const width=Math.max(1,Math.min(Math.floor(Number(rect.width)||0),w-x-8)),height=Math.max(1,Math.min(Math.floor(Number(rect.height)||0),h-y-12));if(attachedView!==v){detachService();win.contentView.addChildView(v);attachedView=v}v.setBounds({x,y,width,height});serviceRect={x,y,width,height};return true;}
ipcMain.handle('service-select',(event,id)=>{trusted(event);detachService();activeService=id&&Object.hasOwn(serviceURLs,id)?id:null;positionWindow(false);if(activeService)getService(activeService);return !!activeService});
ipcMain.handle('service-bounds',(event,rect)=>{trusted(event);return layoutService(rect||{})});
ipcMain.handle('service-visible',(event,visible)=>{trusted(event);if(!visible)detachService();else if(serviceRect)layoutService(serviceRect);return true});
ipcMain.handle('service-reload',event=>{trusted(event);if(activeService)getService(activeService).webContents.reload()});
ipcMain.handle('service-external',async event=>{trusted(event);if(activeService)await shell.openExternal(serviceURLs[activeService])});
ipcMain.handle('remove-legacy-key',event=>{trusted(event);try{fs.unlinkSync(path.join(app.getPath('userData'),'deepseek-key.enc'))}catch{}return true});
// Background music commands never select/attach the website panel.
const publishMusic=state=>{const provider=state.provider||'yandex';if(provider===selectedMusic&&win&&!win.isDestroyed())win.webContents.send('music-state',{...state,provider})};
const yandexController=require('./music-controller.cjs')(()=>getService('yandex').webContents,s=>publishMusic({...s,provider:'yandex'}));providerControllers.yandex=yandexController;for(const id of musicIds.filter(x=>x!=='yandex'))providerControllers[id]=providerModule.create(id,getService,publishMusic);const musicController={perform:action=>providerControllers[selectedMusic].perform(action),state:()=>providerControllers[selectedMusic].state(),seek:(...args)=>providerControllers[selectedMusic].seek(...args),volume:(...args)=>providerControllers[selectedMusic].volume(...args),diagnostics:()=>({provider:selectedMusic,yandex:yandexController.diagnostics()})};
ipcMain.handle('music-provider',async(event,id)=>{trusted(event);if(!musicIds.includes(id))throw Error('Unknown music provider');if(id!==selectedMusic){const old=selectedMusic;if(services[old]){const before=await providerControllers[old].state();if(before.playing){const pause=await providerControllers[old].perform(old==='yandex'?'toggle':'pause');if(!pause.ok)return {ok:false,error:'Сначала останови прежний источник: '+pause.error}}}selectedMusic=id}publishMusic(await musicController.state());return {ok:true,provider:id}});
ipcMain.handle('music-toggle',async event=>{trusted(event);return musicController.perform('toggle')});
ipcMain.handle('music-action',async(event,action)=>{trusted(event);return musicController.perform(action)});
ipcMain.handle('prepare-collapse',event=>{trusted(event);detachService()});
let pollingMusic=false;
setInterval(async()=>{if(!services[selectedMusic]||pollingMusic||!win||win.isDestroyed())return;pollingMusic=true;try{publishMusic(await musicController.state())}finally{pollingMusic=false}},1000).unref();

ipcMain.handle('music-diagnostics',async event=>{trusted(event);try{const wc=getService(selectedMusic).webContents;const state=await musicController.state();const report=selectedMusic==='yandex'?await wc.executeJavaScript('window.__islandMusicV4.diagnostics()'):{provider:selectedMusic,host:new URL(wc.getURL()).hostname,state};const target=await dialog.showSaveDialog(win,{defaultPath:'TTIsland-music-diagnostics.json',filters:[{name:'JSON',extensions:['json']}]});if(target.canceled)return false;await fs.promises.writeFile(target.filePath,JSON.stringify({version:'0.12.0',...report,lastCommand:musicController.diagnostics()},null,2));return true}catch{return false}});

// Use OS cursor coordinates: crossing into an embedded service is not a true mouse-leave.
let hoverRect=null,lastPointerInside=null;
ipcMain.handle('hover-bounds',(event,rect)=>{trusted(event);if(rect&&['x','y','width','height'].every(k=>Number.isFinite(rect[k])))hoverRect=rect});
setInterval(()=>{if(!win||win.isDestroyed()||!win.isVisible())return;const cursor=screen.getCursorScreenPoint(),bounds=win.getContentBounds();const r=hoverRect||{x:0,y:0,width:bounds.width,height:bounds.height};const inside=cursor.x>=bounds.x+r.x&&cursor.x<=bounds.x+r.x+r.width&&cursor.y>=bounds.y+r.y&&cursor.y<=bounds.y+r.y+r.height;if(inside!==lastPointerInside){lastPointerInside=inside;win.webContents.send('pointer-presence',inside)}},100).unref();

ipcMain.handle('music-seek',async(event,request)=>{trusted(event);return musicController.seek(request?.seconds,request?.trackKey)});
ipcMain.handle('music-volume',async(event,value)=>{trusted(event);return musicController.volume(value)});
