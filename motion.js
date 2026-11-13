'use strict';
// A single owner for DOM geometry and the transparent native viewport.
// Grow the host behind a frozen panel; shrink it only after the panel settles.
let islandLayoutBusy=false,islandLayoutGoal=null,islandLayoutTask=Promise.resolve(),islandHandoffTask=Promise.resolve();
let islandLayoutSequence=0,islandLayoutAnimations=[];
let islandBitmapTrim=0;
function setIslandViewport(small,id,bounds){
 if(!native)return null;
 const width=small?windowLayout.compactWidth:id?1040:windowLayout.normalWidth,height=small?120:id?840:windowLayout.normalHeight;
 const target={width:Math.min(width,screen.availWidth||width),height:Math.min(height,screen.availHeight||height)};
 if(Number.isFinite(bounds?.width))target.width=bounds.width;
 if(Number.isFinite(bounds?.height))target.height=bounds.height;
 const style=$('#islandViewport').style;
 style.setProperty('--island-viewport-width',target.width+'px');style.setProperty('--island-viewport-height',target.height+'px');return target;
}
function islandViewportMatches(bounds){return Number.isFinite(bounds?.width)&&Number.isFinite(bounds?.height)&&Math.abs(innerWidth-bounds.width)<=1&&Math.abs(innerHeight-bounds.height)<=1}
function reserveIslandBitmap(from,to){clearTimeout(islandBitmapTrim);window.ttMotionBitmap={width:Math.max(from.width,to.width),height:Math.max(from.height,to.height)};resizeWaveCanvas()}
function releaseIslandBitmap(){clearTimeout(islandBitmapTrim);islandBitmapTrim=setTimeout(()=>{if(islandLayoutBusy)return;window.ttMotionBitmap=null;resizeWaveCanvas()},260)}

function islandFrame(){
 const island=$('#island'),expanded=island.querySelector('.expanded'),r=island.getBoundingClientRect(),cs=getComputedStyle(island),es=getComputedStyle(expanded);
 const rawRadii=['borderTopLeftRadius','borderTopRightRadius','borderBottomRightRadius','borderBottomLeftRadius'].map(key=>{const value=cs[key],n=parseFloat(value)||0;return value.includes('%')?Math.min(r.width,r.height)*n/100:n});
 const radii=TTContours.shape(r.width,r.height,rawRadii).radii.map(n=>n+'px').join(' ');
 return {width:r.width,height:r.height,radii,contentHeight:$('#content').getBoundingClientRect().height,contentWidth:$('#content').getBoundingClientRect().width,navWidth:$('#nav').getBoundingClientRect().width,layoutContentWidth:$('#content').offsetWidth,layoutContentHeight:$('#content').offsetHeight,layoutNavWidth:$('#nav').offsetWidth,expandedWidth:expanded.offsetWidth,scale:es.scale==='none'?1:parseFloat(es.scale)||0,opacity:es.display==='none'?0:parseFloat(es.opacity)||0,transform:es.transform==='none'?'translateY(0)':es.transform};
}
function pinIslandFrame(frame){
 const island=$('#island'),wrap=island.parentElement,content=$('#content');
 document.body.classList.add('island-layout-moving');
 wrap.style.setProperty('width',frame.width+'px','important');
 island.style.setProperty('width',frame.width+'px','important');
 island.style.setProperty('height',frame.height+'px','important');
 island.style.setProperty('border-radius',frame.radii,'important');
 content.style.setProperty('height',frame.contentHeight+'px','important');
}
function clearIslandFrame(){
 const island=$('#island'),expanded=island.querySelector('.expanded');
 island.parentElement.style.removeProperty('width');
 for(const key of ['width','height','border-radius'])island.style.removeProperty(key);
 for(const key of ['height','width','left','translate','position'])$('#content').style.removeProperty(key);
 for(const key of ['display','opacity','transform','width','position','left','translate'])expanded.style.removeProperty(key);
 for(const key of ['width','position','left','translate','overflow-x'])$('#nav').style.removeProperty(key);
 for(const el of [$('#clock'),$('#miniControls'),$('.compact-artwork'),$('.drag-grip')])for(const key of ['display','opacity'])el.style.removeProperty(key);
 for(const el of [$('#pet'),$('#compactMeta')])el.style.removeProperty('left');
 document.body.classList.remove('island-layout-moving');
}
function cancelIslandAnimations(){
 for(const animation of islandLayoutAnimations)animation.cancel();
 islandLayoutAnimations=[];
}
function islandNextFrame(){
 // A hidden/minimizing renderer must not strand an IPC hand-off on a paused RAF.
 return new Promise(resolve=>{let frame;const done=()=>{clearTimeout(timer);cancelAnimationFrame(frame);resolve()},timer=setTimeout(done,70);frame=requestAnimationFrame(done)});
}
async function waitIslandViewport(bounds){
 if(document.hidden)return;
 const start=performance.now();
 do{
  await islandNextFrame();
  if(!Number.isFinite(bounds?.width)||!Number.isFinite(bounds?.height)||Math.abs(innerWidth-bounds.width)<=1&&Math.abs(innerHeight-bounds.height)<=1)return;
 }while(performance.now()-start<240);
}
// Snapshot is kept only in memory and removed after the native view detaches.
let serviceTransitionImage=null;
function clearServiceTransition(){if(serviceTransitionImage){serviceTransitionImage.remove();serviceTransitionImage=null}}
function showServiceTransition(snapshot){
 clearServiceTransition();
 const {image,rect}=snapshot||{};
 if(typeof image!=='string'||!image.startsWith('data:image/png;base64,')||!rect||!['x','y','width','height'].every(k=>Number.isFinite(rect[k]))||rect.width<=0||rect.height<=0)return;
 const island=$('#island'),box=island.getBoundingClientRect(),img=document.createElement('img');
 img.setAttribute('aria-hidden','true');img.alt='';img.src=image;
 const dx=rect.x+rect.width/2-(box.left+box.width/2);
 Object.assign(img.style,{position:'absolute',left:`calc(50% + ${dx}px)`,top:(rect.y-box.top)+'px',width:rect.width+'px',height:rect.height+'px',transform:'translateX(-50%)',zIndex:'12',pointerEvents:'none',borderRadius:'12px',objectFit:'fill'});
 island.appendChild(img);serviceTransitionImage=img;return img;
}
async function stageServiceTransition(id,isCurrent){
 if(!native||typeof api.serviceTransitionSnapshot!=='function')return false;
 let snapshot;try{snapshot=await Promise.race([api.serviceTransitionSnapshot(id),new Promise(resolve=>setTimeout(()=>resolve(null),350))])}catch{return false}
 if(!isCurrent()||!snapshot)return false;
 const img=showServiceTransition(snapshot);if(!img)return false;
 try{await Promise.race([img.decode(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('snapshot timeout')),150))]);await islandNextFrame();await islandNextFrame()}catch{if(serviceTransitionImage===img)clearServiceTransition();return false}
 if(!isCurrent()||serviceTransitionImage!==img){if(serviceTransitionImage===img)clearServiceTransition();return false}
 return true;
}
function fadeServiceTransition(duration=420){
 const img=serviceTransitionImage;if(!img)return Promise.resolve();
 const fade=img.animate([{opacity:1,offset:0},{opacity:1,offset:.5},{opacity:0,offset:1}],{duration,easing:'linear',fill:'forwards'});
 return fade.finished.catch(()=>{}).then(()=>{if(serviceTransitionImage===img)clearServiceTransition()});
}
function moveIslandLayout(small,id,force=false){
 small=!!small;id=id||null;
 if(!force&&islandLayoutGoal?.small===small&&islandLayoutGoal?.id===id){
  if(islandLayoutBusy)return islandLayoutTask;
  serviceReady=!!id&&!small;
  if(serviceReady)requestAnimationFrame(updateServiceBounds);
  return Promise.resolve();
 }
 const ticket=++islandLayoutSequence,initial=islandLayoutGoal===null;
 const homeCollapse=tab==='home'&&small&&!id&&!islandLayoutGoal?.id,fromServiceToPanel=!small&&!id&&!!islandLayoutGoal?.id,homeFromService=tab==='home'&&fromServiceToPanel;
 let finishHandoff;islandHandoffTask=new Promise(resolve=>finishHandoff=resolve);
 const previousViewportWidth=$('#islandViewport').style.getPropertyValue('--island-viewport-width');
 const previousViewportHeight=$('#islandViewport').style.getPropertyValue('--island-viewport-height');
 const island=$('#island'),expanded=island.querySelector('.expanded'),content=$('#content'),wrap=island.parentElement;
 const from=islandFrame(),wasCollapsed=island.classList.contains('collapsed'),wasMoving=islandLayoutBusy;
 const headerEls=[$('#clock'),$('#miniControls'),$('.compact-artwork'),$('.drag-grip')];
 const headerBefore=headerEls.map(el=>{const cs=getComputedStyle(el);return {display:cs.display,opacity:parseFloat(cs.opacity)||0}});
 const petBefore=parseFloat(getComputedStyle($('#pet')).left),metaBefore=parseFloat(getComputedStyle($('#compactMeta')).left);
 // Snapshot BEFORE cancellation. A reversal continues from its displayed frame.
 pinIslandFrame(from);cancelIslandAnimations();
 if(tabAnimation){tabAnimation.cancel();tabAnimation=null}
 clearTimeout(islandBitmapTrim);
 collapsed=small;islandLayoutGoal={small,id};islandLayoutBusy=true;serviceReady=false;
 let viewport=setIslandViewport(small,id);
 const preserveHomeLayout=homeCollapse&&!initial&&motionAllowed()&&!document.hidden&&!!previousViewportWidth;
 if(preserveHomeLayout){
  const style=$('#islandViewport').style;
  style.setProperty('--island-viewport-width',previousViewportWidth);
  style.setProperty('--island-viewport-height',previousViewportHeight);
 }
 document.body.classList.toggle('service-mode',!!id);
 island.classList.toggle('collapsed',small);
 // Preserve the visible header while asynchronous native setup runs.
 if(wasCollapsed!==small&&!initial&&motionAllowed()&&!document.hidden){
  headerEls.forEach((el,i)=>{el.style.display=headerBefore[i].display;el.style.opacity=String(headerBefore[i].opacity)});
  if(Number.isFinite(petBefore))$('#pet').style.left=petBefore+'px';
  if(Number.isFinite(metaBefore))$('#compactMeta').style.left=metaBefore+'px';
 }
 $('#collapse').textContent=small?'+':'−';
 $('#collapse').setAttribute('aria-label',small?'Развернуть панель':'Свернуть панель');
 expanded.style.display='block';expanded.style.opacity=String(from.opacity);
 const current=()=>ticket===islandLayoutSequence;
 islandLayoutTask=(async()=>{
  try{
   if(native){
    // Selection only detaches/loads the service. It cannot race a viewport resize.
    await api.selectService(id,motionAllowed()&&!document.hidden);if(!current())return;
    if(fromServiceToPanel)fadeServiceTransition(160).then(finishHandoff);else {finishHandoff();if(small)fadeServiceTransition()}
    if(small){await api.prepareCollapse();if(!current())return}
    else if(initial||id||wasCollapsed||innerWidth<Math.min(windowLayout.normalWidth,screen.availWidth)||innerHeight<Math.min(windowLayout.normalHeight,screen.availHeight)){
     const bounds=await api.resize(false);if(!current())return;
     viewport=setIslandViewport(small,id,bounds);
     await waitIslandViewport(bounds);if(!current())return;
    }
   }else finishHandoff();
   // Measure the natural destination synchronously; no intermediate state is painted.
   if(preserveHomeLayout)setIslandViewport(small,id,viewport);
   clearIslandFrame();
   const to=islandFrame();
   const headerAfter=headerEls.map(el=>{const cs=getComputedStyle(el);return {display:cs.display,opacity:parseFloat(cs.opacity)||0}});
   const petAfter=parseFloat(getComputedStyle($('#pet')).left),metaAfter=parseFloat(getComputedStyle($('#compactMeta')).left);
   const changed=Math.abs(to.width-from.width)>.25||Math.abs(to.height-from.height)>.25||to.radii!==from.radii;
   const animate=!initial&&changed&&motionAllowed()&&!document.hidden;
   if(animate){
    pinIslandFrame(from);expanded.style.display='block';
    const duration=420,easing='cubic-bezier(.4,0,.6,1)',options={duration,easing,fill:'both'};
    // WAAPI cannot override !important declarations. Keep the pinned start values
    // at normal priority while this class overrides the old responsive rules.
    wrap.style.setProperty('width',from.width+'px');
    island.style.setProperty('width',from.width+'px');
    island.style.setProperty('height',from.height+'px');
    island.style.setProperty('border-radius',from.radii);
    // Home is expensive to lay out. Keep its grid at a fixed size while it
    // fades/clips, rather than relaying it out at every animation frame.
    const contentFrom=fromServiceToPanel?to.contentHeight:wasCollapsed?to.contentHeight:from.layoutContentHeight;
    content.style.setProperty('height',contentFrom+'px');
    // Freeze line wrapping at destination width, not on every morph frame.
    content.style.setProperty('width',(small?from.layoutContentWidth:to.layoutContentWidth)+'px');
    content.style.setProperty('position','relative');content.style.setProperty('left','50%');content.style.setProperty('translate','-50% 0');
    // Keep navigation at its full width and clip it at the island edge; never
    // expose a transient scrollbar while the surrounding surface is morphing.
    if(small||wasCollapsed){expanded.style.width=(small?from.expandedWidth:to.expandedWidth)+'px';expanded.style.position='relative';expanded.style.left='50%';expanded.style.translate='-50% 0'}
    const nav=$('#nav');nav.style.setProperty('width',(small?from.layoutNavWidth:to.layoutNavWidth)+'px');nav.style.setProperty('position','relative');nav.style.setProperty('left','50%');nav.style.setProperty('translate','-50% 0');nav.style.setProperty('overflow-x','hidden');
    reserveIslandBitmap(from,to);
    // Do not switch home to compact container breakpoints while it is visible.
    // The target was measured above; apply its viewport after the morph.
    if(preserveHomeLayout){
     const style=$('#islandViewport').style;
     style.setProperty('--island-viewport-width',previousViewportWidth);
     style.setProperty('--island-viewport-height',previousViewportHeight);
    }
    const footer=$('.bottom');
    islandLayoutAnimations=[
     island.animate([{width:from.width+'px',height:from.height+'px',borderRadius:from.radii},{width:to.width+'px',height:to.height+'px',borderRadius:to.radii}],options),
     wrap.animate([{width:from.width+'px'},{width:to.width+'px'}],options),
     ...(small||wasCollapsed?[expanded.animate([{scale:String(wasMoving?from.scale:small?1:.65)},{scale:String(small?.65:1)}],options)]:[]),
     ...(!homeCollapse&&!fromServiceToPanel?[content.animate([{height:contentFrom+'px'},{height:to.contentHeight+'px'}],options)]:[]),
     ...(fromServiceToPanel&&footer?[footer.animate([{transform:'translateY('+(from.contentHeight-to.contentHeight)+'px)'},{transform:'translateY(0px)'}],options)]:[]),
     expanded.animate(small?
      [{opacity:from.opacity,transform:from.transform,offset:0},{opacity:from.opacity*.2,transform:'translateY(-1px)',offset:.5},{opacity:0,transform:'translateY(-4px)',offset:.7},{opacity:0,transform:'translateY(-4px)',offset:1}]:
      [{opacity:from.opacity,transform:from.transform,offset:0},{opacity:from.opacity,transform:from.transform,offset:wasCollapsed?.3:0},{opacity:1,transform:'translateY(0)',offset:1}],
      {duration,easing:'linear',fill:'both'})
    ];
    if(wasCollapsed!==small){
     // The two header variants overlap; fade them rather than swapping them
     // on the first frame. Keep their hit-testing governed by the final state.
     headerEls.forEach((el,i)=>{
      const before=headerBefore[i],after=headerAfter[i];
      if(before.display===after.display)return;
      el.style.setProperty('display',after.display==='none'?before.display:after.display);
      islandLayoutAnimations.push(el.animate([{opacity:before.display==='none'?0:before.opacity},{opacity:after.display==='none'?0:after.opacity}],{duration:220,easing:'ease-in-out',fill:'both'}));
     });
     for(const [el,a,b] of [[$('#pet'),petBefore,petAfter],[$('#compactMeta'),metaBefore,metaAfter]]){
      if(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)>.1)islandLayoutAnimations.push(el.animate([{left:a+'px'},{left:b+'px'}],options));
     }
    }
    await Promise.all(islandLayoutAnimations.map(animation=>animation.finished.catch(()=>{})));
    if(!current())return;
    // The dashboard is now invisible and the surface is at its target size.
    if(preserveHomeLayout)setIslandViewport(small,id,viewport);
   }
   // Keep the last displayed frame through the native resize acknowledgement.
   pinIslandFrame(to);
   expanded.style.display=small?'none':'block';expanded.style.opacity=small?'0':'1';expanded.style.transform='translateY(0)';
   if(animate&&wasCollapsed!==small)headerEls.forEach((el,i)=>{el.style.display=headerAfter[i].display;el.style.opacity=String(headerAfter[i].opacity)});
   cancelIslandAnimations();
   if(native&&(small||!id)&&!islandViewportMatches(viewport)){
    const bounds=await api.resize(small);if(!current())return;
    setIslandViewport(small,id,bounds);
    await waitIslandViewport(bounds);if(!current())return;
   }
   if(animate){await islandNextFrame();if(!current())return}
   // Natural size and responsive styles now match the held final pixels.
   clearIslandFrame();
  }catch(error){
   if(current())clearServiceTransition();
   if(current()&&native)toast('Не удалось обновить окно. Попробуй открыть панель ещё раз.');
  }finally{
   finishHandoff();
   if(current()){
    cancelIslandAnimations();clearIslandFrame();islandLayoutBusy=false;
    serviceReady=!!id&&!small;
    if(typeof applyLivingAppearance==='function')applyLivingAppearance();
    resizeWaveCanvas();updateWaveAnimation();syncHoverBounds();releaseIslandBitmap();
    if(serviceReady)requestAnimationFrame(updateServiceBounds);
   }
  }
 })();
 return islandLayoutTask;
}

let windowVisibilityAnimation=null,windowVisibilityTicket=0,windowVisibilityBusy=false;
async function animateIslandVisibility(visible){
 const ticket=++windowVisibilityTicket,wrap=$('#island').parentElement,cs=getComputedStyle(wrap),fromOpacity=parseFloat(cs.opacity),fromTransform=cs.transform==='none'?'translateY(0)':cs.transform;
 windowVisibilityBusy=true;serviceReady=false;
 if(visible)wrap.style.opacity='0';
 if(windowVisibilityAnimation){windowVisibilityAnimation.cancel();windowVisibilityAnimation=null}
 if(native&&api.serviceVisible)await api.serviceVisible(false).catch(()=>{});
 if(ticket!==windowVisibilityTicket)return;
 if(motionAllowed()&&!document.hidden){
  windowVisibilityAnimation=wrap.animate([{opacity:visible?0:fromOpacity,transform:visible?'translateY(-6px)':fromTransform},{opacity:visible?1:0,transform:visible?'translateY(0)':'translateY(-6px)'}],{duration:visible?180:140,easing:'ease-out',fill:'both'});
  await windowVisibilityAnimation.finished.catch(()=>{});
 }
 if(ticket!==windowVisibilityTicket)return;
 if(visible){windowVisibilityAnimation?.cancel();windowVisibilityAnimation=null;wrap.style.removeProperty('opacity')}
 windowVisibilityBusy=false;
}
function resetIslandVisibility(){
 ++windowVisibilityTicket;windowVisibilityAnimation?.cancel();windowVisibilityAnimation=null;windowVisibilityBusy=false;$('#island').parentElement.style.removeProperty('opacity');
}
