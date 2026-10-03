/* =========================================================================
   Thermal Dawn intake: the routing rules (PROTOTYPE, PRD D13)
   -------------------------------------------------------------------------
   Pure: given the answers so far and the screen just finished, which screen
   comes next. Shared by the page (window.TDIntakeRoute) and the tests
   (require), so the paths in SPEC §1 are checked in CI, not by eye.

   Source: PRDs/Intake form/SPEC - Intake questions and copy.md, rev A.
   ========================================================================= */
(function (root) {
  "use strict";

  var SERVED = ["VIC", "NSW", "ACT"];                 // = SERVED_STATES in api/lead.js
  var BOILERS = ["boiler_radiators", "boiler_underfloor", "lpg_boiler"];
  var NON_ICP = ["ducted_gas", "splits", "other"];    // N1 only if these are ALL they picked

  function list(v) { return Array.isArray(v) ? v : (v ? [v] : []); }

  /** State from the postcode, by Australia Post ranges. NZ entries come in
      as state "OS" from the "not in Australia" link. */
  function stateFor(pc) {
    var n = parseInt(String(pc || "").trim(), 10);
    if (!/^\d{4}$/.test(String(pc || "").trim())) return "";
    if ((n >= 200 && n <= 299) || (n >= 2600 && n <= 2618) || (n >= 2900 && n <= 2920)) return "ACT";
    if ((n >= 1000 && n <= 2599) || (n >= 2619 && n <= 2899) || (n >= 2921 && n <= 2999)) return "NSW";
    if ((n >= 3000 && n <= 3999) || (n >= 8000 && n <= 8999)) return "VIC";
    if ((n >= 4000 && n <= 4999) || (n >= 9000 && n <= 9999)) return "QLD";
    if (n >= 5000 && n <= 5999) return "SA";
    if (n >= 6000 && n <= 6999) return "WA";
    if (n >= 7000 && n <= 7999) return "TAS";
    if (n >= 800 && n <= 999) return "NT";
    return "";
  }

  function inArea(a) { return SERVED.indexOf(String(a.state || "").toUpperCase()) !== -1; }
  function hasBoiler(a) { return list(a.heating).some(function (h) { return BOILERS.indexOf(h) !== -1; }); }
  function notOurProduct(a) {
    var h = list(a.heating);
    return h.length > 0 && h.every(function (x) { return NON_ICP.indexOf(x) !== -1; });
  }
  function isUrgent(a) { return a.intent === "urgent" || a.boiler_condition === "broken"; }
  /** No boiler picked ("Not sure", "No heating yet" or nothing): the match
      says "could be" and the route is icp-check (Sales review, finding 4). */
  function unconfirmed(a) { return !hasBoiler(a); }

  /** The route tag for the notification (SPEC §7). */
  function route(a) {
    if (a.state && !inArea(a)) return "out-of-area";
    if (notOurProduct(a)) return "not-our-product";
    if (isUrgent(a)) return "urgent";
    if (a.intent === "explore") return "explore";
    return unconfirmed(a) ? "icp-check" : "icp";
  }

  /** Next screen after `done`, given answers `a`. */
  function afterHeating(a) {
    if (notOurProduct(a)) return "N1";
    if (isUrgent(a)) return "URGENT";
    if (a.intent === "explore") return "MATCH_SHORT";
    if (a.intent === "book") return "MATCH";
    return "S10";
  }
  function needsBoiler(a) { return hasBoiler(a) && (!a.intent || a.intent === "fit"); }
  function radiators(a) { var h=list(a.heating); return h.indexOf("boiler_radiators")!==-1 || h.indexOf("lpg_boiler")!==-1 || h.indexOf("boiler_underfloor")===-1; }
  function underfloor(a) { var h=list(a.heating); return h.indexOf("boiler_underfloor")!==-1 || h.indexOf("lpg_boiler")!==-1; }
  function next(done, a) {
    switch (done) {
      case "intro": return "S1";
      case "S1": return "S2";
      case "S2": return "S2b";
      case "S2b": return "S3";
      case "S3": return a.state === "OS" ? "S6" : "S3b";
      case "S3b": return inArea(a) ? "S4" : "S6";
      case "S4": return String(a.phone || "").trim() ? "S4b" : (inArea(a) ? "S5" : "S6");
      case "S4b": return inArea(a) ? "S5" : "S6";
      case "S5": return "S6";
      case "S6": return list(a.source).some(function(s){return s === "friend" || s === "installer";}) ? "S6b" : (inArea(a) ? "S7" : "O1");
      case "S6b": return inArea(a) ? "S7" : "O1";
      case "S7": return needsBoiler(a) ? "S8" : "B2";
      case "S8": return "S9b";
      case "S9b": return "B2";
      case "B2": return list(a.heating).indexOf("other")!==-1 ? "S7b" : afterHeating(a);
      case "S7b": return afterHeating(a);
      case "S10": return "S11";
      case "S11": return "S12";
      case "S12": return "S13";
      case "S13": return "S13b";
      case "S13b": return "MATCH";
      case "MATCH": case "MATCH_SHORT": return "S14";
      case "S14": return radiators(a) ? "S14b" : (underfloor(a) ? "S14c" : "S14d");
      case "S14b": return underfloor(a) ? "S14c" : "S14d";
      case "S14c": return "S14d";
      case "S14d": return "S15";
      case "S15": return "S16";
      case "S16": return "S16b";
      case "S16b": return "S16c";
      case "S16c": return "S16d";
      case "S16d": return "S17";
      case "S17": return "DONE";
      default: return null;
    }
  }
  /** Stage names describe the journey; split questions retain their IDs. */
  function stepOf(screen) {
    if (/^S[1-6]b?$/.test(screen) || screen === "intro") return 1;
    if (/^S([78]b?|9b|1[0-3]b?)$/.test(screen) || screen === "B2" || screen === "URGENT" || /^MATCH/.test(screen)) return 2;
    if (/^S1[4-7][b-d]?$/.test(screen)) return 3;
    return 4;
  }

  /** The 1-2 "why it suits you" lines on the match (SPEC §4). Order (Sales
      review, 6): boiler condition, solar, cheap window, hot water, battery/EV. */
  function whyLines(a) {
    var e = list(a.energy), out = [];
    var bat = e.indexOf("battery") !== -1, ev = e.indexOf("ev") !== -1;
    if (["getting_on", "playing_up", "broken"].indexOf(a.boiler_condition) !== -1) out.push("It replaces a boiler you'd otherwise be replacing anyway.");
    if (e.indexOf("solar") !== -1) out.push("Your solar can charge the store during the day.");
    if (e.indexOf("cheap_window") !== -1) out.push("It can charge in your cheap or free window.");
    if (list(a.scope).indexOf("hot_water") !== -1) out.push("It can take over your hot water too.");
    if (bat && ev) out.push("It works alongside your battery and car charging.");
    else if (bat) out.push("It works alongside your battery.");
    else if (ev) out.push("It works alongside your car charging.");
    return out.slice(0, 2);
  }

  /** How the match names their heating (Sales review, 5): LPG can be either,
      so it only says radiators or underfloor when a gas card fixes it. */
  function emitters(a) {
    var h = list(a.heating), rad = h.indexOf("boiler_radiators") !== -1, uf = h.indexOf("boiler_underfloor") !== -1;
    return rad && uf ? "radiators and underfloor heating" : uf ? "underfloor heating" : rad ? "radiators" : "radiators or underfloor heating";
  }

  var api = { SERVED: SERVED, stateFor: stateFor, inArea: inArea, hasBoiler: hasBoiler,
              notOurProduct: notOurProduct, isUrgent: isUrgent, unconfirmed: unconfirmed, route: route, next: next,
              stepOf: stepOf, whyLines: whyLines, emitters: emitters };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TDIntakeRoute = api;
})(this);
