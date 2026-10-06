"use strict";
const crypto=require('crypto'),intake=require('./_intake.js');
const line=(v,n)=>String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,n);
function parse(b){
 const d={form:'stand',formLabel:'Event capture',name:line(b.name,120),email:line(b.email,254),phone:line(b.phone,40),postcode:line(b.postcode,20),notes:String(b.note||'').trim().slice(0,5000),event:line(b.event||'electrify-boroondara',80),consent:b.consent===true||b.consent==='on',outcome:'stand'};
 if(!d.name)return{error:'Please enter a name.'};
 if(!d.email&&!d.phone)return{error:'Please enter a phone number or email address.'};
 if(d.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email))return{error:'Please check the email address.'};
 if(d.phone&&!intake.PHONE_OK(d.phone))return{error:'Please check the phone number.'};
 if(d.postcode&&!/^\d{4}$/.test(d.postcode))return{error:'Please enter a four-digit postcode.'};
 if(!d.consent)return{error:"Please confirm they're happy for us to contact them."};
 if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(d.event))return{error:'Use letters, numbers, hyphens or underscores for the event tag.'};
 if(b.lead_id&&!/^il-[0-9a-f]{10}$/.test(b.lead_id))return{error:'Invalid capture reference. Reload the page.'};
 // Native forms cannot generate a fresh client ID. Identical native entries on
 // the same Sydney day share an ID, so browser refresh/back re-posts dedupe
 // across instances. Nothing identifying is stored in browser storage or logs.
 const nativeKey=String(b.nojs)==='1' ? crypto.createHash('sha256').update(JSON.stringify([new Date().toLocaleDateString('en-CA',{timeZone:'Australia/Sydney'}),d.event,d.name,d.email,d.phone,d.postcode,d.notes])).digest('hex').slice(0,10) : crypto.randomBytes(5).toString('hex');
 d.lead_id=b.lead_id||'il-'+nativeKey;return{data:d};
}
function row(d,base){return Object.assign(base,{source_site:'event',referral_source:'stand',comments:d.notes||null,intake_lead_id:d.lead_id,intake_event:'complete',answers:{consent_to_contact:true,source:'event',utm_source:'event',utm_medium:'stand',utm_campaign:d.event,event:d.event,note:d.notes}})}
function notification(d,when){
 const note=(d.notes||'-').split(/\r?\n/).map(l=>l.replace(/[^\S\n]+/g,' ').trim()).join('\n> ');
 return ['Form: Event capture','Submission Time: '+when,'Lead ID: '+d.lead_id,'Tags: source:event, medium:stand, event:'+d.event,'','CONTACT','Name: '+d.name,'Email: '+(d.email||'-'),'Phone: '+(d.phone||'-'),'Consent to be contacted: Yes','','LOCATION','Postcode: '+(d.postcode||'-'),'','CONTEXT','Comments: '+note,''].join('\n');
}
module.exports={parse,row,notification};
