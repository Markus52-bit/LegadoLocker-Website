import {initFooterAdmin} from './footer.js';
import {productPhotos} from '../photos.js';
import {initOperations} from './operations.js';
import {currencyFactor} from '../catalog.js';
const $=s=>document.querySelector(s);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let catalog={products:[],collections:[]},tab='products',editing=null,photos=[],busy=false,variantDraft={};
function message(text,type=''){const target=$('#message');target.textContent=text;target.className=type;}
async function api(route,method='GET',body){const response=await fetch('/api/admin/'+route,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});let data;try{data=await response.json();}catch{throw Error('The backend is unavailable. Open this admin page on the Node hosting service.');}if(!response.ok){if(response.status===401&&route!=='login')showLogin();throw Error(data.error||'Request failed.');}return data;}
function showLogin(){document.dispatchEvent(new Event('admin-logout'));tab='products';$('#catalog-layout').hidden=false;$('#operations').hidden=true;$('#footer-editor').hidden=true;$('#footer-tab').classList.remove('active');document.querySelectorAll('[data-ops]').forEach(b=>b.classList.remove('active'));$('#login-panel').hidden=false;$('#dashboard').hidden=true;$('#logout').hidden=true;}
function showDashboard(){$('#login-panel').hidden=true;$('#dashboard').hidden=false;$('#logout').hidden=false;}
function imageURL(value){return value.startsWith('/uploads/')?value:'/assets/'+value;}
function discardPhotos(){for(const photo of photos)if(photo.preview)URL.revokeObjectURL(photo.preview);photos=[];}
function renderPhotos(){
 $('#photo-list').innerHTML=photos.map((photo,i)=>`<article class="photo-entry"><div class="photo-thumb"><img src="${escape(photo.preview||imageURL(photo.image))}" alt="Product photo ${i+1}" loading="lazy"><span>Preview unavailable</span></div><div><p>${i===0?'COVER PHOTO':'PHOTO '+(i+1)}${photo.file?' · Pending upload':''}</p><div class="photo-actions"><button type="button" class="secondary" data-photo-action="cover" data-photo-index="${i}" ${i===0?'disabled':''} aria-label="Make photo ${i+1} the cover">Make cover</button><button type="button" class="secondary" data-photo-action="up" data-photo-index="${i}" ${i===0?'disabled':''} aria-label="Move photo ${i+1} earlier">←</button><button type="button" class="secondary" data-photo-action="down" data-photo-index="${i}" ${i===photos.length-1?'disabled':''} aria-label="Move photo ${i+1} later">→</button><button type="button" class="danger" data-photo-action="remove" data-photo-index="${i}" aria-label="Remove photo ${i+1}">Remove</button></div></div></article>`).join('')||'<p class="help">No photos selected. Add your first product photo above.</p>';
 $('#photo-list').querySelectorAll('img').forEach(img=>{img.onerror=()=>img.closest('.photo-thumb').classList.add('unavailable');});
 $('#remove-photo').disabled=busy||!photos.length;
}
$('#photo-list').addEventListener('click',event=>{
 if(busy)return;const button=event.target.closest('[data-photo-action]');if(!button)return;const index=Number(button.dataset.photoIndex);if(!Number.isInteger(index)||index<0||index>=photos.length)return;
 const action=button.dataset.photoAction;
 if(action==='remove'){const [photo]=photos.splice(index,1);if(photo.preview)URL.revokeObjectURL(photo.preview);}
 if(action==='cover')photos.unshift(photos.splice(index,1)[0]);
 if(action==='up'&&index>0)[photos[index-1],photos[index]]=[photos[index],photos[index-1]];
 if(action==='down'&&index<photos.length-1)[photos[index+1],photos[index]]=[photos[index],photos[index+1]];
 renderPhotos();const next=$('#photo-list').querySelector(`[data-photo-action="${action}"][data-photo-index="${Math.min(index,photos.length-1)}"]`);if(next&&!next.disabled)next.focus();
});
window.addEventListener('beforeunload',()=>{for(const photo of photos)if(photo.preview)URL.revokeObjectURL(photo.preview);});
function readVariantFields(includeEmpty=false){return Object.fromEntries([...$('#shopify-variant-fields').querySelectorAll('input')].map(input=>[input.dataset.size,input.value.trim()]).filter(([,value])=>includeEmpty||value));}
function renderVariantFields(preserve=true){if(preserve)variantDraft={...variantDraft,...readVariantFields(true)};const sizes=[...new Set($('#sizes').value.split(',').map(s=>s.trim()).filter(Boolean))];$('#shopify-variant-fields').innerHTML=sizes.map((size,i)=>`<label for="shopify-variant-${i}">${escape(size)} — Shopify variant ID</label><input id="shopify-variant-${i}" data-size="${escape(size)}" value="${escape(variantDraft[size]||'')}" maxlength="100" placeholder="1234567890">`).join('');}
$('#sizes').addEventListener('change',()=>renderVariantFields());
function render(){
 $('#list-title').textContent=tab==='products'?'Pieces':'Collections';$('#new-item').textContent=tab==='products'?'+ New piece':'+ New collection';
 document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
 $('#items').innerHTML=(tab==='collections'?'<p class="help">Use the arrows to set storefront order. Changes save immediately. New collections appear last.</p>':'')+(catalog[tab].length?catalog[tab].map((item,i)=>`${tab==='collections'?'<div class="collection-sort-row">':''}<button class="item ${item.id===editing?'selected':''}" data-edit="${escape(item.id)}">${escape(item.name)}<small>${item.published?'PUBLISHED':'DRAFT'}${tab==='products'?' · '+escape(catalog.collections.find(c=>c.id===item.collectionId)?.name)+' · '+escape(item.color):''}</small></button>${tab==='collections'?`<div class="collection-sort-actions"><button type="button" class="secondary" data-collection-move="up" data-collection-id="${escape(item.id)}" aria-label="Move ${escape(item.name)} earlier" ${i===0?'disabled':''}>↑</button><button type="button" class="secondary" data-collection-move="down" data-collection-id="${escape(item.id)}" aria-label="Move ${escape(item.name)} later" ${i===catalog.collections.length-1?'disabled':''}>↓</button></div></div>`:''}`).join(''):'<p class="empty">Nothing here yet. Add your first '+(tab==='products'?'piece':'collection')+'.</p>');
 $('#collectionId').innerHTML=catalog.collections.map(c=>`<option value="${escape(c.id)}">${escape(c.name)}${c.published?'':' (draft)'}</option>`).join('');
}
function edit(id=null){editing=id;const item=catalog[tab].find(i=>i.id===id);render();$('#item-form').reset();$('#product-fields').hidden=tab!=='products';$('#collectionId').required=tab==='products';$('#sizes').required=tab==='products';$('#currency').required=tab==='products';$('#editor-title').textContent=(item?'Edit ':'New ')+(tab==='products'?'piece':'collection');$('#item-form button[type=submit]').textContent=tab==='products'?'Save piece':'Save collection';$('#delete-item').hidden=!item;discardPhotos();photos=item&&tab==='products'?productPhotos(item).map(image=>({image})):[];renderPhotos();for(const key of ['name','description','color','kind','collectionId','currency'])if(item&&key in item)$('#'+key).value=item[key];$('#published').checked=item?.published||false;if(item&&tab==='products'){$('#sizes').value=item.sizes.join(', ');$('#price').step=String(1/currencyFactor(item.currency));$('#price').value=item.price===null?'':(item.price/currencyFactor(item.currency)).toFixed(Math.log10(currencyFactor(item.currency)));}variantDraft={...(item?.shopifyVariants||{})};renderVariantFields(false);}
initOperations({api,message});
initFooterAdmin({api,message});
async function refresh(){catalog=await api('catalog');showDashboard();edit();}
$('#login-form').addEventListener('submit',async e=>{e.preventDefault();if(busy)return;busy=true;try{await api('login','POST',{password:$('#password').value});$('#password').value='';await refresh();message('Signed in. Welcome to the backroom.','success');}catch(error){message(error.message,'error');}finally{busy=false;}});
$('#logout').addEventListener('click',async()=>{try{await api('logout','POST',{});showLogin();message('Signed out.');}catch(error){message(error.message,'error');}});
document.addEventListener('click',e=>{if(busy)return;const button=e.target.closest('button');if(button?.dataset.collectionMove){moveCollection(button.dataset.collectionId,button.dataset.collectionMove);return;}if(button?.dataset.tab){$('#catalog-layout').hidden=false;$('#operations').hidden=true;$('#footer-editor').hidden=true;$('#footer-tab').classList.remove('active');document.querySelectorAll('[data-ops]').forEach(b=>b.classList.remove('active'));tab=button.dataset.tab;edit();message('');}if(button?.dataset.edit){edit(button.dataset.edit);message('');}if(button?.id==='new-item'){edit();$('#name').focus();}if(button?.id==='remove-photo'){discardPhotos();$('#photo').value='';renderPhotos();}});
$('#kind').addEventListener('change',()=>{if(!editing){$('#sizes').value=$('#kind').value==='cap'?'Adjustable':'S, M, L, XL, XXL';renderVariantFields();}});
$('#photo').addEventListener('change',()=>{
 if(busy)return;const files=[...$('#photo').files];let rejected=0;
 for(const file of files){if(file.size>5*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type)){rejected++;continue;}photos.push({file,preview:URL.createObjectURL(file)});}
 $('#photo').value='';renderPhotos();if(rejected)message(`${rejected} file(s) skipped. Use PNG, JPEG, or WebP, up to 5 MB each.`,'error');else if(files.length)message(`${files.length} photo(s) added. Save the piece to upload them.`);
});
async function upload(file){const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file);});return (await api('upload','POST',{data})).image;}
function lock(value){busy=value;document.querySelectorAll('#dashboard button,#dashboard input,#dashboard textarea,#dashboard select').forEach(el=>el.disabled=value);if(!value)document.querySelectorAll('[data-collection-move]').forEach(button=>{const i=catalog.collections.findIndex(c=>c.id===button.dataset.collectionId);button.disabled=button.dataset.collectionMove==='up'?i===0:i===catalog.collections.length-1;});}
async function moveCollection(id,direction){
 const ids=catalog.collections.map(c=>c.id),index=ids.indexOf(id),next=index+(direction==='up'?-1:1);if(index<0||next<0||next>=ids.length)return;
 [ids[index],ids[next]]=[ids[next],ids[index]];lock(true);message('Saving collection order…');
 try{const saved=await api('collections/order','PUT',{ids});catalog.collections=saved.collections;render();message('Collection order saved. Refresh the storefront to see the new order.','success');}
 catch(error){message(error.message,'error');}
 finally{lock(false);renderPhotos();const button=document.querySelector(`[data-collection-id="${CSS.escape(id)}"][data-collection-move="${direction}"]`);if(button&&!button.disabled)button.focus();else document.querySelector(`[data-edit="${CSS.escape(id)}"]`)?.focus();}
}
$('#item-form').addEventListener('submit',async e=>{e.preventDefault();if(busy)return;lock(true);message('Saving…');try{
 let body={name:$('#name').value,description:$('#description').value,published:$('#published').checked};
 if(tab==='products'){
  for(let i=0;i<photos.length;i++){const photo=photos[i];if(photo.file){message(`Uploading photo ${i+1} of ${photos.length}…`);photo.image=await upload(photo.file);delete photo.file;if(photo.preview){URL.revokeObjectURL(photo.preview);delete photo.preview;}}}const images=photos.map(photo=>photo.image);
  body={...body,collectionId:$('#collectionId').value,kind:$('#kind').value,color:$('#color').value,sizes:$('#sizes').value.split(',').map(v=>v.trim()).filter(Boolean),price:$('#price').value===''?null:Math.round(Number($('#price').value)*currencyFactor($('#currency').value.toUpperCase())),currency:$('#currency').value,shopifyVariants:readVariantFields(),images};
 }
 const saved=await api(tab+(editing?'/'+editing:''),editing?'PUT':'POST',body);catalog=await api('catalog');edit(saved.id);message((saved.published?'Published':'Draft')+' saved. Refresh the store to see changes.','success');
 }catch(error){message(error.message,'error');}finally{lock(false);renderPhotos();}});
$('#delete-item').addEventListener('click',async()=>{if(!editing||busy||!confirm('Delete this '+(tab==='products'?'piece':'collection')+'? This cannot be undone.'))return;lock(true);try{await api(tab+'/'+editing,'DELETE',{});await refresh();message('Deleted.','success');}catch(error){message(error.message,'error');}finally{lock(false);renderPhotos();}});
try{await api('session');await refresh();}catch(error){showLogin();if(!error.message.includes('Sign in'))message(error.message,'error');}

$('#currency').addEventListener('change',()=>{try{$('#price').step=String(1/currencyFactor($('#currency').value.toUpperCase()));}catch{message('Use a valid three-letter currency code.','error');}});
