import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

// All API calls are intercepted: this test never creates a real booking.
export async function runBookingFlowChecks(chromium) {
  const browser = await chromium.launch({headless: true});
  try {
    for (const [width, beds, capacity] of [[1100, 1, 2], [375, 3, 4], [768, 2, 3]]) {
      const page = await browser.newPage({viewport: {width, height: 900}});
      const errors = [];
      let submitted;
      let failQuote = false;
      let quoteDelay = 0;
      page.on('pageerror', error => errors.push(error.message));
      await page.route('http://booked.test/**', async route => {
        const url = new URL(route.request().url());
        if (/\.(js|css)$/.test(url.pathname)) return route.fulfill({
          contentType: url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript; charset=utf-8',
          body: await fs.readFile(new URL('../assets' + url.pathname, import.meta.url), 'utf8'),
        });
        if (url.pathname === '/') return route.fulfill({contentType: 'text/html; charset=utf-8', body: `<!doctype html><html lang="fr"><link rel="stylesheet" href="/widget.css"><body><div class="booked-booking-card" data-gite-id="g1" data-month-cursor="2027-02-01"></div><script>window.BookedWidgetConfig={restUrl:'http://booked.test/api'};</script><script src="/i18n.js"></script><script src="/widget.js"></script></body></html>`});
        let data = {};
        if (url.pathname.endsWith('/config')) data = {capacite_max: capacity, min_nuits_toute_annee: 1, rules: {regle_animaux_acceptes: width !== 768}, options: {menage: {enabled: true, prix_forfait: 60}, draps: {enabled: true, prix_unitaire: 12}, linge_toilette: {enabled: true, prix_unitaire: 6}, chiens: {enabled: width !== 768, prix_unitaire: 5}, depart_tardif: {enabled: true, prix_forfait: 25}}};
        if (url.pathname.endsWith('/content')) data = {sections: [{groupes: [{items: [{kind: 'bed', type: 'double', count: beds}]}]}]};
        if (url.pathname.endsWith('/availability')) data = {blocked_ranges: [], calendar_periods: []};
        if (url.pathname.endsWith('/quote')) {
          if (quoteDelay) {
            const delay = quoteDelay;
            quoteDelay = 0;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          if (failQuote) { failQuote = false; return route.fulfill({status: 503, contentType: 'application/json', body: JSON.stringify({message: 'Prix temporairement indisponible'})}); }
          const {options} = route.request().postDataJSON();
          const nights = (new Date(route.request().postDataJSON().date_sortie) - new Date(route.request().postDataJSON().date_entree)) / 86400000;
          const detail = {menage: options.menage.enabled ? 60 : 0, draps: options.draps.enabled ? options.draps.nb_lits * 12 : 0,
            linge: options.linge_toilette.enabled ? options.linge_toilette.nb_personnes * 6 : 0,
            chiens: options.chiens.enabled ? options.chiens.nb * 5 * nights : 0, depart_tardif: options.depart_tardif.enabled ? 25 : 0};
          const total = Object.values(detail).reduce((sum, value) => sum + value, 0);
          data = {montant_hebergement: 150, total_options: total, total_global: 150 + total, options_detail: detail};
        }
        if (url.pathname.endsWith('/requests')) { submitted = route.request().postDataJSON(); data = {id: 'mock'}; }
        return route.fulfill({contentType: 'application/json', body: JSON.stringify(data)});
      });
      await page.goto('http://booked.test/');
      await page.getByRole('spinbutton', {name: 'Nombre de voyageurs', exact: true}).fill(String(capacity));
      await page.getByRole('spinbutton', {name: 'Nombre de voyageurs', exact: true}).blur();
      await page.getByRole('button', {name: 'Vérifier la disponibilité', exact: true}).click();
      await page.locator('[data-date="2027-02-10"]').click();
      await page.locator('[data-date="2027-02-12"]').click();
      const popover = page.locator('.booked-booking-card__popover');
      const request = popover.getByRole('button', {name: 'Demande de réservation', exact: true});
      await request.waitFor();
      assert.equal(await popover.count(), 1);
      await popover.getByRole('button', {name: 'Fermer', exact: true}).click();
      assert.equal(await popover.count(), 0);
      await page.getByRole('button', {name: 'Arrivée', exact: false}).click();
      await request.click();
      const comment = 'Arrivée vers 20 h.\nUn lit bébé est-il disponible ?';
      await page.getByLabel('Demandes ou commentaires (facultatif)').fill(comment);
      for (const [name, value] of Object.entries({prenom: 'Test', nom: 'Guest', telephone: '0600000000', email: 'test@example.invalid'})) await page.locator(`[name="${name}"]`).fill(value);
      const first = await page.locator('[name=prenom]').boundingBox();
      const last = await page.locator('[name=nom]').boundingBox();
      assert.equal(first.y, last.y);
      const phone = await page.locator('[name=telephone]').boundingBox();
      const email = await page.locator('[name=email]').boundingBox();
      assert.equal(phone.y, email.y);
      const modal = page.locator('.booked-booking-card__modal');
      await modal.evaluate(element => { element.scrollTop = element.scrollHeight; });
      const scrollTop = await modal.evaluate(element => element.scrollTop);
      quoteDelay = 400;
      await page.locator('[name=menage]').check();
      await modal.getByText('150 € au total', {exact: true}).waitFor();
      assert.equal(await page.locator('button[type=submit]').isDisabled(), true);
      assert.ok(Math.abs(await modal.evaluate(element => element.scrollTop) - scrollTop) <= 1);
      await page.locator('[name=draps]').check();
      await page.locator('[name=nb_lits]').fill(String(beds));
      await page.locator('[name=nb_lits]').blur();
      assert.equal(await page.locator('[name=nb_lits]').getAttribute('max'), String(beds));
      await page.locator('[name=linge_toilette]').check();
      assert.equal(await page.locator('[name=nb_personnes]').inputValue(), String(capacity));
      await page.getByRole('button', {name: 'Diminuer : Linge de toilette', exact: true}).click();
      if (width !== 768) {
        await page.getByRole('button', {name: 'Augmenter : Chiens', exact: true}).click();
        assert.equal(await page.locator('[name=chiens]').isChecked(), true);
        await page.getByRole('button', {name: 'Augmenter : Chiens', exact: true}).click();
        assert.equal(await page.locator('[name=nb_chiens]').inputValue(), '2');
      } else assert.equal(await page.locator('[name=chiens]').count(), 0);
      await page.locator('[name=depart_tardif]').check();
      await page.waitForFunction(() => !document.querySelector('button[type=submit]').disabled);
      assert.equal(await page.locator('[name=email]').inputValue(), 'test@example.invalid');
      assert.equal(await page.locator('[name=message_client]').inputValue(), comment);
      failQuote = true;
      await page.locator('[name=menage]').uncheck();
      await page.getByRole('button', {name: 'Vérifier la disponibilité', exact: true}).last().waitFor();
      assert.equal(await page.locator('button[type=submit]').isDisabled(), true);
      await page.getByRole('button', {name: 'Vérifier la disponibilité', exact: true}).last().click();
      await page.locator('[name=menage]').check();
      await page.getByRole('button', {name: 'Modifier les dates du séjour', exact: false}).click();
      await page.locator('[data-date="2027-02-15"]').click();
      await page.locator('[data-date="2027-02-17"]').click();
      await request.click();
      assert.equal(await page.locator('[name=nom]').inputValue(), 'Guest');
      assert.equal(await page.locator('[name=message_client]').inputValue(), comment);
      assert.equal(await page.locator('[name=nb_lits]').inputValue(), String(beds));
      const expected = 150 + 60 + beds * 12 + (capacity - 1) * 6 + (width !== 768 ? 20 : 0) + 25;
      await modal.locator('.booked-booking-card__modal-total').filter({hasText: String(expected)}).waitFor();
      const dialog = await page.locator('.booked-booking-card__modal').boundingBox();
      assert.ok(dialog.x >= 0 && dialog.x + dialog.width <= width);
      assert.ok(dialog.y >= 0 && dialog.y + dialog.height <= 900);
      assert.equal(await modal.evaluate(element => element.scrollWidth > element.clientWidth), false);
      await page.waitForFunction(() => !document.querySelector('button[type=submit]').disabled);
      // Keyboard focus stays in the dialog and the close action restores the trigger.
      await modal.getByRole('button', {name:'Fermer',exact:true}).focus();
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.evaluate(() => document.activeElement.type), 'submit');
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Fermer');
      await page.screenshot({path: `/tmp/booked-reservation-${width}.png`});
      await page.getByRole('button', {name: 'Envoyer la demande', exact: true}).click();
      await page.getByText('Demande enregistrée.', {exact: true}).waitFor();
      assert.equal(submitted.options.menage.enabled, true);
      assert.deepEqual(submitted.options.draps, {enabled: true, nb_lits: beds});
      assert.deepEqual(submitted.options.linge_toilette, {enabled: true, nb_personnes: capacity - 1});
      assert.deepEqual(submitted.options.chiens, {enabled: width !== 768, nb: width !== 768 ? 2 : 0});
      assert.equal(submitted.options.depart_tardif.enabled, true);
      assert.equal(submitted.date_entree, '2027-02-15');
      assert.equal(await page.evaluate(() => document.body.style.overflow), '');
      assert.equal(submitted.hote_nom, 'Test Guest');
      assert.equal(submitted.message_client, comment);
      assert.deepEqual(errors, []);
      console.log(`${width}px: dates, close, contact rows, options, quote recovery and submission OK`);
      await page.close();
    }
  } finally { await browser.close(); }
}
