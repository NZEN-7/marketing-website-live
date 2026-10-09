const fs=require('fs'),path=require('path'),assert=require('assert/strict'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),PRICE='From $12,000 for the equipment; installation depends on the house',COMPARISON='A premium heat pump replacement without storage typically costs $20,000 to $30,000 installed, and more for large homes.',BOOK='https://calendly.com/nickz-thermaldawn/30min';
function decode(s){return s.replace(/&#(?:x([0-9a-f]+)|(\d+));/gi,(_,h,d)=>String.fromCodePoint(parseInt(h||d,h?16:10))).replace(/&mdash;/gi,'—').replace(/&deg;/gi,'°').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/g,"'");}
function text(s){return decode(s.replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();}
const known=[];
function check(file,html,{cta=true}={}){const hits=[],hit=(rule,fragment)=>hits.push({file,rule,line:html.slice(0,Math.max(0,html.indexOf(fragment))).split('\n').length});let s=html.replace(/<!--[\s\S]*?-->/g,'');
 // Web 2a (CGO, 9 Oct): home may carry the ruled comparison card and Mike & Kay's quote. Two items on home are
 // known and not changed (the savings tile, kept by Nick, item 98; the tariff-history charts): reported here, not failed.
 // Web 2 (W2-30, CFO): the battery card and its footnote.
 if(file==='index.html'){s=s.replace('<b>$20,000 to $30,000</b>','').replace('<b>About $10,000 to $15,000</b>','').replace('at about $1,000 to $1,150 per kWh for battery and inverter (Solar Choice price index, May 2026)','').replace(/<blockquote>"We've been looking for 5 years[^<]*\$25,000[^<]*<\/blockquote>/,'');
  for(const [what,re] of [['savings tile (kept, item 98)',/<dd>\$<span data-live-stat="totalSavedAud">[^<]*<\/span><\/dd>/],['tariff-history charts',/<svg class="mt-2" viewBox="0 0 320 190" role="img" aria-label="(?:Solar export|Grid electricity) price:[\s\S]*?<\/svg>/g]])
   s=s.replace(re,m=>{known.push(file+': '+what);return '';});}
 // Web 1 §5a 1a (Nick, 7 Oct): the Hawthorn proof paragraph on /hydronic/ may carry its app totals
 // and "since install in <month>". Only that one paragraph, only on that page.
 if(file==='hydronic/index.html')s=s.replace(/<p class="lead"><strong>(?:A home in |In )Hawthorn, Melbourne<\/strong>[\s\S]*?<\/p>/,'');
 for(const [rule,re] of [['fixed price',/\bfixed(?: equipment)? price\b/i],['in development',/\bin development\b/i],['ice',/\bice\b/i],['refrigerant',/\b(?:R290|R32|propane)\b/i],['em dash',/—/],['install timing',/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b[^.!?]{0,90}\b(?:install(?:ed|ation)?|batch|booked)\b|\b(?:install(?:ed|ation)?|batch|booked)\b[^.!?]{0,90}\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b|\bdeliver\w*\b[^.!?]{0,90}\b20\d{2}\b/i]]){const m=text(s).match(re);if(m)hit(rule,m[0]);}
 for(const m of s.matchAll(/<(?:p|li|td|summary)\b[^>]*>[\s\S]*?<\/(?:p|li|td|summary)>/g)){const t=text(m[0]);if(/70\s*°?C/i.test(t)&&/\bhot water\b/i.test(t))hit('70C hot water',m[0]);}
 let money=s;
 money=decode(money).replace(/<[^>]+>/g,m=>/^<meta\b/i.test(m)?m:' ');
 money=money.split(PRICE).join('');if(file==='hydronic/pricing/index.html')money=money.split(COMPARISON).join('');
 money=money.replace(/\$990(?=[^.!?<>]{0,100}\b(?:deposit|booking)\b)|\$3,000(?=[^.!?<>]{0,100}\bproduction\b)/gi,'');
 if(money.includes('$'))hit('unapproved dollars',money.slice(Math.max(0,money.indexOf('$')-25),money.indexOf('$')+60));
 let hasCTA=false;for(const m of s.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)){const tag=m[0].slice(0,m[0].indexOf('>')+1);if(!/class="[^"]*\bbtn\b/.test(tag)&&!/(?:See your own number|book a 15-minute chat)/i.test(text(m[0])))continue;const href=tag.match(/href="([^"]*)"/)?.[1];if(href==='/start/'||href===BOOK)hasCTA=true;else if(cta)hit('CTA destination',m[0]);}if(cta&&!hasCTA)hit('missing CTA','<main');
 for(const m of s.matchAll(/<img\b[^>]*>/g))if(!/\balt="[^"]+"/.test(m[0])&&!/\b(?:role="presentation"|aria-hidden="true")/.test(m[0]))hit('image alt',m[0]);
 return hits;
}
const clean='<main><p>'+PRICE+'.</p><a class="btn" href="/start/">See if it suits your home</a><img alt="Thermal store" src="x"></main>';
assert.deepEqual(check('example/index.html',clean),[]);let cases=1;
for(const bad of ['fixed price','ice','R290','R32','propane','—','$5','Booked in November, installed in February.','Delivery in 2027.','Hot water at 70°C.']){assert(check('example/index.html',clean.replace('</p>',' '+bad+'</p>')).length,bad);cases++;}
assert(check('example/index.html',clean.replace('href="/start/"','href="/contact/"')).some(h=>h.rule==='CTA destination'));cases++;
assert(check('example/index.html',clean.replace('alt="Thermal store"','')).some(h=>h.rule==='image alt'));cases++;
// Estimates are no longer an allowed dollar exception, even with a basis.
for(const figure of ['$1,800','$2,600','$800','$1,400','$0','$900']){assert(check('hydronic/pricing/index.html',clean.replace('</main>','<section data-web-bundle-estimates><p>about '+figure+' per year, typical Melbourne home, your home will differ</p></section></main>')).some(h=>h.rule==='unapproved dollars'));cases++;}
assert.deepEqual(check('hydronic/pricing/index.html',clean.replace('</main>','<p>'+COMPARISON+'</p></main>')),[]);cases++;
assert(check('hydronic/index.html',clean.replace('</main>','<p>'+COMPARISON+'</p></main>')).length);cases++;
const pricing=fs.readFileSync(path.join(root,'hydronic/pricing/index.html'),'utf8');
// Web 1 §5a (Nick, 7 Oct): the four-card block with cooling; Web 2b (W2b-22): an optional add-on, quoted for your home.
assert(pricing.includes('<h2>Heat. Cool. Hot water. Pool. One Thermal Dawn system.</h2>'));assert(pricing.includes('<h3>Pool Heating</h3>'));assert(pricing.includes("Thermal Dawn can run in reverse cycle to cool your home in summer, through hydronic underfloor cooling or fan coil units. An optional add-on, quoted for your home."));cases++;
assert(pricing.includes("Your running cost depends mostly on three things: your electricity tariff, whether you have solar, and whether your plan has a free or cheap window. A thermal store lets the heat pump make heat when power is cheapest and keep it for the evening, when power costs most. Every home is different, so we estimate yours from your own bills."));cases++;
assert(!/WEB_BUNDLE_|data-web-bundle-estimates|What it costs to run: estimates/.test(pricing));cases++;
const running=pricing.match(/<div[^>]*data-running-costs[^>]*>([\s\S]*?)<\/div>/)?.[1];assert(running&&!running.includes('$'));assert(running.includes('href="/start/">See your own number')&&running.includes(BOOK+'">or book a 15-minute chat'));cases++;
assert(!fs.existsSync(path.join(root,'tools/web-bundle-oct10.json'))&&!fs.existsSync(path.join(root,'tools/update-web-bundle-partials.cjs')));cases++;
const pages=new Set(require('../tools/web-bundle-pages.json'));for(const args of [['diff','--name-only','HEAD'],['diff','--cached','--name-only']])for(const f of cp.execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim().split('\n'))if(f.endsWith('.html')&&fs.existsSync(path.join(root,f.trim())))pages.add(f.trim());
const bundle=new Set(require('../tools/web-bundle-pages.json'));
const hits=[...pages].flatMap(f=>check(f,fs.readFileSync(path.join(root,f),'utf8'),{cta:bundle.has(f)}));for(const h of hits)console.error(h.file+':'+h.line+' '+h.rule);// The Hawthorn exemption stays narrow: the same paragraph on another page still hits, and any
// other dollar figure on /hydronic/ still hits.
{const para='<p class="lead"><strong>A home in Hawthorn, Melbourne</strong>: totals since install in June: <span>$1,685</span> saved.</p>';
 const h=fs.readFileSync(path.join(root,'hydronic/index.html'),'utf8');
 assert(check('hydronic/pricing/index.html',fs.readFileSync(path.join(root,'hydronic/pricing/index.html'),'utf8').replace('</main>',para+'</main>')).some(x=>x.rule==='unapproved dollars'));
 assert(check('hydronic/index.html',h.replace('</main>','<p>Only $5,000.</p></main>')).some(x=>x.rule==='unapproved dollars'));cases+=2;}
{const ex=clean.replace('</main>','<b>$20,000 to $30,000</b></main>');assert(check('contact/index.html',ex).some(h=>h.rule==='unapproved dollars'));
 assert(check('index.html',clean.replace('</main>','<p>Only $5,000.</p></main>'),{cta:false}).some(h=>h.rule==='unapproved dollars'));
 assert(check('contact/index.html',clean.replace('</p>',' a fixed price</p>'),{cta:false}).some(h=>h.rule==='fixed price'));
 assert.deepEqual(check('contact/index.html',clean.replace('href="/start/"','href="/contact/"'),{cta:false}),[]);cases+=4;}
for(const k of new Set(known))console.log('known, not failed: '+k);
{const hiw=fs.readFileSync(path.join(root,'hydronic/how-it-works/index.html'),'utf8');
 for(const id of ['hour-by-hour','what-we-check','will-it-fit','what-to-expect'])assert(hiw.includes('id="'+id+'"'),'anchor '+id);
 for(const f of ['hydronic/index.html','hydronic/pricing/index.html','hydronic/how-it-works/index.html']){const own=fs.readFileSync(path.join(root,f),'utf8');for(const m of own.matchAll(/href="(\/hydronic\/how-it-works\/)?#([a-z-]+)"/g))assert((m[1]?hiw:own).includes('id="'+m[2]+'"'),f+' links to a missing anchor #'+m[2]);}
 assert(check('example/index.html',clean.replace('</p>',' It is in development.</p>')).some(h=>h.rule==='in development'));cases+=3;}
console.log('Contract: '+pages.size+' pages, '+cases+' mutation/content checks, '+hits.length+' hits.');if(hits.length)process.exitCode=1;
module.exports={check};
