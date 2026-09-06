import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

// Import runBookingI18nChecks with a Playwright chromium instance from the host project.
export async function runBookingI18nChecks(chromium) {
  const browser=await chromium.launch({headless:true});
  try {
    for(const [language,check,request,submit,success] of [
      ['fr','Vérifier la disponibilité','Demande de réservation','Envoyer la demande','Demande enregistrée.'],
      ['en','Check availability','Booking request','Send booking request','Your request has been received.'],
      ['es','Comprobar disponibilidad','Solicitud de reserva','Enviar solicitud','Hemos recibido tu solicitud.'],
    ]) {
      const page=await browser.newPage(); const failures=[]; let submitted=null;
      page.on('pageerror',e=>failures.push(e.message));
      await page.route('http://booked.test/**',async route=>{
        const url=new URL(route.request().url());
        if(url.pathname.endsWith('.js'))return route.fulfill({contentType:'text/javascript; charset=utf-8',body:await fs.readFile(new URL('../assets/'+url.pathname.slice(1),import.meta.url),'utf8')});
        if(url.pathname==='/')return route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><html lang="${language}"><body><div class="booked-booking-card" data-gite-id="g1" data-selected-start="2027-02-10" data-selected-end="2027-02-12"></div><script>window.BookedWidgetConfig={restUrl:'http://booked.test/api'};</script><script src="/i18n.js"></script><script src="/widget.js"></script></body></html>`});
        assert.equal(url.searchParams.get('lang'),language);
        let data={};
        if(url.pathname.endsWith('/config'))data={id:'g1',nom:'Test',capacite_max:4,min_nuits_toute_annee:1};
        if(url.pathname.endsWith('/availability'))data={blocked_ranges:[],calendar_periods:[]};
        if(url.pathname.endsWith('/quote'))data={total_global:150};
        if(url.pathname.endsWith('/requests')){submitted=route.request().postDataJSON();data={id:'test',hold_expires_at:'2027-02-09T12:00:00Z'};}
        return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
      });
      await page.goto('http://booked.test/');
      await page.getByRole('button',{name:check,exact:true}).click();
      await page.getByRole('button',{name:request,exact:true}).click();
      await page.locator('input[name=prenom]').fill('Test');
      await page.locator('input[name=nom]').fill('Guest');
      await page.locator('input[name=telephone]').fill('0600000000');
      await page.locator('input[name=email]').fill('test@example.invalid');
      await page.getByRole('button',{name:submit,exact:true}).click();
      await page.waitForFunction(text=>document.body.textContent.includes(text),success);
      assert.equal(submitted.hote_nom,'Test Guest');
      assert.equal(submitted.date_entree,'2027-02-10');
      assert.deepEqual(failures,[]);
      console.log(`${language}: quote, form and confirmation OK (mock API, no request sent)`);
      await page.close();
    }
  } finally {await browser.close();}
}
