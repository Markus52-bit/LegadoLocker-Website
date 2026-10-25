import {initLocker} from './locker.js';
import {products,collections,setCatalog,validBag,addItem,currencyFactor} from './catalog.js';
const $=selector=>document.querySelector(selector);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const category={tee:'T-shirt',cap:'Adjustable cap',hoodie:'Hoodie',other:'Piece'};
const price=p=>p.price===null?'COMING SOON':new Intl.NumberFormat(undefined,{style:'currency',currency:p.currency}).format(p.price/currencyFactor(p.currency));
let bag=[],filter='all';
let catalogError=false;
try{
 const response=await fetch(new URL('api/catalog',location.origin+'/'),{cache:'no-store'});
 if(response.ok&&response.headers.get('content-type')?.includes('application/json'))setCatalog(await response.json());
 else if(response.status!==404)catalogError=true;
}catch{catalogError=true;}
try{bag=validBag(JSON.parse(localStorage.getItem('legado-bag')||'[]'));}catch{}
function visual(p){const collection=collections.find(c=>c.id===p.collectionId);const image=p.image?.startsWith('/uploads/')?p.image:new URL(`./assets/${p.image}`,import.meta.url).href;return `<div class="product-visual ${p.color.toLowerCase()==='white'?'white':'black'}"><span class="visual-label">${escape(collection?.name||'LEGADO')} / ${escape(category[p.kind])}</span><span class="motif" aria-hidden="true">✦</span><span class="visual-note">PRODUCT PHOTOGRAPHY COMING SOON</span>${p.image?`<img src="${escape(image)}" alt="${escape(p.color)} ${escape(p.name)}" hidden>`:''}</div>`;}
function loadImages(){document.querySelectorAll('.product-visual img').forEach(img=>{const reveal=()=>{img.hidden=false;img.parentElement.classList.add('has-photo');};img.onload=reveal;img.onerror=()=>img.remove();if(img.complete&&img.naturalWidth)reveal();});}
function renderProducts(){
 const collectionId=$('#collection-select').value;
 const items=products.filter(p=>(filter==='all'||p.kind===filter)&&(!collectionId||p.collectionId===collectionId));
 $('#result-count').textContent=items.length+' PIECES';
 $('#products').innerHTML=items.length?items.map(p=>`<article class="product-card"><button class="product-open" data-product="${escape(p.id)}" aria-label="View ${escape(p.color)} ${escape(p.name)}">${visual(p)}<div class="product-meta"><div><h3>${escape(p.name)}</h3><p>${escape(p.color)} / ${escape(category[p.kind])}</p></div><span>↗</span></div></button><div class="launch-label">${escape(price(p))}</div></article>`).join(''):'<p class="empty-products">No pieces in this selection yet.</p>';
 loadImages();
}
function saveBag(){try{localStorage.setItem('legado-bag',JSON.stringify(bag));}catch{}$('#bag-count').textContent=bag.reduce((n,item)=>n+item.quantity,0);}
function openProduct(id){
 const p=products.find(p=>p.id===id);if(!p)return;const collection=collections.find(c=>c.id===p.collectionId);
 $('#product-detail').innerHTML=`<div class="product-detail-grid">${visual(p)}<div><p class="eyebrow">${escape(collection?.name)}</p><h2 id="product-title">${escape(p.name)}</h2><p>${escape(p.color)} · ${escape(p.description||'A piece from the '+(collection?.name||'Legado Locker')+' collection.')}</p><p>${p.price===null?'Price and availability coming soon.':escape(price(p))}</p><label for="size">Select size / fit</label><select id="size">${p.sizes.map(s=>`<option>${escape(s)}</option>`).join('')}</select><button class="button" id="add-to-bag" data-id="${escape(p.id)}">Add to bag <span>+</span></button></div></div>`;loadImages();$('#product-dialog').showModal();
}
function renderBag(){saveBag();$('#bag-items').innerHTML=bag.length?bag.map((item,i)=>{const p=products.find(p=>p.id===item.id);return `<div class="bag-row"><div>${escape(p.name)}<p>${escape(p.color)} / ${escape(item.size)}</p><div class="quantity"><button data-quantity="${i}" data-delta="-1" aria-label="Decrease quantity of ${escape(p.color)} ${escape(p.name)}">−</button><span>${item.quantity}</span><button data-quantity="${i}" data-delta="1" aria-label="Increase quantity of ${escape(p.color)} ${escape(p.name)}">+</button></div></div><button class="remove" data-remove="${i}" aria-label="Remove ${escape(p.color)} ${escape(p.name)}">Remove</button></div>`;}).join(''):'<p>Your bag is waiting for its first piece.</p>';}
let toast;
document.addEventListener('click',e=>{
 const button=e.target.closest('button');if(!button)return;
 if(button.dataset.close){$('#'+button.dataset.close).close();return;}
 if(button.dataset.filter){filter=button.dataset.filter;document.querySelectorAll('.filter').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});renderProducts();}
 if(button.dataset.product)openProduct(button.dataset.product);
 if(button.id==='add-to-bag'){bag=addItem(bag,button.dataset.id,$('#size').value);saveBag();$('#product-dialog').close();$('#status').textContent='Added to your bag';$('#status').classList.add('visible');clearTimeout(toast);toast=setTimeout(()=>$('#status').classList.remove('visible'),2500);}
 if(button.id==='open-bag'){renderBag();$('#bag-dialog').showModal();}
 if(button.dataset.remove!==undefined){bag.splice(Number(button.dataset.remove),1);renderBag();}
 if(button.dataset.quantity!==undefined){const item=bag[Number(button.dataset.quantity)];item.quantity=Math.min(99,item.quantity+Number(button.dataset.delta));bag=validBag(bag);renderBag();}
});
$('#collection-select').innerHTML='<option value="">All collections</option>'+collections.map(c=>`<option value="${escape(c.id)}">${escape(c.name)}</option>`).join('');
$('#collection-select').addEventListener('change',renderProducts);
if(catalogError){$('#catalog-message').hidden=false;$('#catalog-message').textContent='Live catalog is temporarily unavailable. Showing the original collection; please check back for updates.';}
$('#year').textContent=new Date().getFullYear();renderProducts();saveBag();initLocker();
