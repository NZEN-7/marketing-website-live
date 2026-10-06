/* No personal details are persisted in browser storage. */
(function(){'use strict';
 var form=document.getElementById('stand-form'),error=document.getElementById('capture-error'),result=document.getElementById('capture-result'),another=document.getElementById('capture-another'),send=form.querySelector('[type=submit]');
 var initialEvent=new URLSearchParams(location.search).get('event')||'electrify-boroondara',ts=Date.now(),busy=false;
 form.elements.event.value=initialEvent;form.elements.nojs.value='0';
 function id(){var a=new Uint8Array(5);crypto.getRandomValues(a);return 'il-'+Array.from(a,function(v){return v.toString(16).padStart(2,'0')}).join('')}
 form.elements.lead_id.value=id();
 function fail(message){error.textContent=message;error.hidden=false;error.focus()}
 form.addEventListener('submit',async function(e){e.preventDefault();if(busy)return;error.hidden=true;
  if(!form.elements.phone.value.trim()&&!form.elements.email.value.trim()){fail('Please enter a phone number or email address.');return}
  if(!form.reportValidity())return;
  busy=true;send.disabled=true;send.textContent='Sending…';
  var data=Object.fromEntries(new FormData(form));data.ts=ts;
  try{
   // Preserve the existing three-second page stamp even for very fast entries.
   await new Promise(function(r){setTimeout(r,Math.max(0,3001-(Date.now()-ts)))});
   var response=await fetch('/api/lead/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(20000)}),answer=await response.json();
   if(!response.ok||!answer.ok||!answer.sent||(!answer.saved&&!answer.preview))throw new Error(answer.error||'Capture not confirmed. Check Nick\'s notification before retrying.');
   result.textContent=answer.preview?'Preview: test email sent; no CRM row saved.':'Done: saved and emailed';result.hidden=false;form.hidden=true;another.hidden=false;result.focus();
  }catch(e){fail(e.name==='TimeoutError'?'Confirmation timed out. Check Nick\'s notification before retrying.':e.message||'Capture not confirmed. Check Nick\'s notification before retrying.')}
  finally{busy=false;send.disabled=false;send.textContent='Send'}
 });
 another.addEventListener('click',function(){var event=form.elements.event.value;form.reset();form.elements.event.value=event;form.elements.nojs.value='0';form.elements.lead_id.value=id();ts=Date.now();error.hidden=true;result.hidden=true;another.hidden=true;form.hidden=false;form.elements.name.focus()});
})();
