import test from 'node:test';
import assert from 'node:assert/strict';
import {addItem,validBag} from '../public/catalog.js';
import {createApp} from '../server.mjs';
import {createStore} from '../backend/store.mjs';
test('bag combines matching variants and preserves distinct sizes',()=>{
 let bag=addItem([],'tee-black','M');bag=addItem(bag,'tee-black','M');bag=addItem(bag,'tee-black','L');assert.deepEqual(bag,[{id:'tee-black',size:'M',quantity:2},{id:'tee-black',size:'L',quantity:1}]);
});
test('bag rejects corrupt stored data and invalid variants',()=>{assert.deepEqual(validBag([{id:'unknown',size:'M',quantity:1},{id:'cap-black',size:'M',quantity:1},{id:'tee-black',size:'M',quantity:-1}]),[]);assert.deepEqual(validBag(null),[]);});
test('quantity stays capped',()=>assert.equal(addItem([{id:'cap-black',size:'Adjustable',quantity:99}],'cap-black','Adjustable')[0].quantity,99));
test('HTTP serves store, code and actual logo; missing paths return 404',async()=>{
 const store=createStore(':memory:');const server=createApp({store});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try {const base='http://127.0.0.1:'+server.address().port;const page=await fetch(base);assert.equal(page.status,200);assert.match(await page.text(),/id="hero-title"/);const logo=await fetch(base+'/assets/logo.jpg');assert.equal(logo.headers.get('content-type'),'image/jpeg');assert.ok((await logo.arrayBuffer()).byteLength>1000);const script=await fetch(base+'/app.js');assert.equal(script.status,200);assert.equal((await fetch(base+'/missing')).status,404);assert.equal((await fetch(base+'/package.json')).status,404);}finally{await new Promise(resolve=>server.close(resolve));store.close();}
});

test('GitHub Pages entry point matches storefront and resolves its assets',async()=>{
 const {readFile}=await import('node:fs/promises');
 const page=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const development=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 assert.equal(page,development.replace('href="./style.css"','href="./public/style.css"').replace('src="./app.js"','src="./public/app.js"').replace('src="./assets/logo.jpg"','src="./public/assets/logo.jpg"'));
 for(const match of page.matchAll(/(?:src|href)="(\.\/[^\"]+)"/g)) assert.ok((await readFile(new URL('../'+match[1],import.meta.url))).length>0);

});

test('currency pricing uses the correct minor-unit precision',async()=>{
 const {currencyFactor}=await import('../public/catalog.js');assert.equal(currencyFactor('USD'),100);assert.equal(currencyFactor('JPY'),1);assert.equal(currencyFactor('KWD'),1000);
});
