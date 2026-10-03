/* Offline real endpoint: all fetches mocked, no credentials or data services. */
'use strict';
const assert=require('node:assert/strict'),handler=require('../api/intake-view.js');
let count=0,failed=0,calls=[],logs=[];
const print=console.log;
console.warn=(line)=>logs.push(line);
global.fetch=async(url,options)=>{calls.push({url,options});return {ok:true};};
Object.assign(process.env,{SUPABASE_URL:'https://example.invalid',SUPABASE_LEADS_KEY:'fake-writer',SUPABASE_ANON_KEY:'fake-anon'});
async function check(label,fn){try{await fn();count++;print('ok    '+label);}catch(e){failed++;print('FAIL '+label+': '+e.message);}}
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
let ip=0;
async function call(body,env='production',method='POST',address){process.env.VERCEL_ENV=env;calls=[];logs=[];const res={code:0,status(code){this.code=code;return this;},end(){return this;}};await handler({method,body,headers:{'x-forwarded-for':address||'198.51.100.'+(++ip)}},res);assert.equal(res.code,204);return calls;}
(async()=>{
 await check('valid grouped questions call only one day-bucket RPC',async()=>{await call({q:['S7','S8']});assert.equal(calls.length,1);assert.equal(calls[0].url,'https://example.invalid/rest/v1/rpc/increment_intake_view');const b=JSON.parse(calls[0].options.body);assert.deepEqual(b.ids,['S7','S8']);assert.match(b.day,/^\d{4}-\d{2}-\d{2}$/);assert.deepEqual(Object.keys(b).sort(),['day','ids']);});
 await check('split question IDs accepted by endpoint and draft RPC',async()=>{const ids='S2b S3b S6b S7b S9b B2 S13b S14b S14c S14d S16b S16c S16d'.split(' ');const sql=require('fs').readFileSync(require('path').join(__dirname,'../docs/migrations/DRAFT - intake_screen_views (3 Oct 2026).sql'),'utf8');for(const id of ids){await call({q:[id]});assert.deepEqual(JSON.parse(calls[0].options.body).ids,[id]);assert.ok(sql.includes("'"+id+"'"));}});
 await check('beacon string payload accepted and duplicates collapsed',async()=>{await call(JSON.stringify({q:['S1','S2','S1']}));assert.deepEqual(JSON.parse(calls[0].options.body).ids,['S1','S2']);});
 for(const body of [null,[],{}, {q:[]},{q:['S99']},{q:['intro']},{q:['R1']},{q:['S9']},{q:['S1'],email:'forged@example.com'}, {q:['S1'],lead_id:'il-0123456789'}, {q:['S1'],ip:'192.0.2.9'}, {q:['S1','S2','S3','S4','S5','S6','S7']}, {x:['S1']}, {q:[42]},'not json','x'.repeat(257)]) await check('invalid payload rejected '+JSON.stringify(body).slice(0,40),async()=>{await call(body);assert.equal(calls.length,0);assert.deepEqual(logs,['[intake-view] code=invalid_payload']);});
 for(const env of ['preview','development',''])await check('off production no RPC: '+(env||'unset'),async()=>{await call({q:['MATCH']},env);assert.equal(calls.length,0);});
 for(const method of ['GET','PUT','OPTIONS'])await check(method+' cannot increment',async()=>{await call({q:['S1']},'production',method);assert.equal(calls.length,0);});
 await check('per-IP cap is its own (120 per 10 min, a full visit is ~33): first 120 admitted then screened',async()=>{for(let i=0;i<121;i++){await call({q:['S1']},'production','POST','192.0.2.201');assert.equal(calls.length,i<120?1:0);}assert.deepEqual(logs,['[intake-view] code=rate_limited']);});
 await check('RPC refusal returns 204 and logs constant code only',async()=>{global.fetch=async()=>({ok:false});await call({q:['S1']});assert.deepEqual(logs,['[intake-view] code=rpc_failed']);});
 await check('exception text never reaches logs or response',async()=>{global.fetch=async()=>{throw Error('secret fake@example.com 192.0.2.44');};await call({q:['S1']});assert.deepEqual(logs,['[intake-view] code=rpc_failed']);});
 await check('missing credentials fails quietly',async()=>{delete process.env.SUPABASE_LEADS_KEY;await call({q:['S1']});assert.deepEqual(logs,['[intake-view] code=not_configured']);});
 await check('draft migration uses RLS, restricted RPC and atomic counts',async()=>{const sql=require('fs').readFileSync(require('path').join(__dirname,'../docs/migrations/DRAFT - intake_screen_views (3 Oct 2026).sql'),'utf8');for(const r of [/DRAFT ONLY/,/enable row level security/i,/security definer/i,/set search_path = pg_catalog, pg_temp/i,/revoke all on function[\s\S]*from public, anon, authenticated/i,/grant execute on function public\.increment_intake_view\(date, text\[\]\) to service_role;/i,/views = counts.views \+ 1/,/comment on column public.leads.tenure/])assert.match(sql,r);assert.ok(!/lead_writer\s*[,;]|to lead_writer|, lead_writer/i.test(sql.replace(/^--.*$/gm,'')),'lead_writer does not exist (Platform, 3 Oct)');});
 print(`${count} checks passed; ${failed} failed`);process.exitCode=failed?1:0;
})();
