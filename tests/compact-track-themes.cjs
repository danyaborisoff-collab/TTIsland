'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:680,height:540}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.join(__dirname,'..','index.html')).href);await page.waitForTimeout(250);
 const state=async extra=>page.evaluate(extra=>applyMusicState({title:'Тестовый трек',artist:'Исполнитель',connected:true,playing:false,position:1,duration:132,rate:1,volume:.6,canSeek:true,canVolume:true,...extra}),extra||{});
 const time=()=>page.locator('#compactTrackTime').textContent();
 await state();assert.equal(await time(),'0:01 / 2:12');
 assert.equal(await page.locator('#compactState').textContent(),'Тестовый трек');
 const boxes=await page.evaluate(()=>{const t=$('#compactState').getBoundingClientRect(),v=$('#compactTrackTime').getBoundingClientRect();return {titleBottom:t.bottom,timeTop:v.top}});assert(boxes.timeTop>=boxes.titleBottom,'Timer must be below the title');
 await page.evaluate(()=>navigate('notes'));await state({position:10,playing:true});const start=await page.evaluate(()=>musicMeterPosition());await page.waitForTimeout(1050);const end=await page.evaluate(()=>musicMeterPosition());assert(end-start>.9&&end-start<1.4,'Clock must advance 1:1 outside the home tab');
 await state({position:14,playing:false});await page.waitForTimeout(500);assert.equal(await time(),'0:14 / 2:12');
 await state({position:73,playing:false});assert.equal(await time(),'1:13 / 2:12','Seek must immediately update the compact clock');
 await state({title:'Другой трек',position:0,duration:212});assert.equal(await time(),'0:00 / 3:32');
 await state({position:29.6,duration:30,playing:true});await page.waitForTimeout(650);assert.equal(await time(),'0:30 / 0:30','Clamp at track end');
 await state({position:1,duration:0});assert.equal(await time(),'0:01 / --:--');
 await state({connected:false,position:0,duration:0});assert(await page.locator('#compactTrackTime').isHidden());
 await state({position:NaN,duration:NaN});assert(await page.locator('#compactTrackTime').isHidden());
 await state();await page.evaluate(()=>{pomStart();updateMusicMeters()});assert(await page.locator('#compactTrackTime').isHidden());await page.evaluate(()=>{pomStop();updateMusicMeters()});assert.equal(await time(),'0:01 / 2:12');
 for(const cls of ['recording','voice-recording']){await page.evaluate(c=>{document.body.classList.add(c);updateMusicMeters()},cls);assert(await page.locator('#compactTrackTime').isHidden());await page.evaluate(c=>{document.body.classList.remove(c);updateMusicMeters()},cls)}
 for(const palette of ['sand','burgundy']){
  await page.evaluate(()=>navigate('settings'));await page.locator(`[data-palette-choice="${palette}"]`).evaluate(e=>e.click());assert.equal(await page.locator('body').getAttribute('data-palette'),palette);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('island.settings')).palette),palette);
  assert.equal(await page.evaluate(p=>themeData({palette:p}).palette,palette),palette,'Profile sanitizer must keep palette');
  await page.locator('#profileName').fill('Тест '+palette);await page.locator('#saveTheme').evaluate(e=>e.click());const id=await page.evaluate(()=>themeProfiles.at(-1).id);await page.evaluate(()=>applyPalette('dark'));await page.evaluate(id=>applyTheme(id),id);assert.equal(await page.locator('body').getAttribute('data-palette'),palette,'User profile restores palette');
  await page.reload();assert.equal(await page.locator('body').getAttribute('data-palette'),palette,'Palette survives reload');
  await state({title:'Очень длинное название трека для проверки обрезания в мини-плеере'});
  for(const shape of ['island','capsule','circle','square','cloud']){
   await page.evaluate(async shape=>{settings.shape=shape;document.body.dataset.shape=shape;await setCollapsed(true)},shape);await page.waitForTimeout(80);
   assert.equal(await page.locator('#compactTrackTime').isVisible(),shape!=='circle',palette+' '+shape);
   await page.evaluate(()=>setCollapsed(false));
  }
  for(const width of [680,390]){await page.setViewportSize({width,height:800});await page.evaluate(()=>setCollapsed(true));const geometry=await page.evaluate(()=>{const a=$('#compactState').getBoundingClientRect(),t=$('#compactTrackTime').getBoundingClientRect(),c=$('#compactMeta').getBoundingClientRect();return {inside:a.left>=c.left-1&&a.right<=c.right+1&&t.left>=c.left-1&&t.right<=c.right+1,overflow:document.documentElement.scrollWidth>innerWidth}});assert(geometry.inside,JSON.stringify(geometry));assert(!geometry.overflow);await page.evaluate(()=>setCollapsed(false))}
  await page.setViewportSize({width:680,height:540});await page.evaluate(()=>navigate('home'));await page.screenshot({path:'/data/feature-'+palette+'-home.png'});await page.evaluate(()=>setCollapsed(true));await page.screenshot({path:'/data/feature-'+palette+'-mini.png'});await page.evaluate(()=>setCollapsed(false));
  const transparent=await page.evaluate(()=>{document.body.classList.add('native');const color=getComputedStyle(document.body).backgroundColor;document.body.classList.remove('native');return color});assert.equal(transparent,'rgba(0, 0, 0, 0)','Do not paint the native transparent desktop background');
 }
 await page.evaluate(()=>navigate('settings'));assert.equal(await page.locator('[data-palette-choice]').count(),6);
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: compact clock format/geometry/play/pause/seek/track changes/unknown duration/Pomodoro/recording, all five shapes, desktop/mobile, sand/burgundy persistence/profiles, native transparency.');
})().catch(e=>{console.error(e);process.exit(1)});
