const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||chromium.executablePath(),args:['--no-sandbox']});
const p=await browser.newPage({viewport:{width:680,height:650}}),errors=[];p.on('pageerror',e=>errors.push(e.stack));
await p.goto(pathToFileURL(path.join(__dirname,'..','index.html')).href);await p.waitForTimeout(500);
// 1) characters: no chaos layer, eyes are plain sticks
const pets=await p.evaluate(()=>{showMascot&&showMascot('eyes');const eye=document.querySelector('.mascot-eyes .eye');const after=eye?getComputedStyle(eye,'::after').content:'none';return {chaosApi:!!window.TTMascotLife,after,glint:!!document.querySelector('.mascot-glint'),children:eye?eye.children.length:-1}}).catch(e=>({err:String(e)}));
console.log('pets',JSON.stringify(pets));assert(!pets.chaosApi,'no mascot chaos');assert(pets.after==='none'||pets.after==='normal','eyes have no pupils');assert(!pets.glint);
// 2) contour chaos changes the silhouette of spikes / equalizer / waves
const ch=await p.evaluate(()=>{const r={};for(const m of ['spikes','equalizer','waves']){TTContours.chaos=0;const a=[];for(let i=0;i<200;i++)a.push(TTContours.edge(m,i/200,3.3,1,1200));TTContours.chaos=1;let d=0,mx0=Math.max(...a),mx1=-1e9;for(let i=0;i<200;i++){const v=TTContours.edge(m,i/200,3.3,1,1200);d+=Math.abs(v-a[i]);mx1=Math.max(mx1,v)}r[m]={diff:+(d/200).toFixed(2),max0:+mx0.toFixed(1),max1:+mx1.toFixed(1)}}TTContours.chaos=(settings.contourChaos||0)/100;return r});
console.log('chaos',JSON.stringify(ch));for(const m in ch)assert(ch[m].diff>.3,m+' reacts to chaos');
await p.evaluate(()=>openSettingsCategory('appearance'));await p.waitForTimeout(300);
const ui=await p.evaluate(()=>({slider:!!document.getElementById('contourChaos'),petChaos:!!document.getElementById('petChaos')}));console.log('ui',JSON.stringify(ui));assert(ui.slider&&!ui.petChaos);
await p.locator('#contourChaos').scrollIntoViewIfNeeded().catch(()=>{});await p.screenshot({path:path.join(require('node:os').tmpdir(),'rc3-settings.png')});
await p.evaluate(()=>{document.querySelector('.settings-close,#closeSettings')?.click();});
// 3) dock: island becomes flush with the top line and spreads along it
await p.evaluate(()=>{settings.motion='full';settings.vibration='spikes';settings.liquidEnabled=true;settings.contourChaos=80;contourPreview=true;updateWaveAnimation();});
const before=await p.evaluate(()=>document.getElementById('island').getBoundingClientRect().top);
await p.evaluate(()=>TTLiquidFXDebug.setDocked(true));await p.waitForTimeout(900);
const dock=await p.evaluate(()=>{const i=document.getElementById('island'),cs=getComputedStyle(i),c=document.getElementById('fxCanvas'),ctx=c.getContext('2d'),r=i.getBoundingClientRect(),d=devicePixelRatio||1;const px=ctx.getImageData(Math.round(Math.max(1,r.left-8)*d),1,1,1).data;return {top:r.top,radius:cs.borderTopLeftRadius,shoulderAlpha:px[3],docked:document.body.classList.contains('fx-docked')}});
console.log('dock',before,JSON.stringify(dock));await p.screenshot({path:path.join(require('node:os').tmpdir(),'rc3-docked.png'),clip:{x:0,y:0,width:680,height:200}});
assert(dock.docked&&Math.abs(dock.top)<=1.5,'flush with top');assert.equal(dock.radius,'0px');assert(dock.shoulderAlpha>0,'top edge spreads beyond the island');
await p.evaluate(()=>TTLiquidFXDebug.setDocked(false));await p.waitForTimeout(900);
const after=await p.evaluate(()=>document.getElementById('island').getBoundingClientRect().top);console.log('undock top',after);assert(Math.abs(after-before)<=1.5,'returns back');
await p.evaluate(()=>{for(let i=0;i<3;i++)TTLiquidFXDebug.spawn()});await p.waitForTimeout(700);await p.screenshot({path:path.join(require('node:os').tmpdir(),'rc3-spikes-chaos.png'),clip:{x:0,y:0,width:680,height:260}});
assert(errors.length===0,errors.join('\n'));console.log('PASS: rc3 smoke (plain eyes, no mascot chaos, contour chaos, top dock spread, no page errors)');await browser.close()})().catch(e=>{console.error(e);process.exit(1)});
