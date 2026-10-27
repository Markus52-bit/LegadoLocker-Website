import {randomUUID} from 'node:crypto';
import {fail} from './validation.mjs';
export function readPromotions(store){const row=store.db.prepare("SELECT value FROM settings WHERE key='promotions'").get();return row?JSON.parse(row.value):[];}
export function savePromotions(store,input){
 if(!Array.isArray(input)||input.length>100)fail('Use a list of up to 100 promotions.');
 const ids=new Set();const items=input.map(item=>{
  if(!item||typeof item!=='object')fail('Invalid promotion.');
  const str=(key,max,required=false)=>{const v=typeof item[key]==='string'?item[key].trim():'';if(v.length>max||(required&&!v))fail(`Enter a valid ${key} (maximum ${max} characters).`);return v;};
  const id=item.id||randomUUID();if(typeof id!=='string'||!/^[a-zA-Z0-9-]{1,64}$/.test(id)||ids.has(id))fail('Invalid promotion identifier.');ids.add(id);
  const startsAt=str('startsAt',40),endsAt=str('endsAt',40);for(const v of [startsAt,endsAt])if(v&&!Number.isFinite(Date.parse(v)))fail('Enter valid schedule dates.');if(startsAt&&endsAt&&Date.parse(endsAt)<=Date.parse(startsAt))fail('End must be after start.');
  const url=str('url',2048);if(url&&(!url.startsWith('/')||url.startsWith('//')||/[\\\u0000-\u0020]/.test(url)))fail('Use a storefront path such as /#collection.');
  if(!['session','day','always'].includes(item.frequency))fail('Choose a display frequency.');if(!Number.isInteger(item.delay)||item.delay<0||item.delay>120)fail('Delay must be 0–120 seconds.');
  return {id,title:str('title',100,true),body:str('body',2000,true),label:str('label',60),url,code:str('code',40),enabled:item.enabled===true,startsAt,endsAt,frequency:item.frequency,delay:item.delay};
 });store.db.prepare('INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('promotions',JSON.stringify(items));return items;
}
export function livePromotions(store,now=Date.now()){return readPromotions(store).filter(p=>p.enabled&&(!p.startsAt||Date.parse(p.startsAt)<=now)&&(!p.endsAt||Date.parse(p.endsAt)>now));}
