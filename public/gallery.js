const INTERVAL=5000;
export function mountGalleries(scope,{autoplay=true}={}){
 const cleanups=[...scope.querySelectorAll('[data-gallery]')].map(root=>mount(root,autoplay));
 return ()=>cleanups.forEach(cleanup=>cleanup());
}
function mount(root,autoplay){
 let urls;try{urls=JSON.parse(root.dataset.images);}catch{return ()=>{};}
 if(!Array.isArray(urls)||!urls.length)return ()=>{};
 const visual=root.querySelector('.product-visual'),counter=root.querySelector('[data-gallery-counter]'),pause=root.querySelector('[data-gallery-pause]'),controls=root.querySelector('.gallery-controls');
 const motion=matchMedia('(prefers-reduced-motion: reduce)'),failed=new Set();
 const layers=[0,1].map(()=>{const img=document.createElement('img');img.className='gallery-image';img.alt=root.dataset.photoAlt||'Product photo';img.setAttribute('aria-hidden','true');img.loading='lazy';img.decoding='async';visual.append(img);return img;});
 let index=0,active=null,request=0,timer,disposed=false,hovered=false,focused=false,paused=false,visible=false,touchStart,suppressUntil=0;
 const available=()=>urls.length-failed.size;
 function schedule(){clearTimeout(timer);if(disposed||!autoplay||paused||hovered||focused||!visible||document.hidden||motion.matches||active===null||available()<2)return;timer=setTimeout(()=>advance(1),INTERVAL);}
 function update(){root.dataset.current=String(index);if(counter)counter.textContent=`${index+1} / ${urls.length}`;if(pause){pause.hidden=!autoplay||motion.matches;pause.textContent=paused?'Play':'Pause';pause.setAttribute('aria-label',paused?'Resume automatic photos':'Pause automatic photos');pause.setAttribute('aria-pressed',String(paused));}if(controls)controls.hidden=available()<2;}
 function show(next){
  if(disposed)return;clearTimeout(timer);const serial=++request;const img=layers[active===layers[0]?1:0];img.classList.remove('is-active');img.loading=visible?'eager':'lazy';
  img.onload=()=>{if(disposed||serial!==request)return;layers.forEach(layer=>{layer.classList.toggle('is-active',layer===img);layer.setAttribute('aria-hidden',String(layer!==img));});active=img;index=next;visual.classList.add('has-photo');img.alt=`${root.dataset.photoAlt||'Product'} — photo ${index+1} of ${urls.length}`;update();schedule();};
  img.onerror=()=>{if(disposed||serial!==request)return;failed.add(next);if(available()){let candidate=(next+1)%urls.length;while(failed.has(candidate))candidate=(candidate+1)%urls.length;show(candidate);}else{visual.classList.remove('has-photo');layers.forEach(layer=>layer.classList.remove('is-active'));active=null;update();}};
  img.src=urls[next];
 }
 function advance(delta){if(!available())return;let next=(index+delta+urls.length)%urls.length;while(failed.has(next))next=(next+delta+urls.length)%urls.length;show(next);}
 const onClick=e=>{if(performance.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();return;}const button=e.target.closest('button');if(!button)return;if(button.hasAttribute('data-gallery-prev'))advance(-1);if(button.hasAttribute('data-gallery-next'))advance(1);if(button.hasAttribute('data-gallery-pause')){paused=!paused;update();schedule();}};
 const onEnter=e=>{if(e.pointerType==='mouse'){hovered=true;schedule();}};
 const onLeave=()=>{hovered=false;schedule();};
 const onFocus=()=>{focused=true;schedule();};
 const onBlur=()=>{queueMicrotask(()=>{if(disposed)return;focused=root.contains(document.activeElement);schedule();});};
 const onKey=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();advance(e.key==='ArrowLeft'?-1:1);}};
 const onDown=e=>{if(e.pointerType==='touch')touchStart={x:e.clientX,y:e.clientY};};
 const onUp=e=>{if(!touchStart||e.pointerType!=='touch')return;const dx=e.clientX-touchStart.x,dy=e.clientY-touchStart.y;touchStart=null;if(Math.abs(dx)>40&&Math.abs(dy)<60){advance(dx<0?1:-1);suppressUntil=performance.now()+400;}};
 const onCancel=()=>{touchStart=null;};
 const handlers=[['click',onClick,true],['pointerenter',onEnter],['pointerleave',onLeave],['focusin',onFocus],['focusout',onBlur],['keydown',onKey],['pointerdown',onDown],['pointerup',onUp],['pointercancel',onCancel]];
 handlers.forEach(([type,handler,capture])=>root.addEventListener(type,handler,capture));
 document.addEventListener('visibilitychange',schedule);const motionChanged=()=>{update();schedule();};motion.addEventListener('change',motionChanged);
 const observer=typeof IntersectionObserver!=='undefined'?new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;schedule();},{threshold:.1}):null;
 if(observer)observer.observe(root);else visible=true;
 update();show(0);
 return ()=>{disposed=true;clearTimeout(timer);observer?.disconnect();handlers.forEach(([type,handler,capture])=>root.removeEventListener(type,handler,capture));document.removeEventListener('visibilitychange',schedule);motion.removeEventListener('change',motionChanged);layers.forEach(img=>{img.onload=null;img.onerror=null;});};
}
