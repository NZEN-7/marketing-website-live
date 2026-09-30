/* The first emails (brief 07): one template per form, pasted from Sales'
   HANDOVER, chosen by the served/unserved rule, rendered with only the
   placeholders the HANDOVER names. No credentials, no network.

     npm run test:firstemails
*/
"use strict";

const fs = require("fs");
const path = require("path");
const lead = require("../api/lead.js");

let failed = 0;
const check = (label, cond, got) => {
  if (cond) console.log(`ok    ${label}`);
  else { console.error(`FAIL  ${label}${got !== undefined ? ": " + JSON.stringify(got) : ""}`); failed++; }
};
const P = (b) => {
  const r = lead.parseSubmission(b);
  if (r.error) throw new Error(`fixture rejected: ${r.error}`);
  return r.data;
};

const RI = { form: "register-interest", first_name: "Alex", last_name: "Sample", email: "a@example.com",
  phone: "0400000001", suburb: "Testville", state: "VIC", heating: "Gas ducted", solar: "No",
  battery: "No", drivers: ["Bills are too high"], timeline: ["Now"] };
const IL = (over) => P(Object.assign({ form: "interest-list", first_name: "Robin", email: "r@example.com",
  state: "NSW", postcode: "2000", interest: "Heating", heating: "Gas ducted", timeline: "Now",
  consent: "on" }, over));

// ---- 1. the files --------------------------------------------------------
const dir = lead.TEMPLATE_DIR;
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".txt")).sort();
check("four template files (register-interest.txt is §1 for interest-list too)",
  JSON.stringify(files) === JSON.stringify(["contact.txt", "interest-list-unserved.txt", "register-interest.txt", "subscribe.txt"]), files);
for (const f of files) {
  const raw = fs.readFileSync(path.join(dir, f), "utf8");
  check(`${f}: names the HANDOVER as its source`, /HANDOVER - first emails for api-lead\.js/.test(raw));
  check(`${f}: no em dash`, !/—/.test(raw));
  check(`${f}: only the HANDOVER's placeholders`,
    (raw.match(/\{[a-z_]+\}/g) || []).every((p) => p === "{first_name}" || p === "{booking_link}"),
    raw.match(/\{[a-z_]+\}/g));
  check(`${f}: booking link is never written in`, !/calendly\.com/i.test(raw));
  check(`${f}: no savings, COP or stored-energy figure`, !/\$\d|\bCOP\b|kWh/i.test(raw));
}

// ---- 2. which template -----------------------------------------------------
const key = (d) => (lead.firstEmail(d) || { template: "NONE" }).template.split(" ")[0];
check("register-interest -> §1", key(P(RI)) === "register-interest");
check("interest-list NSW -> §1", key(IL({})) === "register-interest");
check("interest-list ACT -> §1", key(IL({ state: "ACT" })) === "register-interest");
check("interest-list VIC hot water -> §1 (served; listTags would tag it)", key(IL({ state: "VIC", interest: "Hot water" })) === "register-interest");
check("interest-list 'Other / not sure' -> §1", key(IL({ heating: "Other / not sure" })) === "register-interest");
check("interest-list 'No heating/cooling system' -> §1", key(IL({ heating: "No heating/cooling system" })) === "register-interest");
check("interest-list QLD -> §2", key(IL({ state: "QLD" })) === "interest-list-unserved");
check("interest-list NZ -> §2", key(IL({ state: "NZ" })) === "interest-list-unserved");
check("interest-list VIC + Split systems only -> §2", key(IL({ state: "VIC", heating: "Split systems only" })) === "interest-list-unserved");
check("unserved rule: missing state is served", lead.isUnservedListLead({ form: "interest-list", heating: "Gas ducted" }) === false);
check("unserved rule: an unrecognised state is served (B07-S1)", ["UNKNOWN", "XX", "Victoria", "OS"].every((st) => lead.isUnservedListLead({ form: "interest-list", state: st, heating: "Gas ducted" }) === false));
check("unserved rule: every known unserved choice on the form is §2", ["QLD", "SA", "WA", "TAS", "NT", "NZ", " qld "].every((st) => key(IL({ state: st })) === "interest-list-unserved"));
check("unserved rule: served and unserved lists don't overlap", lead.SERVED_STATES.every((st) => lead.UNSERVED_STATES.indexOf(st) === -1));
check("unserved rule: only for interest-list", lead.isUnservedListLead({ form: "register-interest", state: "QLD" }) === false);
check("contact -> contact", key(P({ form: "contact", name: "Casey van Dijk", email: "c@example.com", message: "x" })) === "contact");
check("subscribe -> subscribe", key(P({ form: "subscribe", email: "s@example.com" })) === "subscribe");
check("founder-premium -> none (posts before Stripe; A1)", lead.firstEmail(P({ form: "founder-premium", first_name: "A",
  last_name: "B", email: "a@b.co", phone: "1", address: "1 St", heating: "x", timeline: "y", terms: true })) === null);

// ---- 3. rendering ------------------------------------------------------------
const ri = lead.firstEmail(P(RI));
check("§1 subject carries the first name", ri.subject === "Thanks Alex, let's talk about your heating", ri.subject);
check("§1 greets the first name", ri.text.indexOf("Hi Alex,") === 0);
check("§1 with phone: the call paragraph", /quick call in the next day or two/.test(ri.text));
check("§1 with phone: not the no-phone paragraph", !/The easiest next step/.test(ri.text));
check("§1 has the booking link", ri.text.includes("https://calendly.com/nickz-thermaldawn/30min"));
check("§1 has no leftover markers or placeholders", !/\[\/?(no-)?phone\]|\{[a-z_]+\}/.test(ri.text));
const np = lead.firstEmail(IL({}));
check("§1 without phone: the no-phone paragraph", /The easiest next step is a quick 15-minute chat/.test(np.text));
check("§1 without phone: not the call paragraph", !/quick call in the next day or two/.test(np.text));

process.env.BOOKING_LINK = "https://calendly.com/nickz-thermaldawn/15min";
check("BOOKING_LINK env sets the link", lead.firstEmail(P(RI)).text.includes("/15min"));
process.env.BOOKING_LINK = "javascript:alert(1)";
check("a non-https BOOKING_LINK falls back", lead.firstEmail(P(RI)).text.includes("/30min"));
delete process.env.BOOKING_LINK;

const blank = lead.firstEmail(Object.assign(P(RI), { first_name: "" }));
check("no name: 'Hi there,'", blank.text.indexOf("Hi there,") === 0);
check("no name: subject without a name", blank.subject === "Thanks, let's talk about your heating", blank.subject);
const odd = lead.firstEmail(Object.assign(P(RI), { first_name: "R0bin<script>" }));
check("a name that fails validation falls back", odd.text.indexOf("Hi there,") === 0 && !/script/.test(odd.subject + odd.text));
const inj = lead.firstEmail(Object.assign(P(RI), { first_name: "Alex\r\nBcc: x@example.com" }));
check("no CR/LF in the subject", !/[\r\n]/.test(inj.subject), inj.subject);
check("apostrophes and hyphens are names", lead.firstNameFor({ first_name: "D'Artagnan-Sample" }) === "D'Artagnan-Sample");
check("contact greets the first word of the name", lead.firstEmail(P({ form: "contact", name: "Casey van Dijk",
  email: "c@example.com", message: "x" })).text.indexOf("Hi Casey,") === 0);

// ---- 4. list emails are held until they carry an unsubscribe line (A2) ----
const sub = lead.firstEmail(P({ form: "subscribe", email: "s@example.com" }));
const un = lead.firstEmail(IL({ state: "QLD" }));
for (const [label, e] of [["subscribe", sub], ["interest-list §2", un]]) {
  // The body only: the files' "# " header comments mention unsubscribe themselves.
  const raw = fs.readFileSync(path.join(dir, (label === "subscribe" ? "subscribe" : "interest-list-unserved") + ".txt"), "utf8");
  const templateHasLine = /unsubscribe/i.test(raw.split(/\r?\n/).filter((l) => !l.startsWith("#")).join("\n"));
  check(`${label}: the email that goes has an unsubscribe line`, /unsubscribe/i.test(e.text));
  check(`${label}: held (today's email) exactly while the template has no line`, /held/.test(e.template) === !templateHasLine, e.template);
}

console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nAll first-email checks passed.");
process.exit(failed ? 1 : 0);
