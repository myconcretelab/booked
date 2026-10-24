import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

// No booking or charge is created: every API request is intercepted.
export async function runBookingConfirmationChecks(chromium) {
 const browser=await chromium.launch({headless:true});
 try {
  for(const [width,language,purpose] of [[1100,'fr','deposit'],[390,'fr','full'],[390,'en','deposit'],[768,'es','deposit']]) {
   const page=await browser.newPage({viewport:{width,height:1000}});const errors=[];let statusCalls=0;
   page.on('pageerror',e=>errors.push(e.message));
   const result={status:'paid',confirmed:true,purpose,amount_paid:purpose==='full'?360:90,total:360,remaining:purpose==='full'?0:270,reference:'test-confirmation',confirmation:{brand:{name:'Les Gîtes',logo_url:'http://booked.test/logo.png'},gite:{name:'Gîte du Jardin',address:'Adresse de démonstration',photo_url:'http://booked.test/photo.jpg',photo_alt:'Le séjour du gîte'},stay:{arrival:'2027-02-10',departure:'2027-02-14',adults:2,children:1,nights:4},options:['Chiens : 15 € × 4 nuits = 60 €'],message:{text:'Bonjour Camille,\n\nNotre texte personnalisé pour votre séjour.\n\nNos idées : https://example.test/guide\n\n<img src=x onerror="window.confirmationInjected=true">'}}};
   await page.route('http://booked.test/**',async route=>{
    const url=new URL(route.request().url());
    if(/\.(js|css)$/.test(url.pathname))return route.fulfill({contentType:url.pathname.endsWith('.css')?'text/css':'text/javascript; charset=utf-8',body:await fs.readFile(new URL('../assets'+url.pathname,import.meta.url),'utf8')});
    if(/\.(jpg|png)$/.test(url.pathname))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#dfe6d8"/></svg>'});
    if(url.pathname==='/'||url.pathname==='/other-gite')return route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><html lang="${language}"><link rel="stylesheet" href="/widget.css"><body><main>${language==='es'&&url.pathname==='/'?'<div class="booked-confirmation-root"></div>':'<div class="booked-booking-card" data-gite-id="g1"></div>'}</main><script>window.BookedWidgetConfig={restUrl:'http://booked.test/api'};</script><script src="/i18n.js"></script><script src="/widget.js"></script></body></html>`});
    if(url.pathname.endsWith('/payments/status')){statusCalls++;return route.fulfill({contentType:'application/json',body:JSON.stringify(result)});}
    assert.equal(url.pathname.endsWith('/requests'),false);
    return route.fulfill({contentType:'application/json',body:JSON.stringify({capacite_max:4,blocked_ranges:[],calendar_periods:[]})});
   });
   await page.goto('http://booked.test/#booked_payment=fixture&token='+'x'.repeat(43)+'&result=success');
   const confirmation=page.locator('.booked-payment-return--confirmed');await confirmation.waitFor();
   if(language==='es')assert.equal(await page.locator('.booked-booking-card').count(),0);else assert.equal(await page.locator('.booked-booking-card').isVisible(),false);
   assert.equal(await confirmation.locator('.booked-confirmation__photo').getAttribute('alt'),'Le séjour du gîte');
   assert.match(await confirmation.locator('.booked-confirmation__options').textContent(),/15 € × 4 nuits = 60 €/);
   assert.match(await confirmation.locator('.booked-confirmation__payment').textContent(),purpose==='full'?/360/:/90/);
   assert.equal(await confirmation.locator('.booked-confirmation__paid').count(),purpose==='full'?1:0);
   const message=confirmation.locator('details');assert.equal(await message.getAttribute('open'),null);await message.locator('summary').click();
   assert.match(await message.innerText(),/Notre texte personnalisé/);assert.equal(await message.locator('a').getAttribute('href'),'https://example.test/guide');
   assert.equal(await page.evaluate(()=>window.confirmationInjected),undefined);assert.equal(await message.locator('img').count(),0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await message.locator('summary').click();await confirmation.screenshot({path:`/tmp/booked-confirmation-${width}-${language}-${purpose}.png`});
   assert.equal(new URL(page.url()).hash,'');await page.reload();await page.locator('.booked-payment-return--confirmed').waitFor();assert.equal(statusCalls,2);
   await page.goto('http://booked.test/other-gite');await page.locator('.booked-booking-card__panel').waitFor();assert.equal(await page.locator('.booked-booking-card').isVisible(),true);assert.equal(await page.locator('.booked-payment-return').count(),0);
   assert.deepEqual(errors,[]);await page.close();console.log(`${width}px ${language} ${purpose}: récapitulatif, confidentialité, formulaire masqué, rechargement et autre page OK`);
  }
 }finally{await browser.close();}
}
