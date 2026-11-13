'use strict';
const wirelessIcon='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h18v13H3zM8 21h8m-4-4v4M5 13a4 4 0 0 1 4-4M5 10a2 2 0 0 1 2-2"/></svg>';
let wirelessState={busy:false,items:null,error:'',message:''},wirelessGeneration=0;
function renderDisplays(){
 const s=wirelessState;
 const rows=Array.isArray(s.items)?s.items.map((item,i)=>`<div class="wireless-device"><span class="wireless-device-icon" aria-hidden="true">${wirelessIcon}</span><div class="wireless-device-copy"><strong>${escapeHTML(String(item.name||'Дисплей').slice(0,160))}</strong><small>${item.enabled===false?'Windows сообщает: недоступен':'Доступность и подключение — в Windows'}</small></div><button class="small-btn wireless-device-connect" data-wireless-select="${i}">Выбрать в Windows ↗</button></div>`).join(''):'';
 $('#content').innerHTML=`<div class="section-top"><h2>Беспроводные дисплеи</h2><span class="wireless-badge">WINDOWS · MIRACAST</span></div><div class="wireless-intro"><div class="wireless-lead"><span class="wireless-icon" aria-hidden="true">${wirelessIcon}</span><div><strong>Больше пространства</strong><p>Подключи телевизор, проектор или другой дисплей.</p></div></div><div class="wireless-actions"><button class="small-btn primary" id="wirelessScan" ${s.busy?'disabled':''}>${s.busy?'Поиск…':'Найти дисплеи'}</button><button class="small-btn" id="wirelessConnect">Подключить ↗</button><button class="small-btn" id="wirelessMode">Режим проекции ↗</button></div><p class="wireless-hint">Для Miracast включи Wi‑Fi. Выбор и подтверждение — в Windows.</p></div><div class="wireless-list-heading"><strong>Найденные дисплеи</strong><span>${s.busy?'Поиск':Array.isArray(s.items)?`${s.items.length} найдено`:''}</span></div><div id="wirelessResults" aria-live="polite">${s.error?`<p class="wireless-message wireless-error">${escapeHTML(s.error)}</p>`:s.busy?'<p class="wireless-message">Ищем дисплеи через Windows. Это может занять до 25 секунд.</p>':s.items===null?'<p class="wireless-message">Нажми «Найти дисплеи» или сразу открой подключение Windows.</p>':rows||'<p class="wireless-message">Ничего не найдено. Включи дисплей и Wi‑Fi или проверь список Windows через «Подключить».</p>'}</div><p class="wireless-hint">Список приложения может отличаться от Win+K; выбор конкретного экрана и подключение выполняются в Windows.</p>`;
 $('#wirelessScan').onclick=scanWireless;
 $('#wirelessConnect').onclick=()=>openWireless('connect');
 $('#wirelessMode').onclick=()=>openWireless('mode');
 document.querySelectorAll('[data-wireless-select]').forEach(b=>b.onclick=()=>openWireless('connect'));
 iconize();
}
async function scanWireless(){
 if(wirelessState.busy)return;
 if(!native||typeof api.wirelessAction!=='function'){wirelessState={busy:false,items:null,error:'Поиск доступен в настольной версии Windows.',message:''};renderDisplays();return}
 const ticket=++wirelessGeneration;wirelessState={busy:true,items:null,error:'',message:''};renderDisplays();
 try{const r=await api.wirelessAction('scan');if(ticket!==wirelessGeneration)return;wirelessState={busy:false,items:r?.ok&&Array.isArray(r.devices)?r.devices.filter(x=>x&&typeof x.name==='string').slice(0,100):r?.ok?[]:null,error:r?.ok?'':String(r?.error||'Не удалось выполнить поиск.'),message:''}}
 catch{if(ticket!==wirelessGeneration)return;wirelessState={busy:false,items:null,error:'Не удалось получить ответ Windows.',message:''}}
 if(tab==='displays')renderDisplays();
}
async function openWireless(action){
 if(!native||typeof api.wirelessAction!=='function'){toast('Нужна настольная версия Windows');return}
 try{const result=await api.wirelessAction(action);if(!result?.ok){toast(result?.error||'Не удалось открыть панель Windows');return}toast(action==='connect'?'Команда Win+K отправлена. Если панель не открылась, нажми Win+K вручную.':'Команда Win+P отправлена. Если панель не открылась, нажми Win+P вручную.')}
 catch{toast('Не удалось открыть панель Windows. Попробуй Win+K или Win+P.')}
}
