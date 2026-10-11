/* =========================================================================
   /api/intake-sweep/: partial enquiries after 30 minutes idle (stage 2,
   PRD IF7 and IF8 phase 2; Nick, 11 Oct)
   -------------------------------------------------------------------------
   Called every 10 minutes by Vercel cron (vercel.json `crons`; the project is
   on Pro). Vercel sends `Authorization: Bearer <CRON_SECRET>`; anything else
   is refused, and with CRON_SECRET unset the sweep never runs.

   For each session left unfinished for 30 minutes, claimed by Pete's
   intake_sweep_claim (a 15-minute lease, FOR UPDATE SKIP LOCKED, so two runs
   can't both take it):
     0. If the lead's `partial` row is already in `leads`, an earlier run sent it
        and lost the done call: mark it done and send nothing (Pete's
        at-least-once note).
     1. Nick's notification, first, as ever: the root of the lead's one Gmail
        thread (IF6). A later completion replies to it.
     2. The `leads` row, event "partial" (PRD §3.1).
     3. In area only: the customer's one email, "Thanks for putting down your
        details, we'll be in touch.", with the resume link. Out of area or not
        our product: Nick's notification only.
     4. intake_sweep_done: the session is never taken again.
   If the notification fails, done is not called: the lease lapses after 15
   minutes and a later run retries.
   Finished enquiries never come here: their first send closes the session and
   their route email goes at once, as before.

   Off production every email goes only to TEST_RECIPIENT (lead.js's routeTo),
   no `leads` row is written (recordLead), and the sessions store refuses the
   production CRM (_sessions.js). Logs carry a request ID and codes only.
   ========================================================================= */
"use strict";

const crypto = require("crypto");
const path = require("path");
const lead = require("./lead.js");
const intake = require("./_intake.js");
const sessions = require("./_sessions.js");
const R = require(path.join(__dirname, "..", "assets", "js", "intake-route.js"));

const PER_RUN = 20;

function authorised(req) {
  const secret = String(process.env.CRON_SECRET || "");
  if (secret.length < 16) return false;
  const got = Buffer.from(String((req.headers || {}).authorization || ""));
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

/** A claimed session row as the lead form's data: the same parse, so the
    notification, subject and row read exactly as a completed one does. */
function asLead(row) {
  const a = sessions.publicAnswers(row.answers);
  const body = Object.assign({}, a, {
    lead_id: row.intake_lead_id, last_screen: row.last_screen || "", rung_reached: sessions.RUNG_BACK[row.rung_reached] || "",
    route: sessions.routeOut(row.route), ts: row.ts_started ? Date.parse(row.ts_started) : 0, outcome: "",
  });
  const p = intake.parseIntake(body);
  if (p.error) return null;
  p.data.event = "partial";
  p.data.outcome = "partial";   // the notification's "Ended on:" line and answers.outcome
  return p.data;
}

async function sendPartial(row, transport, reqId) {
  const d = asLead(row);
  if (!d) { lead.logEvent(reqId, "intake", "partial_skipped", "unreadable_session"); return "skipped"; }
  const notifyTo = lead.routeTo(lead.NOTIFY_TO);
  if (!notifyTo) { lead.logEvent(reqId, "intake", "partial_skipped", "test_recipient_unset"); return "lapsed"; }
  // 1. Nick's notification: the thread's root (Message-ID from the lead ID).
  await transport.sendMail({
    from: `"Thermal Dawn Website" <${process.env.GMAIL_USER}>`,
    to: notifyTo, replyTo: d.email,
    subject: lead.formatSubject(d),
    messageId: `<intake-${d.lead_id}@thermaldawn.com>`,
    text: lead.formatNotification(d),   // "Ended on: partial (screen …)" marks it; the layout is the parser's contract
  });
  // 2. The leads row, event "partial". Best effort, as for a completion.
  try { await lead.recordLead(d); } catch (e) { lead.logEvent(reqId, "intake", "partial_insert_failed", lead.errorCode(e)); }
  // 3. The customer's one email, in area only.
  if (R.inArea(d)) {
    const t = sessions.openToken((row.answers || {})._rt);
    const to = lead.routeTo(d.email);
    if (!t) lead.logEvent(reqId, "intake", "partial_email_skipped", "no_resume_token");
    else if (!to) lead.logEvent(reqId, "intake", "partial_email_skipped", "test_recipient_unset");
    else {
      try {
        const e = lead.templateEmail("intake-partial", d, { resume_link: sessions.resumeUrl(d.lead_id, t) });
        await transport.sendMail({ from: lead.autoresponderFrom(), to, replyTo: lead.NOTIFY_TO,
          subject: e.subject, text: e.text, html: e.html, attachments: e.attachments });
      } catch (e) { lead.logEvent(reqId, "intake", "partial_email_failed", lead.errorCode(e)); }
    }
  }
  return "sent";
}

module.exports = async function intakeSweep(req, res) {
  const reqId = crypto.randomBytes(4).toString("hex");
  if (!authorised(req)) return res.status(401).json({ ok: false });
  const store = sessions.store();
  if (store.skip) { lead.logEvent(reqId, "intake", "sweep_skipped", store.skip); return res.status(200).json({ ok: true, swept: 0, skipped: store.skip }); }
  let rows;
  try { rows = await store.claim(sessions.IDLE_MINUTES, PER_RUN); }
  catch (e) { lead.logEvent(reqId, "intake", "sweep_claim_failed", lead.errorCode(e)); return res.status(502).json({ ok: false }); }
  const out = { sent: 0, already: 0, lapsed: 0, skipped: 0 };
  let transport = null;
  for (const row of rows) {
    try {
      // 0. An earlier run sent this one and lost its done call: just close it.
      if (await store.hasPartial(row.intake_lead_id)) { await store.done(row.intake_lead_id, row.claim); out.already++; continue; }
      transport = transport || lead.makeTransport();
      const r = await sendPartial(row, transport, reqId);
      if (r === "sent" || r === "skipped") await store.done(row.intake_lead_id, row.claim);
      out[r]++;
    } catch (e) {
      // The notification didn't go: no done, so the lease lapses and a later run retries.
      lead.logEvent(reqId, "intake", "partial_failed", lead.errorCode(e));
      out.lapsed++;
    }
  }
  return res.status(200).json(Object.assign({ ok: true, swept: rows.length }, out));
};
module.exports.authorised = authorised;
module.exports.asLead = asLead;
