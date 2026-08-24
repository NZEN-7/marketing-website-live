/* Checks the row /api/lead writes into Supabase `leads`, for every form.
   No credentials and no network: leadRow() is pure, so the mapping can be
   tested without touching the database.

     npm run test:leadrow

   Watch for the three things that are silently wrong rather than loudly wrong:
     - a column name that does not exist in the table (PostgREST 400s at runtime)
     - "-" written where a field was empty ("-" is an EMAIL convention; in a
       column it makes an unanswered question look answered)
     - newsletter_opt_in false on a form that never asked
*/
"use strict";

const { parseSubmission, leadRow } = require("../api/lead.js");

/* Every column on public.leads that leadRow is allowed to write. Captured half
   only: the triage half is the agent's and must stay untouched at capture. */
const WRITABLE = new Set([
  "submitted_at", "form", "source_site", "first_name", "last_name", "email",
  "phone", "suburb", "state", "address", "solar", "battery",
  "heating_system_type", "driver", "timeline", "comments",
  "newsletter_opt_in", "payment_ref",
]);

const bodies = {
  "register-interest": {
    form: "register-interest", first_name: "Nigel", last_name: "Gray",
    email: "nigeljgray11@gmail.com", phone: "+61416086011", suburb: "Hampton",
    state: "VIC", heating: "Gas wall heaters / space heaters", solar: "No",
    battery: "No", drivers: ["Bills are too high", "Researching"],
    timeline: ["Within 3 months"], comments: "Two storey, 1920s.",
  },
  contact: { form: "contact", name: "Simon Radcliffe", email: "s@example.com", message: "Got hydronic." },
  subscribe: { form: "subscribe", email: "sub@example.com", optin: "true" },
  "subscribe-nooptin": { form: "subscribe", email: "sub2@example.com" },
  "basic-reserve": {
    form: "basic-reserve", first_name: "Pat", last_name: "Jessen", email: "p@example.com",
    phone: "0400000000", address: "12 Example St, Hawthorn VIC 3122",
    heating: "Gas hydronic", timeline: "Within 3 months", terms: true,
  },
};

let failed = 0;
const check = (name, cond, detail) => {
  if (!cond) { failed++; console.log(`FAIL  ${name}${detail ? " — " + detail : ""}`); }
  else console.log(`ok    ${name}`);
};

const rows = {};
for (const [key, body] of Object.entries(bodies)) {
  const { data, error } = parseSubmission(body);
  if (error) { failed++; console.log(`FAIL  ${key} did not parse — ${error}`); continue; }
  rows[key] = leadRow(data);
}

// 1. No column that does not exist. A typo here is a 400 at runtime, on a real
//    lead, discovered only in the logs.
for (const [key, row] of Object.entries(rows)) {
  const bad = Object.keys(row).filter((k) => !WRITABLE.has(k));
  check(`${key}: only real columns`, bad.length === 0, bad.join(", "));
}

// 2. The form label is what identifies the source, and must match the Wix-era
//    vocabulary so the backfill lands in the same values.
check("register-interest label", rows["register-interest"].form === "Homeowner Register Interest", rows["register-interest"].form);
check("contact label",           rows.contact.form === "Contact Form", rows.contact.form);
check("subscribe label",         rows.subscribe.form === "Subscribe Form", rows.subscribe.form);
check("deposit label",           rows["basic-reserve"].form === "Basic Reserve ($190 deposit)", rows["basic-reserve"].form);

// 3. Consent. NULL where the form did not ask; never false.
check("opt-in true when ticked",   rows.subscribe.newsletter_opt_in === true);
check("opt-in false when offered but unticked", rows["subscribe-nooptin"].newsletter_opt_in === false);
check("opt-in NULL on contact",    rows.contact.newsletter_opt_in === null);
check("opt-in NULL on register",   rows["register-interest"].newsletter_opt_in === null);
check("opt-in NULL on deposit",    rows["basic-reserve"].newsletter_opt_in === null);

// 4. Empty must be NULL, never the email layer's "-".
const dashes = Object.entries(rows).flatMap(([k, r]) =>
  Object.entries(r).filter(([, v]) => v === "-").map(([c]) => `${k}.${c}`));
check("no \"-\" placeholders reach the DB", dashes.length === 0, dashes.join(", "));
check("contact has NULL driver", rows.contact.driver === null);

// 5. Field mapping that differs per form.
check("contact name -> first_name", rows.contact.first_name === "Simon Radcliffe");
check("contact message -> comments", rows.contact.comments === "Got hydronic.");
check("multi-select joined", rows["register-interest"].driver === "Bills are too high, Researching");
check("deposit address captured", rows["basic-reserve"].address === "12 Example St, Hawthorn VIC 3122");
check("deposit payment_ref captured", /^td-/.test(rows["basic-reserve"].payment_ref || ""));
check("non-deposit has NULL payment_ref", rows.contact.payment_ref === null);

// 6. Provenance.
check("source_site is freevolt", Object.values(rows).every((r) => r.source_site === "freevolt"));
check("submitted_at is ISO", !Number.isNaN(Date.parse(rows.contact.submitted_at)));

console.log(failed ? `\n${failed} check(s) FAILED.` : "\nAll lead-row checks passed.");
process.exit(failed ? 1 : 0);
