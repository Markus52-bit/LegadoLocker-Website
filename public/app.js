import {initCheckout,checkoutProvider} from './checkout.js';
import {initHero} from './hero.js';
import {initFooterLinks} from './footer.js';
import {productPhotos} from './photos.js';
import {mountGalleries} from './gallery.js';
import {initLocker} from './locker.js';
import {products,collections,setCatalog,validBag,addItem,currencyFactor} from './catalog.js';
const $=selector=>document.querySelector(selector);
initFooterLinks();
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const category={tee:'T-shirt',cap:'Adjustable cap',hoodie:'Hoodie',other:'Piece'};
const price=p=>p.price===null?(checkoutProvider==='shopify'&&Object.keys(p.shopifyVariants||{}).length?'PRICE AT CHECKOUT':'COMING SOON'):new Intl.NumberFormat(undefined,{style:'currency',currency:p.currency}).format(p.price/currencyFactor(p.currency));
let bag=[],filter='all';
let catalogError=false;
try{
 const response=await fetch(new URL('api/catalog',location.origin+'/'),{cache:'no-store'});
 if(response.ok&&response.headers.get('content-type')?.includes('application/json'))setCatalog(await response.json());
 else if(response.status!==404)catalogError=true;
}catch{catalogError=true;}
try{bag=validBag(JSON.parse(localStorage.getItem('legado-bag')||'[]'));}catch{}
const photoURL=image=>image.startsWith('/uploads/')?image:new URL(`./assets/${image}`,import.meta.url).href;
let clearProductGalleries=()=>{},clearDetailGallery=()=>{};
function selectCollection(id){filter='all';$('#collection-select').value=id;document.querySelectorAll('.filter').forEach(button=>{const active=button.dataset.filter==='all';button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});renderProducts();}
const updateHero=initHero({collections,products,photoURL,selectCollection});
function visual(p){const collection=collections.find(c=>c.id===p.collectionId);return `<div class="product-visual ${p.color.toLowerCase()==='white'?'white':'black'}"><span class="visual-label">${escape(collection?.name||'LEGADO')} / ${escape(category[p.kind])}</span><span class="motif" aria-hidden="true">✦</span><span class="visual-note">PRODUCT PHOTOGRAPHY COMING SOON</span></div>`;}
function gallery(p,detail=false){const photos=productPhotos(p);const content=visual(p);return `<div class="product-gallery ${detail?'detail-gallery':''}" data-gallery data-images="${escape(JSON.stringify(photos.map(photoURL)))}" data-photo-alt="${escape(p.color+' '+p.name)}" role="group" aria-label="${escape(p.name)} photos">${detail?content:`<button class="product-open product-photo-open" data-product="${escape(p.id)}" aria-label="View ${escape(p.color)} ${escape(p.name)}">${content}</button>`}${photos.length>1?`<div class="gallery-controls"><button type="button" data-gallery-prev aria-label="Previous photo of ${escape(p.name)}">←</button><span data-gallery-counter aria-label="Photo position">1 / ${photos.length}</span><button type="button" data-gallery-next aria-label="Next photo of ${escape(p.name)}">→</button>${detail?'':'<button type="button" data-gallery-pause aria-label="Pause automatic photos" aria-pressed="false">Pause</button>'}</div>`:''}</div>`;}
function renderProducts(){
 const collectionId=$('#collection-select').value;
 updateHero(collectionId);
 const selectedCollection=collections.find(collection=>collection.id===collectionId);
 $('#collection-eyebrow').textContent=selectedCollection?'COLLECTION '+String(collections.indexOf(selectedCollection)+1).padStart(3,'0'):'EXPLORE THE COLLECTIONS';
 $('#collection-title').textContent=selectedCollection?.name||'THE LINEUP.';
 const described=collections.filter(collection=>(!collectionId||collection.id===collectionId)&&collection.description?.trim());
 const descriptions=$('#collection-descriptions');descriptions.hidden=!described.length;
 descriptions.innerHTML=described.map(collection=>`<article class="collection-note">${selectedCollection?'':`<h3>${escape(collection.name)}</h3>`}<p>${escape(collection.description)}</p></article>`).join('');
 const items=products.filter(p=>(filter==='all'||p.kind===filter)&&(!collectionId||p.collectionId===collectionId));
 $('#result-count').textContent=items.length+' PIECES';
 clearProductGalleries();
 $('#products').innerHTML=items.length?items.map(p=>`<article class="product-card">${gallery(p)}<button class="product-open product-info-open" data-product="${escape(p.id)}" aria-label="Details for ${escape(p.color)} ${escape(p.name)}"><div class="product-meta"><div><h3>${escape(p.name)}</h3><p>${escape(p.color)} / ${escape(category[p.kind])}</p></div><span>↗</span></div></button><div class="launch-label">${escape(price(p))}</div></article>`).join(''):'<p class="empty-products">No pieces in this selection yet.</p>';
 clearProductGalleries=mountGalleries($('#products'));
}
function saveBag(){try{localStorage.setItem('legado-bag',JSON.stringify(bag));}catch{}$('#bag-count').textContent=bag.reduce((n,item)=>n+item.quantity,0);}
function openProduct(id){
 const p=products.find(p=>p.id===id);if(!p)return;const collection=collections.find(c=>c.id===p.collectionId);
 clearDetailGallery();
 $('#product-detail').innerHTML=`<div class="product-detail-grid">${gallery(p,true)}<div><p class="eyebrow">${escape(collection?.name)}</p><h2 id="product-title">${escape(p.name)}</h2><p>${escape(p.color)} · ${escape(p.description||'A piece from the '+(collection?.name||'Legado Locker')+' collection.')}</p><p>${escape(price(p))}</p>${checkoutProvider==='shopify'?'<p>Final price and stock are confirmed in Shopify checkout.</p>':''}<label for="size">Select size / fit</label><select id="size">${p.sizes.map(s=>`<option>${escape(s)}</option>`).join('')}</select><button class="button" id="add-to-bag" data-id="${escape(p.id)}">Add to bag <span>+</span></button></div></div>`;$('#product-dialog').showModal();clearDetailGallery=mountGalleries($('#product-detail'),{autoplay:false});if(checkoutProvider==='shopify'){const update=()=>{const available=Object.hasOwn(p.shopifyVariants||{},$('#size').value);$('#add-to-bag').disabled=!available;$('#add-to-bag').setAttribute('aria-label',available?'Add to bag':'This size is not yet available for checkout');};$('#size').addEventListener('change',update);update();}
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
$('#year').textContent=new Date().getFullYear();renderProducts();saveBag();initLocker(collections,selectCollection);

initCheckout({getBag:()=>bag,onReady:renderProducts,onPurchased:items=>{for(const item of items){const line=bag.find(b=>b.id===item.id&&b.size===item.size);if(line)line.quantity-=item.quantity;}bag=validBag(bag.filter(line=>line.quantity>0));saveBag();if($('#bag-dialog').open)renderBag();}});

$('#product-dialog').addEventListener('close',()=>{clearDetailGallery();clearDetailGallery=()=>{};});
