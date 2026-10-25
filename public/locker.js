export function initLocker() {
  const entrance = document.querySelector('#locker-entrance');
  const scene = document.querySelector('#locker-scene');
  const store = document.querySelector('#storefront');
  const shop = document.querySelector('#enter-shop');
  // Deep links open the requested section directly. Without JS the shop stays usable.
  if (location.hash) return;
  entrance.hidden = false;
  store.inert = true;
  document.body.classList.add('at-entrance');
  let opening = false;
  function open() {
    if (opening) return;
    opening = true;
    entrance.classList.add('opening');
    document.body.classList.add('entering-store');
    shop.setAttribute('aria-disabled', 'true');
    const finish = () => {
      entrance.hidden = true;
      store.inert = false;
      document.body.classList.remove('at-entrance', 'entering-store');
      const heading = store.querySelector('h1');
      heading.setAttribute('tabindex', '-1');
      heading.focus({preventScroll: true});
    };
    // Reduced motion preserves the same entry behavior without a moving door.
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) finish();
    else setTimeout(finish, 1650);
  }
  scene.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse' && matchMedia('(hover: hover) and (pointer: fine)').matches) open();
  });
  shop.addEventListener('click', open);
}
