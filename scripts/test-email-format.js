/* Prints the three notification emails plus the autoresponder so the layout
   can be eyeballed against the real Wix emails without sending anything.
   Requires no credentials and no network.

     npm run test:email

   The register-interest sample uses the real values from the 6 Jul 2026 Wix
   notification (Nigel Gray), so the output is directly comparable. Watch for:
     - multi-selects comma-joined, NOT rendered as "List(...)" like Wix did
     - every labelled line present, "-" where a field was left empty
*/
"use strict";

const lead = require("../api/lead.js");
const stamp = "6 July 2026 at 2:40 pm AEST";

const samples = [
  {
    form: "register-interest",
    first_name: "Nigel",
    last_name: "Gray",
    email: "nigeljgray11@gmail.com",
    phone: "+61416086011",
    suburb: "Hampton",
    state: "VIC",
    heating: "Gas wall heaters / space heaters",
    solar: "No",
    battery: "No",
    drivers: ["Researching for future upgrade", "Bills are too high"],
    timeline: ["Within 3 months"],
    comments:
      "Hi am working with Dennis from electrify me to install solar panels and battery and replace our hot water gas heater. We have a seperate gas unit for our hydronic and he suggested I talk to you about potential options to improve this an maybe move to electricytt.",
  },
  { form: "contact", name: "Tim Hamer", email: "timhamer842@gmail.com",
    message: "Hi Thermaldawn,\nDo you have a showroom in Melbourne please?\nCheers,\nTim." },
  { form: "subscribe", email: "someone@example.com", optin: true },
  // Edge case: optional fields left empty must still print their labels.
  { form: "register-interest", first_name: "Empty", last_name: "Comments",
    email: "e@example.com", phone: "0400000000", suburb: "Testville", state: "NSW",
    heating: "Other / not sure", solar: "Yes", battery: "No",
    drivers: ["Other -> free text typed by the visitor"], timeline: ["Within 6–12 months"],
    comments: "" },
];

let failed = 0;

for (const raw of samples) {
  const { data, error } = lead.parseSubmission(raw);
  if (error) {
    console.error(`\n!! ${raw.form} REJECTED: ${error}`);
    failed++;
    continue;
  }
  const body = lead.formatNotification(data, stamp);
  console.log("\n" + "=".repeat(72));
  console.log("SUBJECT: " + lead.formatSubject(data));
  console.log("=".repeat(72));
  console.log(body);

  if (/List\(/.test(body)) {
    console.error("!! FAIL: array rendered as List(...) — the Wix bug is back");
    failed++;
  }
  if (data.form === "register-interest") {
    for (const label of ["First name:", "Last name:", "Email:", "Phone:", "Suburb:",
                         "State:", "Solar:", "Battery:", "Current heating/cooling system:",
                         "What's driving interest:", "Timeline:", "Comments:"]) {
      if (body.indexOf(label) === -1) {
        console.error(`!! FAIL: missing contract line "${label}"`);
        failed++;
      }
    }
  }
}

// Rejection cases: the handler must refuse these before any mail is sent.
const mustReject = [
  [{ form: "register-interest", first_name: "A", last_name: "B", email: "not-an-email",
     phone: "1", suburb: "s", state: "NSW", heating: "Gas ducted", solar: "No",
     battery: "No", drivers: ["x"], timeline: ["y"] }, "bad email"],
  [{ form: "register-interest", first_name: "A", last_name: "B", email: "a@b.co",
     phone: "1", suburb: "s", state: "NSW", heating: "Gas ducted", solar: "No",
     battery: "No", drivers: [], timeline: ["y"] }, "empty required checkbox group"],
  [{ form: "contact", email: "a@b.co" }, "missing name"],
  [{ form: "nope", email: "a@b.co" }, "unknown form"],
];

console.log("\n" + "=".repeat(72));
console.log("REJECTION CASES");
console.log("=".repeat(72));
for (const [payload, why] of mustReject) {
  const { error } = lead.parseSubmission(payload);
  console.log(`${error ? "ok  " : "FAIL"}  ${why}: ${error || "was accepted!"}`);
  if (!error) failed++;
}

// Header injection: a newline in a name must not break the Subject line.
const inj = lead.parseSubmission({
  form: "contact", name: "Bad\r\nBcc: attacker@evil.com", email: "a@b.co", message: "x",
});
const subject = lead.formatSubject(inj.data);
console.log(`\n${/[\r\n]/.test(subject) ? "FAIL" : "ok  "}  subject header injection stripped: ${JSON.stringify(subject)}`);
if (/[\r\n]/.test(subject)) failed++;

console.log(`\nLive timestamp renders as: ${lead.formatTimestamp()}`);
console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nAll checks passed.");
process.exit(failed ? 1 : 0);
