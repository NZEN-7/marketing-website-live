/**
 * Parse a Thermal Dawn lead notification body into fields.
 *
 * Deliberately pure: no Gmail, no Drive, no Apps Script APIs. That is what
 * lets `npm run test:parser` run it in Node against the exact bodies
 * api/lead.js produces, so a field label renamed on the website fails a test
 * here instead of silently breaking lead capture in production.
 *
 * Paste this into the Apps Script project alongside lead-capture.gs.
 *
 * Two properties of the real emails shaped this, both confirmed against sent
 * messages rather than assumed:
 *
 *   1. Gmail's plain-text body arrives as ONE run-on line, fields separated by
 *      runs of spaces rather than newlines. A parser that splits on lines finds
 *      a single record and silently drops every field after the first.
 *   2. Wix wraps multi-selects as "List(a, b)". api/lead.js comma-joins them.
 *
 * The Wix site and the new site emit the same field labels, so one parser
 * covers both and the cutover needs no switch. Do not add one.
 */

var LEAD_LABELS = [
  'Form', 'Submission Time', 'First name', 'Last name', 'Email', 'Phone',
  'Suburb', 'State', 'Solar', 'Battery', 'Current heating/cooling system',
  "What's driving interest", 'Timeline', 'Comments',
  'How did you hear about us', 'Newsletter opt-in',
  'Tier', 'Name'
];

/* Section headers sit inline in the run-on body. Without stripping them they
   get swallowed into the value of whichever field precedes them: the contact
   form parsed as "radcliffesimon@gmail.com MESSAGE -" until MESSAGE was added
   here, found by test-lead-parser.js rather than in production.

   This must list EVERY header api/lead.js emits, across all five forms. The
   test asserts exactly that, so adding a form with a new section header fails
   there instead of silently corrupting the field before it.

   Matching on a generic /[A-Z ]{3,}/ instead is not safe: "State: VIC" and
   "State: NSW" would lose their values. */
var LEAD_SECTIONS = [
  'CONTACT', 'LOCATION', 'PROPERTY', 'CURRENT SETUP',
  'MOTIVATION AND TIMING', 'CONTEXT', 'MESSAGE', 'DEPOSIT'
];

function leadEsc_(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function leadClean_(v) {
  v = String(v).replace(/\s+/g, ' ').trim();
  var sect = LEAD_SECTIONS.map(leadEsc_).join('|');
  v = v.replace(new RegExp('^(' + sect + ')\\s*'), '').trim();
  /* A value never spans a section, so cut at the first header rather than only
     trimming one off the end. The contact form puts no label after MESSAGE, so
     Email used to absorb the header and the whole message text with it. */
  v = v.split(new RegExp('\\s(?:' + sect + ')(?:\\s|$)'))[0].trim();
  var m = v.match(/^List\((.*)\)$/);   // Wix multi-select wrapper
  if (m) v = m[1];
  return v;
}

/* The contact form writes its message as bare text under a MESSAGE header,
   with no "Label:" in front of it, so the label pass cannot see it. Without
   this the only thing a contact enquiry actually says is dropped. */
function leadMessageBody_(body) {
  var m = String(body).match(
    /(?:^|\n)\s*MESSAGE\s*\n([\s\S]*?)(?=\n\s*[A-Z][A-Z &]{3,}\s*\n|$)/);
  if (!m) return '';
  var v = m[1].replace(/\s+/g, ' ').trim();
  return (v === '-') ? '' : v;
}

/**
 * @param {string} body plain-text notification body
 * @return {Object} label -> value, omitting anything blank
 */
function parseLead(body) {
  // Everything past the footer is mail-client boilerplate, not lead data.
  body = String(body).split(
    /Click on the link below|This email was sent as a notification|Can't see this message/
  )[0];

  var stop = LEAD_LABELS.map(function (l) { return leadEsc_(l) + '\\s*:'; }).join('|');
  var out = {};
  for (var i = 0; i < LEAD_LABELS.length; i++) {
    var label = LEAD_LABELS[i];
    var re = new RegExp(
      leadEsc_(label) + '\\s*:\\s*([\\s\\S]*?)(?=\\s*(?:' + stop + ')|$)'
    );
    var m = body.match(re);
    if (m) {
      var v = leadClean_(m[1]);
      if (v) out[label] = v;
    }
  }
  if (!out['Comments']) {
    var msg = leadMessageBody_(body);
    if (msg) out['Comments'] = msg;
  }
  return out;
}

/* Apps Script ignores this; Node uses it. The typeof guard is what lets one
   file be both a .gs to paste and a module to test. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseLead: parseLead,
    LEAD_LABELS: LEAD_LABELS,
    LEAD_SECTIONS: LEAD_SECTIONS
  };
}
