import {randomUUID} from 'node:crypto';
import {fail} from './validation.mjs';
export function readFooterLinks(store){const row=store.db.prepare("SELECT value FROM settings WHERE key='footer-links'").get();return row?JSON.parse(row.value):[];}
export function saveFooterLinks(store,input){
 if(!Array.isArray(input))fail('Footer links must be a list.');
 const ids=new Set();
 const links=input.map(link=>{
  if(!link||typeof link!=='object'||Array.isArray(link))fail('Each footer link needs a label and destination.');
  const label=typeof link.label==='string'?link.label.trim():'';if(!label||label.length>80)fail('Link labels must be between 1 and 80 characters.');
  const group=link.group;if(!['support','contact','social'].includes(group))fail('Choose Support, Contact, or Socials.');
  let url=typeof link.url==='string'?link.url.trim():'';if(!url||url.length>2048||/[\u0000-\u001f\u007f\\]/.test(url))fail('Enter a valid link destination.');
  if(url.startsWith('/')&&!url.startsWith('//')){ /* An internal page on this store. */ }
  else if(/^#[A-Za-z][\w-]*$/.test(url)){ /* An anchor on this page. */ }
  else{
   let parsed;try{parsed=new URL(url);}catch{fail('Use an HTTPS address, mailto: email link, tel: phone link, or internal /path.');}
   if(parsed.protocol==='https:'&&!parsed.username&&!parsed.password)url=parsed.href;
   else if(parsed.protocol==='mailto:'){
    let address;try{address=decodeURIComponent(parsed.pathname);}catch{fail('Enter a valid email link.');}
    if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address)||/%0[ad]/i.test(url))fail('Enter a valid mailto: email link.');
   }else if(parsed.protocol==='tel:'){if(!/^\+?[\d(). -]{3,40}$/.test(parsed.pathname))fail('Enter a valid tel: phone link.');}
   else fail('Use HTTPS, mailto:, tel:, or an internal /path.');
  }
  const id=link.id||randomUUID();if(typeof id!=='string'||!/^[a-zA-Z0-9-]{1,64}$/.test(id)||ids.has(id))fail('Each footer link must have a unique identifier.');ids.add(id);
  return {id,label,url,group,newTab:link.newTab===true};
 });
 store.db.prepare('INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('footer-links',JSON.stringify(links));return links;
}
