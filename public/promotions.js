export function showPromotion(p,{preview=false}={}){
 const previous=document.activeElement,dialog=document.createElement('dialog');dialog.className='promotion-dialog';
 const close=document.createElement('button');close.className='promotion-close';close.type='button';close.textContent='×';close.setAttribute('aria-label','Close promotion');close.onclick=()=>dialog.close();
 const eyebrow=document.createElement('p');eyebrow.className='eyebrow';eyebrow.textContent='FROM THE LOCKER';
 const title=document.createElement('h2');title.id='promotion-title';title.textContent=p.title;dialog.setAttribute('aria-labelledby',title.id);
 const body=document.createElement('p');body.className='promotion-copy';body.textContent=p.body;dialog.append(close,eyebrow,title,body);
 if(p.code){const code=document.createElement('p');code.className='promotion-code';code.textContent='USE CODE: '+p.code;dialog.append(code);}
 if(p.type==='signup'){
  const form=document.createElement('form');form.className='promotion-signup';
  const emailLabel=document.createElement('label');emailLabel.htmlFor='promotion-email';emailLabel.textContent='Email address';
  const input=document.createElement('input');input.id='promotion-email';input.name='email';input.type='email';input.autocomplete='email';input.required=true;input.maxLength=254;input.placeholder='you@example.com';
  const consentLabel=document.createElement('label');consentLabel.className='promotion-consent';const consent=document.createElement('input');consent.type='checkbox';consent.required=true;consentLabel.append(consent,document.createTextNode('Send me new drops, discounts, and offers. I can unsubscribe anytime.'));
  const submit=document.createElement('button');submit.className='button';submit.type='submit';submit.textContent='Sign me up';
  const status=document.createElement('p');status.setAttribute('role','status');status.className='promotion-copy';form.append(emailLabel,input,consentLabel,submit,status);dialog.append(form);
  form.addEventListener('submit',async e=>{e.preventDefault();if(preview){status.textContent='Preview only — no signup or email was sent.';return;}submit.disabled=true;status.textContent='Sending confirmation…';try{const response=await fetch('/api/newsletter/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:input.value,consent:consent.checked})});const data=await response.json();if(!response.ok)throw Error(data.error||'Signup failed. Please try again.');status.textContent=data.message;input.disabled=true;consent.disabled=true;submit.textContent='Check your inbox';}catch(error){status.textContent=error.message;submit.disabled=false;}});
 }
 if(p.url&&p.url.startsWith('/')&&!p.url.startsWith('//')&&!/[\\\u0000-\u0020]/.test(p.url)&&p.type!=='signup'){const a=document.createElement('a');a.className='button';a.textContent=p.label||'Shop now ↗';a.href=p.url;a.onclick=()=>dialog.close();dialog.append(a);}
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
 dialog.addEventListener('close',()=>{dialog.remove();previous?.focus();});document.body.append(dialog);dialog.showModal();close.focus();
}
export async function initPromotions(){
 try{const r=await fetch('/api/promotions');if(!r.ok)return;const {promotions}=await r.json();
 const eligible=p=>{try{return p.frequency==='always'||!(p.frequency==='day'?localStorage:sessionStorage).getItem('legado-promo-'+p.id+(p.frequency==='day'?'-'+new Date().toISOString().slice(0,10):''));}catch{return true;}};
 const p=promotions.find(eligible);if(!p)return;const readyAt=Date.now()+p.delay*1000;
 const timer=setInterval(()=>{if(Date.now()<readyAt||document.hidden||document.querySelector('dialog[open]')||document.body.classList.contains('at-entrance'))return;
 if(p.endsAt&&Date.parse(p.endsAt)<=Date.now()){clearInterval(timer);return;}clearInterval(timer);showPromotion(p);try{(p.frequency==='day'?localStorage:sessionStorage).setItem('legado-promo-'+p.id+(p.frequency==='day'?'-'+new Date().toISOString().slice(0,10):''),'1');}catch{}},500);
 }catch{ /* Promotions never block shopping. */ }
}
