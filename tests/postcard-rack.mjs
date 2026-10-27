import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

// Isolated browser fixtures only: no WordPress changes or booking requests.
export async function runPostcardRackChecks(chromium, launchOptions = {}) {
  const browser = await chromium.launch({ headless: true, ...launchOptions });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('http://rack.test/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/assets/')) {
        const path = new URL('..' + url.pathname, import.meta.url);
        const ext = url.pathname.split('.').pop();
        return route.fulfill({ contentType: { js: 'text/javascript; charset=utf-8', css: 'text/css', jpg: 'image/jpeg', woff2: 'font/woff2' }[ext], body: await fs.readFile(path) });
      }
      if (url.pathname === '/photo.svg') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#718368"/></svg>' });
      const names = ['La Grée', 'La Lande', 'Le Val', 'Les Bruyères'];
      const gites = names.map((name, index) => ({ id: `g${index}`, name, url: `/gite-${index}/`, description: 'Une maison de campagne pour se retrouver en Brocéliande.', photo: { url: '/photo.svg' }, stats: [{ icon: 'people', label: 'Capacité', value: '4 pers.' }] }));
      return route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><html lang="fr"><head><link rel="stylesheet" href="/assets/postcards.css"><link rel="stylesheet" href="/assets/postcard-rack.css"><style>body{margin:0}main{max-width:900px;margin:auto;padding:0 12px}#root{margin-top:1400px}footer{height:1600px}</style></head><body><main><div id="root" class="booked-gite-cards booked-gite-cards--postcards booked-gite-cards--postcard-rack" data-columns="2"></div></main><footer></footer><script>window.frameRequests=0;const nativeFrame=requestAnimationFrame;window.requestAnimationFrame=callback=>{frameRequests++;return nativeFrame(callback)};window.gites=${JSON.stringify(gites)};</script><script src="/assets/i18n.js"></script><script src="/assets/postcards.js"></script><script src="/assets/postcard-rack.js"></script><script>BookedPostcardRack.mount(document.querySelector('#root'),gites,{});</script></body></html>` });
    });
    await page.goto('http://rack.test/');
    await page.waitForTimeout(100);
    assert.equal(await page.locator('.booked-postcard').count(), 0, 'Cards and images must be deferred while far offscreen.');
    await page.locator('#root').scrollIntoViewIfNeeded();
    await page.locator('.booked-postcard-rack__controls').waitFor();
    assert.equal(await page.locator('.booked-postcard-rack__slot').count(), 4);
    assert.equal(await page.locator('.booked-postcard').count(), 4);
    assert.deepEqual(await page.locator('.booked-postcard').evaluateAll(cards => cards.map(card => [...card.classList].find(c => /--(escale|campagne|album|voyage)$/.test(c)))), ['booked-postcard--escale', 'booked-postcard--campagne', 'booked-postcard--album', 'booked-postcard--voyage']);
    const beforeIdle = await page.evaluate(() => frameRequests);
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => frameRequests), beforeIdle, 'An idle rack must not request animation frames.');
    const rotor = page.locator('.booked-postcard-rack__rotor');
    const beforeRotation = await rotor.getAttribute('style');
    await page.getByRole('button', { name: 'Tourner vers la droite', exact: true }).click();
    assert.notEqual(await rotor.getAttribute('style'), beforeRotation);
    for (const name of ['La Grée', 'La Lande', 'Le Val', 'Les Bruyères']) {
      await page.getByRole('button', { name: `Sortir la carte de ${name}`, exact: true }).click();
      await page.locator('dialog[open]').waitFor();
      assert.equal(await page.locator('.booked-postcard').count(), 4, 'Selection moves the real card instead of duplicating it.');
      assert.equal(await page.locator('dialog h2').textContent(), name);
      await page.getByRole('button', { name: `Voir le verso de ${name}`, exact: true }).click();
      assert.equal(await page.locator('dialog .booked-postcard').getAttribute('data-postcard-pinned'), 'true');
      assert.match(await page.locator('dialog .booked-postcard__back').textContent(), /À bientôt ici…/);
      await page.keyboard.press('Escape');
      await page.locator('dialog[open]').waitFor({ state: 'hidden' });
      await page.waitForFunction(() => document.querySelectorAll('.booked-postcard-rack__slot > .booked-postcard').length === 4);
      assert.equal(await page.locator('.booked-postcard-rack__slot > .booked-postcard').count(), 4);
    }
    const stage = await page.locator('.booked-postcard-rack__stage').boundingBox();
    const rotationBeforeDrag = await rotor.getAttribute('style');
    await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2);
    await page.mouse.down();
    await page.mouse.move(stage.x + stage.width / 2 + 100, stage.y + stage.height / 2, { steps: 12 });
    await page.mouse.up();
    assert.notEqual(await rotor.getAttribute('style'), rotationBeforeDrag, 'Dragging must rotate the rack.');
    assert.equal(await page.locator('dialog[open]').count(), 0, 'Dragging must not accidentally select a card.');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForFunction(() => document.querySelector('#root').classList.contains('is-rack-paused'));
    assert.equal(await page.locator('#root').evaluate(root => root.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length), 0, 'No animations may continue offscreen.');
    const afterHide = await page.evaluate(() => frameRequests);
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => frameRequests), afterHide);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#root').scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Sortir la carte de Les Bruyères', exact: true }).click();
    await page.locator('dialog[open]').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Mobile page must not overflow.');
    const modal = await page.locator('dialog').boundingBox();
    assert.ok(modal.x >= 0 && modal.width <= 390);
    await page.getByRole('button', { name: 'Ranger la carte', exact: true }).click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('#root.is-rack-static').waitFor();
    assert.equal(await page.locator('.booked-postcard-rack__stage').count(), 0);
    assert.equal(await page.locator('.booked-postcard').count(), 4);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.locator('.booked-postcard-rack__stage').waitFor();
    await page.getByRole('button', { name: 'Sortir la carte de La Grée', exact: true }).click();
    await page.evaluate(() => document.querySelector('#root').bookedPostcardRackDestroy());
    await page.waitForTimeout(650);
    assert.equal(await page.locator('dialog[open]').count(), 0, 'An editor rerender must cancel an extraction.');
    assert.deepEqual(errors, []);
    console.log('Postcard rack: lazy images, 4 reused cards, rotation/drag, selection/flip/return, no idle frames, offscreen pause, mobile, reduced-motion fallback and disposal OK.');
  } finally {
    await browser.close();
  }
}
