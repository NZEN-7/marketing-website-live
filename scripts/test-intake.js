/* The intake prototype (PRD D13): the routing table (SPEC §1), the server's
   parse and notification (SPEC §7), and the attachment rule (PRD D3).
   No credentials, no network.

     npm run test:intake
*/
"use strict";

const path = require("path");
const R = require(path.join(__dirname, "..", "assets", "js", "intake-route.js"));
const I = require(path.join(__dirname, "..", "api", "_intake.js"));
const lead = require(path.join(__dirname, "..", "api", "lead.js"));

let failed = 0;
const check = (label, cond, got) => {
  if (cond) console.log(`ok    ${label}`);
  else { console.error(`FAIL  ${label}${got !== undefined ? ": " + JSON.stringify(got) : ""}`); failed++; }
};

/** Walk the routing table from S1, answering from `a`, until a result screen. */
function walk(a) {
  const out = [];
  let s = "S1";
  for (let i = 0; i < 30 && s; i++) {
    out.push(s);
    if (/^(MATCH|MATCH_SHORT|URGENT|O1|N1|R1|DONE)$/.test(s)) break;
    s = R.next(s, a);
  }
  return out.join(" ");
}
const VIC = { state: "VIC", phone: "0400000001" };

// ---- the paths (SPEC §1) ----
check("state: 3121 VIC, 2000 NSW, 2600 ACT, 2880 NSW, 4000 QLD, 0800 NT",
  R.stateFor("3121") === "VIC" && R.stateFor("2000") === "NSW" && R.stateFor("2600") === "ACT" &&
  R.stateFor("2880") === "NSW" && R.stateFor("4000") === "QLD" && R.stateFor("0800") === "NT");
// The live form (Nick, 4 Oct): one screen per question as on production, minus
// the own-or-rent question (S9) and the renter close (R1)
check("fit boiler: the live path without S9",
  walk(Object.assign({ intent: "fit", heating: ["boiler_radiators"] }, VIC)) === "S1 S2 S3 S4 S4b S5 S6 S7 S8 S10 S11 S12 S13 B2 MATCH",
  walk(Object.assign({ intent: "fit", heating: ["boiler_radiators"] }, VIC)));
check("fit without boiler: S8 skipped", walk({ state: "VIC", intent: "fit", heating: ["none"] }) === "S1 S2 S3 S4 S5 S6 S7 S10 S11 S12 S13 B2 MATCH");
check("S4b only with a phone number", walk({ state: "VIC", intent: "explore", heating: ["not_sure"] }).indexOf("S4b") === -1);
check("ready to book: S7 then MATCH", walk(Object.assign({ intent: "book", heating: ["boiler_underfloor"] }, VIC)) === "S1 S2 S3 S4 S4b S5 S6 S7 B2 MATCH");
check("just exploring: S7, then the short match", walk(Object.assign({ intent: "explore", heating: ["boiler_radiators"] }, VIC)) === "S1 S2 S3 S4 S4b S5 S6 S7 B2 MATCH_SHORT");
check("urgent: S7 then URGENT", walk(Object.assign({ intent: "urgent", heating: ["lpg_boiler"] }, VIC)) === "S1 S2 S3 S4 S4b S5 S6 S7 URGENT");
check("fit with 'Broken, or about to go' jumps to URGENT from S8", walk(Object.assign({ intent: "fit", heating: ["boiler_radiators"], boiler_condition: "broken" }, VIC)).endsWith("S8 URGENT"));
check("no answer on S5 takes the full fit path", walk({ state: "NSW", heating: ["boiler_radiators"] }).endsWith("S13 B2 MATCH"));

// ---- the closes ----
check("O1: QLD goes straight to consent (S6), then closes: no phone or intent", walk({ state: "QLD", phone: "0400000001" }) === "S1 S2 S3 S6 O1");
check("O1: outside Australia, the same (no AU phone)", walk({ state: "OS" }) === "S1 S2 S3 S6 O1");
for (const h of [["splits"], ["ducted_gas"], ["other"], ["splits", "ducted_gas"]]) {
  check(`N1: ${h.join("+")} only`, walk({ state: "VIC", intent: "fit", heating: h }).endsWith("S7 N1"));
}
for (const h of [["boiler_radiators", "ducted_gas"], ["none"], ["not_sure"], ["splits", "not_sure"]]) {
  check(`must NOT close: ${h.join("+")}`, walk({ state: "VIC", intent: "fit", heating: h }).indexOf("N1") === -1);
}
check("a renter answer from an old page can't close a journey", walk({ state: "NSW", intent: "fit", heating: ["boiler_radiators"], tenure: "renter" }).endsWith("S13 B2 MATCH") && R.route({ state: "VIC", heating: ["boiler_radiators"], tenure: "renter" }) === "icp");
check("'Not sure' never closes; it routes icp-check", R.route({ state: "VIC", heating: ["not_sure"], boiler_condition: "not_sure" }) === "icp-check");
check("icp-check: 'No heating yet', and nothing picked", R.route({ state: "VIC", heating: ["none"] }) === "icp-check" && R.route({ state: "VIC" }) === "icp-check");
check("icp: a boiler picked, even alongside 'Not sure'", R.route({ state: "VIC", heating: ["lpg_boiler", "not_sure"] }) === "icp");
check("the careful match: no boiler picked", R.unconfirmed({ heating: ["not_sure"] }) && R.unconfirmed({ heating: ["none"] }) && !R.unconfirmed({ heating: ["boiler_underfloor"] }));
check("emitters: LPG alone is 'radiators or underfloor heating'", R.emitters({ heating: ["lpg_boiler"] }) === "radiators or underfloor heating");
check("emitters: LPG + gas radiators is 'radiators'", R.emitters({ heating: ["lpg_boiler", "boiler_radiators"] }) === "radiators");
check("emitters: both gas cards", R.emitters({ heating: ["boiler_radiators", "boiler_underfloor"] }) === "radiators and underfloor heating");

// ---- the match's why lines (SPEC §4) ----
check("why: none of the triggers -> no line", R.whyLines({ energy: ["none"] }).length === 0);
check("why: older boiler first, then solar",
  JSON.stringify(R.whyLines({ energy: ["solar"], boiler_condition: "getting_on", scope: ["hot_water"] })) ===
  JSON.stringify(["It replaces a boiler you'd otherwise be replacing anyway.", "Your solar can charge the store during the day."]));
check("why: the cheap window outranks the EV (Sales' case)",
  JSON.stringify(R.whyLines({ energy: ["ev", "cheap_window"], boiler_condition: "playing_up" })) ===
  JSON.stringify(["It replaces a boiler you'd otherwise be replacing anyway.", "It can charge in your cheap or free window."]));
check("why: EV alone never mentions a battery", JSON.stringify(R.whyLines({ energy: ["ev"] })) === JSON.stringify(["It works alongside your car charging."]));
check("why: battery alone", JSON.stringify(R.whyLines({ energy: ["battery"] })) === JSON.stringify(["It works alongside your battery."]));
check("why: battery and EV", JSON.stringify(R.whyLines({ energy: ["battery", "ev"] })) === JSON.stringify(["It works alongside your battery and car charging."]));
check("why: at most two lines", R.whyLines({ energy: ["solar", "battery", "cheap_window"], boiler_condition: "broken", scope: ["hot_water"] }).length === 2);

// ---- the server: parse, subject, notification (SPEC §7) ----
const base = { form: "intake", first_name: "Alex", last_name: "Sample", email: "alex@example.com", contact_pref: "email", postcode: "3122",
  suburb: "Hawthorn", state: "VIC", intent: "fit", heating: ["boiler_radiators"], boiler_condition: "not_sure", route: "icp",
  outcome: "completed", rung_reached: "done", last_screen: "S17", seen: ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10", "S11", "S12", "S13", "MATCH"] };
const p = lead.parseSubmission(base);
check("intake parses with the three required fields", !p.error && p.data.form === "intake", p.error);
check("a lead_id is issued", /^il-[0-9a-f]{10}$/.test(p.data.lead_id));
{
  // CTO item 68.1: reaching the match sends outcome "matched" (a full, non-followup send: the row and the one first email)
  const pm = lead.parseSubmission(Object.assign({}, base, { outcome: "matched", last_screen: "MATCH", rung_reached: "2" }));
  check("68.1: the server accepts outcome matched, as a first (non-followup) send", !pm.error && pm.data.outcome === "matched" && !pm.data.followup);
  const px = lead.parseSubmission(Object.assign({}, base, { outcome: "book_chat", followup: true, exit: "chat" }));
  check("69: the exit after the match is accepted (chat, deposit, keep_posted, none) and anything else is dropped", px.data.exit === "chat" && lead.parseSubmission(Object.assign({}, base, { exit: "bogus" })).data.exit === "");
  check("68.1: the notification says where it ended", /Ended on: matched \(screen MATCH\)/.test(lead.formatNotification(pm.data, "t")));
  const page = require("fs").readFileSync(require("path").join(__dirname, "..", "assets", "js", "intake.js"), "utf8");
  check("68.1: the page sends on reaching MATCH, MATCH_SHORT or URGENT, once", /if \(\/\^\(MATCH\|MATCH_SHORT\|URGENT\)\$\/\.test\(id\) && !sent && !busy\) finish\("matched"\);/.test(page));
}

// ---- stage 1, I-S1: phone-or-email on the server (rule 5 / D16) ----
const ps = (o) => lead.parseSubmission(Object.assign({}, base, { contact_pref: "" }, o));
check("I-S1: served, no phone, no email choice: refused, why=phone", ps({}).error && ps({}).why === "phone", ps({}));
check("I-S1: served, chose email: accepted", !ps({ contact_pref: "email" }).error);
check("I-S1: served, a valid AU phone: accepted", !ps({ phone: "0412 345 678" }).error && !ps({ phone: "+61 2 7228 3430" }).error);
check("I-S1: served, a malformed phone: refused", ps({ phone: "12" }).why === "phone" && ps({ phone: "12", contact_pref: "email" }).why === "phone");
check("I-S1: out of area (QLD) and NZ are never asked", !ps({ postcode: "4000", state: "QLD" }).error && !ps({ postcode: "", state: "OS" }).error);
check("I-S1: the no-JS long form is held to it too", ps({ nojs: "1" }).why === "phone");
check("I-S1: the long form's 'I'd prefer email' box counts as choosing email", !ps({ nojs: "1", prefer_email: "1" }).error &&
  ps({ nojs: "1", prefer_email: "1" }).data.contact_pref === "email");
check("the long form has that box, hidden when the stepper runs", /<label class="tick iq__nojsonly"><input type="checkbox" name="prefer_email" value="1"> I'd prefer email<\/label>/.test(require("fs").readFileSync(path.join(__dirname, "..", "start", "index.html"), "utf8")));
check("the no-JS error page exists and says nothing was sent", /Nothing has been sent yet/.test(require("fs").readFileSync(path.join(__dirname, "..", "start", "check", "index.html"), "utf8")));
check("the form label is the live one", p.data.formLabel === "Website Intake");
check("the page's own lead_id is kept, so a repeat can be spotted", lead.parseSubmission(Object.assign({}, base, { lead_id: "il-00ff00ff00" })).data.lead_id === "il-00ff00ff00");
check("a malformed lead_id is replaced", /^il-[0-9a-f]{10}$/.test(lead.parseSubmission(Object.assign({}, base, { lead_id: "il-<x>" })).data.lead_id));
const k = { lead_id: "il-1111111111", outcome: "completed" };
{
  const st = (d, t) => I.claimSend(d, t).status;
  const a = st(k, 1000), b = st(k, 1500);                       // second while the first is in flight
  I.settleSend(k, true, 2000);
  const c = st(k, 2500);                                        // after it was sent
  const u = st(Object.assign({}, k, { outcome: "urgent_call" }), 2500);
  check("claimSend: new, then pending while in flight, then done once sent; another outcome is new",
    a === "new" && b === "pending" && c === "done" && u === "new", [a, b, c, u]);
  const f = { lead_id: "il-2222222222", outcome: "completed" };
  st(f, 1000); I.settleSend(f, false);
  check("claimSend: a failed send is forgotten, so a retry is new", st(f, 1200) === "new");
  check("claimSend: a done send expires after 30 minutes", st(k, 2000 + 31 * 60 * 1000) === "new");
}
check("icp-check: the server works it out from the answers", lead.parseSubmission(Object.assign({}, base, { heating: ["not_sure"] })).data.route === "icp-check");
check("the page's own route claim is ignored", lead.parseSubmission(Object.assign({}, base, { route: "renter" })).data.route === "icp");
check("retired landlord block never prints", !/LANDLORD|Landlord phone:/.test(lead.formatNotification(lead.parseSubmission(Object.assign({}, base, { landlord_phone: "0400 000 002" })).data, "x")));
check("missing postcode is refused (unless outside Australia)", !!lead.parseSubmission(Object.assign({}, base, { postcode: "" })).error &&
  !lead.parseSubmission(Object.assign({}, base, { postcode: "", state: "OS" })).error);
check("missing last name is refused", !!lead.parseSubmission(Object.assign({}, base, { last_name: "" })).error);
check("unknown card values are dropped", lead.parseSubmission(Object.assign({}, base, { heating: ["boiler_radiators", "<script>"] })).data.heating.join() === "boiler_radiators");
const subj = lead.formatSubject(p.data);
check("subject: Website lead · name · suburb, state · route · heating · lead_id",
  subj === `Website lead · Alex Sample · Hawthorn, VIC · icp · Gas hydronic with radiators · ${p.data.lead_id}`, subj);
check("subject: URGENT first on the urgent route", lead.formatSubject(lead.parseSubmission(Object.assign({}, base, { intent: "urgent" })).data).startsWith("URGENT · "));
check("subject: no CR/LF", !/[\r\n]/.test(lead.formatSubject(lead.parseSubmission(Object.assign({}, base, { first_name: "A\r\nBcc: x@example.com" })).data)));
const body = lead.formatNotification(p.data, "30 September 2026 at 2:00 pm AEST");
const order = ["Lead ID:", "Rung reached:", "Route:", "CONTACT", "Phone:", "Best time to call:", "LOCATION", "ABOUT THE ENQUIRY", "YOUR HOME", "Heating:", "THE DETAILS", "ANYTHING ELSE"];
check("notification sections in SPEC §7 order, phone near the top", order.every((k, i) => i === 0 || body.indexOf(order[i - 1]) < body.indexOf(k)));
check("'Not sure' shows as such", /Boiler condition: Not sure/.test(body));
check("a shown-but-empty answer says Skipped", /Energy setup: Skipped/.test(body));
check("a screen never shown says Not asked", /Storeys: Not asked/.test(body));
const nj = lead.parseSubmission({ form: "intake", nojs: "1", first_name: "T", last_name: "E", email: "t@example.com", phone: "0412 345 678", postcode: "3820", heating: ["boiler_underfloor"], tenure: "owner_occupier" }).data;
check("no-JS: the server works out state and route itself", nj.state === "VIC" && nj.route === "icp", [nj.state, nj.route]);
check("a completed send reports rung 'done'", lead.parseSubmission(Object.assign({}, base, { rung_reached: "3" })).data.rung_reached === "done");
check("a page's own state claim is only a hint", lead.parseSubmission(Object.assign({}, base, { state: "QLD" })).data.state === "VIC");
check("S14's underfloor answer reaches the notification", /Underfloor covers: Most of the house/.test(lead.formatNotification(lead.parseSubmission(Object.assign({}, base, { underfloor_band: "most", seen: base.seen.concat(["S14"]) })).data, "x")));
check("no-JS posts are tagged", lead.formatSubject(lead.parseSubmission(Object.assign({}, base, { nojs: "1" })).data).endsWith("[no-JS]"));
// ---- the customer's first email (CTO Re #30): brief 07's templates, one per lead ----
const fe = (o) => lead.firstEmail(lead.parseSubmission(Object.assign({}, base, o)).data);
check("first email: a served lead on the match gets §1", fe({}).template === "register-interest" && /^Thanks Alex, let's talk about your heating$/.test(fe({}).subject));
check("first email: §1 with a phone offers the call", /I'll try to give you a quick call/.test(fe({ phone: "0412 345 678", contact_pref: "phone" }).text));
check("first email: §1 for 'I'd prefer email' offers the booking instead", /The easiest next step is a quick 15-minute chat/.test(fe({}).text) && !/give you a quick call/.test(fe({}).text));
check("first email: urgent gets §1", fe({ route: "", intent: "urgent", phone: "0412 345 678", outcome: "urgent_call" }).template === "register-interest");
check("first email: 'Not sure' heating (icp-check) gets §1", fe({ heating: ["not_sure"] }).template === "register-interest");
check("first email: O1 out of area gets §2", fe({ postcode: "4000", state: "QLD", outcome: "keep_posted" }).template === "interest-list-unserved");
check("first email: NZ gets §2", fe({ postcode: "", state: "OS", outcome: "keep_posted" }).template === "interest-list-unserved");
check("first email: N1 (split systems only) gets §2", fe({ heating: ["splits"], outcome: "keep_posted" }).template === "interest-list-unserved");
check("retired renter input gets the server-selected normal email", fe({ tenure: "renter" }).template === "register-interest");
check("first email: §2 carries the unsubscribe line", /Reply with "unsubscribe"/.test(fe({ heating: ["splits"] }).text));
check("first email: a follow-up details send gets none", lead.firstEmail(lead.parseSubmission(Object.assign({}, base, { followup: true })).data) === null);
check("first email: the no-JS long form gets one too", fe({ nojs: "1" }).template === "register-interest");
check("first email: no resume link yet (stage 2)", !/resume|come back/i.test(fe({}).text));

// ---- attachments (PRD D3) ----
const pdf = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(2000, 32)]);
const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(3000, 1)]);
const exe = Buffer.from("MZ\x90\x00 not an image");
const a = I.intakeAttachments({ uploads: [
  { slot: "winter_gas_bill", name: "bill.pdf", data: pdf.toString("base64") },
  { slot: "boiler_compliance_plate", name: "IMG_1234.HEIC", data: jpg.toString("base64") },
  { slot: "switchboard", name: "switch.jpg", data: exe.toString("base64") },
  { slot: "nope", name: "x.pdf", data: pdf.toString("base64") },
] });
check("PDF and JPEG attach, by their first bytes", a.attachments.length === 2 && a.attachments[0].contentType === "application/pdf" && a.attachments[1].contentType === "image/jpeg");
check("attachments are named by slot", a.attachments[0].filename === "winter gas bill - bill.pdf" && a.attachments[1].filename === "boiler compliance plate - IMG_1234.jpg", a.attachments.map((x) => x.filename));
check("a non-image with an image name, and an unknown slot, are refused", a.rejected.length === 2, a.rejected);
check("a file over 4 MB is refused", I.intakeAttachments({ uploads: [{ slot: "switchboard", name: "big.jpg",
  data: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(4 * 1024 * 1024 + 1)]).toString("base64") }] }).attachments.length === 0);
check("at most 6 files are considered", lead.parseSubmission(Object.assign({}, base, { uploads: new Array(9).fill({}) })).data.uploads.length === 6);

// ---- S1-3: single-line fields can't start a new line in the notification ----
{
  const h = lead.parseSubmission(Object.assign({}, base, { first_name: "Alex\r\nEmail: forged@example.com", last_name: "Sample   Phone: 1",
    suburb: "Hawthorn\nLead ID: il-aaaaaaaaaa", referrer: "Bob\n\nHeating: x", source: ["friend"], landlord_name: "Pat\nLandlord email: x@example.com" })).data;
  check("S1-3: CR/LF and whitespace runs collapse in single-line fields", h.first_name === "Alex Email: forged@example.com" && h.last_name === "Sample Phone: 1" &&
    h.suburb === "Hawthorn Lead ID: il-aaaaaaaaaa" && h.referrer === "Bob Heating: x", [h.first_name, h.last_name, h.suburb, h.referrer]);
  const body = lead.formatNotification(h, "x");
  check("S1-3: no forged label starts a line, and the real Email line is the only one", !/^(Email|Lead ID|Heating|Landlord email): (forged|il-aaaaaaaaaa|x(@|$))/m.test(body) &&
    (body.match(/^Email: /gm) || []).length === 1);
  check("S1-3: the notes keep their own lines (multi-line by design)", lead.parseSubmission(Object.assign({}, base, { notes: "a\nb" })).data.notes === "a\nb");
  check("D6-S3: in the notification, every line of free text after the first is quoted, so none starts a line",
    /\nANYTHING ELSE\na\n> Email: x\n> b/.test(lead.formatNotification(lead.parseSubmission(Object.assign({}, base, { notes: "a\nEmail: x\nb" })).data, "x")) &&
    /Comments: one\n> Phone: 1\n/.test(lead.formatNotification(lead.parseSubmission({ form: "register-interest", first_name: "A", last_name: "B", email: "r@example.com",
      phone: "0400000001", suburb: "X", state: "VIC", heating: "h", solar: "No", battery: "No", drivers: ["a"], timeline: ["Now"], comments: "one\nPhone: 1", optin: "true", ts: 1 }).data, "x")));
  const ri = lead.parseSubmission({ form: "register-interest", first_name: "A\nEmail: forged@example.com", last_name: "B", email: "r@example.com",
    phone: "0400 000 001", suburb: "X\r\nState: QLD", state: "VIC", heating: "h", solar: "No", battery: "No", drivers: ["a\nb"], timeline: ["Now"],
    comments: "keep\nlines", optin: "true", ts: 1 }).data;
  check("S1-3: the old forms collapse their single-line fields too, and keep comments' lines",
    ri.first_name === "A Email: forged@example.com" && ri.suburb === "X State: QLD" && ri.drivers[0] === "a b" && ri.comments === "keep\nlines", [ri.first_name, ri.suburb, ri.drivers, ri.comments]);
}

// ---- the page: promises and copy (Sales review) ----
const fs = require("fs");
const page = fs.readFileSync(path.join(__dirname, "..", "start", "index.html"), "utf8");
const thanks = fs.readFileSync(path.join(__dirname, "..", "start", "thanks", "index.html"), "utf8");
const visible = (h) => h.replace(/<!--[\s\S]*?-->/g, "");
check("no 'we've emailed you' promise on either Done (18)", !/emailed you/.test(visible(page)) && !/emailed you/.test(visible(thanks)));
check("the honeypot has no text and is hidden from screen readers (16)", /<div class="hp" aria-hidden="true"><input [^>]*name="website"[^>]*tabindex="-1"[^>]*aria-hidden="true"><\/div>/.test(page) && !/Leave this empty/.test(page));
check("S6 has a Skip (12)", /data-screen="S6"[\s\S]*?data-skip[\s\S]*?<\/section>/.test(page.slice(page.indexOf('data-screen="S6"'), page.indexOf('data-screen="S7"'))));
check("the urgent screen has no plain 'or book a time' (10)", !/>or book a time</.test(page) && /Sorry to hear about the boiler/.test(page));
check("the short match headline ends with a full stop (13)", /id="h-MATCH_SHORT">Here's the short version<span data-first-prefix>, <span data-first><\/span><\/span>\.<\/h2>/.test(page));
check("S7 coach and N1 say hydronic (Sales' SPEC)", /We replace gas and LPG hydronic heating: a boiler that heats water/.test(page) && /LPG hydronic heating \(a boiler heating radiators/.test(page));

check("v2 removes S9, R1 and landlord inputs", !/data-screen="(?:S9|R1)"|name="(?:tenure|landlord_\w+)"/.test(page));
check("SPEC rev B: the upload-set message promises no email", /One file was too big to send here\. No problem: Nick will be in touch, and you can send it to him then\./.test(page) && !/Reply to the email/.test(visible(page)));
check("SPEC rev B: the urgent screen and urgent Done lines", /Sorry to hear about the boiler/.test(page) && (page.match(/Nick will try to call you today\. If we miss you, we'll try again tomorrow at lunchtime\./g) || []).length === 2);
check("the Dialpad number on the contact card, dialable; the card has no price line (Nick, 4 Oct)", /href="tel:\+61272283430">\(02\) 7228 3430<\/a>/.test(page) && !/class="side-offer"/.test(page));

{
  // The privacy page (CTO Re #39-40): its own page, linked from every footer and from /start/.
  const priv = fs.readFileSync(path.join(__dirname, "..", "privacy", "index.html"), "utf8");
  const site = fs.readFileSync(path.join(__dirname, "..", "assets", "js", "site.js"), "utf8");
  check("privacy: /privacy/ exists, with its sections and providers by category (rev 4)", /<h1>Privacy Policy<\/h1>/.test(priv) && (priv.match(/<h2>/g) || []).length >= 10 && /<strong>Website hosting<\/strong>/.test(priv) && /mainly in the United States/.test(priv));
  check("privacy rev 4: no provider or tool is named (Nick, 4 Oct)", !/(Vercel|Supabase|Google|Calendly|YouTube|Stripe|Dialpad|Mailchimp|Anthropic|OpenAI|ChatGPT|Claude|Gmail)/.test(priv.replace(/<!--[\s\S]*?-->/g, "")));
  check("privacy: no TO CONFIRM, no placeholder", !/TO CONFIRM|placeholder/i.test(priv.replace(/<!--[\s\S]*?-->/g, "")));
  check("privacy: the shared footer links to it (every page)", /'<a href="\/privacy\/">Privacy<\/a>'/.test(site));
  check("privacy: /start/'s consent line and footer link to it, with no placeholder left", (page.match(/<a href="\/privacy\/">Privacy policy<\/a>/g) || []).length === 2 && !/\[Privacy policy\]|class="ph-link"/.test(page));
}
check("the sidebar has no placeholder boxes (Nick, 2 Oct)", !/class="side-ph"|\(placeholder\)/.test(page));
check("no placeholder privacy link on the intake (Nick, 2 Oct: strip it until there's a policy page)", !/\[Privacy policy\]|class="ph-link"/.test(page));
{
  // The button switch (Nick, 2 Oct): "Request a Quote" and the interest list go to /start/;
  // contact and the $990 booking page stay. The old pages themselves still exist.
  const { execFileSync } = require("child_process");
  const files = execFileSync("git", ["ls-files", "*.html", "*.js"], { cwd: path.join(__dirname, "..") }).toString().split(/\r?\n/)
    .filter((f) => f && !/^(start|docs|feedback|\.claude|scripts|api|tools)\//.test(f));
  const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
  const old = files.filter((f) => /href="(\/pre-order\/register-interest\/|\/interest\/)"/.test(read(f)));
  check("buttons: no site page links to the old quote or interest-list forms", old.length === 0, old);
  check("buttons: the site links to /start/ from its pages and the shared header", files.filter((f) => /href="\/start\/"/.test(read(f))).length >= 20 && /href="\/start\/"/.test(read("assets/js/site.js")));
  const vj = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "vercel.json"), "utf8"));
  const r301 = (vj.redirects || []).find((r) => r.destination === "/start/");
  check("buttons: /pre-order/register-interest/ 301s to /start/ (its bundled consent retires; CTO Re #41.4)",
    r301 && r301.statusCode === 301 && new RegExp("^" + r301.source + "$").test("/pre-order/register-interest/") && new RegExp("^" + r301.source + "$").test("/pre-order/register-interest"), r301);
  const nt = fs.readFileSync(path.join(__dirname, "..", "netlify.toml"), "utf8").replace(/\r/g, "");
  check("buttons: netlify.toml has the twin 301", nt.includes('from = "/pre-order/register-interest/*"\n  to = "/start/"\n  status = 301'));
  check("buttons: the old pages still exist, for cached links", fs.existsSync(path.join(__dirname, "..", "pre-order", "register-interest", "index.html")) && fs.existsSync(path.join(__dirname, "..", "interest", "index.html")));
}
{
  // YouTube embeds, rolled back from click-to-load (Nick, 2 Oct): the plain youtube-nocookie player,
  // and the privacy page says so.
  const pages = ["index.html", "mission/index.html", "hydronic/how-it-works/index.html"].map((f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8"));
  check("videos: each page embeds the youtube-nocookie player directly", pages.every((h) => /<iframe src="https:\/\/www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{11}"/.test(h) && !/video\.js|video__play/.test(h)));
  const pp = fs.readFileSync(path.join(__dirname, "..", "privacy", "index.html"), "utf8");
  check("videos: the privacy page says the video platform loads with the page, not only on play", /When one of those pages loads, the platform receives your IP address/.test(pp) && !/only load when you press play/.test(pp));
  check("D12: the privacy page says form screens are counted without identifiers", /We count which screens of the form are viewed, without your name, email or any other identifier/.test(pp));
  check("privacy rev 4: calls may be recorded, and callers are told", /Calls to our business number may be recorded; we'll tell you at the start of the call\./.test(pp));
}
{
  // No third-party fonts on any page or in any animation a page embeds (CTO Re #41.1).
  const { execFileSync } = require("child_process");
  const root = path.join(__dirname, "..");
  const pagesAll = execFileSync("git", ["ls-files", "*.html"], { cwd: root }).toString().split(/\r?\n/)
    .filter((f) => f && !/^(docs|feedback|\.claude|scripts|tools|assets)\//.test(f));
  const embedded = new Set();
  pagesAll.forEach((f) => (fs.readFileSync(path.join(root, f), "utf8").match(/src="\/assets\/animations\/[^"?]+/g) || []).forEach((m) => embedded.add(m.slice(6))));
  const offenders = pagesAll.concat([...embedded]).filter((f) => /fonts\.(googleapis|gstatic)\.com/.test(fs.readFileSync(path.join(root, f.replace(/^\//, "")), "utf8")));
  check("fonts: no page and no embedded animation loads Google Fonts", embedded.size >= 3 && offenders.length === 0, offenders);
  check("fonts: DM Mono is self-hosted", fs.existsSync(path.join(root, "assets", "fonts", "DMMono-Medium.woff2")));
}
check("updates are 'occasional', not 'monthly' (Nick, 2 Oct): the /start/ box and the homepage Subscribe line", /<input type="checkbox" name="newsletter_opt_in" value="true"> Send me Thermal Dawn's occasional email updates<\/label>/.test(page) && /Subscribe for occasional email updates/.test(fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8")) && !/monthly/i.test(page));
check("the notification keeps its parsed label 'Monthly update'", /Monthly update: /.test(lead.formatNotification(lead.parseSubmission(Object.assign({}, base)).data, "x")));
{
  // The accessibility pass (2 Oct). Behaviour was checked by keyboard in a real browser;
  // these pin the code that does it.
  const js = fs.readFileSync(path.join(__dirname, "..", "assets", "js", "intake.js"), "utf8");
  check("a11y: arrow keys on a single-select screen move the choice without moving on", /Arrow\(Up\|Down\|Left\|Right\)\|Home\|End/.test(js) && /if \(kbPick\) \{ kbPick = false; return; \}/.test(js));
  check("a11y: Space on the chosen card, or Enter, moves on", /e\.key === " " && t\.checked/.test(js) && /auto && e\.key === "Enter"/.test(js));
  check("a11y: errors are announced (role=alert) and tied to their field (aria-invalid, aria-describedby)", /setAttribute\("role", "alert"\)/.test(js) && /aria-invalid/.test(js) && /aria-describedby/.test(js));
  const slots = page.match(/<div class="upslot" data-slot="[a-z_]+">/g) || [];
  check("a11y: each upload input is named by its slot, and each Remove says what it removes",
    slots.length === 4 && (page.match(/<input type="file" aria-labelledby="up-[a-z_]+-t up-[a-z_]+-how"/g) || []).length === 4 &&
    (page.match(/data-remove aria-label="Remove [^"]+"/g) || []).length === 4);
}
{
  // Design wins, batch A (Nick, 2 Oct). Presentation only; these keep them from regressing.
  const root = path.join(__dirname, "..");
  const css = fs.readFileSync(path.join(root, "assets", "css", "style.css"), "utf8");
  const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
  check("win 1: on phones the centred and dark plain heroes get the phone padding (not the desktop 110/96 and 86/70)",
    /@media\(max-width:520px\)\{\.hero--center \.hero__inner,body\.dark \.hero--plain \.hero__inner\{padding:56px 0 48px;\}\}/.test(css) &&
    css.indexOf(".hero--center .hero__inner,body.dark .hero--plain .hero__inner{padding:56px") > css.indexOf("body.dark .hero--plain .hero__inner{padding:86px"));
  check("win 2: terms and privacy share the legal document style (in style.css, not inline)",
    /<h1 class="legal-title">/.test(read("pre-order/terms/index.html")) && /<article class="article legal">/.test(read("pre-order/terms/index.html")) &&
    /<article class="article legal">/.test(read("privacy/index.html")) && !/<style>/.test(read("privacy/index.html")) && /\.article\.legal\{max-width:720px/.test(css));
  check("win 3: the homepage price and installer line is body text, not micro", /<p class="measure" style="margin:0 auto 18px">From \$12,000 for the equipment/.test(read("index.html")));
  check("win 4: no static (non-link) card lifts on hover", ["hydronic/pricing/index.html", "intelligence/index.html"].every((f) => !/<(div|section|article)[^>]*class="[^"]*card--lift/.test(read(f))));
  check("a11y: header and footer controls have a 44px hit area (item 54.3)", /\.nav__toggle::after\{inset:-5px -1px;\}/.test(css) && /\.footer-social--icons a::after\{inset:-5px;\}/.test(css) && /@media \(pointer:coarse\)\{\.footer-links\{row-gap:24px;\}\}/.test(css));
  check("print: terms and privacy print black on white with no nav (legal-page, item 54.1)",
    ["pre-order/terms/index.html", "privacy/index.html"].every((f) => /<body class="dark legal-page">/.test(read(f))) &&
    /@media print\{\r?\nbody\.legal-page,body\.legal-page \.section[^\n]*\{background:#fff!important;\}/.test(css) && /body\.legal-page #site-header[^{]*\{display:none!important;\}/.test(css));
  check("a11y: the desktop Hydronic submenu opens on keyboard focus, so Tab reaches its links (e2e finding, 3 Oct)", /\.nav__has-sub:hover \.nav__sub,\.nav__has-sub:focus-within \.nav__sub\{opacity:1;visibility:visible;/.test(css));
  // Calmer headings and cards are the site defaults (Nick, 3 Oct): trial B promoted, its page classes retired.
  const bodyOf = (f) => (read(f).match(/<body class="([^"]*)"/) || [])[1] || "";
  const sitePages = fs.readdirSync(root, { recursive: true }).filter((f) => /index\.html$/.test(f) && !/^(node_modules|docs)[\\/]/.test(f));
  check("design: calmer headings and sharper cards are site defaults; no page carries the retired trial classes",
    sitePages.length > 20 && sitePages.every((f) => !/trial-(calm|cards)/.test(bodyOf(f))) && !/trial-(calm|cards)/.test(css) &&
    /body h2\{font-weight:700;font-size:clamp\(1\.55rem,3\.4vw,2rem\);line-height:1\.25;/.test(css) && /\.card\{border-radius:var\(--radius\);padding:20px;box-shadow:none;\}/.test(css) && /--radius:6px;/.test(css));
}
check("Nick's old mobile is gone from the page", !/432 ?395 ?138/.test(page));

// Nick pass: one question per screen retains logical question IDs.
const jsV2=fs.readFileSync(path.join(__dirname,"..","assets/js/intake.js"),"utf8");
for(const id of ["S1","S7","S10","S11"]) {
 const section=page.split('data-screen="'+id+'"')[1].split('</section>')[0];
 check("Nick pass multi-select "+id+" never auto advances", !/data-auto/.test(section));
}
check("v2 heating notes have label, described hint and no placeholder", /<label for="heating-notes">Your notes/.test(page) && /name="heating_notes"[^>]*aria-describedby="heating-notes-hint"/.test(page) && !/<textarea[^>]*name="heating_notes"[^>]*placeholder/.test(page));
check("v2 transition hides old questions and focuses new heading", /s.hidden = true/.test(jsV2) && /h.focus/.test(jsV2));
check("v2 progress sections", ["intro","S1","S6","S4b"].every(id=>R.stepOf(id)===1) && ["S7","S8","S10","S13","B2","MATCH","MATCH_SHORT","URGENT"].every(id=>R.stepOf(id)===2) && ["S14","S17"].every(id=>R.stepOf(id)===3) && R.stepOf("DONE")===4);
check("v2 no batch timing anywhere on start", !/November|installed in February|next winter/i.test(page));
const notesData=lead.parseSubmission(Object.assign({},base,{heating_notes:"a".repeat(2100),tenure:"renter"})).data;
check("v2 heating notes clamp 2000; tenure null", notesData.heating_notes.length===2000 && notesData.tenure===null);
const v2row=I.intakeLeadRow(notesData,{INTAKE_LEAD_COLUMNS:"on"},Date.now());
check("v2 notes saved under answers; tenure column retained null", v2row.answers.heating_notes.length===2000 && Object.hasOwn(v2row,"tenure") && v2row.tenure===null);
check("v2 retired notification label preserved", /Is it your home: -/.test(lead.formatNotification(notesData,"x")));
check("v2 heating notes continuation cannot forge a label", /Heating notes: Hello\n> Boiler condition: Broken/.test(lead.formatNotification(lead.parseSubmission(Object.assign({},base,{heating_notes:"Hello\nBoiler condition: Broken"})).data,"x")));

const cssV2=fs.readFileSync(path.join(__dirname,"..","assets/css/intake.css"),"utf8");
check("focus and reduced-motion styles are explicit", /card-opt:has\(input:focus-visible\)[^}]*outline:3px solid var\(--td-orange\)/.test(cssV2) && /prefers-reduced-motion:reduce/.test(cssV2));
for (const heating of [["ducted_rc"], ["ducted_rc","splits"], ["ducted_rc","ducted_gas"]]) {
 const d=lead.parseSubmission(Object.assign({},base,{heating})).data;
 check("ducted RC non-product route "+heating, d.route==="not-our-product" && R.next("S7",d)==="N1");
 check("ducted RC notification tag "+heating, /Tags: interest:ducted-rc, source:website/.test(lead.formatNotification(d,"x")));
 check("ducted RC saved tag "+heating, I.intakeLeadRow(d,{INTAKE_LEAD_COLUMNS:"on"},Date.now()).answers.tags[0]==="interest:ducted-rc");
}
check("mixed boiler and ducted RC preserves fit",R.route({state:"VIC",heating:["boiler_radiators","ducted_rc"]})==="icp");
check("uncertain ducted RC preserves check",R.route({state:"VIC",heating:["not_sure","ducted_rc"]})==="icp-check");
{
  // No meta tag may contain markup: a "$1..." in a replacement once nested a <meta> inside pricing's description (Web 1, 7 Oct).
  const allPages = fs.readdirSync(path.join(__dirname, ".."), { recursive: true }).filter((f) => /\.html$/.test(f) && !/^(node_modules|docs)[\\/]/.test(f));
  const broken = allPages.filter((f) => /<meta\b[^>]*content="[^"]*</.test(fs.readFileSync(path.join(__dirname, "..", f), "utf8")));
  check("every page's meta tags are clean (no markup inside a content attribute)", broken.length === 0, broken);
  const pricingHtml = fs.readFileSync(path.join(__dirname, "..", "hydronic", "pricing", "index.html"), "utf8");
  check("pricing's meta and og descriptions are the CGO's exact wording",
    pricingHtml.includes('<meta name="description" content="What\'s in a Thermal Dawn hydronic system: heat pump, thermal store and smart controls. From $12,000 for the equipment; installation depends on the house.">') &&
    pricingHtml.includes('<meta property="og:description" content="What\'s in a Thermal Dawn hydronic system: heat pump, thermal store and smart controls. From $12,000 for the equipment; installation depends on the house.">'));
}
console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nAll intake checks passed.");
process.exit(failed ? 1 : 0);
