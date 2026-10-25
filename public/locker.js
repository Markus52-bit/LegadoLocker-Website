export function initLocker(collections=[],selectCollection=()=>{}) {
  const entrance=document.querySelector('#locker-entrance');
  const scene=document.querySelector('#locker-scene');
  const store=document.querySelector('#storefront');
  const shop=document.querySelector('#enter-shop');
  const notes=document.querySelector('#locker-collections');
  const published=collections.filter(collection=>collection.published!==false);
  notes.replaceChildren();
  published.forEach((collection,index)=>{
    const note=document.createElement('button');note.type='button';note.className='collection-sticky';note.dataset.collectionNote=collection.id;
    note.setAttribute('aria-label','Shop '+collection.name);note.title=collection.name;
    const number=document.createElement('span');number.className='sticky-number';number.textContent='DROP '+String(index+1).padStart(2,'0');
    const name=document.createElement('span');name.className='sticky-name';name.textContent=collection.name;
    const arrow=document.createElement('span');arrow.className='sticky-arrow';arrow.setAttribute('aria-hidden','true');arrow.textContent='↗';
    note.append(number,name,arrow);notes.append(note);
  });
  notes.hidden=!published.length;entrance.classList.toggle('has-collection-notes',!!published.length);
  // Existing section links still skip the entrance.
  if(location.hash)return;
  entrance.hidden=false;store.inert=true;document.body.classList.add('at-entrance');
  let opening=false,hoverTimer;
  function cancelHover(){clearTimeout(hoverTimer);hoverTimer=undefined;}
  function open(collectionId=null){
    if(opening)return;cancelHover();opening=true;
    if(collectionId)selectCollection(collectionId);
    entrance.classList.add('opening');document.body.classList.add('entering-store');shop.setAttribute('aria-disabled','true');
    const finish=()=>{
      entrance.hidden=true;store.inert=false;document.body.classList.remove('at-entrance','entering-store');
      const heading=collectionId?document.querySelector('#collection-title'):store.querySelector('h1');
      if(collectionId){history.replaceState(null,'',location.pathname+location.search+'#collection');document.querySelector('#collection').scrollIntoView({behavior:'instant',block:'start'});}
      heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});
    };
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)finish();else setTimeout(finish,1650);
  }
  function hoverDoor(event){
    if(event.pointerType!=='mouse'||!matchMedia('(hover: hover) and (pointer: fine)').matches||opening)return;
    const target=document.elementFromPoint(event.clientX,event.clientY);
    // Give shoppers time to reach a note without the door opening under the pointer.
    if(target?.closest('#locker-collections')||notes.contains(document.activeElement)){cancelHover();return;}
    if(hoverTimer===undefined)hoverTimer=setTimeout(()=>open(),600);
  }
  scene.addEventListener('pointerenter',hoverDoor);scene.addEventListener('pointermove',hoverDoor);scene.addEventListener('pointerleave',cancelHover);
  notes.addEventListener('pointerenter',cancelHover);notes.addEventListener('focusin',cancelHover);
  notes.addEventListener('click',event=>{const note=event.target.closest('[data-collection-note]');if(note)open(note.dataset.collectionNote);});
  shop.addEventListener('click',()=>open());
}
