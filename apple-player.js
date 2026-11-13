// Apple Music website transport adapter. No IPC, account access, token configuration or DRM changes.
// Uses the site's registered Media Session actions, an already configured public MusicKit
// instance when available, HTML media, and narrowly scoped player buttons as fallback.
(()=>{
'use strict';
if(window.__ttAppleMusic)return;
const finite=n=>typeof n==='number'&&Number.isFinite(n),clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const clean=s=>String(s||'').replace(/\s+/g,' ').trim().slice(0,1000);
const visible=e=>!!e&&e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).display!=='none';
const hook=()=>window.__islandMediaV5;
function kit(){try{const k=window.MusicKit?.getInstance?.();return k&&typeof k==='object'?k:null;}catch{return null;}}
function player(k){return k?.player&&typeof k.play!=='function'?k.player:k;}
function snapshot(){try{return hook()?.snapshot?.()||{};}catch{return {};}}
function media(){return [...document.querySelectorAll('audio,video')].find(e=>!e.paused&&!e.ended)||[...document.querySelectorAll('audio,video')].find(e=>e.readyState>0)||null;}
const rootSelector='amp-chrome-player,amp-player,#web-main-player,[data-testid="web-player"],.web-player,.player-bar';
function roots(){return [...document.querySelectorAll(rootSelector)].filter(visible);}
function text(selector){for(const r of roots()){const value=clean(r.querySelector(selector)?.textContent);if(value)return value;}return '';}
function artwork(value){try{const u=new URL(String(value||''),location.href);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&(u.hostname==='mzstatic.com'||u.hostname.endsWith('.mzstatic.com'))?u.href:'';}catch{return '';}}
function state(){
 const k=kit(),p=player(k),h=snapshot(),e=media(),m=navigator.mediaSession?.metadata,item=k?.nowPlayingItem||p?.nowPlayingItem,a=item?.attributes||{};
 const title=clean(m?.title||a.name||item?.title)||text('[data-testid="lcd-track-title"],[data-testid="track-title"],.song-name,.playback-info__song-name');
 const artist=clean(m?.artist||a.artistName||item?.artistName)||text('[data-testid="lcd-track-artist"],[data-testid="track-artist"],.playback-info__artist-name');
 const duration=finite(p?.currentPlaybackDuration)&&p.currentPlaybackDuration>0?p.currentPlaybackDuration:finite(h.duration)&&h.duration>0?h.duration:finite(e?.duration)&&e.duration>0?e.duration:finite(a.durationInMillis)?a.durationInMillis/1000:0;
 const position=finite(p?.currentPlaybackTime)?p.currentPlaybackTime:finite(h.position)&&(h.hasMedia||h.duration>0)?h.position:finite(e?.currentTime)?e.currentTime:0;
 const volume=finite(p?.volume)?p.volume:finite(h.volume)?h.volume:finite(e?.volume)?e.volume:null;
 const playing=typeof k?.isPlaying==='boolean'?k.isPlaying:h.hasMedia?!!h.playing:p&&window.MusicKit?.PlaybackStates?.playing!==undefined?p.playbackState===window.MusicKit.PlaybackStates.playing:navigator.mediaSession?.playbackState==='playing'||!!(e&&!e.paused&&!e.ended);
 const candidates=[...(m?.artwork||[])].sort((x,y)=>(parseInt(y.sizes)||0)-(parseInt(x.sizes)||0));
 let cover=candidates.map(x=>artwork(x.src)).find(Boolean)||artwork(a.artwork?.url?.replace(/\{w\}|\{h\}/g,'512'));
 if(!cover)for(const r of roots()){const img=r.querySelector('img');cover=artwork(img?.currentSrc||img?.src);if(cover)break;}
 return {provider:'apple',title,artist,artwork:cover||'',connected:!!(title||item||e||h.hasMedia),playing,position:clamp(position,0,duration||Infinity),duration:Math.max(0,duration),rate:finite(p?.playbackRate)&&p.playbackRate>0?p.playbackRate:finite(h.rate)&&h.rate>0?h.rate:1,volume:finite(volume)?clamp(volume,0,1):null,muted:typeof p?.isMuted==='boolean'?p.isMuted:h.muted??!!e?.muted,canSeek:duration>0&&(typeof p?.seekToTime==='function'||!!h.canSeek||!!e?.seekable?.length),canVolume:finite(volume)&&(!!p||!!h.hasMedia||!!e)};
}
async function session(action,details){try{const result=await hook()?.invoke?.(action,details);if(result?.handled)return result;}catch{}return null;}
function button(action){
 const patterns={play:/^(play|play song|play current song|resume|воспроизвести|слушать|продолжить)$/i,pause:/^(pause|pause playback|пауза|приостановить)$/i,next:/^(next|next track|next song|следующий|следующий трек)$/i,previous:/^(previous|previous track|previous song|предыдущий|предыдущий трек)$/i};
 for(const r of roots())for(const b of r.querySelectorAll('button,[role="button"]')){if(!visible(b)||b.disabled||b.getAttribute('aria-disabled')==='true')continue;const labels=[b.getAttribute('aria-label'),b.getAttribute('title'),b.textContent].map(clean);if(labels.some(x=>patterns[action]?.test(x)))return b;}
 return null;
}
async function transport(action){
 if(!['toggle','play','pause','next','previous'].includes(action))return {handled:false};
 const desired=action==='toggle'?(state().playing?'pause':'play'):action;
 const mapped=desired==='next'?'nexttrack':desired==='previous'?'previoustrack':desired;
 const h=await session(mapped);if(h)return h;
 const p=player(kit()),method={play:'play',pause:'pause',next:'skipToNextItem',previous:'skipToPreviousItem'}[desired];
 if(typeof p?.[method]==='function'){try{await p[method]();return {handled:true,method:'musickit-existing-instance'};}catch{}}
 const e=media();if(e&&['play','pause'].includes(desired)){try{if(desired==='play')await e.play();else e.pause();return {handled:true,method:'media-element'};}catch{}}
 const b=button(desired);if(b){b.click();return {handled:true,method:'apple-player-button'};}
 return {handled:false};
}
async function seek(seconds){
 if(!finite(seconds)||seconds<0)return {handled:false};const s=state();if(!s.canSeek||!s.duration)return {handled:false};const target=clamp(seconds,0,s.duration);
 const h=await session('seekto',{seekTime:target,fastSeek:false});if(h)return h;
 const p=player(kit());if(typeof p?.seekToTime==='function'){try{await p.seekToTime(target);return {handled:true,method:'musickit-existing-instance'};}catch{}}
 try{const r=hook()?.seek?.(target);if(r?.handled)return r;}catch{}
 const e=media();if(!e?.seekable?.length)return {handled:false};try{e.currentTime=clamp(target,e.seekable.start(0),e.seekable.end(e.seekable.length-1));return {handled:true,method:'media-element'};}catch{return {handled:false};}
}
function volume(value){
 if(!finite(value)||value<0||value>1)return {handled:false};const p=player(kit());
 if(p&&finite(p.volume)){try{p.volume=value;if(Math.abs(p.volume-value)<.03)return {handled:true,method:'musickit-existing-instance'};}catch{}}
 try{const r=hook()?.setVolume?.(value);if(r?.handled)return r;}catch{}
 const e=media();if(!e)return {handled:false};try{e.volume=value;e.muted=false;return {handled:true,method:'media-element'};}catch{return {handled:false};}
}
function diagnostics(){return {provider:'apple',host:location.hostname,mediaSessionHook:!!hook(),existingMusicKit:!!kit(),state:state(),note:'Apple Music playback depends on the website, account, subscription, region and DRM support. No credentials or tokens collected.'};}
window.__ttAppleMusic=Object.freeze({state,transport,seek,volume,diagnostics});
})();
