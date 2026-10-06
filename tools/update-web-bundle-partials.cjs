const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const BASIS="Estimates for a typical Melbourne hydronic home at 2026 Victorian prices. Thermal Dawn's cost depends mostly on whether you have solar or a free midday power window. Your home will differ: we'll estimate yours from your bills.";
function render(html,config){
 const estimates=config.estimatesReady?'<section data-web-bundle-estimates><h2>What it costs to run: estimates</h2><table><caption>Annual heating cost (estimate)</caption><tbody><tr><th scope="row">Gas boiler</th><td>about $1,800 to $2,600</td></tr><tr><th scope="row">Standard heat pump</th><td>about $800 to $1,400</td></tr><tr><th scope="row">Thermal Dawn</th><td>about $0 to $900</td></tr></tbody></table><p>'+BASIS+'</p><p><a href="/start/">See your own number</a> · <a href="https://calendly.com/nickz-thermaldawn/30min">or book a 15-minute chat</a></p></section>':'';
 const replace=(name,value)=>{const re=new RegExp('<!-- '+name+' -->[\\s\\S]*?<!-- /'+name+' -->');if(!re.test(html))throw new Error('Missing partial '+name);html=html.replace(re,'<!-- '+name+' -->'+value+'<!-- /'+name+' -->');};
 replace('WEB_BUNDLE_ESTIMATES',estimates);replace('WEB_BUNDLE_POOL_ROW',config.poolRowHtml||'');
 html=html.replace(/<h2>Heat\. Hot water\.(?: Pool\.)?<\/h2>/,'<h2>Heat. Hot water.'+(config.poolRowHtml?' Pool.':'')+'</h2>');return html;
}
if(require.main===module){const file=path.join(root,'hydronic/pricing/index.html');fs.writeFileSync(file,render(fs.readFileSync(file,'utf8'),JSON.parse(fs.readFileSync(path.join(__dirname,'web-bundle-oct10.json')))));}
module.exports={render,BASIS};
