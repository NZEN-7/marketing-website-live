/* Intake stage 2 in a real browser (HoE items 103 to 105): local static server and API mocks only.
   Saves start once step 1 is done and follow every screen change; the page-hide beacon goes;
   saves stop once the enquiry is sent; a resume link refills the answers, opens the last screen
   and keeps Back working. Reuses the site suite's server and browser context. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, 'test-site-e2e.cjs'), 'utf8');
const sandbox = { require, __dirname, process: { ...process, argv: ['node', 'test', '--suite', 'local'] }, console, Buffer, URL, module: { exports: {} } };
vm.runInNewContext(source.slice(0, source.indexOf('(async()=> {')) + '\nmodule.exports={server,context,playwright};', sandbox);
const { server, context, playwright } = sandbox.module.exports;
let failed = 0;
async function test(name, fn) { try { await fn(); console.log('PASS ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ': ' + e.message); } }
const next = (p) => p.locator('[data-continue]').click();
const current = (p, id) => p.locator('[data-screen="' + id + '"].is-current').waitFor();
const settle = (p) => p.waitForTimeout(250);

(async () => {
  const s = await server(); const browser = await playwright.chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || 'chrome', headless: true });
  async function pageTest(name, fn) { await test(name, async () => { const c = await context(browser, s.url, true); c.ctx.setDefaultTimeout(8000); try { await fn(c.page, c, s.url); } finally { await c.ctx.close(); } }); }
  try {
    await pageTest('Nothing is saved before step 1; then every screen change saves against one lead and token', async (p, c, base) => {
      await p.goto(new URL('/start/', base).href); await p.locator('[data-go="S1"]').click();
      await p.locator('[name=first_name]').fill('Test'); await p.locator('[name=last_name]').fill('Fixture'); await next(p);
      await p.locator('[name=email]').fill('test@example.invalid'); await next(p);
      await p.locator('[name=postcode]').fill('3122'); const sub = p.locator('[data-suburbs] input'); if (await sub.count()) await sub.first().check(); await next(p);
      await current(p, 'S4'); await settle(p);
      assert.equal(c.saves.length, 0, 'saved before step 1 was done');
      await p.locator('[data-prefer-email]').click(); await current(p, 'S5'); await settle(p);
      assert.equal(c.saves.length, 1, 'no save on leaving step 1');
      const first = c.saves[0];
      assert.match(first.lead_id, /^il-[0-9a-f]{10}$/); assert.match(first.resume_token, /^[0-9a-f]{64}$/);
      assert.equal(first.last_screen, 'S5'); assert.equal(first.answers.email, 'test@example.invalid'); assert.equal(first.answers.contact_pref, 'email');
      assert.ok(!('beacon' in first) || first.beacon === false);
      await p.locator('[name=intent][value=fit]').check(); await current(p, 'S6'); await settle(p);
      await next(p); await current(p, 'S7'); await settle(p);
      assert.ok(c.saves.length >= 3, 'a save per screen: ' + c.saves.length);
      assert.ok(c.saves.every((x) => x.lead_id === first.lead_id && x.resume_token === first.resume_token), 'one lead, one token');
      assert.equal(c.saves[c.saves.length - 1].last_screen, 'S7');
      assert.equal(c.saves[c.saves.length - 1].answers.intent, 'fit');
      assert.equal(c.calls.length, 0, 'no enquiry send yet');
    });

    await pageTest('The page-hide beacon saves a half-finished screen', async (p, c, base) => {
      await p.goto(new URL('/start/', base).href); await p.locator('[data-go="S1"]').click();
      await p.locator('[name=first_name]').fill('Test'); await p.locator('[name=last_name]').fill('Fixture'); await next(p);
      await p.locator('[name=email]').fill('test@example.invalid'); await next(p);
      await p.locator('[name=postcode]').fill('3122'); const sub = p.locator('[data-suburbs] input'); if (await sub.count()) await sub.first().check(); await next(p);
      await current(p, 'S4'); await p.locator('[data-prefer-email]').click(); await current(p, 'S5');
      await p.locator('[name=intent][value=fit]').check(); await current(p, 'S6'); await next(p); await current(p, 'S7');
      await p.locator('[name=heating][value=boiler_radiators]').check();          // on screen, not yet moved on
      const before = c.saves.length;
      await p.evaluate(() => window.dispatchEvent(new Event('pagehide'))); await settle(p);
      const b = c.saves.slice(before).find((x) => x.beacon === true);
      assert.ok(b, 'no beacon');
      assert.equal(JSON.stringify(b.answers.heating), '["boiler_radiators"]'); assert.equal(b.last_screen, 'S7');
    });

    await pageTest('Saves stop once the enquiry has been sent', async (p, c, base) => {
      await p.goto(new URL('/start/', base).href); await p.locator('[data-go="S1"]').click();
      await p.locator('[name=first_name]').fill('Test'); await p.locator('[name=last_name]').fill('Fixture'); await next(p);
      await p.locator('[name=email]').fill('test@example.invalid'); await next(p);
      await p.locator('[name=postcode]').fill('3122'); const sub = p.locator('[data-suburbs] input'); if (await sub.count()) await sub.first().check(); await next(p);
      await current(p, 'S4'); await p.locator('[data-prefer-email]').click(); await current(p, 'S5');
      await p.locator('[name=intent][value=fit]').check(); await current(p, 'S6'); await next(p); await current(p, 'S7');
      await p.locator('[name=heating][value=boiler_radiators]').check(); await next(p);
      await current(p, 'S8'); await p.locator('[name=boiler_condition][value=working_fine]').check(); await next(p);
      for (const id of ['S10', 'S11', 'S12', 'S13']) { await current(p, id); await p.locator('[data-screen="' + id + '"] [data-skip]').click(); }
      await current(p, 'B2'); await next(p);                                   // heating notes, before the match
      await current(p, 'MATCH'); await p.waitForTimeout(4200);                  // the match send waits out the 3.5 s floor
      assert.equal(c.calls.length, 1, 'the match send');
      const n = c.saves.length;
      await p.evaluate(() => window.dispatchEvent(new Event('pagehide'))); await settle(p);
      assert.equal(c.saves.length, n, 'saved after the send');
    });

    await pageTest('A resume link refills the answers, opens the last screen, keeps Back, and saves on as the same lead', async (p, c, base) => {
      c.setResume({ ok: true, lead_id: 'il-abcdefabcd', last_screen: 'S8', answers: {
        first_name: 'Test', last_name: 'Fixture', email: 'test@example.invalid', postcode: '3122', suburb: 'Hawthorn',
        contact_pref: 'email', intent: 'fit', heating: ['boiler_radiators'] } });
      const tok = 'd'.repeat(64);
      await p.goto(new URL('/start/#resume=il-abcdefabcd.' + tok, base).href);
      await current(p, 'S8');
      assert.equal(c.resumes.length, 1); assert.equal(c.resumes[0].lead_id, 'il-abcdefabcd'); assert.equal(c.resumes[0].resume_token, tok);
      assert.equal(new URL(p.url()).hash, '', 'the link is cleaned out of the address bar');
      await p.locator('[name=boiler_condition][value=getting_on]').check(); await next(p); await current(p, 'S10'); await settle(p);
      const last = c.saves[c.saves.length - 1];
      assert.equal(last.lead_id, 'il-abcdefabcd'); assert.equal(last.resume_token, tok, 'saves go on with the link token');
      assert.equal(last.answers.email, 'test@example.invalid'); assert.equal(last.answers.boiler_condition, 'getting_on');
      await p.locator('[data-back]').click(); await current(p, 'S8');
      await p.locator('[data-back]').click(); await current(p, 'S7');
      assert.ok(await p.locator('[name=heating][value=boiler_radiators]').isChecked(), 'the heating answer came back');
    });

    await pageTest('A link that no longer works starts the form fresh', async (p, c, base) => {
      await p.goto(new URL('/start/#resume=il-abcdefabcd.' + 'e'.repeat(64), base).href);
      await current(p, 'intro'); assert.equal(c.resumes.length, 1);
      await p.locator('[data-resume-note]').waitFor();
      assert.match(await p.locator('[data-resume-note]').textContent(), /start again/);
      await p.goto('about:blank');                                          // a new hash alone doesn't reload
      await p.goto(new URL('/start/#resume=not-a-link', base).href);
      await current(p, 'intro'); assert.equal(c.resumes.length, 1, 'a malformed link is never posted');
      assert.equal(await p.locator('[data-resume-note]').count(), 0, 'no note without a link');
    });
  } finally { await browser.close(); s.close && s.close(); }
  console.log(failed ? failed + ' stage 2 browser test(s) failed' : 'All stage 2 browser tests passed');
  process.exitCode = failed ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
