/* Run with node scripts/test-site-e2e.cjs --suite local|url --url https://host/.
   No real API handler is loaded. Deployed requests are GET-only. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const option = (k) => args.includes(k) ? args[args.indexOf(k) + 1] : undefined;
const suite = option('--suite');
if (!['local', 'url'].includes(suite)) throw new Error('Pass --suite local or --suite url');
const remote = suite === 'url' ? new URL(option('--url')) : null;
if (remote && (!/^https?:$/.test(remote.protocol) || remote.username || remote.password || remote.search)) throw new Error('Use an explicit credential-free site URL');
let playwright;
try { playwright = require(process.env.E2E_PLAYWRIGHT || 'playwright'); }
catch { throw new Error('Playwright is required: use an existing installation via E2E_PLAYWRIGHT or NODE_PATH. No dependency is installed by this runner.'); }
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({name, status:'passed'}); console.log('PASS ' + name); }
  catch (e) { results.push({name, status:'failed', error:String(e.message).slice(0,1600)}); console.log('FAIL ' + name + ': ' + String(e.message).slice(0,250)); }
}
function pages(dir = root) {
  return fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => {
    if (e.name.startsWith('.') || ['node_modules','docs','assets','api','scripts','tools'].includes(e.name)) return [];
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return pages(p);
    return e.name === 'index.html' ? ['/' + path.relative(root,path.dirname(p)).split(path.sep).filter(Boolean).join('/') + (p === path.join(root,'index.html') ? '' : '/')] : [];
  });
}
async function server() {
  const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.xml':'application/xml','.json':'application/json'};
  const s = http.createServer((req,res) => {
    if (req.method !== 'GET') {res.writeHead(405);return res.end();}
    const pathname = new URL(req.url,'http://localhost').pathname;
    if (pathname.startsWith('/api/')) {res.writeHead(501);return res.end('API must be mocked');}
    let file;
    try {file = path.resolve(root, '.' + decodeURIComponent(pathname));} catch {res.writeHead(400);return res.end();}
    if (!file.startsWith(root + path.sep) && file !== root) {res.writeHead(403);return res.end();}
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file,'index.html');
    // Allow only public page/asset types. No dot files, env files or backend code.
    const rel = path.relative(root,file).split(path.sep);
    if (rel.some(p=>p.startsWith('.')) || ['api','node_modules','scripts','tools'].includes(rel[0]) || !types[path.extname(file)]) {res.writeHead(403);return res.end();}
    if (!fs.existsSync(file)) {res.writeHead(404);return res.end();}
    res.writeHead(200, {'Content-Type':types[path.extname(file)]});res.end(fs.readFileSync(file));
  });
  await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));
  return {url:'http://127.0.0.1:'+s.address().port+'/',close:()=>new Promise(resolve=>s.close(resolve))};
}
async function context(browser,base,local) {
  const ctx = await browser.newContext({serviceWorkers:'block', viewport:{width:1280,height:900}, reducedMotion:'reduce'});
  ctx.setDefaultTimeout(10000);
  const calls = [], views = [], violations = [], blocked = [];
  await ctx.route('**/*',async route=> {
    const req = route.request(), url = new URL(req.url());
    if (url.origin === new URL(base).origin && url.pathname.startsWith('/api/')) {
      if (local) { if(url.pathname==='/api/intake-view'){views.push(JSON.parse(req.postData()||'{}'));return route.fulfill({status:204});} if(req.method()==='POST' && url.pathname.startsWith('/api/lead')) calls.push(JSON.parse(req.postData() || '{}')); return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,sent:true})}); }
      if(req.method()!=='GET' && url.pathname!=='/api/intake-view') violations.push('Non-GET API attempt');
      blocked.push('api'); return route.abort();
    }
    if(req.method() !== 'GET') {violations.push('Non-GET request blocked');return route.abort();}
    if(url.origin !== new URL(base).origin) {
      let video = false;
      try { const f=req.frame(); video = /(^|\.)youtube-nocookie\.com$/.test(url.hostname) && req.isNavigationRequest() && f !== f.page().mainFrame(); } catch {}
      const fleetStats = url.origin === 'https://thermal-dawn-platform.vercel.app' && url.pathname === '/api/public/stats' && !url.search;
      if(!local && !video && !fleetStats) violations.push('Unlisted cross-origin page-load request: '+url.origin+url.pathname);
      blocked.push(video?'video-frame':url.origin);return route.abort();
    }
    return route.continue();
  });
  return {ctx,calls,views,violations,blocked,page:await ctx.newPage()};
}
async function current(p,id) {await p.locator('[data-screen="'+id+'"].is-current').waitFor();}
async function next(p) {await p.locator('[data-continue]').click();}
async function begin(p,base,postcode='3122') {
  await p.goto(new URL('/start/',base).href); await current(p,'intro');
  await p.locator('[data-go="S1"]').click();
  await p.locator('[name=first_name]').fill('Test');await p.locator('[name=last_name]').fill('Fixture');
  if(await p.locator('[data-screen="S2"]').count())await next(p); // v1 deployed GET-only compatibility
  await p.locator('[name=email]').fill('test@example.invalid');await next(p);
  if(await p.locator('[data-screen=S2b]').count())await next(p);
  if(postcode===''){await p.locator('[data-outside-au]').click();await current(p,'S6');return;}
  await p.locator('[name=postcode]').fill(postcode);
  if(await p.locator('[data-screen=S3b]').count())await next(p);
  const suburbs=p.locator('[data-suburbs] input');if(await suburbs.count()) await suburbs.first().check();
  else await p.locator('[name=suburb]').fill('Test suburb');
  await next(p);
  if(postcode==='3122') {await current(p,'S4');await p.locator('[data-prefer-email]').click();await current(p,'S5');}
  else await current(p,'S6');
}
async function choose(p,name,value,screen) {
  await p.locator('[name="'+name+'"][value="'+value+'"]').check(); if(screen) await current(p,screen);
}
async function prepared(p,base,kind) {
  await begin(p,base,kind==='outside'?'4000':kind==='nz'?'':'3122');
  if(kind!=='outside'&&kind!=='nz')await choose(p,'intent',['book','explore','urgent'].includes(kind)?kind:'fit','S6');
  assert.equal(await p.locator('[name=newsletter_opt_in]').isChecked(),false);await next(p);
  if(kind==='outside'||kind==='nz')return current(p,'O1');
  await choose(p,'heating',kind==='splits'?'splits':kind==='uncertain'?'not_sure':'boiler_radiators');
  await next(p);
  if(!['book','explore','urgent','splits','uncertain'].includes(kind)) {
    await choose(p,'boiler_condition',kind==='broken'?'broken':'working_fine','S9b');
    await next(p);
  }
  await current(p,'B2');await p.locator('[name=heating_notes]').fill('Two boilers in this home. Underfloor downstairs and radiators upstairs.');await next(p);
  if(kind==='splits')return current(p,'N1');if(kind==='explore')return current(p,'MATCH_SHORT');
  if(kind==='urgent'||kind==='broken')return current(p,'URGENT');if(kind==='book')return current(p,'MATCH');
  for(const id of ['S10','S11','S12','S13','S13b']) {await current(p,id);await p.locator('[data-screen="'+id+'"] [data-skip]').click();}
  await current(p,'MATCH');
}
async function skipDetails(p,target) {
  for(let i=0;i<20;i++) {const id=await p.locator('[data-screen].is-current').getAttribute('data-screen');if(id===target)return;await p.locator('.is-current [data-skip]').click();}
  throw Error('Details route did not reach '+target);
}
async function keyboard(p) {
  const frames=p.frames().filter(f=>{try{return new URL(f.url()).origin===new URL(p.url()).origin;}catch{return false;}});
    // Closed disclosure contents can have rectangles while remaining untabbable.
  // Open disclosures using their native keyboard control before enumerating.
  for(const frame of frames) {
    const summaries=frame.locator('details > summary:visible');
    for(let i=0;i<await summaries.count();i++) {
      const sum=summaries.nth(i);
      if(await sum.evaluate(e=>!e.parentElement.open)){await sum.focus();await sum.press('Enter');}
    }
  }
  const expected=[];
  for(let fi=0;fi<frames.length;fi++) {
    const ids=await frames[fi].evaluate(prefix=> {
      const elements=Array.from(document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,summary,[tabindex]')).filter(e=>!e.disabled && e.tabIndex>=0 && e.getClientRects().length && getComputedStyle(e).visibility!=='hidden');
      const groups=new Set();return elements.filter(e=>{if(e.type!=='radio')return true;const k=e.name;if(groups.has(k))return false;groups.add(k);return true;}).map((e,i)=>{const id=prefix+':'+i;e.setAttribute('data-e2e-tab',id);e.__e2eStrokes=Array.from(e.querySelectorAll('rect,circle,path')).map(n=>{const s=getComputedStyle(n);return s.stroke+'|'+s.strokeWidth;});return id;});
    },String(fi));expected.push(...ids);
  }
  const reached=new Set(), noRing=new Set();
  await p.evaluate(()=>document.activeElement.blur());
  for(let i=0;i<expected.length*3+30;i++) {
    await p.keyboard.press('Tab');
    for(const frame of frames) {
      const info=await frame.evaluate(()=> {
        if(!document.hasFocus())return null;
        let e=document.activeElement;const id=e.getAttribute('data-e2e-tab');let ring=false;
        if(e.__e2eStrokes)ring=Array.from(e.querySelectorAll('rect,circle,path')).some((n,i)=>{const s=getComputedStyle(n);return s.stroke!=='none' && parseFloat(s.strokeWidth)>0 && s.stroke+'|'+s.strokeWidth!==e.__e2eStrokes[i];});
        for(let j=0;e && j<4;j++,e=e.parentElement){const s=getComputedStyle(e);if((s.outlineStyle!=='none' && parseFloat(s.outlineWidth)>0 && s.clip==='auto')||s.boxShadow!=='none')ring=true;}
        return {id,ring};
      });
      if(info && info.id!==null){reached.add(info.id);if(!info.ring)noRing.add(info.id);}
    }
    if(reached.size===expected.length)break;
  }
    const missed=expected.filter(x=>!reached.has(x)), details=[];
  for(const id of missed) {
    const f=frames[Number(id.split(':')[0])];
    details.push(await f.locator('[data-e2e-tab="'+id+'"]').evaluate(e=>({tag:e.tagName,type:e.type,href:e.getAttribute('href'),class:e.className,detailsClosed:!!e.closest('details:not([open])')})));
  }
  assert.deepEqual(details,[],'Visible controls missing from Tab traversal (including same-origin frames)');
  assert.deepEqual([...noRing],[],'Focused controls without visible outline/shadow');
}
async function designDefaults(p) {
  const styles=await p.evaluate(()=> {
    const trial=document.body.classList.contains('trial-calm') || document.body.classList.contains('trial-cards');
    // Render ordinary elements to check the default cascade on every page type,
    // including pages whose real headings use deliberate component styles.
    const probe=document.createElement('div');probe.innerHTML='<h2>Test heading</h2><h3>Test subheading</h3><div class="card">Test card</div>';
    document.body.append(probe);
    const [h2,h3,card]=Array.from(probe.children).map(e=>{const s=getComputedStyle(e);return {size:parseFloat(s.fontSize),weight:s.fontWeight,line:parseFloat(s.lineHeight),gap:parseFloat(s.marginBottom),radius:s.borderTopLeftRadius,padding:s.paddingTop,shadow:s.boxShadow,border:s.borderTopColor};});
    const root=parseFloat(getComputedStyle(document.documentElement).fontSize);const dark=document.body.classList.contains('dark');probe.remove();
    return {trial,h2,h3,card,root,dark,width:innerWidth};
  });
  assert.equal(styles.trial,false,'Retired trial body class remains');
  const size=Math.min(2*styles.root,Math.max(1.55*styles.root,.034*styles.width));
  assert.ok(Math.abs(styles.h2.size-size)<.1,'Default H2 clamp');assert.equal(styles.h2.weight,'700');
  assert.ok(Math.abs(styles.h2.line-size*1.25)<.1,'Default H2 leading');assert.ok(Math.abs(styles.h2.gap-size*.45)<.1,'Heading-to-text gap');
  assert.ok(Math.abs(styles.h3.line/styles.h3.size-1.3)<.01,'Default H3 leading');
  assert.equal(styles.card.radius,'6px');assert.equal(styles.card.padding,'20px');assert.equal(styles.card.shadow,'none');
  if(styles.dark)assert.ok(styles.card.border.endsWith('0.28)'),'Dark card lighter keyline');
}
(async()=> {
  let localServer, browser;
  try {
    if(suite==='local') localServer=await server();
    const base = remote ? remote.href : localServer.url;
    browser=await playwright.chromium.launch({channel:process.env.E2E_BROWSER_CHANNEL || 'chrome',headless:true});
    if(suite==='local') {
      for(const urlPath of [...pages().filter(x=>x!=='/pre-order/register-interest/'),'/404.html']) {
        const c=await context(browser,base,true);
        try {
          await c.page.goto(new URL(urlPath,base).href);
          for(const width of [1280,390])await test('Local site-wide defaults '+urlPath+' '+width+'px',async()=>{await c.page.setViewportSize({width,height:900});await designDefaults(c.page);});
        } finally {await c.ctx.close();}
      }
    }
    if(suite==='url') {
      // The runner does not activate deployed submits, exits, booking links or uploads.
      for(const urlPath of pages().filter(p=>!option('--paths') || option('--paths').split(',').includes(p))) {
        let status;
        await test('HTTP '+urlPath,async()=> {
          const response=await fetch(new URL(urlPath,base),{method:'GET',redirect:'manual'}); status=response.status;
          if(urlPath==='/pre-order/register-interest/') {assert.equal(status,301);assert.equal(new URL(response.headers.get('location'),base).pathname,'/start/');}
          else assert.equal(status,200);
        });
        if(status!==200) continue;
        const c=await context(browser,base,false);
        try {
          let loaded=false;
          await test('Browser load '+urlPath,async()=>{await c.page.goto(new URL(urlPath,base).href,{waitUntil:'load'});await c.page.locator('#site-footer a[href="/privacy/"]').waitFor();loaded=true;});
          if(!loaded) continue;
          await test('Privacy links '+urlPath,async()=> {
            assert.ok(await c.page.locator('#site-footer a[href="/privacy/"]').count(),'Footer privacy link missing');
            if(urlPath==='/start/') {
              assert.ok(await c.page.locator('[data-screen="S6"] a[href="/privacy/"]').count(),'Consent privacy link missing');
              assert.ok(await c.page.locator('.iq-foot__privacy a[href="/privacy/"]').count(),'Intake footer strip privacy link missing');
            }          });
          await test('Design scope '+urlPath,async()=> {
            if(option('--design')==='sitewide') return designDefaults(c.page);
            const classes=await c.page.locator('body').getAttribute('class') || '';
            assert.equal(classes.includes('trial-calm'),['/hydronic/pricing/','/hydronic/how-it-works/'].includes(urlPath));
            assert.equal(classes.includes('trial-cards'),urlPath==='/hydronic/pricing/');
          });
          await test('Keyboard Tab and focus '+urlPath,()=>keyboard(c.page));
          await test('Page-load requests '+urlPath,async()=>assert.deepEqual(c.violations,[]));
        } finally {await c.ctx.close();}
      }
    } else {
      for(const kind of ['fit','outside','nz','splits','book','explore','urgent','broken','uncertain']) await test('Local intake route '+kind,async()=> {
        const c=await context(browser,base,true);
        try {
          await prepared(c.page,base,kind);
          if(['fit','book','explore','uncertain'].includes(kind)) {
            await c.page.locator('.is-current [data-go="S14"]').click();
            await skipDetails(c.page,'S17');
            await current(c.page,'S17');await next(c.page);await current(c.page,'DONE');
          } else if(['urgent','broken'].includes(kind)) {await c.page.locator('[data-urgent-phone-input]').fill('0412345678');await c.page.locator('[data-exit="urgent_call"]').click();await current(c.page,'DONE');
          } else {await c.page.locator('.is-current [data-exit="keep_posted"]').click();await current(c.page,'POSTED');}
          // Reaching the match / urgent screen sends the enquiry; Step 3 (or a phone given on the urgent screen) follows as details (CTO item 68.1)
          const matched=!['outside','nz','splits'].includes(kind);
          assert.equal(c.calls.length,matched?2:1);assert.equal(c.calls[0].newsletter_opt_in,undefined);
          if(matched){assert.equal(c.calls[0].outcome,'matched');assert.ok(!c.calls[0].followup);assert.equal(c.calls[1].followup,true);}
          const routing={fit:'icp',outside:'out-of-area',splits:'not-our-product',nz:'out-of-area',broken:'urgent',uncertain:'icp-check',book:'icp',explore:'explore',urgent:'urgent'};
          assert.equal(c.calls[0].route,routing[kind]);
          assert.ok(c.calls[0].seen.includes('S1') && c.calls[0].seen.includes('S2'));assert.equal(c.calls[0].tenure,undefined);
          if(['fit','uncertain'].includes(kind))for(const id of ['S7','S10','S11','S12','S13'])assert.ok(c.calls[0].seen.includes(id),'Lost logical question '+id);
          if(!['outside','nz'].includes(kind))assert.equal(c.calls[0].heating_notes,'Two boilers in this home. Underfloor downstairs and radiators upstairs.');
          assert.deepEqual(c.violations,[]);
        } finally {await c.ctx.close();}
      });
      await test('Local invalid email and postcode announced',async()=> {
        const c=await context(browser,base,true);
        try {
          await c.page.goto(new URL('/start/',base).href);await c.page.locator('[data-go="S1"]').click();
          await c.page.locator('[name=first_name]').fill('Test');await c.page.locator('[name=last_name]').fill('Fixture');
          await next(c.page);await c.page.locator('[name=email]').fill('invalid');await next(c.page);await current(c.page,'S2');
          const err=c.page.locator('[data-err=email]');await err.waitFor({state:'visible'});assert.equal(await err.getAttribute('role'),'alert');assert.equal(await c.page.locator('[name=email]').getAttribute('aria-invalid'),'true');
          await c.page.locator('[name=email]').fill('test@example.invalid');await next(c.page);await next(c.page);await c.page.locator('[name=postcode]').fill('12');await next(c.page);await current(c.page,'S3');
          assert.equal(await c.page.locator('[data-err=postcode]').getAttribute('role'),'alert');assert.equal(await c.page.locator('[name=postcode]').getAttribute('aria-invalid'),'true');assert.equal(c.calls.length,0);
        } finally {await c.ctx.close();}
      });
      await test('Local uploads accessible by slot and mocked payload',async()=> {
        const c=await context(browser,base,true);
        try {
          await prepared(c.page,base,'fit');await c.page.locator('[data-screen="MATCH"] [data-go="S14"]').click();
          await skipDetails(c.page,'S16');
          await current(c.page,'S16');
          const uploads=c.page.locator('input[type=file]');assert.equal(await uploads.count(),4);
          for(let i=0;i<4;i++) {const input=uploads.nth(i);const ids=(await input.getAttribute('aria-labelledby')).split(' ');assert.ok(ids.length>=2);for(const id of ids) assert.ok((await c.page.locator('[id="'+id+'"]').textContent()).trim());}
          await uploads.first().setInputFiles({name:'fixture.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nTest fixture\n%%EOF')});
          const remove=c.page.locator('[data-remove]:visible');assert.ok((await remove.first().getAttribute('aria-label')).startsWith('Remove '));
          await next(c.page);await skipDetails(c.page,'S17');await next(c.page);await current(c.page,'DONE');assert.equal(c.calls.length,2);assert.equal(c.calls[0].outcome,'matched');assert.equal(c.calls[1].followup,true);assert.equal(c.calls[1].uploads.length,1);
        } finally {await c.ctx.close();}
      });
    }
    if(suite==='url') {
      await test('Deployed desktop submenu keyboard reachability',async()=> {
        const c=await context(browser,base,false);
        try {await c.page.goto(base);await c.page.locator('.nav__has-sub > a').focus();await c.page.keyboard.press('Tab');
          assert.equal(await c.page.evaluate(()=>!!document.activeElement.closest('.nav__sub')),true,'Tab skips the closed desktop submenu');
        } finally {await c.ctx.close();}
      });
      await test('Deployed mobile menu opens with keyboard',async()=> {
        const c=await context(browser,base,false);
        try {await c.page.setViewportSize({width:390,height:844});await c.page.goto(base);const toggle=c.page.locator('.nav__toggle');await toggle.focus();await toggle.press('Enter');assert.equal(await toggle.getAttribute('aria-expanded'),'true');await keyboard(c.page);assert.equal(c.calls.length,0);}
        finally {await c.ctx.close();}
      });
    } else {
      await test('Local phone error announced, linked and cleared',async()=> {
        const c=await context(browser,base,true);
        try {await begin(c.page,base);await c.page.locator('[data-back]').click();await current(c.page,'S4');const phone=c.page.locator('[name=phone]');await phone.fill('123');await next(c.page);await current(c.page,'S4');const error=c.page.locator('[data-err=phone]');assert.equal(await error.getAttribute('role'),'alert');assert.equal(await phone.getAttribute('aria-invalid'),'true');assert.ok((await phone.getAttribute('aria-describedby')).includes(await error.getAttribute('id')));await phone.fill('0412345678');await next(c.page);await current(c.page,'S4b');assert.equal(await phone.getAttribute('aria-invalid'),null);assert.equal(c.calls.length,0);}
        finally {await c.ctx.close();}
      });
    }
    for(const key of ['Enter','Space']) await test((suite==='local'?'Local':'Deployed GET-only')+' keyboard arrows then '+key,async()=> {
      const c=await context(browser,base,suite==='local');
      try {
        await begin(c.page,base);await keyboard(c.page);const radio=c.page.locator('[data-screen="S5"] input[type=radio]').first();await radio.focus();
        await c.page.keyboard.press('ArrowRight');await c.page.waitForTimeout(400);await current(c.page,'S5');
        assert.equal(await c.page.locator('[name=intent][value=book]').isChecked(),true);
        await c.page.keyboard.press(key==='Space'?'Space':'Enter');await current(c.page,'S6');assert.equal(c.calls.length,0);assert.deepEqual(c.violations,[]);
      } finally {await c.ctx.close();}
    });
  } finally {
    if(browser) await browser.close();if(localServer) await localServer.close();
    const summary={suite,passed:results.filter(x=>x.status==='passed').length,failed:results.filter(x=>x.status==='failed').length,results};
    const dest=process.env.E2E_REPORT || path.join(os.tmpdir(),'thermal-dawn-e2e-'+suite+'.json');fs.writeFileSync(dest,JSON.stringify(summary,null,2));
    console.log('Results: '+summary.passed+' passed, '+summary.failed+' failed; '+dest);if(summary.failed) process.exitCode=1;
  }
})().catch(e=>{console.error(String(e.message));process.exitCode=1});
