const fs=require('fs'),path=require('path'),assert=require('assert/strict'),cp=require('child_process');const root=path.resolve(__dirname,'..');
const v=require('../vercel.json');const before=JSON.parse(cp.execFileSync('git',['show','6cb6b928b2595721deb1916478a83ea2b890f5ef:vercel.json'],{cwd:root,encoding:'utf8'}));
const n=fs.readFileSync(path.join(root,'netlify.toml'),'utf8');const net=[...n.matchAll(/\[\[redirects\]\]([\s\S]*?)(?=\[\[|$)/g)].map(m=>({source:m[1].match(/from = "([^"]*)"/)?.[1],destination:m[1].match(/to = "([^"]*)"/)?.[1]}));
function next(p,host){return v.redirects.find(r=>r.source===p&&(!r.has||r.has.every(h=>h.type==='host'&&h.value===host)))?.destination;}
const overrides={'/learn':'/hydronic/how-it-works/','/register':'/start/','/register-interest-installer':'/start/'};
let count=0;for(const r of before.redirects.filter(r=>!r.has&&!r.source.includes('(')&&r.destination.startsWith('/'))){const expected=overrides[r.source.replace(/\/$/,'')]||r.destination;let dest=expected;while(before.redirects.some(x=>!x.has&&x.source===dest)){dest=before.redirects.find(x=>!x.has&&x.source===dest).destination;}if(expected.startsWith('/pre-order/register-interest'))dest='/start/';
 assert.equal(next(r.source,'www.thermaldawn.com'),dest,r.source);assert(!next(dest,'www.thermaldawn.com'),'chain '+r.source);assert(fs.existsSync(path.join(root,dest,'index.html'))||fs.existsSync(path.join(root,dest)),dest);
 for(const host of ['freevolt.com.au','www.freevolt.com.au'])assert.equal(next(r.source,host),'https://www.thermaldawn.com'+dest,host+r.source);count+=4;
 const twin=net.find(x=>x.source===r.source);if(twin){assert.equal(twin.destination,dest,'Netlify '+r.source);assert(!net.some(x=>x.source===dest),'Netlify chain '+r.source);count+=2;}
}
for(const p of ['/product','/pricing','/how-it-works','/hydronic-overview','/register','/pre-order-form','/post/i-want-to-replace-my-ducted-gas-heating-what-are-my-options','/learn'])assert(next(p,'www.thermaldawn.com'),p);
assert.equal(next('/post/i-want-to-replace-my-ducted-gas-heating-what-are-my-options','www.thermaldawn.com'),'/blog/heat-pump-replace-gas-hydronic-boiler/');assert(fs.existsSync(path.join(root,'blog/heat-pump-pipe-diameter-myth/index.html')));
console.log('Redirects: '+count+' configuration assertions pass; existing aliases reach files without path or domain chains.');
