export function createMailer(config=process.env){
 return {
  ready:!!(config.RESEND_API_KEY&&config.EMAIL_FROM),
  address:config.SHOP_POSTAL_ADDRESS||'',
  async send({to,subject,text,idempotencyKey,headers={}}){
   if(!this.ready)throw Error('Configure RESEND_API_KEY and a verified EMAIL_FROM in Render.');
   const response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+config.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':idempotencyKey},body:JSON.stringify({from:config.EMAIL_FROM,to:[to],subject,text,headers})});
   if(!response.ok)throw Error('Email provider rejected the request ('+response.status+'). Check the verified sender, API key and sending limits.');const data=await response.json();if(!data.id)throw Error('Email provider did not confirm acceptance.');return data.id;
  }
 };
}
