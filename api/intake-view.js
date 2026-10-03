/* Anonymous question counts only. No visitor identity is logged or persisted.
   Draft RPC: Platform must review/apply the migration before this can count. */
"use strict";
const IDS = new Set("S1 S2 S3 S4 S4b S5 S6 S7 S8 S10 S11 S12 S13 S14 S15 S16 S17 MATCH MATCH_SHORT URGENT DONE O1 N1".split(" "));
const WINDOW = 10 * 60 * 1000;
const buckets = new Map();
function screened(req, now) {
  const since = now - WINDOW;
  for (const [key, hits] of buckets) if (!hits.some(t => t > since)) buckets.delete(key);
  const h = req.headers || {};
  const ip = String(h["x-forwarded-for"] || h["x-real-ip"] || (req.socket || {}).remoteAddress || "unknown").split(",")[0].trim();
  const hits = (buckets.get(ip) || []).filter(t => t > since);
  hits.push(now);
  buckets.set(ip, hits.slice(-11)); // Eleven timestamps suffice to detect >10; bounded per IP.
  return hits.length > 10;
}
function questions(body) {
  if (typeof body === "string") {
    if (body.length > 256) return null;
    try { body = JSON.parse(body); } catch (_) { return null; }
  }
  if (!body || Array.isArray(body) || typeof body !== "object" || Object.keys(body).length !== 1 || !Array.isArray(body.q)) return null;
  if (!body.q.length || body.q.length > 6 || !body.q.every(q => typeof q === "string" && IDS.has(q))) return null;
  return [...new Set(body.q)];
}
function auth(env) {
  if (env.SUPABASE_LEADS_KEY && env.SUPABASE_ANON_KEY) return { apikey: env.SUPABASE_ANON_KEY, bearer: env.SUPABASE_LEADS_KEY };
  if (env.SUPABASE_SERVICE_ROLE_KEY) return { apikey: env.SUPABASE_SERVICE_ROLE_KEY, bearer: env.SUPABASE_SERVICE_ROLE_KEY };
  return null;
}
function log(code) { console.warn("[intake-view] code=" + code); }
module.exports = async function intakeView(req, res) {
  const done = () => res.status(204).end();
  if (req.method !== "POST") return done();
  if (screened(req, Date.now())) { log("rate_limited"); return done(); }
  const ids = questions(req.body);
  if (!ids) { log("invalid_payload"); return done(); }
  // Fail closed: no RPC, insert or other network call outside production.
  if (process.env.VERCEL_ENV !== "production") return done();
  const credentials = auth(process.env);
  const base = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  if (!credentials || !/^https:\/\//.test(base)) { log("not_configured"); return done(); }
  try {
    const response = await fetch(base + "/rest/v1/rpc/increment_intake_view", {
      method: "POST", headers: { apikey: credentials.apikey, Authorization: "Bearer " + credentials.bearer, "Content-Type": "application/json" },
      body: JSON.stringify({ day: new Date().toISOString().slice(0, 10), ids }),
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) log("rpc_failed");
  } catch (_) { log("rpc_failed"); }
  return done();
};
module.exports.questions = questions;
