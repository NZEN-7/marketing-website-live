"use strict";
const path = require("path");
// Customer first emails only. Internal notifications keep their plain-text contract.
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
module.exports = function customerEmail(body, booking) {
  const textSignature = ['Best regards,','Nick Zeniou','Founder','(02) 7228 3430',
    'thermaldawn.com | Book a call: ' + booking,'Hornsby NSW, 2077, Australia','ABN 47 682 866 913'].join('\n');
  const signature = `<p style="margin:0 0 12px">Best regards,<br><strong>Nick Zeniou</strong><br>Founder</p>
<img src="cid:td-logo@thermaldawn.com" alt="Thermal Dawn" width="260" height="52" style="display:block;width:260px;height:52px;border:0;margin:0 0 12px">
<p style="margin:0"><a href="tel:+61272283430">(02) 7228 3430</a><br><a href="https://thermaldawn.com">thermaldawn.com</a> | <a href="${escapeHtml(booking)}">Book a call</a><br><em>Hornsby NSW, 2077, Australia</em><br><span style="font-size:12px">ABN 47 682 866 913</span></p>`;
  // Escape all body copy, including greeting and configured URL, before adding markup.
  const paragraph = s => s.trim() ? s.trim().split(/\n\s*\n/).map(p => '<p style="margin:0 0 16px">' + escapeHtml(p).split(escapeHtml(booking)).join('<a href="'+escapeHtml(booking)+'">'+escapeHtml(booking)+'</a>').replace(/\n/g,'<br>') + '</p>').join('') : '';
  const parts = body.split('{signature}');
  if (parts.length !== 2) throw new Error('Customer email requires exactly one signature');
  return {text: body.replace('{signature}',textSignature),
    html: '<!doctype html><html lang="en"><body>' + paragraph(parts[0]) + signature + (parts[1].trim() ? '<div style="margin-top:16px">'+paragraph(parts[1])+'</div>' : '') + '</body></html>',
    // The logo travels inside the email (inline, cid), so it shows before the site is live, in previews,
    // and in clients that block remote images. White-backed so it reads in dark mode too.
    attachments: [{ filename: 'thermal-dawn.png', path: path.join(__dirname, '..', 'assets', 'email', 'logo.png'), cid: 'td-logo@thermaldawn.com', contentDisposition: 'inline' }]};
};
