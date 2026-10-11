/* =========================================================================
   /api/intake-save/: the intake's per-screen save (stage 2, PRD IF4)
   -------------------------------------------------------------------------
   The page posts its answers from the end of step 1, after every screen, and
   once more as a page-hide beacon, so someone who leaves partway is kept
   (Nick, 11 Oct: "capture every enquiry"). No email goes from here: the
   partial sweep (/api/intake-sweep/) sends those after 30 minutes idle.

   Screens, as the lead form has them: the honeypot, the page stamp (3 s), and
   a per-IP cap sized for one save per screen. The first save fixes the row's
   token hash; a later save with another token is refused by the database
   (Pete's intake_session_save).
   Nothing about the visitor is logged: a request ID and a code only.

   The reply is always quick and quiet: 204 for a beacon or a screened post,
   { ok, saved } for the page's own fetch, which never waits on it.
   ========================================================================= */
"use strict";

const crypto = require("crypto");
const sessions = require("./_sessions.js");

const WINDOW = 10 * 60 * 1000;
const CAP = 90;            // ~30 saves in a whole visit; three visits from one address
const buckets = new Map();
function screened(req, now) {
  const since = now - WINDOW;
  for (const [k, hits] of buckets) if (!hits.some((t) => t > since)) buckets.delete(k);
  const h = req.headers || {};
  const ip = String(h["x-forwarded-for"] || h["x-real-ip"] || "unknown").split(",")[0].trim();
  const hits = (buckets.get(ip) || []).filter((t) => t > since);
  hits.push(now);
  buckets.set(ip, hits.slice(-(CAP + 1)));
  return hits.length > CAP;
}
const log = (req, code) => console.warn(`intake-save req=${req} code=${code}`);

module.exports = async function intakeSave(req, res) {
  const reqId = crypto.randomBytes(4).toString("hex");
  const quiet = (code, json) => (json ? res.status(code).json(json) : res.status(204).end());
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return quiet(405, { ok: false }); }
  let body = req.body;
  if (typeof body === "string") {
    if (body.length > 40000) { log(reqId, "too_large"); return quiet(204); }
    try { body = JSON.parse(body); } catch (_) { body = null; }
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) { log(reqId, "invalid_payload"); return quiet(204); }
  const beacon = body.beacon === true;
  const reply = (saved) => (beacon ? quiet(204) : quiet(200, { ok: true, saved }));

  const ts = Number(body.ts);
  if ((typeof body.website === "string" && body.website.trim()) || !(ts > 0) || Date.now() - ts < 3000) {
    log(reqId, "bot_trap"); return reply(false);
  }
  if (screened(req, Date.now())) { log(reqId, "rate_limited"); return reply(false); }
  if (!sessions.LEAD_ID.test(String(body.lead_id || "")) || !sessions.TOKEN.test(String(body.resume_token || ""))) {
    log(reqId, "invalid_ids"); return reply(false);
  }
  const patch = sessions.patchFrom(body);
  if (body.state) patch.answers.state = String(body.state).slice(0, 3).toUpperCase();
  if (!sessions.stepOneDone(patch.answers)) { log(reqId, "before_step_one"); return reply(false); }

  const store = sessions.store();
  if (store.skip) { log(reqId, store.skip); return reply(false); }
  try {
    // The token rides in the answers sealed (for the partial email's link); the database hashes the raw one.
    patch.answers._rt = sessions.sealToken(body.resume_token);
    if (await store.save(body.lead_id, body.resume_token, patch)) return reply(true);
    log(reqId, "save_refused");      // another token, finished, or past 30 days
    return reply(false);
  } catch (err) {
    log(reqId, err && err.code ? err.code : "rpc_failed");
    return reply(false);
  }
};
module.exports.screened = screened;
