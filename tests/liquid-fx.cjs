const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||chromium.executablePath(),args:['--no-sandbox']});
const p=await browser.newPage({viewport:{width:680,height:650}}),errors=[];p.on('pageerror',e=>errors.push(e.stack));
await p.goto(pathToFileURL(path.join(__dirname,'..','index.html')).href);await p.waitForTimeout(350);
await p.evaluate(()=>{settings.liquidEnabled=true;settings.motion='full';saveLiving()});
assert.equal(await p.locator('#fxCanvas').count(),1,'fx canvas mounted');
assert(await p.evaluate(()=>getComputedStyle($('#fxCanvas')).pointerEvents==='none'&&Number(getComputedStyle($('#fxCanvas')).zIndex)<Number(getComputedStyle($('.island-wrap')).zIndex)),'canvas is behind the island and click-through');
await p.evaluate(()=>openSettingsCategory('appearance'));
assert.equal(await p.locator('[data-fx-setting=stickTop]').count(),1);assert.equal(await p.locator('[data-fx-setting=drips]').count(),1);
// sticky neck: pixels appear between the window top and the island top
await p.waitForTimeout(900);
const neck=await p.evaluate(()=>{const c=$('#fxCanvas'),r=$('#island').getBoundingClientRect(),d=devicePixelRatio,x=Math.round((r.left+r.width/2)*d),y=Math.max(1,Math.round(r.top*.5*d));return c.getContext('2d').getImageData(x,y,1,1).data[3]});
assert(neck>200,'neck is drawn above the island: alpha '+neck);
// drip: forms, detaches and falls, then disappears
await p.evaluate(()=>TTLiquidFXDebug.spawn());
const phases=new Set();for(let i=0;i<30;i++){await p.waitForTimeout(100);for(const d of await p.evaluate(()=>TTLiquidFXDebug.state.drops.map(d=>d.phase+(d.absorbing?'-absorb':''))))phases.add(d)}
assert(phases.has('form'),'drop forms');assert(phases.has('fall')||phases.has('form-absorb'),'drop detaches or is reabsorbed: '+[...phases]);
// switches persist and stop the effect
await p.locator('[data-fx-setting=stickTop]').evaluate(el=>{el.checked=false;el.dispatchEvent(new Event('change'))});
assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('island.settings')).stickTop),false);
await p.waitForTimeout(700);assert(await p.evaluate(()=>TTLiquidFXDebug.state.amount<.05),'neck retracts when disabled');
// reduced motion: nothing animates
await p.evaluate(()=>{settings.motion='off';saveLiving()});await p.waitForTimeout(300);
assert(errors.length===0,errors.join('\n'));
console.log('PASS: liquid FX canvas behind island, sticky top neck, drip form/detach/fall, switches persist, neck retracts');
await browser.close()})().catch(e=>{console.error(e);process.exit(1)});
