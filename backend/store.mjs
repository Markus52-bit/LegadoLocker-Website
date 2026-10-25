import {DatabaseSync} from 'node:sqlite';
import {randomBytes,createHash,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {products as initialProducts} from '../public/catalog.js';
import {productPhotos} from '../public/photos.js';
const normalizeProduct=p=>({...p,images:productPhotos(p)});
const scrypt=promisify(scryptCallback);
export const digest=token=>createHash('sha256').update(token).digest('hex');
export function createStore(filename){
 const db=new DatabaseSync(filename);db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
 db.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS collections (id TEXT PRIMARY KEY, data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, collection_id TEXT NOT NULL REFERENCES collections(id), data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL);`);
 if(!db.prepare("SELECT value FROM settings WHERE key='seeded'").get()){
  db.exec('BEGIN');try{
   db.prepare('INSERT INTO collections VALUES (?,?)').run('fallen-angel',JSON.stringify({id:'fallen-angel',name:'Fallen Angel',description:'Collection 001. Angel artwork, wings, and celestial details.',published:true}));
   const insert=db.prepare('INSERT INTO products VALUES (?,?,?)');
   for(const p of initialProducts)insert.run(p.id,'fallen-angel',JSON.stringify({...p,collectionId:'fallen-angel',description:'',sizes:p.kind==='cap'?['Adjustable']:['S','M','L','XL','XXL'],price:null,currency:'USD',published:true}));
   db.prepare('INSERT INTO settings VALUES (?,?)').run('seeded','yes');db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
 }
 const store={
  db,
  list(type){return db.prepare(`SELECT data FROM ${type==='products'?'products':'collections'} ORDER BY rowid`).all().map(row=>{const item=JSON.parse(row.data);return type==='products'?normalizeProduct(item):item;});},
  catalog(){const collections=store.list('collections').filter(c=>c.published);return {collections,products:store.list('products').filter(p=>p.published&&collections.some(c=>c.id===p.collectionId))};},
  get(type,id){const row=db.prepare(`SELECT data FROM ${type==='products'?'products':'collections'} WHERE id=?`).get(id);return row?(type==='products'?normalizeProduct(JSON.parse(row.data)):JSON.parse(row.data)):null;},
  put(type,item){if(type==='products')db.prepare('INSERT INTO products VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET collection_id=excluded.collection_id,data=excluded.data').run(item.id,item.collectionId,JSON.stringify(item));else db.prepare('INSERT INTO collections VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(item.id,JSON.stringify(item));return item;},
  remove(type,id){if(type==='collections'&&db.prepare('SELECT id FROM products WHERE collection_id=? LIMIT 1').get(id))return false;db.prepare(`DELETE FROM ${type==='products'?'products':'collections'} WHERE id=?`).run(id);return true;},
  hasPassword(){return !!db.prepare("SELECT value FROM settings WHERE key='password'").get();},
  async setPassword(password){if(typeof password!=='string'||password.length<12||password.length>256)throw Error('Use a password between 12 and 256 characters.');const salt=randomBytes(16).toString('hex');const hash=(await scrypt(password,salt,64)).toString('hex');db.prepare('INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('password',JSON.stringify({salt,hash}));db.exec('DELETE FROM sessions');},
  async verifyPassword(password){const row=db.prepare("SELECT value FROM settings WHERE key='password'").get();if(!row||typeof password!=='string'||password.length>256)return false;const {salt,hash}=JSON.parse(row.value);return timingSafeEqual(await scrypt(password,salt,64),Buffer.from(hash,'hex'));},
  newSession(){db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES (?,?)').run(digest(token),Date.now()+8*60*60*1000);return token;},
  session(token){if(!token||!/^[a-f0-9]{64}$/.test(token))return false;return !!db.prepare('SELECT token FROM sessions WHERE token=? AND expires>?').get(digest(token),Date.now());},
  logout(token){db.prepare('DELETE FROM sessions WHERE token=?').run(digest(token||''));},
  close(){db.close();}
 };return store;
}
