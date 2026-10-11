/* =========================================================================
   Intake stage 2: the session layer (PRD §3.1, IF4, IF7, IF8; HoE items 103 to 105)
   -------------------------------------------------------------------------
   Required by the intake endpoints; not a route (underscore).

   One row per lead in `intake_sessions` (CRM project, Sydney), saved from the
   end of step 1 and after every screen, so anyone who leaves partway is kept.
   The table is Platform's (Pete, item 125). The website never reads or writes
   it directly: it calls five functions, so the role can be narrow and every
   rule (the token check, the atomic claim) lives in the database.

   THE CONTRACT the website expects (proposed to Platform; names may change
   when Pete posts the real table, and only this file changes with them):

     intake_session_save(p_lead_id text, p_token_hash text, p_patch jsonb) -> text
         'inserted'  first save: stores p_token_hash as the row's hash
         'updated'   later save with the same hash: merges p_patch.answers into
                     answers, sets last_screen, rung_reached, route, ts_last=now()
         'refused'   a row exists with another hash (never updated)
         'closed'    the row is completed (a late beacon after the send)
     intake_session_complete(p_lead_id text, p_token_hash text) -> jsonb
         { "ok": bool, "partial_sent": bool }   completed_at=now(); the hash must match
     intake_sessions_claim_partials(p_idle_minutes int, p_limit int) -> setof jsonb
         atomically sets partial_sent_at=now() on rows with completed_at null,
         partial_sent_at null and ts_last older than p_idle_minutes, and returns
         them (UPDATE ... FOR UPDATE SKIP LOCKED ... RETURNING): two sweeps never
         claim the same row
     intake_session_release_partial(p_lead_id text) -> boolean
         partial_sent_at back to null when the partial's emails failed, so the
         next sweep tries again
     intake_session_resume(p_lead_id text, p_new_token_hash text) -> jsonb
         { "answers", "last_screen" } and the hash replaced; null when there is
         no row or it is completed. Called only after the signed link checks out.

   Env (all optional until Platform posts the table; nothing runs without them):
     INTAKE_SESSIONS=on          the switch; off, every save is accepted and dropped
     INTAKE_SESSIONS_URL         the project the sessions live in
     INTAKE_SESSIONS_KEY         a JWT for the sessions role (bearer)
     INTAKE_SESSIONS_APIKEY      that project's public anon key (gateway apikey)
     INTAKE_TOKEN_SECRET         signs the resume link (lead_id.expiry.HMAC)
   Preview guard (PRD §4): off production the sessions URL must not be the
   production CRM, or nothing is written.
   ========================================================================= */
"use strict";

const crypto = require("crypto");

const PRODUCTION_CRM = "skyequfcoejlhzbyipwt";      // the CRM project's ref
const LEAD_ID = /^il-[0-9a-f]{10}$/;
const TOKEN = /^[0-9a-f]{64}$/;
const IDLE_MINUTES = 30;                            // Nick, 11 Oct: partials after 30 minutes
const RESUME_DAYS = 30;                             // PRD §3.1: the resume link lasts 30 days

const isProduction = (env) => (env || process.env).VERCEL_ENV === "production";
const on = (env) => String((env || process.env).INTAKE_SESSIONS || "").trim() === "on";
const hashToken = (t) => crypto.createHash("sha256").update(String(t)).digest("hex");

/** Where the sessions go, or null with a reason code (never a value). */
function target(env) {
  env = env || process.env;
  if (!on(env)) return { skip: "sessions_off" };
  const url = String(env.INTAKE_SESSIONS_URL || "").replace(/\/$/, "");
  if (!/^https:\/\//.test(url) || !env.INTAKE_SESSIONS_KEY || !env.INTAKE_SESSIONS_APIKEY) return { skip: "not_configured" };
  // A preview or local run never touches the production CRM, whatever the env says.
  if (!isProduction(env) && url.indexOf(PRODUCTION_CRM) !== -1) return { skip: "non_production_guard" };
  return { url, bearer: env.INTAKE_SESSIONS_KEY, apikey: env.INTAKE_SESSIONS_APIKEY };
}

/** The real store: the five functions over PostgREST. */
function restStore(env) {
  const t = target(env);
  if (t.skip) return { skip: t.skip };
  async function rpc(name, args) {
    const res = await fetch(`${t.url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: t.apikey, Authorization: `Bearer ${t.bearer}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) { const e = new Error("rpc_failed"); e.code = `rpc_${res.status}`; throw e; }
    const text = await res.text();
    try { return JSON.parse(text); } catch (_) { return text; }
  }
  return {
    save: (leadId, tokenHash, patch) => rpc("intake_session_save", { p_lead_id: leadId, p_token_hash: tokenHash, p_patch: patch }),
    complete: (leadId, tokenHash) => rpc("intake_session_complete", { p_lead_id: leadId, p_token_hash: tokenHash }),
    claimPartials: (idle, limit) => rpc("intake_sessions_claim_partials", { p_idle_minutes: idle, p_limit: limit }),
    releasePartial: (leadId) => rpc("intake_session_release_partial", { p_lead_id: leadId }),
    resume: (leadId, newHash) => rpc("intake_session_resume", { p_lead_id: leadId, p_new_token_hash: newHash }),
  };
}

/** The same contract in memory, for the tests (and nothing else). */
function memoryStore() {
  const rows = new Map();
  const now = () => (memoryStore.clock ? memoryStore.clock() : Date.now());
  return {
    rows,
    async save(leadId, tokenHash, patch) {
      const r = rows.get(leadId);
      if (!r) {
        rows.set(leadId, { lead_id: leadId, token_hash: tokenHash, answers: Object.assign({}, patch.answers),
          last_screen: patch.last_screen || null, rung_reached: patch.rung_reached || null, route: patch.route || null,
          ts_started: patch.ts_started || new Date(now()).toISOString(), ts_last: new Date(now()).toISOString(),
          partial_sent_at: null, completed_at: null });
        return "inserted";
      }
      if (r.token_hash !== tokenHash) return "refused";
      if (r.completed_at) return "closed";
      Object.assign(r.answers, patch.answers || {});
      ["last_screen", "rung_reached", "route"].forEach((k) => { if (patch[k] != null) r[k] = patch[k]; });
      r.ts_last = new Date(now()).toISOString();
      return "updated";
    },
    async complete(leadId, tokenHash) {
      const r = rows.get(leadId);
      if (!r || r.token_hash !== tokenHash) return { ok: false, partial_sent: false };
      r.completed_at = r.completed_at || new Date(now()).toISOString();
      return { ok: true, partial_sent: !!r.partial_sent_at };
    },
    async claimPartials(idle, limit) {
      const cut = now() - idle * 60000, out = [];
      for (const r of rows.values()) {
        if (out.length >= limit) break;
        if (!r.completed_at && !r.partial_sent_at && Date.parse(r.ts_last) <= cut) {
          r.partial_sent_at = new Date(now()).toISOString();
          out.push(JSON.parse(JSON.stringify(r)));
        }
      }
      return out;
    },
    async releasePartial(leadId) { const r = rows.get(leadId); if (r) r.partial_sent_at = null; return !!r; },
    async resume(leadId, newHash) {
      const r = rows.get(leadId);
      if (!r || r.completed_at) return null;
      r.token_hash = newHash;
      return { answers: r.answers, last_screen: r.last_screen };
    },
  };
}

/* ---- the resume link (PRD §3.1): lead_id.expiry.HMAC, 30 days ---- */
function signResume(leadId, env, now) {
  const secret = (env || process.env).INTAKE_TOKEN_SECRET;
  if (!secret || !LEAD_ID.test(leadId)) return null;
  const exp = Math.floor((now || Date.now()) / 1000) + RESUME_DAYS * 86400;
  const mac = crypto.createHmac("sha256", secret).update(`${leadId}.${exp}`).digest("base64url");
  return `${leadId}.${exp}.${mac}`;
}
function verifyResume(token, env, now) {
  const secret = (env || process.env).INTAKE_TOKEN_SECRET;
  const m = /^(il-[0-9a-f]{10})\.(\d{9,11})\.([A-Za-z0-9_-]{43})$/.exec(String(token || ""));
  if (!secret || !m) return null;
  if (Number(m[2]) * 1000 < (now || Date.now())) return null;
  const want = crypto.createHmac("sha256", secret).update(`${m[1]}.${m[2]}`).digest();
  const got = Buffer.from(m[3], "base64url");
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null;
  return m[1];
}
/** Where the link points: the live site, or the preview it came from. */
function resumeUrl(token, env) {
  env = env || process.env;
  const host = isProduction(env) ? "https://www.thermaldawn.com"
    : env.VERCEL_URL ? `https://${String(env.VERCEL_URL).replace(/^https?:\/\//, "")}` : "https://www.thermaldawn.com";
  return `${host}/start/?resume=${encodeURIComponent(token)}`;
}

/* ---- what a save may carry ---- */
const SCREEN = /^(intro|S\d{1,2}[b-d]?|B2|MATCH|MATCH_SHORT|URGENT|DONE|O1|N1|POSTED)$/;
const ANSWER = /^[a-z_]{1,32}$/;
/** A save's patch from the page: answer keys and short values only, bounded. */
function patchFrom(body) {
  const a = body && typeof body.answers === "object" && !Array.isArray(body.answers) ? body.answers : {};
  const answers = {};
  let n = 0;
  for (const k of Object.keys(a)) {
    if (!ANSWER.test(k) || ++n > 60) continue;
    const v = a[k];
    if (typeof v === "boolean") answers[k] = v;
    else if (Array.isArray(v)) answers[k] = v.slice(0, 12).map((x) => String(x).slice(0, 60));
    else if (v != null) answers[k] = String(v).slice(0, k === "notes" ? 5000 : k === "heating_notes" ? 2000 : 300);
  }
  return {
    answers,
    last_screen: SCREEN.test(String(body.last_screen || "")) ? String(body.last_screen) : null,
    rung_reached: ["1", "2", "3", "done"].indexOf(String(body.rung_reached)) !== -1 ? String(body.rung_reached) : null,
    route: /^[a-z-]{1,20}$/.test(String(body.route || "")) ? String(body.route) : null,
    ts_started: Number(body.ts) > 0 ? new Date(Number(body.ts)).toISOString() : null,
  };
}

/** The store the endpoints use: the real one, unless a test has put in its own. */
let injected = null;
function store(env) { return injected || restStore(env); }
function useStore(s) { injected = s; }

/** Step 1 is done (IF4: nothing is saved before it): a name, an email, a
    postcode (or outside Australia), and a phone or the email preference. */
function stepOneDone(a) {
  if (!a || !String(a.first_name || "").trim() || !String(a.last_name || "").trim()) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(a.email || "").trim())) return false;
  if (a.state !== "OS" && !/^\d{4}$/.test(String(a.postcode || ""))) return false;
  return a.state === "OS" || !!String(a.phone || "").trim() || a.contact_pref === "email";
}

module.exports = { store, useStore, stepOneDone, target, restStore, memoryStore, hashToken, signResume, verifyResume, resumeUrl, patchFrom,
  isProduction, on, LEAD_ID, TOKEN, IDLE_MINUTES, PRODUCTION_CRM };
