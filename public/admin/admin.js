import {currencyFactor} from '../catalog.js';
const $=s=>document.querySelector(s);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let catalog={products:[],collections:[]},tab='products',editing=null,image='',busy=false,previewURL;
function message(text,type=''){const target=$('#message');target.textContent=text;target.className=type;}
async function api(route,method='GET',body){const response=await fetch('/api/admin/'+route,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});let data;try{data=await response.json();}catch{throw Error('The backend is unavailable. Open this admin page on the Node hosting service.');}if(!response.ok){if(response.status===401&&route!=='login')showLogin();throw Error(data.error||'Request failed.');}return data;}
function showLogin(){$('#login-panel').hidden=false;$('#dashboard').hidden=true;$('#logout').hidden=true;}
function showDashboard(){$('#login-panel').hidden=true;$('#dashboard').hidden=false;$('#logout').hidden=false;}
function imageURL(value){return value.startsWith('/uploads/')?value:'/assets/'+value;}
function preview(value){if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null;}const img=$('#photo-preview');if(value){img.src=value;img.hidden=false;}else{img.removeAttribute('src');img.hidden=true;}}
function render(){
 $('#list-title').textContent=tab==='products'?'Pieces':'Collections';$('#new-item').textContent=tab==='products'?'+ New piece':'+ New collection';
 document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
 $('#items').innerHTML=catalog[tab].length?catalog[tab].map(item=>`<button class="item ${item.id===editing?'selected':''}" data-edit="${escape(item.id)}">${escape(item.name)}<small>${item.published?'PUBLISHED':'DRAFT'}${tab==='products'?' · '+escape(catalog.collections.find(c=>c.id===item.collectionId)?.name)+' · '+escape(item.color):''}</small></button>`).join(''):'<p class="empty">Nothing here yet. Add your first '+(tab==='products'?'piece':'collection')+'.</p>';
 $('#collectionId').innerHTML=catalog.collections.map(c=>`<option value="${escape(c.id)}">${escape(c.name)}${c.published?'':' (draft)'}</option>`).join('');
}
function edit(id=null){editing=id;const item=catalog[tab].find(i=>i.id===id);render();$('#item-form').reset();$('#product-fields').hidden=tab!=='products';$('#collectionId').required=tab==='products';$('#sizes').required=tab==='products';$('#currency').required=tab==='products';$('#editor-title').textContent=(item?'Edit ':'New ')+(tab==='products'?'piece':'collection');$('#item-form button[type=submit]').textContent=tab==='products'?'Save piece':'Save collection';$('#delete-item').hidden=!item;image=item?.image||'';preview(image?imageURL(image):'');for(const key of ['name','description','color','kind','collectionId','currency'])if(item&&key in item)$('#'+key).value=item[key];$('#published').checked=item?.published||false;if(item&&tab==='products'){$('#sizes').value=item.sizes.join(', ');$('#price').step=String(1/currencyFactor(item.currency));$('#price').value=item.price===null?'':(item.price/currencyFactor(item.currency)).toFixed(Math.log10(currencyFactor(item.currency)));}}
async function refresh(){catalog=await api('catalog');showDashboard();edit();}
$('#login-form').addEventListener('submit',async e=>{e.preventDefault();if(busy)return;busy=true;try{await api('login','POST',{password:$('#password').value});$('#password').value='';await refresh();message('Signed in. Welcome to the backroom.','success');}catch(error){message(error.message,'error');}finally{busy=false;}});
$('#logout').addEventListener('click',async()=>{try{await api('logout','POST',{});showLogin();message('Signed out.');}catch(error){message(error.message,'error');}});
document.addEventListener('click',e=>{if(busy)return;const button=e.target.closest('button');if(button?.dataset.tab){tab=button.dataset.tab;edit();message('');}if(button?.dataset.edit){edit(button.dataset.edit);message('');}if(button?.id==='new-item'){edit();$('#name').focus();}if(button?.id==='remove-photo'){image='';$('#photo').value='';preview('');}});
$('#kind').addEventListener('change',()=>{if(!editing)$('#sizes').value=$('#kind').value==='cap'?'Adjustable':'S, M, L, XL, XXL';});
$('#photo').addEventListener('change',()=>{const file=$('#photo').files[0];if(!file)return;if(file.size>5*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type)){$('#photo').value='';message('Choose a PNG, JPEG, or WebP up to 5 MB.','error');return;}preview('');previewURL=URL.createObjectURL(file);$('#photo-preview').src=previewURL;$('#photo-preview').hidden=false;});
async function upload(file){const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file);});return (await api('upload','POST',{data})).image;}
function lock(value){busy=value;document.querySelectorAll('#dashboard button,#dashboard input,#dashboard textarea,#dashboard select').forEach(el=>el.disabled=value);}
$('#item-form').addEventListener('submit',async e=>{e.preventDefault();if(busy)return;lock(true);message('Saving…');try{
 let body={name:$('#name').value,description:$('#description').value,published:$('#published').checked};
 if(tab==='products'){
  const file=$('#photo').files[0];if(file)image=await upload(file);
  body={...body,collectionId:$('#collectionId').value,kind:$('#kind').value,color:$('#color').value,sizes:$('#sizes').value.split(',').map(v=>v.trim()).filter(Boolean),price:$('#price').value===''?null:Math.round(Number($('#price').value)*currencyFactor($('#currency').value.toUpperCase())),currency:$('#currency').value,image};
 }
 const saved=await api(tab+(editing?'/'+editing:''),editing?'PUT':'POST',body);catalog=await api('catalog');edit(saved.id);message((saved.published?'Published':'Draft')+' saved. Refresh the store to see changes.','success');
 }catch(error){message(error.message,'error');}finally{lock(false);}});
$('#delete-item').addEventListener('click',async()=>{if(!editing||busy||!confirm('Delete this '+(tab==='products'?'piece':'collection')+'? This cannot be undone.'))return;lock(true);try{await api(tab+'/'+editing,'DELETE',{});await refresh();message('Deleted.','success');}catch(error){message(error.message,'error');}finally{lock(false);}});
try{await api('session');await refresh();}catch(error){showLogin();if(!error.message.includes('Sign in'))message(error.message,'error');}

$('#currency').addEventListener('change',()=>{try{$('#price').step=String(1/currencyFactor($('#currency').value.toUpperCase()));}catch{message('Use a valid three-letter currency code.','error');}});
