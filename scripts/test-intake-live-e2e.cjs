/* The live intake form with Nick's 4 Oct changes: local static server and API mocks only.
   Reuses the site suite's server and browser context (no deployed request is made). */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, 'test-site-e2e.cjs'), 'utf8');
const sandbox = { require, __dirname, process: { ...process, argv: ['node', 'test', '--suite', 'local'] }, console, Buffer, URL, module: { exports: {} } };
vm.runInNewContext(source.slice(0, source.indexOf('(async()=> {')) + '\nmodule.exports={server,context,playwright};', sandbox);
const { server, context, playwright } = sandbox.module.exports;
const results = [];
async function test(name, fn) { try { await fn(); results.push({ name, passed: true }); console.log('PASS ' + name); } catch (e) { results.push({ name, passed: false, error: e.message }); console.log('FAIL ' + name + ': ' + e.message); } }
const next = (p) => p.locator('[data-continue]').click();
const current = (p, id) => p.locator('[data-screen="' + id + '"].is-current').waitFor();
async function toHeating(p, base) {
  await p.goto(new URL('/start/', base).href); await p.locator('[data-go="S1"]').click();
  await p.locator('[name=first_name]').fill('Test'); await p.locator('[name=last_name]').fill('Fixture'); await next(p);
  await p.locator('[name=email]').fill('test@example.invalid'); await next(p);
  await p.locator('[name=postcode]').fill('3122'); const sub = p.locator('[data-suburbs] input'); if (await sub.count()) await sub.first().check(); await next(p);
  await current(p, 'S4'); await p.locator('[data-prefer-email]').click(); await current(p, 'S5');
  await p.locator('[name=intent][value=fit]').check(); await current(p, 'S6'); await next(p); await current(p, 'S7');
}
(async () => {
  const s = await server(); const browser = await playwright.chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || 'chrome', headless: true });
  async function pageTest(name, fn) { await test(name, async () => { const c = await context(browser, s.url, true); c.ctx.setDefaultTimeout(8000); try { await fn(c.page, c, s.url); } finally { await c.ctx.close(); } }); }
  try {
    await test('No own-or-rent question or renter close; the card keeps the phone and drops the price line; no install timing', () => {
      const html = fs.readFileSync(path.join(__dirname, '../start/index.html'), 'utf8');
      assert.ok(!/data-screen="(S9|R1)"|name="tenure"|landlord/.test(html));
      const card = html.split('class="intake-side"')[1].split('</aside>')[0];
      assert.ok(/href="tel:\+61272283430"/.test(card)); assert.ok(!/12,000/.test(card));
      assert.ok(!/November|installed in February|next winter/.test(html));
    });
    await pageTest('Heating notes: visible label, hint linked, no placeholder, sent with the enquiry', async (p, c, base) => {
      await toHeating(p, base);
      const notes = p.locator('[name=heating_notes]'); assert.ok(await notes.isVisible());
      assert.equal(await p.getByRole('textbox', { name: /Anything else you'd like us to know\?/ }).count(), 1);
      assert.equal(await notes.getAttribute('placeholder'), null);
      assert.match(await p.locator('#' + (await notes.getAttribute('aria-describedby'))).textContent(), /For example/);
      await p.locator('[name=heating][value=boiler_radiators]').check(); await notes.fill('Two boilers.'); await next(p);
      await current(p, 'S8'); await p.locator('[name=boiler_condition][value=working_fine]').check(); await next(p);
      for (const id of ['S10', 'S11', 'S12', 'S13']) { await current(p, id); await p.locator('[data-screen="' + id + '"] [data-skip]').click(); }
      await current(p, 'MATCH'); await p.waitForTimeout(3800);
      assert.equal(c.calls.length, 1); assert.equal(c.calls[0].heating_notes, 'Two boilers.'); assert.equal(c.calls[0].tenure, undefined);
    });
    await pageTest('Reaching the match submits once; Back and return never re-send; the exit and Step 3 follow as details', async (p, c, base) => {
      await toHeating(p, base); await p.locator('[name=heating][value=boiler_radiators]').check(); await next(p);
      await current(p, 'S8'); await p.locator('[name=boiler_condition][value=working_fine]').check(); await next(p);
      for (const id of ['S10', 'S11', 'S12', 'S13']) { await current(p, id); await p.locator('[data-screen="' + id + '"] [data-skip]').click(); }
      await current(p, 'MATCH'); await p.waitForTimeout(3800);
      assert.equal(c.calls.length, 1); assert.equal(c.calls[0].outcome, 'matched'); assert.ok(!c.calls[0].followup); assert.equal(c.calls[0].exit, 'none');
      await p.locator('[data-back]').click(); await current(p, 'S13'); await next(p); await current(p, 'MATCH'); await p.waitForTimeout(400);
      assert.equal(c.calls.length, 1, 'returning to the match sends nothing');
      await p.locator('.is-current [data-exit=book_chat]').click().catch(() => {}); await p.waitForTimeout(400);
      assert.equal(c.calls.length, 2); assert.equal(c.calls[1].followup, true); assert.equal(c.calls[1].exit, 'chat');
      await p.locator('.is-current [data-exit=book_chat]').click().catch(() => {}); await p.waitForTimeout(400);
      assert.equal(c.calls.length, 2, 'a second chat tap sends nothing');
      await p.locator('.is-current [data-go=S14]').click();
      for (const id of ['S14', 'S15', 'S16']) { await current(p, id); await p.locator('[data-screen="' + id + '"] [data-skip]').click(); }
      await current(p, 'S17'); await next(p); await current(p, 'DONE');
      assert.equal(c.calls.length, 3); assert.equal(c.calls[2].followup, true); assert.ok(c.calls.every((x) => x.lead_id === c.calls[0].lead_id));
    });
    await pageTest('Anonymous counts: each screen ID once per page, no identifiers or storage', async (p, c, base) => {
      await toHeating(p, base); await p.waitForTimeout(200);
      const ids = c.views.flatMap((v) => { assert.deepEqual(Object.keys(v), ['q']); return v.q; });
      for (const id of ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7']) assert.equal(ids.filter((x) => x === id).length, 1, id);
      assert.ok(!ids.includes('intro')); assert.deepEqual(await c.ctx.cookies(), []);
      assert.equal(await p.evaluate(() => localStorage.length + sessionStorage.length), 0);
    });
    await pageTest('Back keeps light text on hover', async (p, c, base) => {
      await toHeating(p, base); const back = p.locator('[data-back]'); await back.hover(); await p.waitForTimeout(250);
      const rgb = (await back.evaluate((e) => getComputedStyle(e).color)).match(/\d+/g).map(Number);
      assert.ok(rgb[0] + rgb[1] + rgb[2] > 450, 'Back text went dark on hover: ' + rgb);
    });
  } finally { await browser.close(); await s.close(); }
  const failed = results.filter((r) => !r.passed).length; console.log((results.length - failed) + ' passed / ' + failed + ' failed'); if (failed) process.exitCode = 1;
})().catch((e) => { console.error(e.message); process.exitCode = 1; });
