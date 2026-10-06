const fs=require('fs'),path=require('path'),assert=require('assert/strict'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),PRICE='From $12,000 for the equipment; installation depends on the house',COMPARISON='A premium heat pump replacement without storage typically costs $20,000 to $30,000 installed, and more for large homes.',BOOK='https://calendly.com/nickz-thermaldawn/30min';
const {BASIS,render}=require('../tools/update-web-bundle-partials.cjs');
function decode(s){return s.replace(/&#(?:x([0-9a-f]+)|(\d+));/gi,(_,h,d)=>String.fromCodePoint(parseInt(h||d,h?16:10))).replace(/&mdash;/gi,'—').replace(/&deg;/gi,'°').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/g,"'");}
function text(s){return decode(s.replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();}
function check(file,html){const hits=[],hit=(rule,fragment)=>hits.push({file,rule,line:html.slice(0,Math.max(0,html.indexOf(fragment))).split('\n').length});let s=html.replace(/<!--[\s\S]*?-->/g,'');
 for(const [rule,re] of [['fixed price',/\bfixed(?: equipment)? price\b/i],['ice',/\bice\b/i],['refrigerant',/\b(?:R290|R32|propane)\b/i],['em dash',/—/],['install timing',/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b[^.!?]{0,90}\b(?:install(?:ed|ation)?|batch|booked)\b|\b(?:install(?:ed|ation)?|batch|booked)\b[^.!?]{0,90}\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b|\bdeliver\w*\b[^.!?]{0,90}\b20\d{2}\b/i]]){const m=text(s).match(re);if(m)hit(rule,m[0]);}
 for(const m of s.matchAll(/<(?:p|li|td|summary)\b[^>]*>[\s\S]*?<\/(?:p|li|td|summary)>/g)){const t=text(m[0]);if(/70\s*°?C/i.test(t)&&/\bhot water\b/i.test(t))hit('70C hot water',m[0]);}
 let money=s.replace(/<section\b[^>]*data-web-bundle-estimates[^>]*>[\s\S]*?<\/section>/g,m=>{const t=text(m);if(file!=='hydronic/pricing/index.html'||!t.includes(BASIS)||!['about $1,800 to $2,600','about $800 to $1,400','about $0 to $900'].every(x=>t.includes(x))){hit('estimates basis/ranges',m);return m;}let left=t.replace(BASIS,'');for(const x of ['about $1,800 to $2,600','about $800 to $1,400','about $0 to $900'])left=left.replace(x,'');if(left.includes('$'))hit('unapproved estimate dollars',m);return '';});
 money=decode(money).replace(/<[^>]+>/g,m=>/^<meta\b/i.test(m)?m:' ');
 money=money.split(PRICE).join('');if(file==='hydronic/pricing/index.html')money=money.split(COMPARISON).join('');
 money=money.replace(/\$990(?=[^.!?<>]{0,100}\b(?:deposit|booking)\b)|\$3,000(?=[^.!?<>]{0,100}\bproduction\b)/gi,'');
 if(money.includes('$'))hit('unapproved dollars',money.slice(Math.max(0,money.indexOf('$')-25),money.indexOf('$')+60));
 let hasCTA=false;for(const m of s.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)){const tag=m[0].slice(0,m[0].indexOf('>')+1);if(!/class="[^"]*\bbtn\b/.test(tag)&&!/(?:See your own number|book a 15-minute chat)/i.test(text(m[0])))continue;const href=tag.match(/href="([^"]*)"/)?.[1];if(href==='/start/'||href===BOOK)hasCTA=true;else hit('CTA destination',m[0]);}if(!hasCTA)hit('missing CTA','<main');
 for(const m of s.matchAll(/<img\b[^>]*>/g))if(!/\balt="[^"]+"/.test(m[0])&&!/\b(?:role="presentation"|aria-hidden="true")/.test(m[0]))hit('image alt',m[0]);
 return hits;
}
const clean='<main><p>'+PRICE+'.</p><a class="btn" href="/start/">See if it suits your home</a><img alt="Thermal store" src="x"></main>';
assert.deepEqual(check('example/index.html',clean),[]);let cases=1;
for(const bad of ['fixed price','ice','R290','R32','propane','—','$5','Booked in November, installed in February.','Delivery in 2027.','Hot water at 70°C.']){assert(check('example/index.html',clean.replace('</p>',' '+bad+'</p>')).length,bad);cases++;}
assert(check('example/index.html',clean.replace('href="/start/"','href="/contact/"')).some(h=>h.rule==='CTA destination'));cases++;
assert(check('example/index.html',clean.replace('alt="Thermal store"','')).some(h=>h.rule==='image alt'));cases++;
const partial='<!-- WEB_BUNDLE_ESTIMATES --><!-- /WEB_BUNDLE_ESTIMATES --><!-- WEB_BUNDLE_POOL_ROW --><!-- /WEB_BUNDLE_POOL_ROW --><h2>Heat. Hot water.</h2>'+clean;
const ready=render(partial,{estimatesReady:true,poolRowHtml:'<div>Pool heating</div>'});assert.deepEqual(check('hydronic/pricing/index.html',ready),[]);cases++;
assert(check('hydronic/pricing/index.html',ready.replace(BASIS,'Missing basis')).some(h=>h.rule==='estimates basis/ranges'));cases++;
assert(check('hydronic/index.html',ready).length);cases++;
assert(render(ready,{estimatesReady:false,poolRowHtml:''}).includes('<h2>Heat. Hot water.</h2>'));assert(!render(ready,{estimatesReady:false,poolRowHtml:''}).includes('about $'));cases++;
const pages=new Set(require('../tools/web-bundle-pages.json'));for(const args of [['diff','--name-only','HEAD'],['diff','--cached','--name-only']])for(const f of cp.execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim().split('\n'))if(f.endsWith('.html'))pages.add(f.trim());
const hits=[...pages].flatMap(f=>check(f,fs.readFileSync(path.join(root,f),'utf8')));for(const h of hits)console.error(h.file+':'+h.line+' '+h.rule);console.log('Contract: '+pages.size+' pages, '+cases+' mutation/partial checks, '+hits.length+' hits.');if(hits.length)process.exitCode=1;
module.exports={check};
