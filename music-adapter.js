(() => {
  if (window.__islandMusicV4) return;
  const normalize = x => String(x || '').replace(/\s+/g, ' ').trim();
  const visible = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none';
  const available = el => visible(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true';
  const labels = el => ['aria-label', 'title', 'data-test-id', 'data-testid'].map(a => normalize(el.getAttribute(a))).concat(normalize(el.textContent).slice(0,180)).filter(Boolean);
  const elements = () => Array.from(document.querySelectorAll('button,a,[role="button"]')).filter(available);
  const matches = (el,re) => labels(el).some(x=>re.test(x));
  const exact = {
    wave: /^(моя волна|включить мою волну|запустить мою волну|слушать мою волну|play my vibe|my vibe)$/i,
    likes: /^(мне нравится|любимые|любимые треки|понравившиеся треки|liked tracks|favorites|favourites)$/i,
    collection: /^(коллекция|моя коллекция|collection|my collection)$/i,
    next: /(^|[\s:_-])(следующий трек|следующий|next track|next|nextTrack)([\s:_-]|$)/i,
    previous: /(^|[\s:_-])(предыдущий трек|предыдущий|previous track|previous|prev|previousTrack)([\s:_-]|$)/i,
    play: /^(воспроизвести|слушать|включить|играть|play|воспроизвести плейлист|слушать плейлист|play playlist)$/i,
    pause: /^(пауза|приостановить|pause)$/i
  };
  const player = () => Array.from(document.querySelectorAll('audio,video')).find(a=>!a.paused) || document.querySelector('audio,video');
  function artworkURL(value){try{let raw=String(value||'').trim().replace(/%%/g,'400x400');if(raw.startsWith('//'))raw='https:'+raw;else if(/^(avatars(?:\.mds)?\.yandex\.net)\//i.test(raw))raw='https://'+raw;const u=new URL(raw);const ok=['yandex.net','yandex.ru','yandex.com','yandex.kz','yandex.by','yastatic.net'].some(d=>u.hostname===d||u.hostname.endsWith('.'+d));return u.protocol==='https:'&&ok&&!u.username&&!u.password&&(!u.port||u.port==='443')?u.href:''}catch{return ''}}
  function trackArtwork(metadata,track){const items=Array.from(metadata?.artwork||[]).map(x=>({url:artworkURL(x.src),size:parseInt(x.sizes)||0})).filter(x=>x.url).sort((a,b)=>Math.abs((a.size||512)-512)-Math.abs((b.size||512)-512));if(items.length)return items[0].url;const external=artworkURL(track?.cover||track?.coverUri||track?.albums?.[0]?.coverUri);if(external)return external;const img=Array.from(document.querySelectorAll('[class*="PlayerBar"] img,[class*="FullscreenPlayer"] img,[class*="player-bar"] img')).find(e=>visible(e)&&artworkURL(e.currentSrc||e.src));return img?artworkURL(img.currentSrc||img.src):''}
  function transportInfo(a,snapshot,external){let progress=null,volume=null;try{if(typeof external?.getProgress==='function'){const p=external.getProgress();if(p&&typeof p==='object'&&typeof p.then!=='function')progress=p}if(typeof external?.getVolume==='function'){const v=external.getVolume();if(typeof v==='number'&&Number.isFinite(v))volume=Math.max(0,Math.min(1,v))}}catch{}const duration=snapshot?.duration>0?snapshot.duration:Number.isFinite(a?.duration)&&a.duration>0?a.duration:Number.isFinite(progress?.duration)?progress.duration:0;const position=Number.isFinite(snapshot?.position)&&(snapshot.hasMedia||snapshot.duration>0)?snapshot.position:Number.isFinite(a?.currentTime)?a.currentTime:Number.isFinite(progress?.position)?progress.position:0;const mediaVolume=Number.isFinite(snapshot?.volume)?snapshot.volume:Number.isFinite(a?.volume)?a.volume:null;if(volume===null)volume=mediaVolume;const muted=snapshot?.hasMedia?snapshot.muted:!!a?.muted;return {position:Math.max(0,position),duration,rate:snapshot?.rate||a?.playbackRate||1,volume,muted,canSeek:duration>0&&(!!snapshot?.canSeek||!!a?.seekable?.length||typeof external?.setPosition==='function'),canVolume:Number.isFinite(volume)&&(!!snapshot?.hasMedia||!!a||typeof external?.setVolume==='function')}}
  async function seekTo(seconds){if(!Number.isFinite(seconds)||seconds<0)return {handled:false};const current=state();if(!current.canSeek)return {handled:false};const time=Math.max(0,Math.min(current.duration,seconds));try{const r=await window.__islandMediaV5?.invoke?.('seekto',{seekTime:time,fastSeek:false});if(r?.handled)return r}catch{}try{if(typeof window.externalAPI?.setPosition==='function'){await window.externalAPI.setPosition(time);return {handled:true,method:'yandex-external-api'}}}catch{}const r=window.__islandMediaV5?.seek?.(time);if(r?.handled)return r;const a=player();if(a?.seekable?.length){a.currentTime=Math.max(a.seekable.start(0),Math.min(a.seekable.end(a.seekable.length-1),time));return {handled:true,method:'media-element'}}return {handled:false}}
  async function setVolume(value){if(!Number.isFinite(value)||value<0||value>1)return {handled:false};try{if(typeof window.externalAPI?.setVolume==='function'){await window.externalAPI.setVolume(value);return {handled:true,method:'yandex-external-api'}}}catch{}const r=window.__islandMediaV5?.setVolume?.(value);if(r?.handled)return r;const a=player();if(a){a.volume=value;if(value>0)a.muted=false;return {handled:true,method:'media-element'}}return {handled:false}}
  function state(){const m=navigator.mediaSession?.metadata,a=player(),external=window.externalAPI;let track=null,active=null;try{if(typeof external?.getCurrentTrack==='function'){const t=external.getCurrentTrack();if(t&&typeof t==='object'&&typeof t.then!=='function')track=t}if(typeof external?.isPlaying==='function'){const v=external.isPlaying();if(typeof v==='boolean')active=v}}catch{}const ms=navigator.mediaSession?.playbackState;const snapshot=window.__islandMediaV5?.snapshot?.();const playing=snapshot?.hasMedia?snapshot.playing:active!==null?active:ms==='playing'?true:ms==='paused'?false:a?(!a.paused&&!a.ended):false;const mediaActions=window.__islandMediaV5?.actions?.()||[];return {artwork:trackArtwork(m,track),title:normalize(m?.title||track?.title)||'Яндекс Музыка',artist:normalize(m?.artist||(Array.isArray(track?.artists)?track.artists.map(x=>x.name||x).join(', '):''))||'Моя волна · Любимые',playing,...transportInfo(a,snapshot,external),connected:true,waveActive:findWaveControl()?.intent==='already',mediaActions};}
  async function mediaAction(action){try{const r=await window.__islandMediaV5?.invoke?.(action);if(r?.handled)return {clicked:true,method:r.method}}catch{}return null}
  function diagnostics(){return {host:location.hostname,state:state(),hookInstalled:!!window.__islandMediaV5,wave:waveProbe(),controls:elements().filter(e=>/player|пауза|трек|pause|next|previous/i.test(labels(e).join(' ')+e.className)).slice(0,40).map(e=>({tag:e.tagName,aria:e.getAttribute('aria-label'),title:e.getAttribute('title'),testId:e.getAttribute('data-test-id')||e.getAttribute('data-testid'),class:String(e.className).slice(0,200)}))};}
  function actionButton(action){
    const list=elements();
    // Known test IDs are preferred, labels are the fallback; never invoke a private API.
    const tokens=action==='next'?['next','next-track','player-next','nextTrack']:['previous','prev','previous-track','player-previous','previousTrack'];
    const tested=list.find(el=>['data-test-id','data-testid'].some(a=>tokens.includes(el.getAttribute(a))));
    if(tested)return tested;
    const semantic=list.filter(el=>matches(el,exact[action]));
    return semantic.find(el=>el.closest('[class*="Player"],[class*="player"],[role="contentinfo"],footer')) || semantic.find(el=>labels(el).some(t=>/трек|track/i.test(t)));
  }
  async function toggle(){const desired=state().playing?'pause':'play';const media=await mediaAction(desired);if(media)return media;try{if(typeof window.externalAPI?.togglePause==='function'){window.externalAPI.togglePause();return {clicked:true,method:'yandex-external-api'}}}catch{}
    // Only the main player transport, never a playlist or a track-row button.
    const preferred=['[data-test-id="PLAYER_PLAY_BUTTON"]','[data-test-id="PLAYER_PAUSE_BUTTON"]','[data-testid="PLAYER_PLAY_BUTTON"]','[data-test-id="player-play-pause"]','[class*="PlayerBar"] button[aria-label]','[class*="player-controls"] button[aria-label]','footer button[aria-label]'];
    for(const selector of preferred){const el=Array.from(document.querySelectorAll(selector)).find(e=>available(e)&&(matches(e,desired==='pause'?exact.pause:exact.play)||/PLAYER_(PLAY|PAUSE)_BUTTON/i.test(e.getAttribute('data-test-id')||'')));if(el){el.click();return {clicked:true,method:'player-button'}}}
    const a=player();if(a){try{if(desired==='play')await a.play();else a.pause();return {clicked:true,method:'media-element'}}catch{}}
    return {clicked:false,reason:'no-player-command'};
  }
  async function step(action){const media=await mediaAction(action==='next'?'nexttrack':'previoustrack');if(media)return media;try{const name=action==='next'?'next':'prev';if(typeof window.externalAPI?.[name]==='function'){window.externalAPI[name]();return {clicked:true,method:'yandex-external-api'}}}catch{}
    const id=action==='next'?'PLAYER_NEXT_TRACK_BUTTON':'PLAYER_PREVIOUS_TRACK_BUTTON';const known=document.querySelector('[data-test-id="'+id+'"],[data-testid="'+id+'"]');if(available(known)){known.click();return {clicked:true,method:'player-test-id'}}
    const el=actionButton(action);if(!el)return {clicked:false,reason:'control-not-found'};el.click();return {clicked:true,method:'player-button'};
  }
  function findWaveControl(){
    const list=elements(),phrase=/(моя волна|мою волну|моей волны|my vibe|my wave)/i;
    const explicit=list.find(e=>labels(e).some(t=>/^(включить|запустить|слушать|воспроизвести|начать|play|start)\b/i.test(t)&&phrase.test(t)));
    // Cyrillic words do not have JS \b word boundaries: test them separately.
    const named=explicit||list.find(e=>labels(e).some(t=>/^(включить|запустить|слушать|воспроизвести|начать|play|start)(?:\s|$)/i.test(t)&&phrase.test(t)));
    if(named)return {el:named,intent:'play',via:'wave-labelled-control'};
    const roots=Array.from(document.querySelectorAll('[class*="VibeBlock"],[class*="MyVibe"],[class*="MyWave"],[class*="WaveBlock"],[class*="my-vibe"],[class*="my-wave"],[data-testid*="MY_VIBE"],[data-test-id*="MY_VIBE"],[data-testid*="MY_WAVE"],[data-test-id*="MY_WAVE"]')).filter(visible);
    const headings=Array.from(document.querySelectorAll('h1,h2,h3,span,p,div')).filter(e=>visible(e)&&e.childElementCount===0&&/^(моя волна|my vibe|my wave)$/i.test(normalize(e.textContent)));
    const scopes=[...roots];for(const heading of headings){let parent=heading.parentElement;for(let n=0;n<4&&parent&&parent!==document.body&&parent.tagName!=='MAIN';n++,parent=parent.parentElement){if(parent.querySelectorAll('button,a').length>30)break;scopes.push(parent)}}
    const isPlay=e=>labels(e).some(t=>exact.play.test(t)||/^(начать|начать воспроизведение|воспроизведение|play my vibe)$/i.test(t));
    for(const root of [...new Set(scopes)]){const buttons=Array.from(root.querySelectorAll('button,[role="button"]')).filter(available);const play=buttons.find(isPlay)||buttons.find(e=>/playbutton|play_button|vibeButton/i.test(String(e.className))&&!matches(e,exact.pause)&&!labels(e).some(t=>/настро|settings|меню|menu/i.test(t)));if(play)return {el:play,intent:'play',via:'wave-scoped-play'};const pause=buttons.find(e=>matches(e,exact.pause));if(pause&&(roots.includes(root)||root.querySelectorAll('button,a').length<6))return {el:pause,intent:'already',via:'wave-scoped-pause'}}
    const known=list.find(e=>['data-test-id','data-testid'].some(a=>/^(MY_(VIBE|WAVE)_PLAY_BUTTON|my-vibe-play|my-wave-play)$/i.test(e.getAttribute(a)||'')));if(known)return {el:known,intent:'play',via:'wave-test-id'};
    const namedTarget=list.find(e=>matches(e,exact.wave));if(namedTarget)return {el:namedTarget,intent:namedTarget.tagName==='A'?'navigate':'play',via:'wave-title-control'};
    return null;
  }
  function waveProbe(){const found=findWaveControl();const describe=e=>({tag:e.tagName,aria:e.getAttribute('aria-label'),testId:e.getAttribute('data-testid')||e.getAttribute('data-test-id'),class:String(e.className).slice(0,220)});return {homepage:location.pathname==='/',ready:document.readyState,found:found?{...describe(found.el),intent:found.intent,via:found.via}:null,related:elements().filter(e=>labels(e).some(t=>/моя волна|мою волну|моей волны|my vibe|my wave/i.test(t))||/VibeBlock|MyVibe|WaveBlock|MyWave/i.test(String(e.className))).slice(0,18).map(describe)}}
  function openMode(mode){
    const list=elements();
    if(mode==='wave'){const found=findWaveControl();if(!found)return {clicked:false,reason:'wave-control-not-rendered'};if(found.intent!=='already')found.el.click();return {clicked:true,kind:'wave',intent:found.intent,via:found.via}}
    const link=list.find(el=>el.tagName==='A'&&matches(el,exact.likes)) || list.find(el=>el.tagName==='A'&&/\/users\/[^/]+\/playlists\/3(?:[/?#]|$)|\/playlists\/lk\./.test(el.getAttribute('href')||'')) || list.find(el=>matches(el,exact.likes)&&(el.closest('nav,aside,[role="navigation"]')||el.getAttribute('role')==='link'));
    if(link){link.click();return {clicked:true,kind:'likes'}}
    const onLikes=Array.from(document.querySelectorAll('h1,h2')).some(el=>visible(el)&&exact.likes.test(normalize(el.textContent)));
    if(onLikes)return {clicked:true,kind:'likes',already:true};
    const collection=list.find(el=>matches(el,exact.collection));if(collection){collection.click();return {clicked:true,kind:'collection'}}
    return {clicked:false,reason:'likes-not-found'};
  }
  function playMode(mode){
    const list=elements();
    if(mode==='wave'){const found=findWaveControl();if(found&&found.intent==='already')return {clicked:true,already:true};if(found&&found.intent==='play'){found.el.click();return {clicked:true,via:found.via}}return {clicked:false,reason:'wave-play-not-rendered'}
    }else{
      const heading=Array.from(document.querySelectorAll('h1,h2')).find(e=>visible(e)&&exact.likes.test(normalize(e.textContent)));
      if(!heading)return {clicked:false,reason:'not-on-likes'};
      let parent=heading.parentElement;
      for(let i=0;i<5&&parent;i++,parent=parent.parentElement){const p=Array.from(parent.querySelectorAll('button,[role=button]')).find(e=>available(e)&&matches(e,exact.play));if(p){p.click();return {clicked:true}}}
      const firstTrack=document.querySelector('[data-test-id="track-play"],[data-testid="track-play"],button[aria-label="Воспроизвести трек"]');if(available(firstTrack)){firstTrack.click();return {clicked:true}}
    }
    return {clicked:false,reason:'play-not-found'};
  }
  window.__islandMusicV4=Object.freeze({state,toggle,step,openMode,playMode,diagnostics,waveProbe,seekTo,setVolume});
})();
