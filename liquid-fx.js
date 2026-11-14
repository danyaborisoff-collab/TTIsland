'use strict';
// Liquid FX 0.17 rc.3
// 1) Dock: when the window reaches the top line, the island moves flush to the edge and spreads along the top of the screen.
// 2) Drips: big, glossy drops swell on the bottom edge, stretch, snap off, fall with gravity and splash.
// 3) One intensity slider (20–160 %) drives size, frequency, flare width and wobble of every effect.
// Everything is drawn on one full-window canvas *behind* the island, so junctions hide under the island body.
(function(){
const FX=window.TTLiquidFX=Object.assign({
 tetherMaxGap:64,      // dock shape is drawn while the island top is this close to the window top (px)
 spread:150,           // how far the top edge spreads sideways along the screen top at 100 % (limited by the window)
 springK:210,springC:8,// wobble spring (stiffness, damping)
 dripMinDelay:900,dripMaxDelay:5200,dripMusicFactor:.5,
 dripMaxDrops:6,dripGravity:1500,dripFall:170,
},window.TTLiquidFX||{});
let canvas=null,ctx=null,raf=0,dpr=1,last=0,docked=!window.islandAPI?.onWindowDocked,pull=0;
const spring={x:0,v:0,w:0,wv:0};
const state={amount:0,amountV:0,drops:[],splats:[],nextDrip:0,get docked(){return docked},get pull(){return pull}};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rnd=(a,b)=>a+Math.random()*(b-a),ease=k=>k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
function cfg(){try{return typeof settings!=='undefined'&&settings?settings:{}}catch{return {}}}
function allowed(){try{return typeof motionAllowed!=='function'||motionAllowed()}catch{return true}}
function power(){const s=cfg(),v=Number(s.fxIntensity??s.liquidStrength??80);return clamp((Number.isFinite(v)?v:80)/100,.2,1.6)}
function stickOn(){const s=cfg();return s.fxEnabled!==false&&s.stickTop!==false}
function dripsOn(){const s=cfg();return s.fxEnabled!==false&&s.drips!==false}
function musicOn(){return document.body.classList.contains('playing')}
function active(){return allowed()&&!document.hidden&&(stickOn()||dripsOn()||state.drops.length>0||state.splats.length>0||state.amount>.01)}
function surface(){
 const island=document.getElementById('island'),cs=getComputedStyle(document.body);
 let base=(cs.getPropertyValue('--island-bg')||'').trim();
 if(!base){const bg=getComputedStyle(island).backgroundColor;base=bg&&!/rgba\(0, 0, 0, 0\)|transparent/.test(bg)?bg:'#09090b'}
 const line=(cs.getPropertyValue('--line-p')||'').trim()||getComputedStyle(island).borderTopColor||'#27272c';
 const fill=typeof window.ttSurfaceColor==='function'?window.ttSurfaceColor(base):base;
 return {fill,line}
}
function resize(){if(!canvas)return;dpr=Math.min(2,window.devicePixelRatio||1);const w=innerWidth,h=innerHeight;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);canvas.style.width=w+'px';canvas.style.height=h+'px'}
function kick(p){spring.v+=p*(Math.random()<.5?-1:1);spring.wv-=Math.abs(p)*1.8}
function schedule(now){const p=power(),music=musicOn()?FX.dripMusicFactor:1,dock=docked?.75:1;state.nextDrip=now+rnd(FX.dripMinDelay,FX.dripMaxDelay)*music*dock*clamp(1.6-p*.85,.22,1.45)}
function pulse(cls,ms){const wrap=document.querySelector('.island-wrap');if(!wrap||!allowed())return;wrap.classList.remove('fx-suck','fx-release');void wrap.offsetWidth;wrap.classList.add(cls);clearTimeout(wrap._fxTimer);wrap._fxTimer=setTimeout(()=>wrap.classList.remove(cls),ms)}

// ---------- drops ----------
function spawn(r,now,opts={}){
 const p=power(),rad=Math.min(r.height/2,28),span=Math.max(4,r.width-2*rad-16);
 const fx=opts.fx??((rad+8+Math.random()*span)/r.width);
 const size=rnd(4.2,7.2)*(.65+.45*p)*(opts.scale||1);
 state.drops.push({fx,size,phase:'form',t:0,formDur:rnd(.55,1.25)/(.7+.35*p),len:0,y:0,vy:0,seed:Math.random()*6.28,absorbing:false,born:now});
}
function bottomAt(r){return r.bottom-1}
function drawBulb(x,top,len,R,neck,col,wob){
 // a teat-shaped bulge: wide meniscus at the island edge, thin neck, round bulb
 const by=top+len,base=R*2.1+neck*1.4;
 ctx.beginPath();
 ctx.moveTo(x-base,top-6);
 ctx.bezierCurveTo(x-base*.45,top-1,x-neck,top+len*.35,x-neck*.9,by-R*.9);
 ctx.arc(x+wob,by,R,Math.PI*1.12,Math.PI*-.12,true);
 ctx.bezierCurveTo(x+neck,top+len*.35,x+base*.45,top-1,x+base,top-6);
 ctx.closePath();ctx.fillStyle=col.fill;ctx.fill();
 ctx.globalAlpha=.55;ctx.strokeStyle=col.line;ctx.lineWidth=1;ctx.beginPath();ctx.arc(x+wob,by,R,Math.PI*.05,Math.PI*.95);ctx.stroke();ctx.globalAlpha=1;
 highlight(x+wob,by,R,.9);
}
function highlight(x,y,R,alpha=1){
 ctx.globalAlpha=.42*alpha;ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(x-R*.35,y-R*.38,R*.26,R*.17,-.6,0,Math.PI*2);ctx.fill();
 ctx.globalAlpha=.16*alpha;ctx.beginPath();ctx.arc(x+R*.3,y+R*.35,R*.12,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
}
function drawFalling(d,x,col){
 const st=clamp(d.vy/1100,0,.75),R=d.size,rx=R*(1-st*.32),ry=R*(1+st*.9);
 ctx.fillStyle=col.fill;ctx.beginPath();
 // tear shape: pointy tail up, round body down
 ctx.moveTo(x,d.y-ry*1.9);
 ctx.bezierCurveTo(x+rx*.25,d.y-ry*1.2,x+rx,d.y-ry*.55,x+rx,d.y);
 ctx.arc(x,d.y,rx,0,Math.PI);
 ctx.bezierCurveTo(x-rx,d.y-ry*.55,x-rx*.25,d.y-ry*1.2,x,d.y-ry*1.9);
 ctx.fill();
 ctx.globalAlpha=.5;ctx.strokeStyle=col.line;ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,d.y,rx,.15,Math.PI-.15);ctx.stroke();ctx.globalAlpha=1;
 highlight(x,d.y,rx,1);
}
function splash(x,y,R){
 const p=power(),n=Math.round(3+3*p);
 for(let i=0;i<n;i++){const a=-Math.PI/2+rnd(-1.25,1.25);state.splats.push({kind:'dot',x,y:y-1,vx:Math.cos(a)*rnd(60,170)*(.7+.4*p),vy:Math.sin(a)*rnd(90,230),r:rnd(.9,2.1)*R/5,life:rnd(.35,.7),t:0})}
 state.splats.push({kind:'puddle',x,y,w:R*1.4,life:.9,t:0});
}
function stepSplats(dt,col){
 const g=FX.dripGravity,floor=innerHeight-2;
 state.splats=state.splats.filter(s=>{s.t+=dt;if(s.t>=s.life)return false;const k=s.t/s.life;
  if(s.kind==='dot'){s.vy+=g*dt;s.x+=s.vx*dt;s.y=Math.min(floor,s.y+s.vy*dt);ctx.globalAlpha=1-k;ctx.fillStyle=col.fill;ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=(1-k)*.5;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(s.x-s.r*.3,s.y-s.r*.3,s.r*.35,0,Math.PI*2);ctx.fill()}
  else{const w=s.w*(1+k*1.6),h=Math.max(.6,s.w*.28*(1-k));ctx.globalAlpha=1-k;ctx.fillStyle=col.fill;ctx.beginPath();ctx.ellipse(s.x,s.y,w,h,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=(1-k)*.35;ctx.strokeStyle=col.line;ctx.lineWidth=1;ctx.stroke()}
  ctx.globalAlpha=1;return true});
}
function stepDrops(r,dt,now,col){
 const p=power(),limit=Math.max(1,Math.round(FX.dripMaxDrops*clamp(p,.35,1.2)));
 if(dripsOn()&&allowed()){if(!state.nextDrip)schedule(now);if(now>=state.nextDrip){if(state.drops.length<limit)spawn(r,now);schedule(now)}}
 const top=bottomAt(r),room=innerHeight-top-4,g=FX.dripGravity;
 state.drops=state.drops.filter(d=>{
  const x=r.left+d.fx*r.width,R=d.size;d.seed+=dt*7;
  if(d.phase==='form'){
   d.t+=d.absorbing?-dt*1.8:dt;const k=clamp(d.t/d.formDur,0,1),e=ease(k);
   const maxLen=Math.max(R*.8,Math.min(R*3.6,room-R-2));
   d.len=R*.2+(maxLen-R*.2)*e;
   const bulbR=R*(.45+.55*e),neck=R*(1.05-.72*e),wob=Math.sin(d.seed)*R*.12*e;
   drawBulb(x,top,d.len,bulbR,neck,col,wob);
   if(d.absorbing&&d.t<=0){kick(4*p);return false}
   if(!d.absorbing&&k>=1){if(room<R*5){d.absorbing=true}else{d.phase='fall';d.y=top+d.len;d.vy=60;d.floor=Math.min(innerHeight-3,top+FX.dripFall*(.75+.5*p)+R*4);state.splats.push({kind:'dot',x,y:top+2,vx:0,vy:-40,r:R*.45,life:.18,t:0});kick(3*p)}}
   return true}
  if(d.phase==='fall'){
   d.vy+=g*dt;d.y+=d.vy*dt;
   if(d.y+R>=d.floor){d.phase='melt';d.t=0;splash(x,d.floor,R);return false}
   drawFalling(d,x,col);return true}
  return false});
 stepSplats(dt,col);
}

// ---------- suction ----------
function drawSuction(r,dt,now,col){
 // rc.3: when docked the island sits flush on the top line (no gap, square top corners) and its top edge
 // spreads sideways along the top of the screen with smooth concave shoulders, like a notch grown from the bezel.
 const target=stickOn()&&docked?1:0;
 state.amountV+=(90*(target-state.amount)-13*state.amountV)*dt;state.amount+=state.amountV*dt;
 if(target===0&&state.amount<.002){state.amount=0;state.amountV=0}
 spring.v+=(-FX.springK*spring.x-FX.springC*spring.v)*dt;spring.x+=spring.v*dt;spring.wv+=(-FX.springK*.6*spring.w-FX.springC*spring.wv)*dt;spring.w+=spring.wv*dt;
 const a=clamp(state.amount,0,1.25);if(a<.01||r.top>FX.tetherMaxGap)return;
 const p=power(),cx=r.left+r.width/2,hw=r.width/2,room=Math.max(0,Math.min(cx-hw,innerWidth-(cx+hw))-2);
 const spread=Math.min(room,FX.spread*(.55+.55*p))*a*(1-pull*.7);if(spread<1)return;
 const top=Math.max(0,r.top),depth=top+Math.min(r.height*.75,(14+spread*.32)*(.7+.3*Math.min(1,a)));
 ctx.beginPath();ctx.moveTo(cx-hw-spread,-2);ctx.lineTo(cx+hw+spread,-2);ctx.lineTo(cx+hw+spread,0);
 ctx.bezierCurveTo(cx+hw+spread*.3,0,cx+hw,depth*.25,cx+hw,depth);ctx.lineTo(cx+hw-3,depth+4);ctx.lineTo(cx-hw+3,depth+4);ctx.lineTo(cx-hw,depth);
 ctx.bezierCurveTo(cx-hw,depth*.25,cx-hw-spread*.3,0,cx-hw-spread,0);ctx.closePath();ctx.fillStyle=col.fill;ctx.fill();
 ctx.globalAlpha=.55*Math.min(1,a);ctx.strokeStyle=col.line;ctx.lineWidth=1;
 for(const s of [1,-1]){ctx.beginPath();ctx.moveTo(cx+s*(hw+spread),0);ctx.bezierCurveTo(cx+s*(hw+spread*.3),0,cx+s*hw,depth*.25,cx+s*hw,depth);ctx.stroke()}
 ctx.globalAlpha=1;
}

function frame(now){
 raf=0;if(!canvas)return;const dt=Math.min(.05,last?(now-last)/1000:.016);last=now;
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,canvas.width/dpr,canvas.height/dpr);
 const island=document.getElementById('island');if(!island)return;
 const r=island.getBoundingClientRect();
 if(r.width>2&&r.height>2&&active()){const col=surface();drawSuction(r,dt,now,col);stepDrops(r,dt,now,col)}else{state.drops=[];state.splats=[];state.amount=0;state.amountV=0}
 if(active())raf=requestAnimationFrame(frame);else last=0;
}
function wake(){if(!raf&&canvas&&active()){raf=requestAnimationFrame(frame)}else if(canvas&&!active()){ctx.clearRect(0,0,canvas.width,canvas.height)}}
function setDocked(value){
 const next=!!value;
 const wrap=document.querySelector('.island-wrap'),isl=document.getElementById('island');
 if(next&&wrap&&isl){const had=document.body.classList.contains('fx-docked'),prev=wrap.style.transition;document.body.classList.remove('fx-docked');wrap.style.transition='none';const gap=Math.max(0,Math.round(isl.getBoundingClientRect().top));wrap.style.setProperty('--fx-gap',gap+'px');if(had)document.body.classList.add('fx-docked');void wrap.offsetWidth;wrap.style.transition=prev;if(!docked)state.amountV+=4*power()}
 if(!next&&docked){state.amountV-=3;const i=document.getElementById('island');if(i&&dripsOn())spawn(i.getBoundingClientRect(),performance.now(),{fx:.5,scale:1.15})}
 docked=next;document.body.classList.toggle('fx-docked',docked&&stickOn());if(!docked)setPull(0);refit();wake()}
function refit(){[0,120,260,420].forEach(ms=>setTimeout(()=>{try{if(typeof resizeWaveCanvas==='function')resizeWaveCanvas()}catch{}},ms))}
function setPull(v){pull=clamp(Number(v)||0,0,1);const wrap=document.querySelector('.island-wrap');if(wrap)wrap.style.setProperty('--fx-pull',pull.toFixed(3));if(pull>0)wake()}

function installLiquidFx(){
 if(canvas)return;const s=cfg();if(s.stickTop===undefined)s.stickTop=true;if(s.drips===undefined)s.drips=true;if(s.fxIntensity===undefined)s.fxIntensity=Number(s.liquidStrength)||80;
 canvas=document.createElement('canvas');canvas.id='fxCanvas';canvas.setAttribute('aria-hidden','true');document.body.prepend(canvas);ctx=canvas.getContext('2d');resize();
 addEventListener('resize',()=>{resize();wake()});document.addEventListener('visibilitychange',wake);
 window.islandAPI?.onWindowDocked?.(setDocked);window.islandAPI?.onWindowPull?.(setPull);
 window.islandAPI?.windowShellInfo?.().then?.(info=>{if(info&&typeof info.docked==='boolean')setDocked(info.docked)}).catch?.(()=>{});
 mountControls();new MutationObserver(()=>{const c=document.getElementById('liquidFxControls');if(!c){mountControls();return}const better=document.getElementById('islandShape')?.closest('section');if(better&&c.previousElementSibling!==better&&!better.contains(c))better.insertAdjacentElement('afterend',c)}).observe(document.body,{childList:true,subtree:true});
 const pet=document.getElementById('pet');if(pet)pet.addEventListener('click',()=>{if(!allowed())return;pet.classList.remove('mascot-poke');void pet.offsetWidth;pet.classList.add('mascot-poke');clearTimeout(pet._pokeTimer);pet._pokeTimer=setTimeout(()=>pet.classList.remove('mascot-poke'),600);if(stickOn())kick(22);const i=document.getElementById('island');if(i&&dripsOn()&&Math.random()<.5)spawn(i.getBoundingClientRect(),performance.now());wake()});
 new MutationObserver(wake).observe(document.body,{attributes:true,attributeFilter:['class','data-liquid','data-motion']});
 wake();
}
function save(){try{persist('island.settings',cfg())}catch{}}
function mountControls(){
 if(document.getElementById('liquidFxControls'))return;
 const anchor=document.getElementById('islandShape')?.closest('section')||document.getElementById('liquidStyleOptions');if(!anchor)return;
 const s=cfg(),row=(key,title,desc)=>`<label class="settings-row"><div><strong>${title}</strong><p>${desc}</p></div><input type="checkbox" class="switch" data-fx-setting="${key}" ${s[key]!==false?'checked':''}></label>`;
 const v=Math.round(Number(s.fxIntensity)||80);
 const html=`<section class="extra-section fx-config" id="liquidFxControls"><div class="extra-heading"><h3>Жидкие эффекты</h3><span class="muted">Работают всегда, отдельно от «Жидкого острова»</span></div>${row('stickTop','Прилипание к верху экрана','Дотяни остров до верхней линии — он встанет вплотную к краю и расширится под верх экрана, как вырез. Чтобы оторвать, потяни вниз сильнее')}${row('drips','Капли с острова','С нижнего края набухают капли, отрываются, падают и разбрызгиваются')}<label class="living-range fx-range">Сила эффектов <input id="fxIntensity" type="range" min="20" max="160" step="5" value="${v}"><output>${v}%</output></label><p class="help-line">Ползунок меняет размер и частоту капель, ширину «присоски» и силу желейной отдачи.</p><button type="button" class="fx-test" id="fxDripNow">Капнуть сейчас</button></section>`;
 anchor.insertAdjacentHTML(anchor.id==='liquidStyleOptions'?'beforebegin':'afterend',html);
 const root=document.getElementById('liquidFxControls');
 root.querySelectorAll('[data-fx-setting]').forEach(input=>input.onchange=()=>{s[input.dataset.fxSetting]=input.checked;save();document.body.classList.toggle('fx-docked',docked&&stickOn());wake()});
 const range=root.querySelector('#fxIntensity');range.oninput=()=>{s.fxIntensity=Number(range.value);range.nextElementSibling.textContent=range.value+'%';const old=document.getElementById('liquidStrength');if(old&&Number(range.value)<=100){old.value=range.value;if(old.nextElementSibling)old.nextElementSibling.textContent=range.value+'%';s.liquidStrength=Number(range.value)}save();kick(12*power());wake()};
 root.querySelector('#fxDripNow').onclick=()=>{const i=document.getElementById('island');if(!i)return;for(let n=0;n<Math.max(1,Math.round(power()*2));n++)spawn(i.getBoundingClientRect(),performance.now());wake()};
 const old=document.getElementById('liquidStrength');if(old&&!old._fxBound){old._fxBound=true;old.addEventListener('input',()=>{s.fxIntensity=Number(old.value);range.value=old.value;range.nextElementSibling.textContent=old.value+'%';kick(10);wake()})}
}
window.installLiquidFx=installLiquidFx;
window.TTLiquidFXDebug={state,spring,wake,setDocked,setPull,power,frame:t=>frame(t),spawn:()=>{const i=document.getElementById('island');spawn(i.getBoundingClientRect(),performance.now());wake()}};
})();
