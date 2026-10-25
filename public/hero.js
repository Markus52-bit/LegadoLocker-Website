import {productPhotos} from './photos.js';
const kindNames={tee:'TEES',cap:'HEADWEAR',hoodie:'HOODIES',other:'PIECES'};
export function initHero({collections,products,photoURL,selectCollection}){
 const title=document.querySelector('#hero-title'),description=document.querySelector('#hero-description'),cta=document.querySelector('#hero-shop'),art=document.querySelector('.hero-art'),image=art.querySelector('img');
 const logo=new URL('./assets/logo.jpg',import.meta.url).href;let featuredId='',imageKey='',generation=0;
 cta.addEventListener('click',()=>selectCollection(featuredId));
 function setTitle(name){const words=name.trim().split(/\s+/),middle=Math.ceil(words.length/2);title.replaceChildren();if(words.length<2)title.textContent=name;else{const outline=document.createElement('em');outline.textContent=words.slice(middle).join(' ');title.append(words.slice(0,middle).join(' ')+' ',document.createElement('br'),outline);}title.classList.toggle('long-title',name.length>22);}
 function updateImage(collection,items){
  const seen=new Set(),candidates=[];for(const product of items){const cover=productPhotos(product)[0];if(!cover)continue;const url=photoURL(cover);if(seen.has(url))continue;seen.add(url);candidates.push({url,alt:collection.name+' — '+product.name,photo:true});}
  candidates.push({url:logo,alt:'Legado Locker silver emblem and wordmark',photo:false});const key=JSON.stringify([collection?.id,candidates.map(c=>c.url)]);if(key===imageKey)return;imageKey=key;const current=++generation;
  function load(index){if(current!==generation||index>=candidates.length)return;const candidate=candidates[index],probe=new Image();probe.onload=()=>{if(current!==generation)return;image.src=candidate.url;image.alt=candidate.alt;art.classList.toggle('has-collection-photo',candidate.photo);};probe.onerror=()=>load(index+1);probe.src=candidate.url;}
  load(0);
 }
 return function update(selectedId=''){
  const collection=collections.find(c=>c.id===selectedId)||collections[0]||null;featuredId=collection?.id||'';const items=collection?products.filter(p=>p.collectionId===collection.id):[];const number=collection?String(collections.indexOf(collection)+1).padStart(3,'0'):'';
  setTitle(collection?.name||'LEGADO LOCKER');
  const copy=collection?.description?.trim()|| (collection?'Explore '+collection.name+' from Legado Locker.':'New collections are on the way. Check back soon.');description.textContent=copy.length>280?copy.slice(0,277).trimEnd()+'…':copy;
  document.querySelector('#hero-eyebrow').textContent=collection?'COLLECTION '+number+' / '+collection.name:'YOUR STORY / YOUR LEGACY';
  document.querySelector('#store-announcement').textContent=collection?'LEGADO LOCKER ✦ '+collection.name+' — COLLECTION '+number:'LEGADO LOCKER ✦ NEW CHAPTERS AHEAD';
  art.querySelector('.hero-art-index').textContent=collection?'LL—'+number+' / '+collection.name:'LEGADO LOCKER / YOUR LEGACY';
  art.querySelector('.art-caption').textContent=collection?items.length+' '+(items.length===1?'PIECE':'PIECES')+' / '+collection.name:'THE LEGACY IS YOURS';
  const colors=[...new Set(items.map(p=>p.color).filter(Boolean))],kinds=[...new Set(items.map(p=>kindNames[p.kind]).filter(Boolean))];
  document.querySelector('#hero-details').textContent=items.length?[colors.slice(0,4).join(' / '),kinds.join(' / ')].filter(Boolean).join(' ✦ '):'NEW PIECES COMING SOON';
  document.querySelector('#entrance-categories').textContent=kinds.length?kinds.join(' / '):'EXPLORE THE COLLECTIONS';
  document.querySelector('#entrance-colors').textContent=colors.length?colors.slice(0,4).join(' / '):'YOUR STORY. YOUR LEGACY.';
  cta.querySelector('.hero-shop-label').textContent=collection?'SHOP THE COLLECTION':'EXPLORE THE STORE';
  cta.setAttribute('aria-label',collection?'Shop '+collection.name:'Explore the store');
  document.title=collection?collection.name+' — Legado Locker':'Legado Locker';
  document.querySelector('meta[name=description]').content=collection?collection.name+'. '+copy.slice(0,145):'Explore clothing and headwear collections from Legado Locker.';
  updateImage(collection,items);
 };
}
