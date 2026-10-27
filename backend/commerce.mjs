import {randomBytes,randomUUID,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {digest} from './store.mjs';
import {fail} from './validation.mjs';
const scrypt=promisify(scryptCallback);
const now=()=>new Date().toISOString();
export function text(value,label,max=200,optional=false){if(typeof value!=='string'||value.trim().length>max||(!optional&&!value.trim()))fail(`${label} is required (maximum ${max} characters).`);return value.trim();}
export function email(value){const result=text(value,'Email',254).toLowerCase();if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(result))fail('Enter a valid email address.');return result;}
function amount(value,label){if(!Number.isSafeInteger(value)||value<0||value>100000000)fail(`${label} must be a non-negative whole number in minor currency units.`);return value;}
export function createCommerce(store){
 const db=store.db;
 db.exec(`CREATE TABLE IF NOT EXISTS customers(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,data TEXT NOT NULL,password TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS customer_sessions(token TEXT PRIMARY KEY,customer_id TEXT NOT NULL REFERENCES customers(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS customer_tokens(token TEXT PRIMARY KEY,customer_id TEXT NOT NULL REFERENCES customers(id),kind TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS unsubscribe_tokens(token TEXT PRIMARY KEY,customer_id TEXT NOT NULL REFERENCES customers(id));
 CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS campaigns(id TEXT PRIMARY KEY,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS discounts(id TEXT PRIMARY KEY,code TEXT NOT NULL UNIQUE,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS campaign_recipients(campaign_id TEXT NOT NULL REFERENCES campaigns(id),customer_id TEXT NOT NULL REFERENCES customers(id),data TEXT NOT NULL,PRIMARY KEY(campaign_id,customer_id));`);
 const tables=new Set(['orders','campaigns','discounts']);
 const api={
  list(type){if(!tables.has(type))throw Error('Invalid table');return db.prepare(`SELECT data FROM ${type} ORDER BY rowid DESC`).all().map(r=>JSON.parse(r.data));},
  get(type,id){if(!tables.has(type))throw Error('Invalid table');const row=db.prepare(`SELECT data FROM ${type} WHERE id=?`).get(id);return row?JSON.parse(row.data):null;},
  put(type,item){if(!tables.has(type))throw Error('Invalid table');if(type==='discounts')db.prepare('INSERT INTO discounts VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET code=excluded.code,data=excluded.data').run(item.id,item.code,JSON.stringify(item));else db.prepare(`INSERT INTO ${type} VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data`).run(item.id,JSON.stringify(item));return item;},
  customers(){return db.prepare('SELECT data FROM customers ORDER BY rowid DESC').all().map(r=>JSON.parse(r.data));},
  customer(id){const row=db.prepare('SELECT data FROM customers WHERE id=?').get(id);return row?JSON.parse(row.data):null;},
  findCustomer(address){const row=db.prepare('SELECT data FROM customers WHERE email=?').get(address);return row?JSON.parse(row.data):null;},
  saveCustomer(customer){db.prepare('UPDATE customers SET data=? WHERE id=?').run(JSON.stringify(customer),customer.id);return customer;},
  async hashPassword(password){if(typeof password!=='string'||password.length<12||password.length>256)fail('Use a password between 12 and 256 characters.');const salt=randomBytes(16).toString('hex');return JSON.stringify({salt,hash:(await scrypt(password,salt,64)).toString('hex')});},
  async register(input){const address=email(input.email);const name=text(input.name,'Name',100);const hash=await api.hashPassword(input.password);if(api.findCustomer(address))return null;const customer={id:randomUUID(),email:address,name,verified:false,marketingConsent:input.marketingConsent===true,consentUpdatedAt:now(),createdAt:now()};db.prepare('INSERT INTO customers VALUES (?,?,?,?)').run(customer.id,address,JSON.stringify(customer),hash);return customer;},
  async login(address,password){const customer=api.findCustomer(email(address));const row=customer?db.prepare('SELECT password FROM customers WHERE id=?').get(customer.id):null;
   const saved=row?JSON.parse(row.password):{salt:'invalid-account-placeholder',hash:'0'.repeat(128)};
   if(typeof password!=='string'||password.length>256)return null;const valid=timingSafeEqual(await scrypt(password,saved.salt,64),Buffer.from(saved.hash,'hex'));if(valid&&customer&&!customer.verified)fail('Your password is correct, but your email needs verification. Open the verification email and press Verify email, then sign in. If needed, use Resend verification below.',403);return valid&&customer?customer:null;},
  newSession(customerId){db.prepare('DELETE FROM customer_sessions WHERE expires<?').run(Date.now());const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO customer_sessions VALUES (?,?,?)').run(digest(token),customerId,Date.now()+7*86400000);return token;},
  session(token){if(!token||!/^[a-f0-9]{64}$/.test(token))return null;const row=db.prepare('SELECT customer_id FROM customer_sessions WHERE token=? AND expires>?').get(digest(token),Date.now());return row?api.customer(row.customer_id):null;},
  logout(token){db.prepare('DELETE FROM customer_sessions WHERE token=?').run(digest(token||''));},
  token(customerId,kind){const token=randomBytes(32).toString('hex');db.prepare('DELETE FROM customer_tokens WHERE expires<?').run(Date.now());db.prepare('DELETE FROM customer_tokens WHERE customer_id=? AND kind=?').run(customerId,kind);db.prepare('INSERT INTO customer_tokens VALUES (?,?,?,?)').run(digest(token),customerId,kind,Date.now()+(kind==='verify'?86400000:3600000));return token;},
  async consume(token,kind,password){if(typeof token!=='string')fail('Invalid or expired link.');const row=db.prepare('SELECT customer_id FROM customer_tokens WHERE token=? AND kind=? AND expires>?').get(digest(token),kind,Date.now());if(!row)fail('Invalid or expired link.');const hash=kind==='reset'?await api.hashPassword(password):null;
   db.exec('BEGIN IMMEDIATE');try{const removed=db.prepare('DELETE FROM customer_tokens WHERE token=?').run(digest(token));if(!removed.changes)fail('This link has already been used.');const customer=api.customer(row.customer_id);if(kind==='verify'){customer.verified=true;api.saveCustomer(customer);}else{db.prepare('UPDATE customers SET password=? WHERE id=?').run(hash,customer.id);db.prepare('DELETE FROM customer_sessions WHERE customer_id=?').run(customer.id);}db.exec('COMMIT');return customer;}catch(error){db.exec('ROLLBACK');throw error;}
  },
  unsubscribeToken(customer){const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO unsubscribe_tokens VALUES (?,?)').run(digest(token),customer.id);return token;},
  unsubscribe(token){if(typeof token!=='string'||token.length>100)fail('Invalid unsubscribe link.');const row=db.prepare('SELECT customer_id FROM unsubscribe_tokens WHERE token=?').get(digest(token));const customer=row?api.customer(row.customer_id):null;if(!customer)fail('Invalid unsubscribe link.');customer.marketingConsent=false;customer.consentUpdatedAt=now();api.saveCustomer(customer);},
  discount(input,id){const code=text(input.code,'Code',40).toUpperCase();if(!/^[A-Z0-9_-]{3,40}$/.test(code))fail('Use 3–40 letters, digits, underscores or hyphens for a code.');const percent=amount(input.percent,'Percentage');if(percent<1||percent>100)fail('Discount percentage must be between 1 and 100.');let expiresAt=null;if(input.expiresAt){const parsed=new Date(input.expiresAt);if(!Number.isFinite(parsed.getTime()))fail('Enter a valid expiration date.');expiresAt=parsed.toISOString();}
   const duplicate=db.prepare('SELECT id FROM discounts WHERE code=?').get(code);if(duplicate&&duplicate.id!==id)fail('That code already exists.');return api.put('discounts',{id:id||randomUUID(),code,percent,active:input.active===true,expiresAt,createdAt:now()});},
  createOrder(input){
   const address=email(input.email),name=text(input.name,'Customer name',100),currency=text(input.currency||'USD','Currency',3).toUpperCase();try{new Intl.NumberFormat('en',{style:'currency',currency});}catch{fail('Invalid currency.');}
   if(!Array.isArray(input.items)||!input.items.length||input.items.length>100)fail('Add between 1 and 100 order items.');
   const items=input.items.map(item=>({name:text(item.name,'Item name',150),sku:text(item.sku||'','SKU',100,true),size:text(item.size||'','Size',30,true),quantity:amount(item.quantity,'Quantity'),unitPrice:amount(item.unitPrice,'Unit price')}));if(items.some(i=>i.quantity<1||i.quantity>999))fail('Quantity must be between 1 and 999.');
   const subtotal=items.reduce((sum,item)=>sum+item.quantity*item.unitPrice,0);amount(subtotal,'Subtotal');const shipping=amount(input.shipping||0,'Shipping'),tax=amount(input.tax||0,'Tax');const code=String(input.discountCode||'').trim().toUpperCase();const offer=code?api.list('discounts').find(d=>d.code===code&&d.active&&(!d.expiresAt||new Date(d.expiresAt)>new Date())):null;if(code&&!offer)fail('Discount code is invalid or expired.');const discount=offer?Math.round(subtotal*offer.percent/100):0;const total=amount(subtotal-discount+shipping+tax,'Total');
   const order={id:randomUUID(),number:'LL-'+randomBytes(5).toString('hex').toUpperCase(),createdAt:now(),updatedAt:now(),source:'manual',sourceReference:text(input.sourceReference||'','Source reference',200,true),email:address,name,items,currency,subtotal,shipping,tax,discount,discountCode:code,total,paymentStatus:'unpaid',refunded:0,status:'new',shippingAddress:text(input.shippingAddress||'','Shipping address',2000,true),carrier:'',trackingNumber:'',trackingUrl:'',timeline:[{at:now(),event:'Order recorded manually. Payment has not been verified.'}]};return api.put('orders',order);
  },
  updateOrder(order,input){const statuses=['new','processing','shipped','delivered','cancelled','returned'];if(!statuses.includes(input.status))fail('Invalid order status.');if(!['unpaid','failed','paid','partially_refunded','refunded'].includes(input.paymentStatus))fail('Invalid payment status.');
   const refunded=amount(input.refunded||0,'Refund amount');if(refunded>order.total)fail('Refund cannot exceed the order total.');if((input.paymentStatus==='refunded'&&refunded!==order.total)||(input.paymentStatus==='partially_refunded'&&(refunded<=0||refunded>=order.total))||(['paid','unpaid','failed'].includes(input.paymentStatus)&&refunded!==0))fail('Refund amount must match the payment status.');if(['shipped','delivered'].includes(input.status)&&['unpaid','failed'].includes(input.paymentStatus))fail('Record payment before marking an order shipped.');
   const trackingUrl=text(input.trackingUrl||'','Tracking URL',1000,true);if(trackingUrl){try{if(new URL(trackingUrl).protocol!=='https:')fail('Tracking URLs must use HTTPS.');}catch{fail('Enter a valid HTTPS tracking URL.');}}
   const next={...order,status:input.status,paymentStatus:input.paymentStatus,refunded,paymentReference:text(input.paymentReference||'','Payment reference',300,true),carrier:text(input.carrier||'','Carrier',100,true),trackingNumber:text(input.trackingNumber||'','Tracking number',150,true),trackingUrl,updatedAt:now()};const note=text(input.note||'','Note',2000,true);next.timeline=[...order.timeline,{at:now(),event:`Status: ${next.status}; payment: ${next.paymentStatus}; refund: ${refunded}. Recorded manually.`,note,carrier:next.carrier,trackingNumber:next.trackingNumber,paymentReference:next.paymentReference}];return api.put('orders',next);
  },
  customerOrders(customer){return api.list('orders').filter(o=>o.email===customer.email).map(({timeline,paymentReference,sourceReference,stripeSessionId,stripePaymentIntent,shopifyAdminUrl,...o})=>o);},
  recipients(id){return db.prepare('SELECT data FROM campaign_recipients WHERE campaign_id=?').all(id).map(r=>JSON.parse(r.data));},
  recipient(id,customerId,data){db.prepare('INSERT INTO campaign_recipients VALUES (?,?,?) ON CONFLICT(campaign_id,customer_id) DO UPDATE SET data=excluded.data').run(id,customerId,JSON.stringify(data));}
 };return api;
}
