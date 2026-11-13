// Executed only on an approved Yandex Weather page in its sandboxed view.
(() => {
  const clean = value => String(value || '').replace(/[\u200b-\u200f\u2060\ufeff]/g,'').replace(/\s+/g,' ').trim();
  const get = (root, selectors) => { for (const selector of selectors) { const el = root.querySelector(selector); const text = clean(el?.textContent); if (text) return text; } return ''; };
  // Only the current-conditions card, never the first temperature in a forecast.
  const current = document.querySelector('[class*="FactWithoutCharacter_wrap"]') || document.querySelector('.fact') || document.querySelector('[class*="CurrentConditions"]');
  if (!current) return {ok:false,error:'Яндекс не показал текущую погоду. Открой страницу погоды, выбери город и проверь доступ к сайту.'};
  let temp = get(current, ['[class*="AppFactTemperature_content"]', '.fact__temp .temp__value', '.fact__temp', '[class*="CurrentConditions"] [class*="Temp"]']);
  temp = temp.replace(/\s/g,'').replace(/−/g,'-');
  if (/^[+-]?\d{1,2}$/.test(temp)) temp += '°';
  if (!/^[+-]?\d{1,2}°(?:C|С)?$/i.test(temp)) return {ok:false,error:'Температура на странице Яндекса не найдена. Открой погоду и проверь город.'};
  const cond = get(current,['[class*="FactWithoutCharacter_warning__first_text"]','.link__condition','.fact__condition','[class*="Condition"]']).slice(0,80);
  const title = get(document,['main h1','h1']).replace(/^Погода\s+в\s+/i,'').slice(0,100);
  return {ok:true,temp,cond,city:title,source:'Яндекс Погода'};
})()
