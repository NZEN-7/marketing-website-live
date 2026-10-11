/* =========================================================================
   Intake stage 2: the session layer (PRD §3.1, IF4, IF7, IF8; HoE items 103 to 108)
   -------------------------------------------------------------------------
   Required by the intake endpoints; not a route (underscore).

   One row per lead in `intake_sessions` (CRM project, Sydney), saved from the
   end of step 1 and after every screen, so anyone who leaves partway is kept.
   The table is Platform's: migration `docs/migrations/intake_sessions (11 Oct
   2026).sql` (Pete, item 125). The website never touches the table itself; it
   calls Pete's five functions, which are executable by service_role only:

     intake_session_save(p_lead_id, p_token, p_answers, p_last_screen, p_rung, p_route) -> boolean
         first call makes the row with the token's hash; later calls must bring the
         same token; refused once completed or 30 days after it started
     intake_session_complete(p_lead_id, p_token, p_route) -> boolean
         marks it finished: the sweep never takes it again
     intake_session_resume(p_lead_id, p_token) -> jsonb {answers, last_screen, rung_reached, route} | null
     intake_sweep_claim(p_idle_minutes, p_limit) -> rows (intake_lead_id, claim, answers, ...)
         sessions idle 30 min, not finished, not yet emailed, not claimed in the
         last 15 min; FOR UPDATE SKIP LOCKED, so two runs never take the same row
     intake_sweep_done(p_lead_id, p_claim) -> boolean   true once, for the claim holder

   The resume link carries the lead's own 64-hex token (Pete: "carried in the
   resume link next to the lead id"). The table keeps only its hash, so for the
   sweep to write the link the token also rides in the answers, ENCRYPTED with
   INTAKE_TOKEN_SECRET (AES-256-GCM, key `answers._rt`). The database never sees
   it in the clear; it is stripped from everything that leaves the server.

   Pete's `route` check is [a-z0-9_]; the app's routes have hyphens
   (out-of-area, icp-check, not-our-product), so they are stored with
   underscores and read back with hyphens.

   Env:
     INTAKE_SESSIONS=on          the switch; off, every save is accepted and dropped
     SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   the CRM and the server key the functions need
     INTAKE_TOKEN_SECRET         encrypts the token in the answers
   Preview guard (PRD §4): off production nothing is written to the production
   CRM. With no CRM branch (Nick, 11 Oct) previews simply skip sessions.
   ========================================================================= */
"use strict";

const crypto = require("crypto");

const PRODUCTION_CRM = "skyequfcoejlhzbyipwt";      // the CRM project's ref
const LEAD_ID = /^il-[0-9a-f]{10}$/;
const TOKEN = /^[0-9a-f]{64}$/;
const IDLE_MINUTES = 30;                            // Nick, 11 Oct: partials after 30 minutes
const RUNG = { 1: 1, 2: 2, 3: 3, done: 4 };
const RUNG_BACK = { 1: "1", 2: "2", 3: "3", 4: "done" };

const isProduction = (env) => (env || process.env).VERCEL_ENV === "production";
const on = (env) => String((env || process.env).INTAKE_SESSIONS || "").trim() === "on";
const routeIn = (r) => (r ? String(r).replace(/-/g, "_") : null);
const routeOut = (r) => (r ? String(r).replace(/_/g, "-") : "");

/** Where the sessions go, or a skip reason code (never a value). */
function target(env) {
  env = env || process.env;
  if (!on(env)) return { skip: "sessions_off" };
  const url = String(env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!/^https:\/\//.test(url) || !key) return { skip: "not_configured" };
  if (!env.INTAKE_TOKEN_SECRET) return { skip: "token_secret_unset" };
  // A preview or local run never touches the production CRM, whatever the env says.
  if (!isProduction(env) && url.indexOf(PRODUCTION_CRM) !== -1) return { skip: "non_production_guard" };
  return { url, key };
}

/* ---- the token in the answers: AES-256-GCM under INTAKE_TOKEN_SECRET ---- */
const keyOf = (env) => crypto.createHash("sha256").update("intake-rt:" + String((env || process.env).INTAKE_TOKEN_SECRET || "")).digest();
function sealToken(token, env) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", keyOf(env), iv);
  const out = Buffer.concat([c.update(String(token), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), out].map((b) => b.toString("base64url")).join(".");
}
function openToken(sealed, env) {
  try {
    const [iv, tag, data] = String(sealed || "").split(".").map((s) => Buffer.from(s, "base64url"));
    const d = crypto.createDecipheriv("aes-256-gcm", keyOf(env), iv);
    d.setAuthTag(tag);
    const t = Buffer.concat([d.update(data), d.final()]).toString("utf8");
    return TOKEN.test(t) ? t : null;
  } catch (_) { return null; }
}
/** Answers as they may leave the server: never the sealed token. */
function publicAnswers(a) { const o = Object.assign({}, a || {}); delete o._rt; return o; }

/** The real store: Pete's five functions over PostgREST, plus one read of leads. */
function restStore(env) {
  const t = target(env);
  if (t.skip) return { skip: t.skip };
  const headers = { apikey: t.key, Authorization: `Bearer ${t.key}`, "Content-Type": "application/json" };
  async function rpc(name, args) {
    const res = await fetch(`${t.url}/rest/v1/rpc/${name}`, { method: "POST", headers, body: JSON.stringify(args), signal: AbortSignal.timeout(4000) });
    if (!res.ok) { const e = new Error("rpc_failed"); e.code = `rpc_${res.status}`; throw e; }
    const text = await res.text();
    try { return JSON.parse(text); } catch (_) { return text; }
  }
  return {
    async save(leadId, token, patch) {
      return (await rpc("intake_session_save", { p_lead_id: leadId, p_token: token, p_answers: patch.answers,
        p_last_screen: patch.last_screen, p_rung: RUNG[patch.rung_reached] || null, p_route: routeIn(patch.route) })) === true;
    },
    async complete(leadId, token, route) {
      return (await rpc("intake_session_complete", { p_lead_id: leadId, p_token: token, p_route: routeIn(route) })) === true;
    },
    async resume(leadId, token) {
      const r = await rpc("intake_session_resume", { p_lead_id: leadId, p_token: token });
      return r && typeof r === "object" ? r : null;
    },
    async claim(idle, limit) { const r = await rpc("intake_sweep_claim", { p_idle_minutes: idle, p_limit: limit }); return Array.isArray(r) ? r : []; },
    async done(leadId, claim) { return (await rpc("intake_sweep_done", { p_lead_id: leadId, p_claim: claim })) === true; },
    // Pete's at-least-once note: before a re-send, see whether the partial row is already there.
    async hasPartial(leadId) {
      const res = await fetch(`${t.url}/rest/v1/leads?intake_lead_id=eq.${encodeURIComponent(leadId)}&intake_event=eq.partial&select=intake_lead_id&limit=1`,
        { headers, signal: AbortSignal.timeout(4000) });
      if (!res.ok) { const e = new Error("read_failed"); e.code = `read_${res.status}`; throw e; }
      const rows = JSON.parse(await res.text());
      return Array.isArray(rows) && rows.length > 0;
    },
  };
}

/** Pete's functions in memory, same rules, for the tests (and nothing else). */
function memoryStore() {
  const rows = new Map(), partials = new Set();
  const now = () => (memoryStore.clock ? memoryStore.clock() : Date.now());
  const hash = (t) => crypto.createHash("sha256").update(String(t)).digest("hex");
  const live = (r) => !r.completed_at && now() - r.ts_started < 30 * 86400000;
  const check = (v, re) => v == null || re.test(String(v));
  return {
    rows, partials,
    async save(leadId, token, patch) {
      if (!LEAD_ID.test(leadId) || !TOKEN.test(token)) return false;
      // Pete's check constraints: a value they refuse fails the whole call.
      const route = routeIn(patch.route);
      if (!check(route, /^[a-z0-9_]{1,32}$/) || !check(patch.last_screen, /^[A-Za-z0-9_]{1,16}$/)) { const e = new Error("rpc_failed"); e.code = "rpc_400"; throw e; }
      const r = rows.get(leadId), h = hash(token);
      if (!r) {
        rows.set(leadId, { intake_lead_id: leadId, resume_hash: h, answers: Object.assign({}, patch.answers), rung_reached: RUNG[patch.rung_reached] || 1,
          route, last_screen: patch.last_screen || null, ts_started: now(), ts_last: now(),
          completed_at: null, sweep_claim: null, sweep_claimed_at: null, partial_sent_at: null });
        return true;
      }
      if (r.resume_hash !== h || !live(r)) return false;
      Object.assign(r.answers, patch.answers || {});
      r.rung_reached = Math.max(r.rung_reached, RUNG[patch.rung_reached] || r.rung_reached);
      if (route) r.route = route;
      if (patch.last_screen) r.last_screen = patch.last_screen;
      r.ts_last = now();
      return true;
    },
    async complete(leadId, token, route) {
      const r = rows.get(leadId);
      if (!r || r.resume_hash !== hash(token)) return false;
      if (!r.completed_at) { r.completed_at = now(); r.ts_last = now(); }
      if (route) r.route = routeIn(route);
      return true;
    },
    async resume(leadId, token) {
      const r = rows.get(leadId);
      if (!r || r.resume_hash !== hash(token) || !live(r)) return null;
      return JSON.parse(JSON.stringify({ answers: r.answers, last_screen: r.last_screen, rung_reached: r.rung_reached, route: r.route }));
    },
    async claim(idle, limit) {
      const out = [], c = crypto.randomUUID();
      for (const r of rows.values()) {
        if (out.length >= limit) break;
        if (r.completed_at || r.partial_sent_at || now() - r.ts_last < idle * 60000) continue;
        if (r.sweep_claimed_at && now() - r.sweep_claimed_at < 15 * 60000) continue;
        r.sweep_claim = c; r.sweep_claimed_at = now();
        out.push(JSON.parse(JSON.stringify({ intake_lead_id: r.intake_lead_id, claim: c, answers: r.answers, last_screen: r.last_screen,
          rung_reached: r.rung_reached, route: r.route, ts_started: new Date(r.ts_started).toISOString(), ts_last: new Date(r.ts_last).toISOString() })));
      }
      return out;
    },
    async done(leadId, claim) {
      const r = rows.get(leadId);
      if (!r || r.sweep_claim !== claim || r.partial_sent_at || r.completed_at) return false;
      r.partial_sent_at = now();
      return true;
    },
    async hasPartial(leadId) { return partials.has(leadId); },
  };
}

/** The store the endpoints use: the real one, unless a test has put in its own. */
let injected = null;
function store(env) { return injected || restStore(env); }
function useStore(s) { injected = s; }

/* ---- the resume link: /start/#resume=<lead_id>.<token> ----
   In the fragment, so it never reaches a server log; the page posts it to
   /api/intake-resume/. The database checks the token and the 30-day life. */
function resumeUrl(leadId, token, env) {
  env = env || process.env;
  const host = isProduction(env) ? "https://www.thermaldawn.com"
    : env.VERCEL_URL ? `https://${String(env.VERCEL_URL).replace(/^https?:\/\//, "")}` : "https://www.thermaldawn.com";
  return `${host}/start/#resume=${leadId}.${token}`;
}

/* ---- what a save may carry ---- */
const SCREEN = /^(intro|S\d{1,2}[b-d]?|B2|MATCH|MATCH_SHORT|URGENT|DONE|O1|N1|POSTED)$/;
const ANSWER = /^[a-z][a-z_]{0,31}$/;
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
  };
}

/** Step 1 is done (IF4: nothing is saved before it): a name, an email, a
    postcode (or outside Australia), and a phone or the email preference. */
function stepOneDone(a) {
  if (!a || !String(a.first_name || "").trim() || !String(a.last_name || "").trim()) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(a.email || "").trim())) return false;
  if (a.state !== "OS" && !/^\d{4}$/.test(String(a.postcode || ""))) return false;
  return a.state === "OS" || !!String(a.phone || "").trim() || a.contact_pref === "email";
}

module.exports = { store, useStore, stepOneDone, target, restStore, memoryStore, sealToken, openToken, publicAnswers,
  resumeUrl, patchFrom, routeOut, RUNG_BACK, isProduction, on, LEAD_ID, TOKEN, IDLE_MINUTES, PRODUCTION_CRM };
