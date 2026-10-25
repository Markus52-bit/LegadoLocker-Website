export let collections=[{id:'fallen-angel',name:'Fallen Angel',description:'Collection 001. Angel artwork, wings, and celestial details.',published:true}];
export let products=[
 {id:'tee-black',name:'Fallen Angel Tee',color:'Black',kind:'tee',image:'tee-black.webp'},
 {id:'tee-white',name:'Fallen Angel Tee',color:'White',kind:'tee',image:'tee-white.webp'},
 {id:'cap-black',name:'Fallen Angel Cap',color:'Black',kind:'cap',image:'cap-black.webp'},
 {id:'cap-white',name:'Fallen Angel Cap',color:'White',kind:'cap',image:'cap-white.webp'}
].map(p=>({...p,collectionId:'fallen-angel',sizes:p.kind==='cap'?['Adjustable']:['S','M','L','XL','XXL'],description:'',price:null,currency:'USD',published:true}));
export function setCatalog(catalog){collections=catalog.collections;products=catalog.products;}
export function validBag(value){return Array.isArray(value)?value.filter(item=>products.some(p=>p.id===item.id&&p.sizes.includes(item.size))&&Number.isInteger(item.quantity)&&item.quantity>0&&item.quantity<=99):[];}
export function addItem(bag,id,size){const next=validBag(bag).map(item=>({...item}));const item=next.find(item=>item.id===id&&item.size===size);if(item)item.quantity=Math.min(99,item.quantity+1);else next.push({id,size,quantity:1});return validBag(next);}

export function currencyFactor(currency){return 10**new Intl.NumberFormat('en',{style:'currency',currency}).resolvedOptions().maximumFractionDigits;}
