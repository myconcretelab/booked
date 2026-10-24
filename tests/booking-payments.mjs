import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

export async function runBookingPaymentChecks(chromium) {
 const browser=await chromium.launch({headless:true});
 try {
  for(const [width,language,check,request,pay] of [[1100,'fr','Vérifier la disponibilité','Demande de réservation','Payer et confirmer ma réservation'],[390,'en','Check availability','Booking request','Pay and confirm my booking'],[768,'es','Comprobar disponibilidad','Solicitud de reserva','Pagar y confirmar mi reserva']]) {
   const page=await browser.newPage({viewport:{width,height:950}});const errors=[];let submitted;let delayedQuote=false;
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('http://booked.test/**',async route=>{
    const url=new URL(route.request().url());
    if(/\.(js|css)$/.test(url.pathname))return route.fulfill({contentType:url.pathname.endsWith('.css')?'text/css':'text/javascript; charset=utf-8',body:await fs.readFile(new URL('../assets'+url.pathname,import.meta.url),'utf8')});
    if(url.pathname==='/')return route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><html lang="${language}"><link rel="stylesheet" href="/widget.css"><body><main><div class="booked-booking-card" data-gite-id="g1" data-selected-start="2027-02-10" data-selected-end="2027-02-14"></div></main><script>window.BookedWidgetConfig={restUrl:'http://booked.test/api'};</script><script src="/i18n.js"></script><script src="/widget.js"></script></body></html>`});
    let data={};
    if(url.pathname.endsWith('/config'))data={capacite_max:4,arrhes_taux_defaut:0.3,options:{chiens:{enabled:true,prix_unitaire:15}},payments:{online:true,mode:'test'}};
    if(url.pathname.endsWith('/availability'))data={blocked_ranges:[],calendar_periods:[]};
    if(url.pathname.endsWith('/quote')) {
     if(delayedQuote) {delayedQuote=false;await new Promise(resolve=>setTimeout(resolve,300));}
     const extras=route.request().postDataJSON().options.chiens.enabled?60:0;
     data={montant_hebergement:300,total_options:extras,total_global:300+extras,arrhes_theoriques:90,nb_nuits:4};
    }
    if(url.pathname.endsWith('/requests')){submitted=route.request().postDataJSON();return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Test : connexion indisponible'})});}
    return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
   });
   await page.goto('http://booked.test/');await page.getByRole('button',{name:check,exact:true}).click();await page.getByRole('button',{name:request,exact:true}).click();
   const modal=page.locator('[role=dialog]');
   assert.equal(await page.locator('[name=payment_choice]').count(),3);
   for(const [name,value] of Object.entries({prenom:'Guest',nom:'Test',telephone:'0600000000',email:'fake@example.test'}))await page.locator(`[name=${name}]`).fill(value);
   await page.locator('[name=chiens]').check();
   await page.waitForFunction(()=>!document.querySelector('button[type=submit]').disabled);
   for(const choice of ['deposit','full','manual']) {
    await page.locator(`[name=payment_choice][value=${choice}]`).check();
    assert.equal(await page.evaluate(()=>document.activeElement.value),choice);
    assert.equal(await page.locator('[name=email]').inputValue(),'fake@example.test');
    assert.equal(await page.locator(`[name=payment_choice][value=${choice}]`).isChecked(),true);
    const breakdown=modal.locator('.booked-booking-card__payment-breakdown');
    if(choice==='manual')assert.equal(await breakdown.count(),0);
    else {
     assert.match(await breakdown.locator('.booked-booking-card__due-now').textContent(),choice==='deposit'?/90/:/360/);
     if(choice==='deposit') {
      const calculation=await breakdown.locator('.booked-booking-card__deposit-calculation').textContent();
      assert.match(calculation,/300/);assert.match(calculation,/30\s*%/);assert.match(calculation,/90/);
      assert.match(await breakdown.locator('.booked-booking-card__remaining').textContent(),/270/);
      const amount=breakdown.locator('.booked-booking-card__due-now strong');
      assert.ok(await amount.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))>=20);
     } else assert.equal(await breakdown.locator('.booked-booking-card__remaining').count(),0);
    }
    assert.equal(await modal.evaluate(el=>el.scrollWidth>el.clientWidth),false);
   }
   await page.locator('[name=payment_choice][value=deposit]').check();
   delayedQuote=true;
   await page.locator('[name=chiens]').uncheck();
   assert.equal(await modal.locator('.booked-booking-card__due-now').count(),0);
   assert.equal(await page.locator('button[type=submit]').isDisabled(),true);
   await page.waitForFunction(()=>!document.querySelector('button[type=submit]').disabled);
   assert.match(await modal.locator('.booked-booking-card__remaining').textContent(),/210/);
   await page.locator('[name=chiens]').check();
   await page.waitForFunction(()=>!document.querySelector('button[type=submit]').disabled);
   assert.match(await modal.locator('.booked-booking-card__remaining').textContent(),/270/);
   await modal.evaluate(el=>el.scrollTop=el.scrollHeight);await page.screenshot({path:`/tmp/booked-payment-form-${width}.png`});
   await page.getByRole('button',{name:pay,exact:true}).click();await page.waitForFunction(()=>document.querySelector('.booked-booking-card__modal-feedback')?.textContent.trim() && !document.querySelector('button[type=submit]').disabled);
   assert.equal(submitted.payment_choice,'deposit');assert.equal(await page.locator('[name=email]').inputValue(),'fake@example.test');
   assert.equal(await page.locator('[name=payment_choice][value=deposit]').isChecked(),true);
   assert.deepEqual(errors,[]);await page.close();console.log(`${width}px ${language}: choix, montants, coordonnées conservées et reprise après erreur OK`);
  }
  for(const [status,confirmed,result,expected] of [['paid',true,'success','Votre réservation est confirmée !'],['expired',false,'cancel','Paiement annulé ou expiré'],['requires_review',false,'success','Votre paiement nécessite un suivi']]) {
   const page=await browser.newPage();let sent;
   await page.route('http://booked.test/**',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname.endsWith('.js'))return route.fulfill({contentType:'text/javascript; charset=utf-8',body:await fs.readFile(new URL('../assets'+url.pathname,import.meta.url),'utf8')});
    if(url.pathname==='/')return route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><html lang="fr"><body><main><div class="booked-booking-card" data-gite-id="g1"></div></main><script>window.BookedWidgetConfig={restUrl:"http://booked.test/api"};</script><script src="/i18n.js"></script><script src="/widget.js"></script></body></html>'});
    if (!url.pathname.endsWith('/payments/status')) return route.fulfill({contentType:'application/json',body:JSON.stringify({capacite_max:4,blocked_ranges:[],calendar_periods:[]})});
    sent=route.request().postDataJSON();return route.fulfill({contentType:'application/json',body:JSON.stringify({status,confirmed,amount_paid:90,remaining:270,reference:'test'})});
   });
   await page.goto(`http://booked.test/#booked_payment=test&token=${'x'.repeat(43)}&result=${result}`);
   await page.getByRole('heading',{name:expected,exact:true}).waitFor();
   assert.equal(await page.locator('.booked-payment-return').evaluate(el=>el.closest('.booked-booking-card')===null),true);
   assert.equal(await page.locator('.booked-booking-card').isVisible(),status==='expired');
   assert.equal(sent.cancel,result==='cancel');assert.equal(new URL(page.url()).hash,'');await page.close();
  }
  console.log('Retours Stripe : confirmation vérifiée, annulation, suivi et suppression du jeton de l’URL OK');
 } finally {await browser.close();}
}
