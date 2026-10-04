/* Prints the three notification emails plus the autoresponder so the layout
   can be eyeballed against the real Wix emails without sending anything.
   Requires no credentials and no network.

     npm run test:email

   The register-interest sample has the shape of the 6 Jul 2026 Wix
   notification, with made-up values, so the output is directly comparable.
   Watch for:
     - multi-selects comma-joined, NOT rendered as "List(...)" like Wix did
     - every labelled line present, "-" where a field was left empty
*/
"use strict";

const lead = require("../api/lead.js");
const stamp = "6 July 2026 at 2:40 pm AEST";

const samples = [
  {
    form: "register-interest",
    first_name: "Alex",
    last_name: "Sample",
    email: "alex.sample@example.com",
    phone: "+61400000001",
    suburb: "Testville",
    state: "VIC",
    heating: "Gas wall heaters / space heaters",
    solar: "No",
    battery: "No",
    drivers: ["Researching for future upgrade", "Bills are too high"],
    timeline: ["Within 3 months"],
    comments:
      "Hi, we are working with an installer on solar panels and a battery and replacing our gas hot water. We have a seperate gas unit for our hydronic and were told to ask you about options to move that to electricity too.",
  },
  { form: "contact", name: "Robin Example", email: "robin@example.com",
    message: "Hi Thermaldawn,\nDo you have a showroom in Melbourne please?\nCheers,\nTim." },
  { form: "subscribe", email: "someone@example.com", optin: true },
  {
    form: "founder-premium",
    first_name: "Casey", last_name: "van Dijk",
    email: "casey@example.com", phone: "+61400000003",
    address: "12 Example St, Testville VIC 3000",
    heating: "Gas hydronic - radiators or underfloor",
    timeline: "Within 3 months",
    comments: "Semi detached double brick, 100 years old, new extension.",
    terms: true,
  },
  { form: "basic-reserve", first_name: "Bare", last_name: "Minimum",
    email: "bare@example.com", phone: "0400000000", address: "1 Test Rd, Testville NSW 2000",
    heating: "Other / not sure", timeline: "12+ months / future planning",
    comments: "", terms: true },
  // Interest list (27 Sep 2026): unserved state, heating and cooling.
  { form: "interest-list", first_name: "Alex", last_name: "Sample",
    email: "alex.list@example.com", phone: "", state: "QLD", postcode: "4000",
    interest: "Heating and cooling", heating: "Split systems only",
    timeline: "6-12 months", referral: ["An event or expo"], consent: "on" },
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
  if (data.form === "interest-list") {
    for (const label of ["First name:", "Last name:", "Email:", "Phone:", "State:",
                         "Postcode:", "Interested in:", "Current heating/cooling system:",
                         "Timeline:", "How did you hear about us:",
                         "Consent to be contacted:", "Tags:"]) {
      if (body.indexOf(label) === -1) {
        console.error(`!! FAIL: missing interest-list line "${label}"`);
        failed++;
      }
    }
    // It must say it is not pipeline, so nobody counts it as a lead.
    if (body.indexOf("not pipeline") === -1) {
      console.error("!! FAIL: interest-list email does not say it is not pipeline");
      failed++;
    }
  }
  if (data.form === "basic-reserve" || data.form === "founder-premium") {
    for (const label of ["Address:", "Tier:", "Amount:", "Terms accepted:", "Reference:",
                         "Current heating/cooling system:", "Timeline:", "Comments:"]) {
      if (body.indexOf(label) === -1) {
        console.error(`!! FAIL: missing deposit line "${label}"`);
        failed++;
      }
    }
    // The email must not read as confirmation of payment.
    if (body.indexOf("Confirm the payment itself in Stripe") === -1) {
      console.error("!! FAIL: deposit email is missing the not-yet-paid caveat");
      failed++;
    }
    if (!/^td-[a-z0-9]+$/.test(data.ref || "")) {
      console.error(`!! FAIL: bad reference format: ${data.ref}`);
      failed++;
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
  // Money path: terms must be explicitly accepted, and the address is what
  // the site assessment depends on.
  [{ form: "basic-reserve", first_name: "A", last_name: "B", email: "a@b.co",
     phone: "1", address: "1 St", heating: "Gas ducted", timeline: "Within 3 months",
     terms: false }, "deposit without accepting terms"],
  [{ form: "founder-premium", first_name: "A", last_name: "B", email: "a@b.co",
     phone: "1", heating: "Gas ducted", timeline: "Within 3 months",
     terms: true }, "deposit without address"],
  // Interest list: joining is consent to be contacted, so it must be given.
  [{ form: "interest-list", first_name: "A", email: "a@b.co", state: "QLD",
     postcode: "4000", interest: "Cooling", heating: "x", timeline: "Now" },
   "interest list without consent"],
  [{ form: "interest-list", first_name: "A", email: "a@b.co", state: "QLD",
     interest: "Cooling", heating: "x", timeline: "Now", consent: "on" },
   "interest list without postcode"],
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
  form: "contact", name: "Bad\r\nBcc: attacker@example.com", email: "a@b.co", message: "x",
});
const subject = lead.formatSubject(inj.data);
console.log(`\n${/[\r\n]/.test(subject) ? "FAIL" : "ok  "}  subject header injection stripped: ${JSON.stringify(subject)}`);
if (/[\r\n]/.test(subject)) failed++;

// Autoresponder: goes to register-interest, contact and (since 25 Aug 2026)
// subscribe. Never to deposits, where Stripe sends the receipt and a second
// thanks from us reads as a duplicate payment confirmation.
console.log("\n" + "=".repeat(72));
console.log("AUTORESPONDER");
console.log("=".repeat(72));
const auto = lead.parseSubmission({ form: "contact", name: "Robin Example", email: "t@example.com", message: "x" });
const autoBody = lead.formatAutoresponder(auto.data);
console.log(autoBody);
if (autoBody.indexOf("Hi Robin,") !== 0) {
  console.error(`!! FAIL: contact autoresponder should greet the first name only, got: ${autoBody.split("\n")[0]}`);
  failed++;
}
const noName = lead.parseSubmission({ form: "contact", name: "", email: "t@example.com" });
if (!noName.error) {
  console.error("!! FAIL: contact without a name should be rejected");
  failed++;
}
if (/—/.test(autoBody)) { console.error("!! FAIL: em dash in customer-facing copy"); failed++; }
if (/\n\s*I\s/.test(autoBody)) { console.error("!! FAIL: sentence starts with I"); failed++; }

/* Subscribe autoresponder: HANDOVER v2 §5 since 1 Oct (CTO Re #25). A
   subscriber gives an email and nothing else, so it has to greet without a
   name, and it must not promise a reply that nobody owes them: this is a
   confirmation, not an enquiry. Replies reach nickz@ through Reply-To. */
const sub = lead.parseSubmission({ form: "subscribe", email: "s@example.com", optin: "true" });
const subBody = lead.formatAutoresponder(sub.data);
console.log("\n" + "-".repeat(72) + "\nSUBSCRIBE\n" + "-".repeat(72));
console.log(subBody);
[
  ["greets without a name",          () => subBody.indexOf("Hi there,") === 0],
  ["confirms the subscription",      () => /Thanks for subscribing/.test(subBody)],
  ["invites a reply (to nickz@)",    () => /just reply to this email/i.test(subBody)],
  ["no link to chase",               () => !/https?:\/\//.test(subBody.split("Best regards,")[0])],
  ["honours the unsubscribe promise",() => /unsubscribe/i.test(subBody)],
  ["no em dash",                     () => !/—/.test(subBody)],
  ["does not promise a reply",       () => !/back to you/i.test(subBody)],
].forEach(([label, fn]) => {
  if (fn()) { console.log(`ok    ${label}`); }
  else { console.error(`!! FAIL: subscribe autoresponder ${label}`); failed++; }
});

/* Interest-list autoresponder: HANDOVER v2 §2 (unserved) and §1 (served)
   since 1 Oct. It must promise no price and no date (CEO ruling). */
const il = lead.parseSubmission({ form: "interest-list", first_name: "Alex", email: "j@example.com",
  state: "NZ", postcode: "6011", interest: "Hot water", heating: "x", timeline: "Just looking", consent: "on" });
const ilBody = lead.formatAutoresponder(il.data);
const ilServed = lead.formatAutoresponder(lead.parseSubmission({ form: "interest-list", first_name: "Vic",
  email: "v@example.com", state: "VIC", postcode: "3122", interest: "Heating", heating: "x",
  timeline: "Now", consent: "on" }).data);
console.log("\n" + "-".repeat(72) + "\nINTEREST LIST\n" + "-".repeat(72));
console.log(ilBody);
[
  ["greets the first name",          () => ilBody.indexOf("Hi Alex,") === 0],
  ["confirms the sign-up",           () => /Thanks for putting your name down/.test(ilBody.split("Best regards,")[0])],
  ["no price, no date",              () => !/\$|\b20\d\d\b|within \d|weeks|months/i.test(ilBody.split("Best regards,")[0])],
  ["honours the unsubscribe promise",() => /unsubscribe/i.test(ilBody)],
  ["no em dash",                     () => !/—/.test(ilBody + ilServed)],
  // Brief 07: a served lead gets HANDOVER §1 (a call, and the booking link),
  // not the quote-form link today's email carried.
  ["served -> §1 with booking link", () => /let's talk|15-minute chat/.test(ilServed) && ilServed.includes("https://calendly.com/")],
  ["unserved does not offer a quote",() => !ilBody.includes("/pre-order/register-interest/")],
].forEach(([label, fn]) => {
  if (fn()) { console.log(`ok    ${label}`); }
  else { console.error(`!! FAIL: interest-list autoresponder ${label}`); failed++; }
});

console.log(`\nLive timestamp renders as: ${lead.formatTimestamp()}`);
console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nAll checks passed.");
process.exit(failed ? 1 : 0);
