'use strict';
const fs=require('node:fs'), path=require('node:path');
const reader=fs.readFileSync(path.join(__dirname,'weather-reader.js'),'utf8');
function normalizeWeatherURL(value){try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||!['yandex.ru','www.yandex.ru','pogoda.yandex.ru','yandex.com','www.yandex.com'].includes(u.hostname))return null;if(!u.hostname.startsWith('pogoda.')&&!/^\/pogoda(?:\/|$)/.test(u.pathname))return null;if(u.pathname.length>400)return null;const lat=u.searchParams.getAll('lat'),lon=u.searchParams.getAll('lon');let query='';if(lat.length===1&&lon.length===1&&/^-?\d{1,3}(?:\.\d{1,8})?$/.test(lat[0])&&/^-?\d{1,3}(?:\.\d{1,8})?$/.test(lon[0])&&Math.abs(Number(lat[0]))<=90&&Math.abs(Number(lon[0]))<=180)query='?lat='+lat[0]+'&lon='+lon[0];return u.origin+u.pathname+query}catch{return null}}
function createWeatherController(getView,isActive){
 let request=null,lastLoadAt=Date.now(),attached=null,loadError='';
 function watch(wc){if(attached===wc)return;attached=wc;lastLoadAt=Date.now();wc.on('did-finish-load',()=>{lastLoadAt=Date.now();loadError=''});wc.on('did-fail-load',(_,code,description,url,isMainFrame)=>{if(isMainFrame&&code!==-3){lastLoadAt=Date.now();loadError='Яндекс Погода не загрузилась. Проверь интернет и нажми «Обновить». '}});}
 async function read(){
  const wc=getView().webContents;watch(wc);
  if(wc.isDestroyed())return {ok:false,error:'Панель погоды закрыта'};
  if(wc.isLoadingMainFrame())return {ok:false,error:'Загрузка Яндекс Погоды…'};
  if(loadError){if(!isActive()&&Date.now()-lastLoadAt>60000){lastLoadAt=Date.now();wc.reload();return {ok:false,error:'Повторная загрузка погоды…'}}return {ok:false,error:loadError};}
  if(!normalizeWeatherURL(wc.getURL()))return {ok:false,error:'Открой Яндекс Погоду и выбери город на сайте.'};
  // Poll the loaded page every 10 s; refresh a hidden page after 10 minutes.
  if(!isActive()&&Date.now()-lastLoadAt>10*60*1000){lastLoadAt=Date.now();wc.reload();return {ok:false,error:'Обновляем страницу погоды…'};}
  let timer;try {const result=await Promise.race([wc.executeJavaScript(reader),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),5000)})]);return result?.ok?result:{ok:false,error:result?.error||'Не удалось прочитать погоду'};}
  catch{return {ok:false,error:'Не удалось прочитать страницу погоды. Проверь интернет и выбери город.'};}finally{clearTimeout(timer)}
 }
 return {snapshot(){if(!request){request=read().catch(()=>({ok:false,error:'Не удалось загрузить погоду'})).finally(()=>request=null)}return request;}};
}
module.exports={normalizeWeatherURL,createWeatherController};
