export const products = [
  {id:'tee-black', name:'Fallen Angel Tee', color:'Black', kind:'tee', image:'tee-black.webp'},
  {id:'tee-white', name:'Fallen Angel Tee', color:'White', kind:'tee', image:'tee-white.webp'},
  {id:'cap-black', name:'Fallen Angel Cap', color:'Black', kind:'cap', image:'cap-black.webp'},
  {id:'cap-white', name:'Fallen Angel Cap', color:'White', kind:'cap', image:'cap-white.webp'}
];
export function validBag(value) {
  return Array.isArray(value) ? value.filter(item=>products.some(p=>p.id===item.id && (p.kind==='cap' ? item.size==='Adjustable' : ['S','M','L','XL','XXL'].includes(item.size))) && Number.isInteger(item.quantity) && item.quantity>0 && item.quantity<=99) : [];
}
export function addItem(bag,id,size) {
  const next = validBag(bag).map(item=>({...item}));
  const item = next.find(item=>item.id===id && item.size===size);
  if(item) item.quantity=Math.min(99,item.quantity+1); else next.push({id,size,quantity:1});
  return validBag(next);
}
