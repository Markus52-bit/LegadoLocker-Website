import test from 'node:test';
import assert from 'node:assert/strict';
import {addItem,validBag} from '../public/catalog.js';
import {server} from '../server.mjs';
test('bag combines matching variants and preserves distinct sizes',()=>{
 let bag=addItem([],'tee-black','M');bag=addItem(bag,'tee-black','M');bag=addItem(bag,'tee-black','L');assert.deepEqual(bag,[{id:'tee-black',size:'M',quantity:2},{id:'tee-black',size:'L',quantity:1}]);
});
test('bag rejects corrupt stored data and invalid variants',()=>{assert.deepEqual(validBag([{id:'unknown',size:'M',quantity:1},{id:'cap-black',size:'M',quantity:1},{id:'tee-black',size:'M',quantity:-1}]),[]);assert.deepEqual(validBag(null),[]);});
test('quantity stays capped',()=>assert.equal(addItem([{id:'cap-black',size:'Adjustable',quantity:99}],'cap-black','Adjustable')[0].quantity,99));
test('HTTP serves store, code and actual logo; missing paths return 404',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try {const base='http://127.0.0.1:'+server.address().port;const page=await fetch(base);assert.equal(page.status,200);assert.match(await page.text(),/Fallen Angel/);const logo=await fetch(base+'/assets/logo.jpg');assert.equal(logo.headers.get('content-type'),'image/jpeg');assert.ok((await logo.arrayBuffer()).byteLength>1000);const script=await fetch(base+'/app.js');assert.equal(script.status,200);assert.equal((await fetch(base+'/missing')).status,404);assert.equal((await fetch(base+'/package.json')).status,404);}finally{await new Promise(resolve=>server.close(resolve));}
});
