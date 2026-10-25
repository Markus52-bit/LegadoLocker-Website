import {randomUUID} from 'node:crypto';
export function fail(message,status=400){throw Object.assign(new Error(message),{status});}
const text=(value,name,max=200,required=true)=>{if(typeof value!=='string'||value.trim().length>max||(required&&!value.trim()))fail(`${name} is required and must be at most ${max} characters.`);return value.trim();};
export function validate(type,input,id,store){
 if(!input||typeof input!=='object'||Array.isArray(input))fail('Expected an object.');
 const item={id:id||randomUUID(),name:text(input.name,'Name',100),description:text(input.description??'','Description',2000,false),published:input.published===true};
 if(type==='collections')return item;
 if(!store.get('collections',input.collectionId))fail('Select an existing collection.');
 if(!['tee','cap','hoodie','other'].includes(input.kind))fail('Select a valid product category.');
 if(!Array.isArray(input.sizes)||input.sizes.length<1||input.sizes.length>20)fail('Add between 1 and 20 sizes.');
 const sizes=[...new Set(input.sizes.map(s=>text(s,'Size',30)))];
 const price=input.price===''||input.price===null||input.price===undefined?null:input.price;
 if(price!==null&&(!Number.isSafeInteger(price)||price<0||price>100000000))fail('Price must be a positive amount in minor currency units, or blank.');
 const currency=text(input.currency??'USD','Currency',3).toUpperCase();
 try{new Intl.NumberFormat('en',{style:'currency',currency});}catch{fail('Use a three-letter currency code.');}
 const existing=id?store.get('products',id):null;
 let supplied;
 if(Object.hasOwn(input,'images')){if(!Array.isArray(input.images))fail('Photos must be an array.');supplied=input.images;}
 else if(Object.hasOwn(input,'image'))supplied=input.image===existing?.image?existing.images:(input.image?[input.image]:[]);
 else supplied=existing?.images||[];
 const images=[...new Set(supplied.map(value=>{const image=text(value,'Photo',150);if(!/^(?:[\w-]+\.(?:webp|png|jpg|jpeg)|\/uploads\/[a-f0-9-]+\.(?:webp|png|jpg))$/.test(image))fail('Upload product photos or use bundled image filenames.');return image;}))];
 return {...item,kind:input.kind,color:text(input.color??'','Color',60,false),collectionId:input.collectionId,sizes,price,currency,images,image:images[0]||''};
}
export function imageType(bytes){
 if(bytes.length>8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'png';
 if(bytes.length>3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'jpg';
 if(bytes.length>12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'webp';
 fail('Use a PNG, JPEG, or WebP image.');
}
