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
check("fit, boiler: S1..S6, S7, S8, S9, S10-S13, MATCH",
  walk(Object.assign({ intent: "fit", heating: ["boiler_radiators"], tenure: "owner_occupier" }, VIC)) ===
  "S1 S2 S3 S4 S4b S5 S6 S7 S8 S9 S10 S11 S12 S13 MATCH", walk(Object.assign({ intent: "fit", heating: ["boiler_radiators"] }, VIC)));
check("fit, no boiler picked: S8 is not shown",
  walk({ state: "VIC", intent: "fit", heating: ["none"] }) === "S1 S2 S3 S4 S5 S6 S7 S9 S10 S11 S12 S13 MATCH");
check("S4b only with a phone number", walk({ state: "VIC", intent: "explore", heating: ["not_sure"] }).indexOf("S4b") === -1);
check("ready to book: only S7 and S9, then MATCH",
  walk(Object.assign({ intent: "book", heating: ["boiler_underfloor"], tenure: "owner_occupier" }, VIC)) === "S1 S2 S3 S4 S4b S5 S6 S7 S9 MATCH");
check("just exploring: S7, then the short match",
  walk(Object.assign({ intent: "explore", heating: ["boiler_radiators"] }, VIC)) === "S1 S2 S3 S4 S4b S5 S6 S7 MATCH_SHORT");
check("urgent: S7, S9, then URGENT",
  walk(Object.assign({ intent: "urgent", heating: ["lpg_boiler"], tenure: "owner_occupier" }, VIC)) === "S1 S2 S3 S4 S4b S5 S6 S7 S9 URGENT");
check("fit with 'Broken, or about to go' jumps to URGENT after S9",
  walk(Object.assign({ intent: "fit", heating: ["boiler_radiators"], boiler_condition: "broken", tenure: "owner_occupier" }, VIC)).endsWith("S8 S9 URGENT"));
check("no answer on S5 takes the full fit path", walk({ state: "NSW", heating: ["boiler_radiators"] }).endsWith("S13 MATCH"));

// ---- the closes ----
check("O1: QLD saves step 1 (S6), then closes", walk({ state: "QLD", phone: "" }) === "S1 S2 S3 S4 S6 O1");
check("O1: outside Australia", walk({ state: "OS" }) === "S1 S2 S3 S4 S6 O1");
for (const h of [["splits"], ["ducted_gas"], ["other"], ["splits", "ducted_gas"]]) {
  check(`N1: ${h.join("+")} only`, walk({ state: "VIC", intent: "fit", heating: h }).endsWith("S7 N1"));
}
for (const h of [["boiler_radiators", "ducted_gas"], ["none"], ["not_sure"], ["splits", "not_sure"]]) {
  check(`must NOT close: ${h.join("+")}`, walk({ state: "VIC", intent: "fit", heating: h }).indexOf("N1") === -1);
}
check("R1: renting closes at S9", walk({ state: "NSW", intent: "fit", heating: ["boiler_radiators"], tenure: "renter" }).endsWith("S9 R1"));
check("'Not sure' never closes", R.route({ state: "VIC", heating: ["not_sure"], boiler_condition: "not_sure" }) === "icp");

// ---- the match's why lines (SPEC §4) ----
check("why: none of the triggers -> no line", R.whyLines({ energy: ["none"] }).length === 0);
check("why: solar + older boiler -> those two, in order",
  JSON.stringify(R.whyLines({ energy: ["solar"], boiler_condition: "getting_on", scope: ["hot_water"] })) ===
  JSON.stringify(["Your solar can charge the store during the day.", "It replaces a boiler you'd otherwise be replacing anyway."]));
check("why: at most two lines", R.whyLines({ energy: ["solar", "battery", "cheap_window"], boiler_condition: "broken", scope: ["hot_water"] }).length === 2);

// ---- the server: parse, subject, notification (SPEC §7) ----
const base = { form: "intake", first_name: "Alex", last_name: "Sample", email: "alex@example.com", postcode: "3122",
  suburb: "Hawthorn", state: "VIC", intent: "fit", heating: ["boiler_radiators"], boiler_condition: "not_sure", route: "icp",
  outcome: "completed", rung_reached: "done", last_screen: "S17", seen: ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10", "S11", "S12", "S13", "MATCH"] };
const p = lead.parseSubmission(base);
check("intake parses with the three required fields", !p.error && p.data.form === "intake", p.error);
check("a lead_id is issued", /^il-[0-9a-f]{10}$/.test(p.data.lead_id));
check("missing postcode is refused (unless outside Australia)", !!lead.parseSubmission(Object.assign({}, base, { postcode: "" })).error &&
  !lead.parseSubmission(Object.assign({}, base, { postcode: "", state: "OS" })).error);
check("missing last name is refused", !!lead.parseSubmission(Object.assign({}, base, { last_name: "" })).error);
check("unknown card values are dropped", lead.parseSubmission(Object.assign({}, base, { heating: ["boiler_radiators", "<script>"] })).data.heating.join() === "boiler_radiators");
const subj = lead.formatSubject(p.data);
check("subject: Website lead · name · suburb, state · route · heating · lead_id",
  subj === `Website lead · Alex Sample · Hawthorn, VIC · icp · Gas boiler with radiators · ${p.data.lead_id}`, subj);
check("subject: URGENT first on the urgent route", lead.formatSubject(lead.parseSubmission(Object.assign({}, base, { route: "urgent" })).data).startsWith("URGENT · "));
check("subject: no CR/LF", !/[\r\n]/.test(lead.formatSubject(lead.parseSubmission(Object.assign({}, base, { first_name: "A\r\nBcc: x@example.com" })).data)));
const body = lead.formatNotification(p.data, "30 September 2026 at 2:00 pm AEST");
const order = ["Lead ID:", "Rung reached:", "Route:", "CONTACT", "Phone:", "Best time to call:", "LOCATION", "ABOUT THE ENQUIRY", "YOUR HOME", "Heating:", "THE DETAILS", "ANYTHING ELSE"];
check("notification sections in SPEC §7 order, phone near the top", order.every((k, i) => i === 0 || body.indexOf(order[i - 1]) < body.indexOf(k)));
check("'Not sure' shows as such", /Boiler condition: Not sure/.test(body));
check("a shown-but-empty answer says Skipped", /Energy setup: Skipped/.test(body));
check("a screen never shown says Not asked", /Storeys: Not asked/.test(body));
check("no-JS posts are tagged", lead.formatSubject(lead.parseSubmission(Object.assign({}, base, { nojs: "1" })).data).endsWith("[no-JS]"));
check("the intake gets no customer first email in the prototype", lead.firstEmail(p.data) === null);

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

console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nAll intake checks passed.");
process.exit(failed ? 1 : 0);
