'use strict';
// rc.3: only a uniform speed control for the island character (25-400 %). No random tricks, no extra decorations.
(function(){
if(typeof settings!=='object'||!settings)return;
if(!Number.isFinite(Number(settings.petSpeed)))settings.petSpeed=100;
delete settings.petChaos;
const rate=()=>Math.max(.25,Math.min(4,(Number(settings.petSpeed)||100)/100));
function apply(){const r=rate();document.querySelectorAll('#pet,.mascot-config').forEach(host=>{for(const a of host.getAnimations({subtree:true}))if(typeof CSSAnimation!=='undefined'&&a instanceof CSSAnimation&&a.playbackRate!==r)a.playbackRate=r})}
function mount(){const host=document.querySelector('.mascot-config');if(!host||document.getElementById('petSpeed'))return;host.insertAdjacentHTML('beforeend','<div class="mascot-life"><label class="living-range">Скорость анимации <input id="petSpeed" type="range" min="25" max="400" step="5"><output id="petSpeedOut"></output></label></div>');const input=document.getElementById('petSpeed'),out=document.getElementById('petSpeedOut');input.value=settings.petSpeed;out.textContent=settings.petSpeed+' %';input.oninput=()=>{settings.petSpeed=Number(input.value);out.textContent=input.value+' %';try{persist('island.settings',settings)}catch{}apply()}}
new MutationObserver(()=>{mount();apply()}).observe(document.body,{childList:true,subtree:true});
setInterval(apply,1200);mount();apply();
window.TTMascotSpeed={apply,rate};
})();
