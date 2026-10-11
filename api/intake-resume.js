/* =========================================================================
   /api/intake-resume/: reopen a half-finished intake (stage 2, PRD IF7)
   -------------------------------------------------------------------------
   The partial email links to /start/#resume=<lead_id>.<token> (the fragment
   never reaches a server). The page posts the lead ID and token here; Pete's
   intake_session_resume checks the token's hash and the 30-day life, and the
   answers and last screen come back for the page to fill in. The page then
   carries on saving with the same lead and token.

   A completed session, an unknown lead or a wrong token gets { ok: false } and
   the page simply starts fresh. Nothing about the visitor is logged.
   ========================================================================= */
"use strict";

const crypto = require("crypto");
const sessions = require("./_sessions.js");

const WINDOW = 10 * 60 * 1000, CAP = 20;
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
const log = (req, code) => console.warn(`intake-resume req=${req} code=${code}`);

module.exports = async function intakeResume(req, res) {
  const reqId = crypto.randomBytes(4).toString("hex");
  res.setHeader("Cache-Control", "no-store");
  const no = () => res.status(200).json({ ok: false });
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ ok: false }); }
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (_) { body = null; } }
  if (!body || typeof body !== "object") { log(reqId, "invalid_payload"); return no(); }
  if (screened(req, Date.now())) { log(reqId, "rate_limited"); return no(); }
  if (!sessions.LEAD_ID.test(String(body.lead_id || "")) || !sessions.TOKEN.test(String(body.resume_token || ""))) { log(reqId, "invalid_link"); return no(); }
  const store = sessions.store();
  if (store.skip) { log(reqId, store.skip); return no(); }
  try {
    const r = await store.resume(body.lead_id, body.resume_token);
    if (!r || !r.answers) { log(reqId, "no_open_session"); return no(); }
    return res.status(200).json({ ok: true, lead_id: body.lead_id, answers: sessions.publicAnswers(r.answers), last_screen: r.last_screen || null });
  } catch (err) {
    log(reqId, err && err.code ? err.code : "rpc_failed");
    return no();
  }
};
