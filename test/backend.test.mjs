import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomBytes} from 'node:crypto';
import {createStore} from '../backend/store.mjs';
import {createApp} from '../server.mjs';
async function fixture(t,options={}){
 const directory=await mkdtemp(path.join(os.tmpdir(),'legado-test-'));const filename=path.join(directory,'db.sqlite');await mkdir(path.join(directory,'uploads'));
 const store=createStore(filename);const password=randomBytes(20).toString('hex');await store.setPassword(password);
 const server=createApp({store,uploadsDirectory:path.join(directory,'uploads'),...options});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));store.close();await rm(directory,{recursive:true,force:true});});
 let cookie='';
 const request=(route,method='GET',body,headers={})=>fetch(base+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...headers},body:body?JSON.stringify(body):undefined});
 const login=async()=>{const response=await request('/api/admin/login','POST',{password});assert.equal(response.status,200);cookie=response.headers.get('set-cookie').split(';')[0];return response;};
 return {store,request,login,directory,filename,password,base};
}
test('owner sign-in, protected mutations, CSRF protection, and logout',async t=>{
 const f=await fixture(t);assert.equal((await f.request('/api/admin/catalog')).status,401);assert.equal((await f.request('/api/admin/collections','POST',{name:'No access'})).status,401);
 assert.equal((await f.request('/api/admin/login','POST',{password:'incorrect'})).status,401);
 const login=await f.login();assert.match(login.headers.get('set-cookie'),/HttpOnly/);assert.match(login.headers.get('set-cookie'),/SameSite=Strict/);
 assert.equal((await f.request('/api/admin/session')).status,200);
 assert.equal((await f.request('/api/admin/collections','POST',{name:'Evil origin'},{Origin:'https://evil.example'})).status,403);
 assert.equal((await f.request('/api/admin/logout','POST',{})).status,200);assert.equal((await f.request('/api/admin/catalog')).status,401);
});
test('draft and publish workflow, validation, updates, deletion and collection integrity',async t=>{
 const f=await fixture(t);await f.login();const collection=await (await f.request('/api/admin/collections','POST',{name:'Night Shift',description:'New drop',published:false})).json();
 const body={name:'Afterhours Hoodie',description:'Heavy graphic',color:'Ash',kind:'hoodie',collectionId:collection.id,sizes:['M','L'],price:6500,currency:'USD',image:'',published:true};
 const created=await f.request('/api/admin/products','POST',body);assert.equal(created.status,201);const product=await created.json();
 let catalog=await (await f.request('/api/catalog')).json();assert.ok(!catalog.products.some(p=>p.id===product.id));
 assert.equal((await f.request('/api/admin/collections/'+collection.id,'PUT',{...collection,published:true})).status,200);
 catalog=await (await f.request('/api/catalog')).json();assert.equal(catalog.products.find(p=>p.id===product.id).price,6500);
 assert.equal((await f.request('/api/admin/products/'+product.id,'PUT',{...body,name:'Renamed Hoodie',published:false})).status,200);
 catalog=await (await f.request('/api/catalog')).json();assert.ok(!catalog.products.some(p=>p.id===product.id));
 assert.equal((await f.request('/api/admin/products','POST',{...body,price:-1})).status,400);
 assert.equal((await f.request('/api/admin/products','POST',{...body,collectionId:'does-not-exist'})).status,400);
 assert.equal((await f.request('/api/admin/products','POST',{...body,image:'javascript:alert(1)'})).status,400);
 assert.equal((await f.request('/api/admin/products','POST',{...body,sizes:[]})).status,400);
 assert.equal((await f.request('/api/admin/collections/'+collection.id,'DELETE',{})).status,409);
 assert.equal((await f.request('/api/admin/products/'+product.id,'DELETE',{})).status,200);
 assert.equal((await f.request('/api/admin/collections/'+collection.id,'DELETE',{})).status,200);
 assert.equal((await f.request('/api/admin/products/'+product.id,'DELETE',{})).status,404);
});
test('uploads require auth, validate images, persist bytes and stay outside static source',async t=>{
 const f=await fixture(t);const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6p0AAAAASUVORK5CYII=','base64');
 assert.equal((await f.request('/api/admin/upload','POST',{data:png.toString('base64')})).status,401);await f.login();
 assert.equal((await f.request('/api/admin/upload','POST',{data:Buffer.from('<svg/>').toString('base64')})).status,400);
 const result=await f.request('/api/admin/upload','POST',{data:png.toString('base64')});assert.equal(result.status,201);const uploaded=await result.json();
 const photo=await f.request(uploaded.image);assert.equal(photo.status,200);assert.equal(photo.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await photo.arrayBuffer()),png);
 assert.deepEqual(await readFile(path.join(f.directory,uploaded.image)),png);
 assert.equal((await f.request('/api/admin/upload','POST',{data:Buffer.alloc(5*1024*1024+1).toString('base64')})).status,413);
 assert.equal((await f.request('/data/legado.sqlite')).status,404);
});
test('database and password survive reopening; password changes revoke sessions',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'legado-persist-'));t.after(()=>rm(dir,{recursive:true,force:true}));const file=path.join(dir,'store.sqlite');let store=createStore(file);const password=randomBytes(18).toString('hex');await store.setPassword(password);
 store.put('collections',{id:'persisted',name:'Still here',description:'',published:false});const token=store.newSession();store.close();store=createStore(file);try{assert.equal(store.get('collections','persisted').name,'Still here');assert.equal(await store.verifyPassword(password),true);assert.equal(store.session(token),true);await store.setPassword(randomBytes(18).toString('hex'));assert.equal(store.session(token),false);assert.equal(await store.verifyPassword(password),false);}finally{store.close();}
});
test('sign-in attempts are rate limited',async t=>{const f=await fixture(t);for(let i=0;i<10;i++)assert.equal((await f.request('/api/admin/login','POST',{password:'bad'})).status,401);const response=await f.request('/api/admin/login','POST',{password:'bad'});assert.equal(response.status,429);assert.ok(response.headers.get('retry-after'));});
test('production cookies are secure and enforce configured origin',async t=>{const f=await fixture(t,{production:true,publicOrigin:'https://shop.example'});const response=await f.request('/api/admin/login','POST',{password:f.password},{Origin:'https://shop.example'});assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),/; Secure/);assert.equal((await f.request('/api/admin/login','POST',{password:f.password},{Origin:f.base})).status,403);});

test('product galleries preserve ordered photos, legacy covers and existing data across restart',async t=>{
 const f=await fixture(t);await f.login();const original=f.store.get('products','tee-black');assert.deepEqual(original.images,['tee-black.webp']);
 const images=Array.from({length:301},(_,i)=>`detail-${i}.webp`);const body={...original,images:[...images,images[0]]};const result=await f.request('/api/admin/products/tee-black','PUT',body);assert.equal(result.status,200);const saved=await result.json();assert.deepEqual(saved.images,images);assert.equal(saved.image,images[0]);
 const catalog=await(await f.request('/api/catalog')).json();assert.deepEqual(catalog.products.find(p=>p.id==='tee-black').images,images);
 const reopened=createStore(f.filename);try{assert.deepEqual(reopened.get('products','tee-black').images,images);}finally{reopened.close();}
 const {images:ignored,...legacy}=saved;const edited=await(await f.request('/api/admin/products/tee-black','PUT',{...legacy,name:'Legacy edit'})).json();assert.deepEqual(edited.images,images);
 assert.equal((await f.request('/api/admin/products/tee-black','PUT',{...saved,images:'not-an-array'})).status,400);
 assert.equal((await f.request('/api/admin/products/tee-black','PUT',{...saved,images:['javascript:alert(1)']})).status,400);
 assert.equal((await f.request('/api/admin/products/tee-black','PUT',{...saved,images:['']})).status,400);
 const cleared=await(await f.request('/api/admin/products/tee-black','PUT',{...saved,images:[]})).json();assert.deepEqual(cleared.images,[]);assert.equal(cleared.image,'');
});

test('footer links require owner access, validate destinations and persist without changing store data',async t=>{
 const f=await fixture(t);const links=[{id:'support',label:'Help & FAQs',url:'/#collection',group:'support',newTab:false},{id:'contact',label:'Contact us',url:'mailto:hello@example.com',group:'contact',newTab:false},{id:'instagram',label:'Instagram',url:'https://www.instagram.com/legadolocker/',group:'social',newTab:true},{id:'phone',label:'Call us',url:'tel:+15551234567',group:'contact',newTab:false}];
 assert.equal((await f.request('/api/admin/footer-links')).status,401);assert.equal((await f.request('/api/admin/footer-links','PUT',{links})).status,401);assert.deepEqual(await(await f.request('/api/footer-links')).json(),{links:[]});
 await f.login();const saved=await f.request('/api/admin/footer-links','PUT',{links});assert.equal(saved.status,200);assert.deepEqual((await saved.json()).links,links);assert.deepEqual((await(await f.request('/api/footer-links')).json()).links,links);
 const reopened=createStore(f.filename);try{assert.deepEqual(JSON.parse(reopened.db.prepare("SELECT value FROM settings WHERE key='footer-links'").get().value),links);assert.equal(await reopened.verifyPassword(f.password),true);assert.equal(reopened.catalog().products.length,4);}finally{reopened.close();}
 for(const url of ['javascript:alert(1)','data:text/html,<script>alert(1)</script>','//evil.example','/\\evil.example','https://user:password@example.com'])assert.equal((await f.request('/api/admin/footer-links','PUT',{links:[{...links[0],url}]})).status,400);
 assert.equal((await f.request('/api/admin/footer-links','PUT',{links:[{...links[0],group:'unknown'}]})).status,400);assert.equal((await f.request('/api/admin/footer-links','PUT',{links:[links[0],links[0]]})).status,400);
 assert.deepEqual((await(await f.request('/api/footer-links')).json()).links,links,'invalid updates must leave existing links intact');
 const reordered=[links[2],links[0]];assert.equal((await f.request('/api/admin/footer-links','PUT',{links:reordered})).status,200);assert.deepEqual((await(await f.request('/api/footer-links')).json()).links,reordered);
 assert.equal((await f.request('/api/admin/footer-links','PUT',{links:[]})).status,200);assert.deepEqual((await(await f.request('/api/footer-links')).json()).links,[]);
});
