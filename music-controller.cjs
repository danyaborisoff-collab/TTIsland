'use strict';
const fs=require('node:fs');
const path=require('node:path');
const adapter=fs.readFileSync(path.join(__dirname,'music-adapter.js'),'utf8');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const allowed=new Set(['music.yandex.ru','music.yandex.com','music.yandex.kz','music.yandex.by']);
module.exports=function createMusicController(getWebContents,publish){
 let busy=false,mode=null,lastCommand=null;
 async function call(method,arg){const wc=getWebContents();if(wc.isDestroyed())throw Error('closed');let host;try{host=new URL(wc.getURL()).hostname}catch{throw Error('loading')}if(!allowed.has(host))throw Error('login');await wc.executeJavaScript(adapter);return wc.executeJavaScript(`window.__islandMusicV4.${method}(${arg===undefined?'':JSON.stringify(arg)})`,true)}
 async function ready(deadline){while(Date.now()<deadline){const wc=getWebContents();if(!wc.isLoadingMainFrame()){try{await call('state');return}catch(e){if(e.message==='login'&&wc.getURL())throw e}}await sleep(250)}throw Error('timeout')}
 async function state(){try{return await call('state')}catch{return {title:'Яндекс Музыка',artist:'Нужен вход в аккаунт',playing:false,connected:false}}}
 async function waitPlaying(deadline){while(Date.now()<deadline){try{const s=await call('state');if(s.playing){publish(s);return true}}catch{}await sleep(300)}return false}
 function error(code){return {ok:false,error:code==='login'?'Нужен вход: нажми «Поиск / настройки» и войди в Яндекс.':code==='timeout'?'Музыка не ответила вовремя. Проверь интернет и вход в аккаунт.':'Не удалось выполнить команду. Веб-панель не открывалась; проверь вход и доступность плеера.'}}
 async function perform(action){if(!['toggle','next','previous','wave','likes','collection'].includes(action))return error('invalid');if(busy)return {ok:false,error:'Предыдущая команда ещё выполняется'};busy=true;lastCommand={action,startedAt:new Date().toISOString(),stages:[]};const deadline=Date.now()+18000;try{await ready(deadline);const before=await call('state');
 if(action==='toggle'){const r=await call('toggle');if(!r.clicked)return {ok:false,error:'Плеер пока недоступен. Проверь вход через «Поиск / настройки».'};let after=before;const end=Date.now()+3500;while(Date.now()<end){await sleep(180);after=await call('state');if(after.playing!==before.playing)break}publish(after);if(after.playing===before.playing)return {ok:false,error:'Команда отправлена, но плеер не подтвердил смену состояния.'};return {ok:true,playing:after.playing,method:r.method}}
 if(action==='next'||action==='previous'){const r=await call('step',action);if(!r.clicked)return {ok:false,error:'На сайте не найдена кнопка переключения. Веб-панель не открывалась.'};const until=Math.min(deadline,Date.now()+6000);while(Date.now()<until){await sleep(350);const after=await call('state');if(after.title!==before.title||after.artist!==before.artist||after.position+2<before.position){publish(after);return {ok:true,method:r.method}}}return {ok:false,error:'Нажатие отправлено, но смена трека не подтверждена.'}}
 if(action==='wave'){
  let opened=await call('openMode','wave');lastCommand.stages.push({step:'current-page',...opened});
  if(!opened.clicked){const wc=getWebContents();await wc.loadURL('https://music.yandex.ru/');await ready(deadline);const discoveryEnd=deadline-4000;while(Date.now()<discoveryEnd){opened=await call('openMode','wave');if(opened.clicked)break;await sleep(350)}lastCommand.stages.push({step:'homepage-hydrated',...opened})}
  if(!opened.clicked){lastCommand.wave=await call('waveProbe');return {ok:false,error:'На главной не найдена кнопка запуска Волны. Сохрани новую диагностику: теперь она содержит отдельный раздел wave.'}}
  if(opened.intent==='already'){mode='wave';return {ok:true,already:true}}
  if(opened.intent==='navigate'){let play={clicked:false};while(Date.now()<deadline-2500){await ready(deadline);play=await call('playMode','wave');if(play.clicked)break;await sleep(350)}lastCommand.stages.push({step:'wave-page-play',...play});if(!play.clicked){lastCommand.wave=await call('waveProbe');return {ok:false,error:'Страница Волны открыта в фоне, но её Play не найден. Сохрани новую диагностику музыки.'}}}
  const until=Math.min(deadline,Date.now()+12000);let latest=before;
  while(Date.now()<until){await sleep(300);latest=await call('state');if(latest.playing&&(latest.waveActive||!before.playing||latest.title!==before.title||latest.artist!==before.artist||latest.position+1<before.position)){mode='wave';publish(latest);lastCommand.confirmed=true;return {ok:true,mode}}}
  lastCommand.wave=await call('waveProbe');lastCommand.confirmed=false;publish(latest);return {ok:false,error:'Команда Волны отправлена один раз, но её запуск не подтверждён. Сохрани диагностику музыки — теперь в ней есть выбранная кнопка и этапы запуска.'};
 }
 const target=action==='wave'?'wave':'likes';if(mode===target&&before.playing)return {ok:true,already:true};
 if(before.playing){const paused=await call('toggle');if(!paused.clicked)return {ok:false,error:'Не удалось подготовить переключение источника.'};await sleep(200)}
 let opened=await call('openMode',target);
 if(!opened.clicked&&target==='wave'){// Load only the background player, never expose the service view.
 const wc=getWebContents();await wc.loadURL('https://music.yandex.ru/');await ready(deadline);opened=await call('openMode',target)}
 if(!opened.clicked)return {ok:false,error:target==='wave'?'На сайте не найдена «Моя волна». Проверь вход или настройки волны.':'На сайте не найдены «Любимые». Проверь вход и наличие любимых треков.'};
 if(target==='likes'&&opened.kind==='collection'){await sleep(700);while(Date.now()<deadline){opened=await call('openMode','likes');if(opened.kind==='likes')break;await sleep(350)}if(opened.kind!=='likes')return {ok:false,error:'Не удалось найти плейлист «Мне нравится» в твоей коллекции.'}}
 await sleep(600);await ready(deadline);
 // For wave, its own labelled button often starts playback. For likes, explicitly press playlist Play.
 if(target==='wave'&&await waitPlaying(Math.min(deadline,Date.now()+1200))){mode=target;return {ok:true,mode}}
 let clicked=false;while(Date.now()<deadline){const play=await call('playMode',target);if(play.clicked){clicked=true;break}await sleep(350)}
 if(clicked&&await waitPlaying(Math.min(deadline,Date.now()+5000))){mode=target;return {ok:true,mode}}
 return {ok:false,error:'Сайт не подтвердил запуск. Возможны ограничения аккаунта или изменение интерфейса. Веб-панель не открывалась.'};
 }catch(e){return error(e.message)}finally{busy=false}}
 const identity=s=>[s.title,s.artist,Math.round(s.duration||0)].join('\n');
 async function seek(seconds,trackKey){if(!Number.isFinite(seconds)||seconds<0||typeof trackKey!=='string'||trackKey.length>2000)return {ok:false,error:'Некорректная позиция трека'};if(busy)return {ok:false,error:'Дождись завершения музыкальной команды'};busy=true;try{await ready(Date.now()+4000);const before=await call('state');if(identity(before)!==trackKey)return {ok:false,error:'Трек сменился. Перемотка отменена.'};if(!before.canSeek||!(before.duration>0))return {ok:false,error:'Для этого источника перемотка недоступна'};const target=Math.min(seconds,before.duration);const result=await call('seekTo',target);if(!result.handled)return {ok:false,error:'Плеер не поддерживает эту перемотку'};const deadline=Date.now()+2500;while(Date.now()<deadline){await sleep(150);const after=await call('state');if(identity(after)!==trackKey)return {ok:false,error:'Трек сменился во время перемотки'};if(Math.abs(after.position-target)<2.5){publish(after);return {ok:true,state:after}}}return {ok:false,error:'Плеер не подтвердил перемотку'}}catch{return {ok:false,error:'Не удалось перемотать трек'}}finally{busy=false}}
 async function volume(value){if(!Number.isFinite(value)||value<0||value>1)return {ok:false,error:'Некорректная громкость'};try{await ready(Date.now()+4000);const r=await call('setVolume',value);if(!r.handled)return {ok:false,error:'Плеер пока не предоставляет управление громкостью'};await sleep(100);const after=await call('state');publish(after);if(!Number.isFinite(after.volume)||Math.abs(after.volume-value)>.03||value>0&&after.muted)return {ok:false,error:'Плеер не подтвердил изменение громкости'};return {ok:true,state:after}}catch{return {ok:false,error:'Не удалось изменить громкость'}}}
 return {perform,state,seek,volume,diagnostics:()=>lastCommand};
};
