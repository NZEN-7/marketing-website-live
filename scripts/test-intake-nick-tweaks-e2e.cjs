const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'test-site-e2e.cjs'),'utf8');
const box={require,__dirname,process:{...process,argv:['node','x','--suite','local']},console,Buffer,URL,module:{exports:{}}};
vm.runInNewContext(source.slice(0,source.indexOf('(async()=> {'))+'\nmodule.exports={server,context,playwright,begin,next,current};',box);
const {server,context,playwright,begin,next,current}=box.module.exports;
let passed=0,failed=0;
(async()=>{const s=await server(),b=await playwright.chromium.launch({channel:'chrome',headless:true});
async function test(name,options,fn){const c=await context(b,s.url,true,options);const errors=[];c.page.on("pageerror",e=>errors.push(e.message));try{await fn(c.page,c);assert.deepEqual(errors,[]);assert.equal(c.violations.length,0);passed++;console.log('PASS '+name);}catch(e){failed++;console.log('FAIL '+name+': '+e.message);}finally{await c.ctx.close();}}
try{
 for(const [name,options,desktop] of [['desktop',{viewport:{width:1280,height:900},hasTouch:false},true],['phone',{viewport:{width:390,height:844},hasTouch:true,isMobile:true},false],['hybrid',{hasTouch:true},false]]) {
  await test(name+' focus, heading context and validation',options,async(p,c)=>{
   await p.goto(s.url+'start/');await p.locator('[data-go=S1]').click();await current(p,'S1');
   assert.equal(await p.evaluate(()=>document.activeElement.getAttribute('name')||document.activeElement.id),desktop?'first_name':'h-S1');
   if(desktop){assert.match(await p.locator('[name=first_name]').getAttribute('aria-describedby'),/h-S1/);assert.equal(await p.locator('[data-live]').textContent(),"What's your name?");}
   await p.locator('[name=first_name]').fill('Test');await p.locator('[name=last_name]').fill('Fixture');await next(p);await current(p,'S2');
   assert.equal(await p.evaluate(()=>document.activeElement.getAttribute('name')||document.activeElement.id),desktop?'email':'h-S2');
   await p.locator('[name=email]').fill('invalid');await next(p);assert.equal(await p.locator('[name=email]').getAttribute('aria-invalid'),'true');
   await p.locator('[name=email]').fill('test@example.invalid');await next(p);await current(p,'S3');
   await p.locator('[data-back]').click();await current(p,'S2');assert.equal(await p.locator('[name=email]').getAttribute('aria-invalid'),null);
   assert.equal(c.calls.length,0);
  });
 }
 for(const width of [390,960,1280])await test('heating layout '+width,{viewport:{width,height:900},hasTouch:width===390,isMobile:width===390},async(p)=>{
  await begin(p,s.url);await p.locator('[name=intent][value=fit]').check();await current(p,'S6');await next(p);await current(p,'S7');
  const rects=await p.locator('[data-screen=S7] .card-opt').evaluateAll(es=>es.map(e=>({y:e.offsetTop,w:e.offsetWidth})));
  assert.equal(await p.locator("[data-live]").textContent(), "");assert.equal(rects.length,9);assert.ok(rects.every(r=>r.w>=100));
  if(width>=960)assert.equal(new Set(rects.map(r=>r.y)).size,1);else assert.ok(new Set(rects.map(r=>r.y)).size>1);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.equal(await p.locator('[name=heating_notes]').isVisible(),false);
  await p.locator('[name=heating][value=ducted_rc]').focus();assert.equal(await p.locator('[name=heating][value=ducted_rc]').evaluate(e=>e===document.activeElement),true);
  await p.keyboard.press('Space');await next(p);await current(p,'N1');
 });
 for(const intent of ['fit','book','explore'])await test(intent+' notes immediately before match, no early submit',{},async(p,c)=>{
  await begin(p,s.url);await p.locator('[name=intent][value='+intent+']').check();await current(p,'S6');await next(p);await current(p,'S7');await p.locator('[name=heating][value=boiler_radiators]').check();await next(p);
  if(intent==='fit'){await current(p,'S8');await p.locator('[name=boiler_condition][value=working_fine]').check();await next(p);for(const id of ['S10','S11','S12','S13']){await current(p,id);await p.locator('.is-current [data-skip]').click();}}
  await current(p,'B2');assert.equal(c.calls.length,0);assert.equal(await p.evaluate(()=>document.activeElement.name),'heating_notes');
  assert.match(await p.locator('[name=heating_notes]').getAttribute('aria-describedby'),/h-B2/);assert.match(await p.locator('[name=heating_notes]').getAttribute('aria-describedby'),/heating-notes-hint/);
  await p.locator('[name=heating_notes]').fill('Two systems.');await next(p);await current(p,intent==='explore'?'MATCH_SHORT':'MATCH');await p.waitForTimeout(3800);
  assert.equal(c.calls.length,1);assert.equal(c.calls[0].heating_notes,'Two systems.');assert.ok(c.calls[0].seen.includes('B2'));
 });
 await test('intro secondary white outline and existing contact page',{},async(p)=>{await p.goto(s.url+'start/');const a=p.getByRole('link',{name:'Not sure? Send us a message'});assert.equal(await a.getAttribute('href'),'/contact/');assert.equal(await a.evaluate(e=>getComputedStyle(e).borderTopColor),'rgb(255, 255, 255)');await a.click();assert.match(p.url(),/\/contact\/$/);});
 await test('no-JS keeps notes and ducted RC as native fields',{javaScriptEnabled:false},async(p,c)=>{await p.goto(s.url+'start/');assert.ok(await p.locator('[name=heating_notes]').isVisible());assert.ok(await p.locator('[name=heating][value=ducted_rc]').isVisible());assert.equal(await p.locator('[data-nojs]').inputValue(),'1');assert.equal(c.calls.length,0);});
}finally{await b.close();await s.close();}console.log(passed+' passed / '+failed+' failed');process.exitCode=failed?1:0;})().catch(e=>{console.error(e);process.exitCode=1;});
