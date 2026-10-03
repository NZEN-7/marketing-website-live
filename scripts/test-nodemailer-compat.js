/* Real Nodemailer compatibility checks. Memory-only stream transport;
   no SMTP connection, remote URL, credential or real email. */
'use strict';
const assert=require('node:assert/strict');
const net=require('node:net');
net.Socket.prototype.connect=()=>{throw new Error('Network forbidden in compatibility test');};
const nodemailer=require('nodemailer');
const lead=require('../api/lead.js');
(async()=>{
  assert.equal(typeof nodemailer.createTransport,'function');
  console.log('ok CommonJS createTransport API');
  const smtp=nodemailer.createTransport({host:'smtp.gmail.com',port:465,secure:true,auth:{user:'test@example.invalid',pass:'synthetic'}});
  assert.equal(smtp.options.port,465);assert.equal(smtp.options.secure,true);smtp.close();
  console.log('ok Existing SMTP options construct without connecting');
  const transport=nodemailer.createTransport({streamTransport:true,buffer:true,newline:'windows',disableFileAccess:true,disableUrlAccess:true});
  const fixture=lead.parseSubmission({form:'contact',name:'Test Fixture',email:'test@example.invalid',message:'Synthetic compatibility check'});
  assert.ok(!fixture.error);
  const text=lead.formatNotification(fixture.data,'Synthetic timestamp');
  const info=await transport.sendMail({from:'sender@example.invalid',to:'inbox@example.invalid',replyTo:fixture.data.email,subject:lead.formatSubject(fixture.data),text,attachments:[{filename:'fixture.pdf',content:Buffer.from('%PDF-1.4\nSynthetic fixture'),contentType:'application/pdf'}]});
  assert.deepEqual(info.envelope.to,['inbox@example.invalid']);assert.equal(info.envelope.from,'sender@example.invalid');
  const mime=info.message.toString('utf8');assert.match(mime,/Reply-To: test@example.invalid/);assert.match(mime,/filename=fixture.pdf|filename="fixture.pdf"/);assert.ok(Buffer.isBuffer(info.message));
  console.log('ok Notification MIME, reply-to, attachment and exact envelope');
  for(const kind of ['contact','subscribe','interest-list','interest-list-served']){
    const form=kind==='interest-list-served'?'interest-list':kind;
    const raw=form==='contact'?{form,name:'Test Fixture',email:'test@example.invalid',message:'Synthetic'}:form==='subscribe'?{form,email:'test@example.invalid',optin:true}:{form,first_name:'Test',email:'test@example.invalid',state:kind==='interest-list-served'?'NSW':'QLD',postcode:'4000',interest:'Heating',heating:'Gas ducted',timeline:'Now',consent:'on'};
    const parsed=lead.parseSubmission(raw);assert.ok(!parsed.error);
    const mail=lead.firstEmail(parsed.data);assert.ok(mail && mail.subject && mail.text);
    const result=await transport.sendMail({from:'sender@example.invalid',to:parsed.data.email,subject:mail.subject,text:mail.text});
    assert.deepEqual(result.envelope.to,['test@example.invalid']);assert.ok(result.message.length>mail.text.length);
    console.log('ok '+kind+' first-email composes using real memory transport');
  }
  transport.close();
})().catch(e=>{console.error(e.message);process.exitCode=1;});
