import http from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createStore} from './backend/store.mjs';
import {fail,validate,imageType} from './backend/validation.mjs';
import {createFeatures} from './backend/features.mjs';
const root=path.resolve(fileURLToPath(new URL('./public/',import.meta.url)));
export const dataDirectory=path.resolve(process.env.DATA_DIR||fileURLToPath(new URL('./data/',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
async function jsonBody(req){
 if(!req.headers['content-type']?.startsWith('application/json'))fail('Use application/json.',415);
 const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>7*1024*1024)fail('Request too large. Maximum photo size is 5 MB.',413);chunks.push(chunk);}
 let body;try{body=JSON.parse(Buffer.concat(chunks).toString());}catch{fail('Invalid JSON.');}if(!body||typeof body!=='object'||Array.isArray(body))fail('Expected a JSON object.');return body;
}
export function createApp({store,uploadsDirectory,publicOrigin=process.env.PUBLIC_ORIGIN,production=process.env.NODE_ENV==='production',mailer,paymentConfig}={}){
 if(publicOrigin){const origin=new URL(publicOrigin);if(origin.origin!==publicOrigin||(production&&origin.protocol!=='https:'))throw Error('PUBLIC_ORIGIN must be an exact origin without a trailing slash and use HTTPS in production.');}
 const features=createFeatures({store,origin:publicOrigin,production,mailer,paymentConfig});
 const attempts=new Map();
 const app=http.createServer(async(req,res)=>{
  const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
  try{
   const url=new URL(req.url,'http://localhost');const route=url.pathname;
   if(route==='/api/health'&&req.method==='GET'){store.db.prepare('SELECT 1').get();return send(200,{status:'ok'});}
   if(route==='/api/catalog'&&req.method==='GET')return send(200,store.catalog());
   if(route==='/api/stripe/webhook'&&req.method==='POST'){
    const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>1024*1024)fail('Webhook too large.',413);chunks.push(chunk);}return send(200,await features.payments.webhook(Buffer.concat(chunks),req.headers['stripe-signature']));
   }
   if(route.startsWith('/api/')){
    res.setHeader('Cache-Control','no-store');
    if(!['GET','HEAD'].includes(req.method)&&route!=='/api/email/unsubscribe'){
     // Require JSON and a same-origin browser request. No CORS is enabled.
     if(production&&!publicOrigin)fail('Set PUBLIC_ORIGIN to the HTTPS website origin before administering production.',503);
     const expected=publicOrigin||`http://${req.headers.host}`;
     if(req.headers.origin&&req.headers.origin!==expected)fail('Cross-origin request rejected.',403);
     if(req.headers['sec-fetch-site']==='cross-site')fail('Cross-site request rejected.',403);
    }
    const token=(req.headers.cookie||'').split(';').map(c=>c.trim()).find(c=>c.startsWith('legado_session='))?.slice(15);
    const authenticated=store.session(token);
    const cookie=(value,age)=>`legado_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${production?'; Secure':''}`;
    if(route==='/api/admin/login'&&req.method==='POST'){
     if(!store.hasPassword())fail('Admin is not configured. Set the owner password on the server.',503);
     const key=req.socket.remoteAddress;const now=Date.now();for(const [ip,a]of attempts)if(a.until<now)attempts.delete(ip);
     const attempt=attempts.get(key)||{count:0,until:now+15*60*1000};if(attempt.count>=10){res.setHeader('Retry-After',String(Math.ceil((attempt.until-now)/1000)));fail('Too many sign-in attempts. Try again later.',429);}
     const body=await jsonBody(req);attempt.count++;attempts.set(key,attempt);
     if(!await store.verifyPassword(body.password))fail('Incorrect password.',401);
     attempts.delete(key);res.setHeader('Set-Cookie',cookie(store.newSession(),28800));return send(200,{ok:true});
    }
    if(await features.handle({req,res,route,url,send,authenticated,jsonBody}))return;
    if(!authenticated)fail('Sign in to manage your store.',401);
    if(route==='/api/admin/session'&&req.method==='GET')return send(200,{authenticated:true});
    if(route==='/api/admin/logout'&&req.method==='POST'){await jsonBody(req);store.logout(token);res.setHeader('Set-Cookie',cookie('',0));return send(200,{ok:true});}
    if(route==='/api/admin/catalog'&&req.method==='GET')return send(200,{collections:store.list('collections'),products:store.list('products')});
    if(route==='/api/admin/upload'&&req.method==='POST'){
     const body=await jsonBody(req);if(typeof body.data!=='string'||!body.data||!/^[A-Za-z0-9+/]*={0,2}$/.test(body.data))fail('Invalid image data.');
     const bytes=Buffer.from(body.data,'base64');if(bytes.length>5*1024*1024)fail('Maximum photo size is 5 MB.',413);
     const extension=imageType(bytes);const filename=randomUUID()+'.'+extension;await writeFile(path.join(uploadsDirectory,filename),bytes,{flag:'wx',mode:0o600});return send(201,{image:'/uploads/'+filename});
    }
    const match=route.match(/^\/api\/admin\/(collections|products)(?:\/([a-zA-Z0-9-]+))?$/);
    if(match){const[,type,id]=match;
     if(req.method==='POST'&&!id){const item=validate(type,await jsonBody(req),null,store);return send(201,store.put(type,item));}
     if(id&&['PUT','DELETE'].includes(req.method)){
      if(!store.get(type,id))fail('Item not found.',404);
      const body=await jsonBody(req);
      if(req.method==='PUT')return send(200,store.put(type,validate(type,body,id,store)));
      if(!store.remove(type,id))fail('Move or delete this collection’s products first.',409);return send(200,{ok:true});
     }
    }
    fail('Endpoint not found.',404);
   }
   if(!['GET','HEAD'].includes(req.method)&&route!=='/api/email/unsubscribe'){res.setHeader('Allow','GET, HEAD');fail('Method not allowed.',405);}
   let file;
   if(/^\/uploads\/[a-f0-9-]+\.(png|jpg|webp)$/.test(route))file=path.join(uploadsDirectory,path.basename(route));
   else{const name=route==='/'?'/index.html':route==='/admin'||route==='/admin/'?'/admin/index.html':route==='/account'||route==='/account/'||route==='/unsubscribe'?'/account/index.html':route;file=path.resolve(root,'.'+decodeURIComponent(name));if(!file.startsWith(root+path.sep))fail('Forbidden.',403);}
   const body=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':route.startsWith('/uploads/')?'public, max-age=31536000, immutable':'no-cache'});res.end(req.method==='HEAD'?undefined:body);
  }catch(error){if(!error.status&&error.code!=='ENOENT'&&error.code!=='EISDIR')console.error('Request failed:',error.code||'internal error');send(error.status||(['ENOENT','EISDIR'].includes(error.code)?404:500),{error:error.status?error.message:['ENOENT','EISDIR'].includes(error.code)?'Not found.':'Server error.'});}
 });app.requestTimeout=30000;return app;
}
// Tests use their own temporary stores. Importing this file has no disk side effects.
if(process.argv[1]===fileURLToPath(import.meta.url)){
 await mkdir(path.join(dataDirectory,'uploads'),{recursive:true,mode:0o700});
 const store=createStore(path.join(dataDirectory,'legado.sqlite'));
 if(process.env.ADMIN_PASSWORD&&!store.hasPassword())await store.setPassword(process.env.ADMIN_PASSWORD);
 const app=createApp({store,uploadsDirectory:path.join(dataDirectory,'uploads')});
 app.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Legado Locker listening on port '+(process.env.PORT||3000)));
 const stop=()=>app.close(()=>{store.close();process.exit(0);});process.on('SIGTERM',stop);process.on('SIGINT',stop);
}
