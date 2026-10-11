/* =========================================================================
   /api/intake-sweep/: partial enquiries after 30 minutes idle (stage 2,
   PRD IF7 and IF8 phase 2; Nick, 11 Oct)
   -------------------------------------------------------------------------
   Called every 10 minutes by Vercel cron (vercel.json `crons`; the project is
   on Pro). Vercel sends `Authorization: Bearer <CRON_SECRET>`; anything else
   is refused, and with CRON_SECRET unset the sweep never runs.

   For each session left unfinished for 30 minutes, claimed atomically by the
   database so two runs can't both take it:
     1. Nick's notification, first, as ever: the root of the lead's one Gmail
        thread (IF6). A later completion replies to it.
     2. The `leads` row, event "partial" (PRD §3.1).
     3. In area only: the customer's one email, "Thanks for putting down your
        details, we'll be in touch.", with the resume link. Out of area or not
        our product: Nick's notification only.
   If the notification fails, the claim is released and the next run retries.
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
  const a = row.answers || {};
  const body = Object.assign({}, a, {
    lead_id: row.lead_id, last_screen: row.last_screen || "", rung_reached: row.rung_reached || "",
    route: row.route || "", ts: row.ts_started ? Date.parse(row.ts_started) : 0, outcome: "",
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
  if (!notifyTo) { lead.logEvent(reqId, "intake", "partial_skipped", "test_recipient_unset"); return "released"; }
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
    const t = sessions.signResume(d.lead_id);
    const to = lead.routeTo(d.email);
    if (!t) lead.logEvent(reqId, "intake", "partial_email_skipped", "token_secret_unset");
    else if (!to) lead.logEvent(reqId, "intake", "partial_email_skipped", "test_recipient_unset");
    else {
      try {
        const e = lead.templateEmail("intake-partial", d, { resume_link: sessions.resumeUrl(t) });
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
  try { rows = await store.claimPartials(sessions.IDLE_MINUTES, PER_RUN); }
  catch (e) { lead.logEvent(reqId, "intake", "sweep_claim_failed", lead.errorCode(e)); return res.status(502).json({ ok: false }); }
  rows = Array.isArray(rows) ? rows : [];
  const out = { sent: 0, released: 0, skipped: 0 };
  let transport = null;
  for (const row of rows) {
    try {
      transport = transport || lead.makeTransport();
      const r = await sendPartial(row, transport, reqId);
      if (r === "released") { await store.releasePartial(row.lead_id); out.released++; }
      else out[r]++;
    } catch (e) {
      // The notification didn't go: give the session back for the next run.
      lead.logEvent(reqId, "intake", "partial_failed", lead.errorCode(e));
      try { await store.releasePartial(row.lead_id); } catch (_) { /* the next run's claim is unaffected */ }
      out.released++;
    }
  }
  return res.status(200).json(Object.assign({ ok: true, swept: rows.length }, out));
};
module.exports.authorised = authorised;
module.exports.asLead = asLead;
