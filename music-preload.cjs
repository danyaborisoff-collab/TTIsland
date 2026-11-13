'use strict';
// Runs before the music site's scripts. Exposes NO IPC, filesystem, token or Node API.
const {contextBridge,webFrame}=require('electron');
function installMediaHook(){
 if(window.__islandMediaV5||!navigator.mediaSession)return;
 const handlers=new Map(),session=navigator.mediaSession,media=[];let positionState=null;
 const remember=el=>{if(!media.includes(el)){media.push(el);if(media.length>8)media.shift()}};
 const originalPlay=HTMLMediaElement.prototype.play,originalPause=HTMLMediaElement.prototype.pause;
 HTMLMediaElement.prototype.play=function(...args){remember(this);return originalPlay.apply(this,args)};
 HTMLMediaElement.prototype.pause=function(...args){remember(this);return originalPause.apply(this,args)};
 const originalPosition=session.setPositionState?.bind(session);if(originalPosition)session.setPositionState=function(value){const result=originalPosition(value);positionState=value?{position:value.position||0,duration:value.duration||0,playbackRate:value.playbackRate??1,at:Date.now()}:null;return result};
 const original=session.setActionHandler.bind(session);
 session.setActionHandler=function(action,handler){const result=original(action,handler);if(typeof handler==='function')handlers.set(action,handler);else handlers.delete(action);return result};
 Object.defineProperty(window,'__islandMediaV5',{configurable:false,value:Object.freeze({
  actions:()=>Array.from(handlers.keys()),
  setVolume:value=>{if(!Number.isFinite(value)||value<0||value>1)return {handled:false};const el=media.find(a=>!a.paused&&!a.ended)||media.at(-1);if(!el)return {handled:false};el.volume=value;if(value>0)el.muted=false;return {handled:true,method:'media-element',value:el.volume}},
  seek:seconds=>{const el=media.find(a=>!a.paused&&!a.ended)||media.at(-1);if(!el||!Number.isFinite(seconds)||!el.seekable?.length)return {handled:false};el.currentTime=Math.max(el.seekable.start(0),Math.min(el.seekable.end(el.seekable.length-1),seconds));return {handled:true,method:'media-element'}},
  snapshot:()=>{const el=media.find(a=>!a.paused&&!a.ended&&a.readyState>=2)||media.at(-1);const rate=el?.playbackRate||positionState?.playbackRate||1,playing=el?(!el.paused&&!el.ended&&el.readyState>=2):session.playbackState==='playing';const duration=el&&Number.isFinite(el.duration)?el.duration:positionState?.duration||0;const estimated=(positionState?.position||0)+(playing&&positionState?(Date.now()-positionState.at)/1000*rate:0);return {hasMedia:!!el,playing,position:el&&Number.isFinite(el.currentTime)?el.currentTime:Math.min(duration||Infinity,estimated),duration,rate,volume:el&&Number.isFinite(el.volume)?el.volume:null,muted:!!el?.muted,canSeek:handlers.has('seekto')||!!el?.seekable?.length}},
  invoke:async (action,details={})=>{const handler=handlers.get(action);if(!handler)return {handled:false};try{await handler({...details,action});return {handled:true,method:'media-session'}}catch{return {handled:false,error:'handler-failed'}}}
 })});
}
try{if(typeof contextBridge.executeInMainWorld==='function')contextBridge.executeInMainWorld({func:installMediaHook});else webFrame.executeJavaScript('('+installMediaHook.toString()+')()').catch(()=>{})}catch{}
