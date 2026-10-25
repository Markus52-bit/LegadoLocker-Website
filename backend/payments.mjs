import {createHmac,timingSafeEqual,randomUUID} from 'node:crypto';
import {fail} from './validation.mjs';
export function verifyStripeSignature(raw,header,secret,at=Date.now()){
 if(!header||!secret)return false;const parts=header.split(',');const timestamp=parts.find(p=>p.startsWith('t='))?.slice(2);if(!/^\d+$/.test(timestamp||'')||Math.abs(at/1000-Number(timestamp))>300)return false;const expected=createHmac('sha256',secret).update(timestamp+'.').update(raw).digest();return parts.filter(p=>p.startsWith('v1=')).some(p=>{const sig=p.slice(3);return /^[a-f0-9]{64}$/.test(sig)&&timingSafeEqual(Buffer.from(sig,'hex'),expected);});
}
export function createPayments({store,commerce,origin,config}){
 const db=store.db;db.exec('CREATE TABLE IF NOT EXISTS stripe_events(id TEXT PRIMARY KEY,processed_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS stripe_refunds(payment_intent TEXT PRIMARY KEY,data TEXT NOT NULL);');
 const countries=(config.SHIPPING_COUNTRIES||'').split(',').map(c=>c.trim().toUpperCase()).filter(Boolean);
 const shipping=config.SHIPPING_AMOUNT_MINOR;
 const ready=!!(config.STRIPE_SECRET_KEY&&config.STRIPE_WEBHOOK_SECRET&&origin&&countries.length&&countries.every(c=>/^[A-Z]{2}$/.test(c))&&/^\d+$/.test(shipping||'')&&Number(shipping)<=100000000&&['true','false'].includes(config.STRIPE_AUTOMATIC_TAX));
 async function stripe(route,params,key){const options={headers:{Authorization:'Bearer '+config.STRIPE_SECRET_KEY,'Stripe-Version':'2024-06-20'},signal:AbortSignal.timeout(20000)};if(params){options.method='POST';options.body=new URLSearchParams(params);options.headers['Content-Type']='application/x-www-form-urlencoded';options.headers['Idempotency-Key']=key;}
 const response=await fetch('https://api.stripe.com/v1/'+route,options);if(!response.ok)fail('Stripe could not complete this request. Check payment configuration or try again.',502);return response.json();}
 function applySession(order,session){
  if(session.id!==order.stripeSessionId||session.metadata?.legado_order_id!==order.id)fail('Payment session did not match this order.',400);
  if(['paid','no_payment_required'].includes(session.payment_status)){
   const tax=session.total_details?.amount_tax||0;const discount=session.total_details?.amount_discount??order.discount;if(session.currency?.toUpperCase()!==order.currency||session.amount_subtotal!==order.subtotal||session.amount_total!==order.subtotal-discount+order.shipping+tax)fail('Payment totals did not match the order.',400);
   if(!['paid','partially_refunded','refunded'].includes(order.paymentStatus)){order.paymentStatus='paid';order.status=['new','cancelled'].includes(order.status)?'processing':order.status;order.timeline.push({at:new Date().toISOString(),event:'Payment confirmed by Stripe.'});}
   order.discount=discount;order.tax=tax;order.total=session.amount_total;order.stripePaymentIntent=typeof session.payment_intent==='string'?session.payment_intent:session.payment_intent?.id;
   const shippingDetails=session.shipping_details||session.collected_information?.shipping_details;if(shippingDetails){order.shippingAddress=[shippingDetails.name,...['line1','line2','city','state','postal_code','country'].map(k=>shippingDetails.address?.[k])].filter(Boolean).join('\n');}
  }else if(session.status==='expired'&&['unpaid','failed'].includes(order.paymentStatus)){order.status='cancelled';order.timeline.push({at:new Date().toISOString(),event:'Stripe checkout expired without payment.'});}
  order.updatedAt=new Date().toISOString();return commerce.put('orders',order);
 }
 function applyRefund(order,charge){const refunded=charge.amount_refunded||0;if(refunded<order.refunded)return order;order.refunded=refunded;order.paymentStatus=refunded>=order.total?'refunded':refunded>0?'partially_refunded':order.paymentStatus;order.timeline.push({at:new Date().toISOString(),event:'Refund amount confirmed by Stripe: '+refunded+' minor units.'});order.updatedAt=new Date().toISOString();return commerce.put('orders',order);}
 return {ready,
  async checkout(customer,body){
   if(!ready)fail('Checkout is not configured yet.',503);if(!Array.isArray(body.items)||!body.items.length||body.items.length>50)fail('Your bag must contain 1–50 pieces.');const products=store.catalog().products;
   const lines=body.items.map(item=>{const p=products.find(p=>p.id===item.id);if(!p||!p.sizes.includes(item.size)||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>99||!Number.isSafeInteger(p.price)||p.price<1)fail('A bag item is unavailable, unpriced, or invalid.');return {name:p.name+' / '+p.color,sku:p.id,size:item.size,quantity:item.quantity,unitPrice:p.price,currency:p.currency};});const currency=lines[0].currency;if(lines.some(l=>l.currency!==currency))fail('All bag items must use the same currency.');
   const order=commerce.createOrder({email:customer.email,name:customer.name,currency,items:lines,shipping:Number(shipping),tax:0,discountCode:body.discountCode||''});order.source='stripe';order.timeline=[{at:new Date().toISOString(),event:'Stripe checkout started. Awaiting payment.'}];commerce.put('orders',order);
   const params={mode:'payment',customer_email:customer.email,client_reference_id:order.id,'metadata[legado_order_id]':order.id,'payment_intent_data[metadata][legado_order_id]':order.id,success_url:origin+'/account?checkout=success&order='+order.id,cancel_url:origin+'/#collection','payment_method_types[0]':'card','shipping_options[0][shipping_rate_data][type]':'fixed_amount','shipping_options[0][shipping_rate_data][fixed_amount][amount]':String(order.shipping),'shipping_options[0][shipping_rate_data][fixed_amount][currency]':currency.toLowerCase(),'shipping_options[0][shipping_rate_data][display_name]':'Standard shipping','shipping_options[0][shipping_rate_data][tax_behavior]':'exclusive'};
   countries.forEach((c,i)=>params[`shipping_address_collection[allowed_countries][${i}]`]=c);
   if(config.STRIPE_AUTOMATIC_TAX==='true')params['automatic_tax[enabled]']='true';
   lines.forEach((l,i)=>{const key=`line_items[${i}]`;params[key+'[price_data][currency]']=currency.toLowerCase();params[key+'[price_data][unit_amount]']=String(l.unitPrice);params[key+'[price_data][tax_behavior]']='exclusive';params[key+'[price_data][product_data][name]']=l.name+' / '+l.size;params[key+'[quantity]']=String(l.quantity);});
   try{
    if(order.discountCode){const discount=commerce.list('discounts').find(d=>d.code===order.discountCode);const coupon=await stripe('coupons',{percent_off:String(discount.percent),duration:'once',name:discount.code},'coupon-'+order.id);params['discounts[0][coupon]']=coupon.id;}
    const session=await stripe('checkout/sessions',params,'checkout-'+order.id);if(!session.url?.startsWith('https://checkout.stripe.com/'))fail('Stripe returned an invalid checkout address.',502);order.stripeSessionId=session.id;commerce.put('orders',order);return {url:session.url,orderId:order.id};
   }catch(error){order.timeline.push({at:new Date().toISOString(),event:'Checkout session creation was not confirmed. No payment has been confirmed.'});commerce.put('orders',order);throw error;}
  },
  async sync(order){if(!config.STRIPE_SECRET_KEY||!order.stripeSessionId)fail('This order has no Stripe session.');const session=await stripe('checkout/sessions/'+encodeURIComponent(order.stripeSessionId)+'?expand[]=payment_intent.latest_charge');let updated=applySession(order,session);const charge=session.payment_intent?.latest_charge;if(charge&&typeof charge==='object'&&charge.amount_refunded)updated=applyRefund(updated,charge);return updated;},
  async webhook(raw,header){
   if(!verifyStripeSignature(raw,header,config.STRIPE_WEBHOOK_SECRET))fail('Invalid payment signature.',400);let event;try{event=JSON.parse(raw);}catch{fail('Invalid event.',400);}if(!event.id||!event.type)fail('Invalid event.',400);if(db.prepare('SELECT id FROM stripe_events WHERE id=?').get(event.id))return {ok:true};
   db.exec('BEGIN IMMEDIATE');try{
    const object=event.data?.object;if(['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.expired'].includes(event.type)){
     const order=commerce.get('orders',object?.metadata?.legado_order_id);if(order&&order.source==='stripe'){if(!order.stripeSessionId)fail('Checkout setup is still completing. Retry event.',503);const paid=applySession(order,object);if(paid.stripePaymentIntent){const pending=db.prepare('SELECT data FROM stripe_refunds WHERE payment_intent=?').get(paid.stripePaymentIntent);if(pending)applyRefund(paid,JSON.parse(pending.data));}}
    }else if(event.type==='payment_intent.payment_failed'){
     const order=commerce.get('orders',object?.metadata?.legado_order_id);if(order?.source==='stripe'&&!['paid','partially_refunded','refunded'].includes(order.paymentStatus)){order.paymentStatus='failed';order.stripePaymentIntent=object.id;order.updatedAt=new Date().toISOString();order.timeline.push({at:order.updatedAt,event:'Stripe reported a failed payment attempt.'});commerce.put('orders',order);}
    }else if(event.type==='charge.refunded'){
     const order=commerce.list('orders').find(o=>o.source==='stripe'&&o.stripePaymentIntent===object?.payment_intent);if(order)applyRefund(order,object);if(typeof object?.payment_intent==='string'){const old=db.prepare('SELECT data FROM stripe_refunds WHERE payment_intent=?').get(object.payment_intent);if(!old||JSON.parse(old.data).amount_refunded<object.amount_refunded)db.prepare('INSERT INTO stripe_refunds VALUES (?,?) ON CONFLICT(payment_intent) DO UPDATE SET data=excluded.data').run(object.payment_intent,JSON.stringify(object));}
    }
    db.prepare('INSERT INTO stripe_events VALUES (?,?)').run(event.id,new Date().toISOString());db.exec('COMMIT');return {ok:true};
   }catch(error){db.exec('ROLLBACK');throw error;}
  }
 };
}
