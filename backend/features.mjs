import {readPromotions,savePromotions,livePromotions} from './promotions.mjs';
import {createShopify} from './shopify.mjs';
import {readFooterLinks,saveFooterLinks} from './footer-links.mjs';
import {randomUUID} from 'node:crypto';
import {createCommerce,email,text} from './commerce.mjs';
import {createMailer} from './mailer.mjs';
import {digest} from './store.mjs';
import {fail} from './validation.mjs';
import {createPayments} from './payments.mjs';
const date=()=>new Date().toISOString();
export function createFeatures({store,origin,production,mailer=createMailer(),paymentConfig=process.env}){
 const commerce=createCommerce(store),locks=new Set(),limits=new Map();
 const payments=createPayments({store,commerce,origin,config:paymentConfig});
 const shopify=createShopify({store,commerce,config:paymentConfig});
 const checkoutProvider=String(paymentConfig.CHECKOUT_PROVIDER||'stripe').trim().toLowerCase();
 const checkoutReady=()=>checkoutProvider==='shopify'?shopify.ready:checkoutProvider==='stripe'&&payments.ready;
 const marketingReady=()=>mailer.ready&&!!origin;
 function throttle(key,max=10){const at=Date.now();for(const [k,v]of limits)if(v.until<at)limits.delete(k);const entry=limits.get(key)||{count:0,until:at+15*60000};if(++entry.count>max)fail('Too many attempts. Please try again in 15 minutes.',429);limits.set(key,entry);}
 const customerCookie=(value,age)=>`legado_customer=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${production?'; Secure':''}`;
 const customerOf=req=>{const cookie=(req.headers.cookie||'').split(';').map(c=>c.trim()).find(c=>c.startsWith('legado_customer='));return commerce.session(cookie?.slice(16));};
 async function accountEmail(customer,kind){const token=commerce.token(customer.id,kind);const link=origin+'/account?'+(kind==='verify'?'verify':'reset')+'='+token;await mailer.send({to:customer.email,subject:kind==='verify'?'Verify your Legado Locker account':'Reset your Legado Locker password',text:`Hi ${customer.name},\n\n${kind==='verify'?'Verify your email address to finish creating your account':'Choose a new account password'}:\n${link}\n\n${kind==='verify'?'This link expires in 24 hours.':'This link expires in one hour.'}\nIf you did not request this, you can ignore this email.`,idempotencyKey:kind+'-'+token});}
 const overview=()=>({customers:commerce.customers().map(({unsubscribeHash,...c})=>c),orders:commerce.list('orders'),discounts:commerce.list('discounts'),campaigns:commerce.list('campaigns').map(c=>({...c,counts:commerce.recipients(c.id).reduce((counts,r)=>(counts[r.status]=(counts[r.status]||0)+1,counts),{})})),emailReady:mailer.ready,marketingReady:marketingReady(),checkoutReady:checkoutReady(),checkoutProvider,shopifyOrderSyncReady:shopify.orderSyncReady});
 return {
  commerce,payments,shopify,
  async handle({req,res,route,url,send,authenticated,jsonBody}){
   if(route==='/api/checkout'&&req.method==='POST'){if(checkoutProvider!=='shopify')fail('Shopify checkout is not enabled.',409);throttle('shopify-checkout:'+req.socket.remoteAddress,300);send(201,shopify.checkout(await jsonBody(req)));return true;}
   if(route==='/api/checkout/status'&&req.method==='POST'){send(200,shopify.status((await jsonBody(req)).checkoutToken));return true;}
   if(route==='/api/newsletter/subscribe'&&req.method==='POST'){
    if(!mailer.ready||!origin)fail('Email signup is temporarily unavailable. Please try again later.',503);
    throttle('newsletter-ip:'+req.socket.remoteAddress,20);const body=await jsonBody(req);const address=email(body.email);if(body.consent!==true)fail('Please agree to receive offers before subscribing.');throttle('newsletter-email:'+digest(address),5);
    const promotion=body.promotionId?livePromotions(store).find(p=>p.id===body.promotionId&&p.type==='signup'):null;if(body.promotionId&&!promotion)fail('This signup offer is no longer available. Refresh the page for current offers.',409);
    const customer=await commerce.subscribe(address);if(promotion||!customer.verified||!customer.marketingConsent){const token=commerce.token(customer.id,'subscribe');const offer=promotion?`${promotion.title}\n\n${promotion.body}\n\n${promotion.code?'Discount code: '+promotion.code+'\n\n':''}${promotion.url?(promotion.label||'Shop now')+': '+origin+promotion.url+'\n\n':''}`:'';const unsubscribeToken=promotion?commerce.unsubscribeToken(customer):null;const unsubscribe=unsubscribeToken?origin+'/unsubscribe?token='+unsubscribeToken:'';try{await mailer.send({to:address,subject:promotion?'Your Legado Locker signup offer':'Confirm your Legado Locker email signup',text:`${offer}Confirm that you want to receive Legado Locker drops, discounts, and offers:\n${origin}/account?subscribe=${token}\n\nThis link expires in 24 hours. You can unsubscribe at any time. If you did not request this, ignore this message.${unsubscribe?'\n\nUnsubscribe: '+unsubscribe:''}`,idempotencyKey:'subscribe-'+token,...(unsubscribe?{headers:{'List-Unsubscribe':'<'+origin+'/api/email/unsubscribe?token='+unsubscribeToken+'>','List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}}:{})});}catch{fail('We could not send your confirmation email. Please try again later.',503);}}
    send(202,{message:'Check your inbox for your signup email and any requested offer. Confirm your email to receive future drops and discounts. Already subscribed? You are all set.'});return true;
   }
   if(route==='/api/promotions'&&req.method==='GET'){send(200,{promotions:livePromotions(store).map(p=>{if(p.type!=='signup')return p;const {code,...publicPromotion}=p;return publicPromotion;})});return true;}
   if(route==='/api/admin/promotions'){if(!authenticated)fail('Sign in to manage your store.',401);if(req.method==='GET'){send(200,{promotions:readPromotions(store)});return true;}if(req.method==='PUT'){send(200,{promotions:savePromotions(store,(await jsonBody(req)).promotions)});return true;}fail('Method not allowed.',405);}
   if(route==='/api/footer-links'&&req.method==='GET'){send(200,{links:readFooterLinks(store)});return true;}
   if(route==='/api/admin/footer-links'){if(!authenticated)fail('Sign in to manage your store.',401);if(req.method==='GET'){send(200,{links:readFooterLinks(store)});return true;}if(req.method==='PUT'){const body=await jsonBody(req);send(200,{links:saveFooterLinks(store,body.links)});return true;}fail('Method not allowed.',405);}
   if(route==='/api/features'&&req.method==='GET'){send(200,{accountsReady:!!mailer.ready&&!!origin,checkoutReady:checkoutReady(),checkoutProvider,shopifyCheckoutOrigin:shopify.origin,shopifyOrderSyncReady:shopify.orderSyncReady});return true;}
   if(route==='/api/email/unsubscribe'&&req.method==='POST'){commerce.unsubscribe(url.searchParams.get('token'));send(200,{ok:true});return true;}
   if(route.startsWith('/api/customer/')){
    const action=route.slice('/api/customer/'.length);const customer=customerOf(req);
    if(req.method==='POST'&&['register','login','recover','resend','verify','reset','subscribe-confirm'].includes(action))throttle(req.socket.remoteAddress+':'+action,100);
    if(action==='register'&&req.method==='POST'){
     if(!mailer.ready||!origin)fail('Account registration will open once email delivery is configured.',503);const body=await jsonBody(req);throttle('register:'+digest(email(body.email)),5);const created=await commerce.register(body);if(created)try{await accountEmail(created,'verify');}catch{fail('Verification email could not be sent. Use Resend verification after the email service is restored.',503);}send(202,{message:'If this email can be registered, a verification link is on its way. Check your inbox, or use Resend verification.'});return true;
    }
    if(['recover','resend'].includes(action)&&req.method==='POST'){
     if(!mailer.ready||!origin)fail('Email delivery is not configured.',503);const body=await jsonBody(req);throttle(action+':'+digest(email(body.email)),5);const found=commerce.findCustomer(email(body.email));if(found&&(action==='recover'||!found.verified))try{await accountEmail(found,action==='recover'?'reset':'verify');}catch{fail('Email service is temporarily unavailable. Please try again later.',503);}send(202,{message:'If this account is eligible, an email link is on its way.'});return true;
    }
    if(action==='subscribe-confirm'&&req.method==='POST'){await commerce.consume((await jsonBody(req)).token,'subscribe');send(200,{message:'You’re subscribed! Watch your inbox for new drops and offers. You can unsubscribe from any campaign.'});return true;}
    if(['verify','reset'].includes(action)&&req.method==='POST'){const body=await jsonBody(req);await commerce.consume(body.token,action==='verify'?'verify':'reset',body.password);send(200,{message:action==='verify'?'Email verified. You can sign in.':'Password updated. Sign in with your new password.'});return true;}
    if(action==='login'&&req.method==='POST'){const body=await jsonBody(req);throttle('customer-login:'+digest(email(body.email)),10);const found=await commerce.login(body.email,body.password);if(!found)fail('Email or password is incorrect. Check your email address or use Forgot password below.',401);res.setHeader('Set-Cookie',customerCookie(commerce.newSession(found.id),604800));const {unsubscribeHash,...safe}=found;send(200,{customer:safe});return true;}
    if(!customer)fail('Sign in to your customer account.',401);
    if(action==='me'&&req.method==='GET'){const {unsubscribeHash,...safe}=customer;send(200,{customer:safe,orders:commerce.customerOrders(customer)});return true;}
    if(action==='logout'&&req.method==='POST'){await jsonBody(req);const token=(req.headers.cookie||'').split(';').map(c=>c.trim()).find(c=>c.startsWith('legado_customer='))?.slice(16);commerce.logout(token);res.setHeader('Set-Cookie',customerCookie('',0));send(200,{ok:true});return true;}
    if(action==='preferences'&&req.method==='POST'){const body=await jsonBody(req);customer.marketingConsent=body.marketingConsent===true;if(!customer.marketingConsent)store.db.prepare("DELETE FROM customer_tokens WHERE customer_id=? AND kind='subscribe'").run(customer.id);customer.consentUpdatedAt=date();commerce.saveCustomer(customer);send(200,{ok:true});return true;}
    if(action==='checkout'&&req.method==='POST'){if(checkoutProvider!=='stripe')fail('Use the Shopify checkout button for this store.',409);throttle('checkout:'+customer.id,10);const body=await jsonBody(req);send(201,await payments.checkout(customer,body));return true;}
    fail('Endpoint not found.',404);
   }
   if(!route.startsWith('/api/admin/'))return false;
   if(!/^\/api\/admin\/(operations|orders|discounts|campaigns)(\/|$)/.test(route))return false;
   if(!authenticated)fail('Sign in to manage your store.',401);
   if(route==='/api/admin/operations'&&req.method==='GET'){send(200,overview());return true;}
   if(route==='/api/admin/orders'&&req.method==='POST'){send(201,commerce.createOrder(await jsonBody(req)));return true;}
   const orderMatch=route.match(/^\/api\/admin\/orders\/([a-zA-Z0-9-]+)(\/sync)?$/);
   if(orderMatch&&req.method==='POST'){const order=commerce.get('orders',orderMatch[1]);if(!order)fail('Order not found.',404);if(order.source==='shopify')fail('Manage this order in Shopify; updates arrive through Shopify webhooks.',409);const body=await jsonBody(req);
    if(orderMatch[2]){send(200,await payments.sync(order));return true;}
    if(order.source==='stripe'&&(body.paymentStatus!==order.paymentStatus||body.refunded!==order.refunded))fail('Stripe payment and refund amounts update from Stripe. Use Sync payment, or issue refunds in Stripe.');send(200,commerce.updateOrder(order,body));return true;
   }
   const notifyMatch=route.match(/^\/api\/admin\/orders\/([a-zA-Z0-9-]+)\/notify$/);
   if(notifyMatch&&req.method==='POST'){await jsonBody(req);if(!mailer.ready||!origin)fail('Configure email delivery before sending order updates.',503);const order=commerce.get('orders',notifyMatch[1]);if(!order)fail('Order not found.',404);const providerId=await mailer.send({to:order.email,subject:'Legado Locker order '+order.number,text:`Hi ${order.name},\n\nOrder ${order.number} is ${order.status}.\nPayment status: ${order.paymentStatus}.\n${order.carrier?'Carrier: '+order.carrier+'\n':''}${order.trackingNumber?'Tracking: '+order.trackingNumber+'\n':''}${order.trackingUrl?'Track your order: '+order.trackingUrl+'\n':''}\nView your orders: ${origin}/account`,idempotencyKey:'order-update-'+order.id+'-'+order.updatedAt});send(200,{accepted:true,providerId});return true;}
   if(route==='/api/admin/discounts'&&req.method==='POST'){send(201,commerce.discount(await jsonBody(req)));return true;}
   const discountMatch=route.match(/^\/api\/admin\/discounts\/([a-zA-Z0-9-]+)$/);if(discountMatch&&req.method==='PUT'){if(!commerce.get('discounts',discountMatch[1]))fail('Code not found.',404);send(200,commerce.discount(await jsonBody(req),discountMatch[1]));return true;}
   if(route==='/api/admin/campaigns'&&req.method==='POST'){
    const body=await jsonBody(req);const discountId=body.discountId||'';if(discountId&&!commerce.get('discounts',discountId))fail('Select a valid discount.');if(/[\r\n]/.test(body.subject||''))fail('Email subjects must be one line.');const audience=body.audience||'all';if(!['all','new','active'].includes(audience))fail('Select a valid campaign audience.');const campaign={id:randomUUID(),audience,subject:text(body.subject,'Subject',150),body:text(body.body,'Message',10000),discountId,createdAt:date(),status:'draft'};send(201,commerce.put('campaigns',campaign));return true;
   }
   const campaignMatch=route.match(/^\/api\/admin\/campaigns\/([a-zA-Z0-9-]+)\/send$/);
   if(campaignMatch&&req.method==='POST'){
    await jsonBody(req);if(!marketingReady())fail('Configure Resend, a verified sender, and PUBLIC_ORIGIN before sending offers.',503);
    const id=campaignMatch[1],campaign=commerce.get('campaigns',id);if(!campaign)fail('Campaign not found.',404);if(locks.has(id))fail('This campaign is already being processed.',409);
    const discount=campaign.discountId?commerce.get('discounts',campaign.discountId):null;if(discount&&(!discount.active||(discount.expiresAt&&new Date(discount.expiresAt)<=new Date())))fail('This campaign’s discount has expired or been disabled.');locks.add(id);
    try{
     if(campaign.status==='draft'){
      store.db.exec('BEGIN IMMEDIATE');try{campaign.status='sending';campaign.startedAt=date();campaign.origin=origin;campaign.discount=discount?{code:discount.code,percent:discount.percent,expiresAt:discount.expiresAt}:null;commerce.put('campaigns',campaign);
      for(const c of commerce.customers().filter(c=>c.verified&&c.marketingConsent&&((campaign.audience||'all')==='all'||(campaign.audience==='new'?!c.welcomedAt:!!c.welcomedAt))))commerce.recipient(id,c.id,{customerId:c.id,status:'pending'});store.db.exec('COMMIT');}catch(error){store.db.exec('ROLLBACK');throw error;}
     }
     const batch=commerce.recipients(id).filter(r=>['pending','retry','sending'].includes(r.status)).slice(0,3);
     for(const recipient of batch){const customer=commerce.customer(recipient.customerId);if(!customer?.verified||!customer.marketingConsent||(campaign.audience==='new'&&customer.welcomedAt&&!recipient.startedAt)){commerce.recipient(id,recipient.customerId,{...recipient,status:'skipped'});continue;}
      if(recipient.startedAt&&Date.now()-new Date(recipient.startedAt).getTime()>23*3600000){commerce.recipient(id,recipient.customerId,{...recipient,status:'unknown',error:'Provider acceptance needs manual review; automatic resend disabled to avoid duplicates.'});continue;}
      let token=recipient.unsubscribeToken;if(!token)token=commerce.unsubscribeToken(customer);
      const current={...recipient,status:'sending',startedAt:recipient.startedAt||date(),unsubscribeToken:token};commerce.recipient(id,customer.id,current);
      const unsubscribe=campaign.origin+'/unsubscribe?token='+token;
      try{const providerId=await mailer.send({to:customer.email,subject:campaign.subject,text:`${campaign.body}\n\n${campaign.discount?`Discount code: ${campaign.discount.code} — ${campaign.discount.percent}% off${campaign.discount.expiresAt?' until '+campaign.discount.expiresAt:''}.\n\n`:''}Shop: ${campaign.origin}/#collection\n\nLegado Locker\n${campaign.postalAddress?campaign.postalAddress+'\n\n':''}You opted in to Legado Locker offers. Unsubscribe: ${unsubscribe}`,idempotencyKey:'campaign-'+id+'-'+customer.id,headers:{'List-Unsubscribe':'<'+campaign.origin+'/api/email/unsubscribe?token='+token+'>','List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}});commerce.recipient(id,customer.id,{...current,status:'accepted',providerId,acceptedAt:date()});if(campaign.audience==='new'){const latest=commerce.customer(customer.id);if(latest&&!latest.welcomedAt){latest.welcomedAt=date();commerce.saveCustomer(latest);}}}
      catch{commerce.recipient(id,customer.id,{...current,status:'retry',error:'Provider did not confirm acceptance. Retry within 23 hours uses the same idempotency key.'});}
     }
     const remaining=commerce.recipients(id).filter(r=>['pending','retry','sending'].includes(r.status));campaign.status=remaining.length?'sending':'complete';commerce.put('campaigns',campaign);send(200,{...campaign,remaining:remaining.length,counts:commerce.recipients(id).reduce((c,r)=>(c[r.status]=(c[r.status]||0)+1,c),{})});return true;
    }finally{locks.delete(id);}
   }
   return false;
  }
 };
}
