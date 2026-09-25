# W2 — Flow animation v3: mode correctness + design elevation

**Spec:** Fable, 3 Aug 2026. **Executor:** Opus.
**Scope approved by Nick:** fix **v3 only**; port to marketing later. The HA
`thermal-dawn-flow.html` on the Pis is likewise a later port (see §7).
**Gate:** Nick walks every state in the tester before anything is committed
to TD-Platform. Nothing deploys anywhere without him saying so.

All file references are in `C:\Users\nickz\Documents\NZ\Code\TD-Platform`
unless marked otherwise. Work on a branch.

---

## 1. Verified facts (do not re-derive)

**The canonical file:** `apps/web/public/animations/thermal-dawn-flow-v3.html`
(56 KB). Identical copies exist in `apps/portal/public/animations/` and
`sites/7-mason-street/ha/www/animations/` — edit the `apps/web` copy and sync
the others at the end.

**It already has a test harness.** Standalone open → panel shows
automatically; embedded in an iframe → hidden; `?test=1` / `?test=0`
override (line ~700). Panel groups: Time of day (+slider), Weather, Mode,
Camera. Modes drive via buttons, `?mode=`, or `postMessage({type:'setMode'})`.

**How production drives it:** `packages/dashboard/src/FlowScene.tsx` embeds
it with `?test=0` and pushes `setMode` / `setTemps` / `setEnv` over
postMessage after the scene announces `thermalDawnReady`.

**The two field sites differ in topology**, and `site.yaml` already carries
the flag the animation needs:

| Site | `plant.type` | Modes incl. | Meaning in Direct Heating |
|---|---|---|---|
| **Hawthorn** (install #1) | `valved-buffer` (MK1.2.1) | `Max_Heat` present | coil **sealed** — tank plumbed in but bypassed |
| **Warragul** (install #2) | `direct-slab`, `valves: none` | no `Max_Heat` | store **genuinely fed** as a byproduct — the old picture is *correct* here |

So the fix is **per-plant, not just per-mode**. This resolves the draft's
Q5: yes, per-topology, and both topologies are live in the field.

**Wire modes** (firmware is source of truth,
`packages/shared/src/index.ts:20` + both `sites/*/site.yaml`):
`Idle, Charge, Discharge, Direct_Heating, Charge_Boost, Direct_Heat_Boost`
(+ `Max_Heat` on valved plants only; legacy wire alias `Direct_Charge`,
normalised in `packages/shared/src/telemetry.ts:20`).

**The candidate implementation is NOT retrievable here.** Commits `29c3727`
/ revert `ab6e6f8` (branch `site/hawthorn-mk121`) exist in neither the local
TD-Platform checkout nor origin (`git ls-remote` shows only `main`). They
live in the on-Pi site repo. **Do not hunt for them; write from this spec.**
If Nick can pull the diff off the Pi it's a useful cross-check, nothing more.

---

## 2. The bugs

### Bug 1 — v3 renders Direct Heating as if charging (measured)

Probed via `?test=1` per mode:

| Mode | store label | HP→store flow | store→home flow | store glow |
|---|---|---|---|---|
| charging | Charging | 1 | 0 | charge |
| discharging | Releasing | 0 | 1 | discharge |
| **direct** | **Secondary** | **1 ← wrong (valved)** | 1 | **charge ← wrong (valved)** |
| idle | Idle | 0 | 0 | discharge |

Cause: `MODES = ['charging','discharging','direct','idle']` (line 690) — one
`direct` state stands in for three firmware modes, and it draws the HP→store
leg (line 725) plus the charging glow (line 746).

Homeowner impact: the Hawthorn homeowner (3 Aug) asked why Direct Heat and Max Heat "both do
house + tank". Customer-visible.

### Bug 2 — portal shows Idle during Max Heat (new, found in this review)

`FlowScene.tsx` `MODE_MAP` has entries for Charge / Discharge / Direct
Heating / Direct Heat Boost / Idle only. `'Max Heat'` and `'Charge Boost'`
are missing, so `MODE_MAP[mode] ?? 'idle'` renders the plant's hardest-working
mode as **Idle** on the portal. Fix in the same pass.

---

## 3. Design: visual state = f(plant, mode)

### 3.1 Plant awareness

- v3 accepts `?plant=valved|slab` (default **`valved`** — the go-forward
  product) and a `setPlant` postMessage (or a `plant` field on `setMode`;
  pick one, document it in the file header).
- `FlowScene.tsx` passes the site's `plant.type` through
  (`valved-buffer→valved`, `direct-slab→slab`). It has `LiveState` /
  site context available; if the plant type isn't in `LiveState` yet, thread
  it through from the site manifest rather than hardcoding.

### 3.2 Truth table

The tank is **always drawn** — Nick's explicit call: it stays in the loop on
every plant, in every mode. Only flows, glow, and label change.

**Valved plant (`valved`):**

| Wire mode | anim state | HP→store | store→home | store glow | store label | boost tell |
|---|---|---|---|---|---|---|
| Idle | idle | off | off | none | Idle | — |
| Charge | charging | on | off | charge | Charging | — |
| Charge_Boost | charging | on | off | charge | Charging | on |
| Discharge | discharging | off | on | discharge | Releasing | — |
| Direct_Heating | direct | **off** | on | **neutral/discharge** | **Bypassed** | — |
| Direct_Heat_Boost | direct | **off** | on | neutral/discharge | **Bypassed** | on |
| Max_Heat | maxheat | **on, secondary emphasis** | on | charge | **Secondary** | — |

**Slab plant (`slab`):**

| Wire mode | anim state | HP→store | store→home | store glow | store label | boost tell |
|---|---|---|---|---|---|---|
| Idle / Charge / Charge_Boost / Discharge | as valved | | | | | |
| Direct_Heating | direct | **on** | on | charge | **Charging** | — |
| Direct_Heat_Boost | direct | **on** | on | charge | **Charging** | on |

(`Max_Heat` never arrives from a slab plant; if it somehow does, render as
valved maxheat rather than crashing to idle.)

### 3.3 Implementation shape

Replace the single `direct` boolean with derived flags so "house fed" and
"store fed" are independent:

```js
// inside applyMode(), after resolving state.mode and state.plant
var feedsHouse = mode !== 'idle' && mode !== 'charging';
var feedsStore = mode === 'charging'
              || mode === 'maxheat'
              || (mode === 'direct' && state.plant === 'slab');
var heatFlavour = (mode === 'direct' || mode === 'maxheat');
```

- `g-flow-home` / `g-flow-home-2` visible ⟺ `feedsHouse`
- `g-flow-hp` visible ⟺ `feedsStore`; in `maxheat` render at ~0.45 opacity
  and slower dash speed so it reads as the secondary path
- store glow: charge gradient ⟺ `feedsStore`, else discharge/neutral;
  opacity 0 in idle (as now)
- flow/label colour: `heatFlavour ? var(--direct) : …` as today
- boost tell: brighter inner HP ring or small element glow on the HP body.
  Subtle — it's a state, not an event. Same tell for Charge_Boost and
  Direct_Heat_Boost.

### 3.4 Mode plumbing

- `MODES = ['charging','discharging','direct','maxheat','idle']` with a
  separate `boost` flag, **or** six flat states — executor's choice, but the
  postMessage surface must accept the *wire* names too (including
  `Direct Charge` legacy → maxheat, via the same normalisation as
  `telemetry.ts`), so FlowScene's map can be dumb.
- `FlowScene.tsx` `MODE_MAP` gains `'Max Heat'` and `'Charge Boost'`.
- `Dashboard.tsx` `MODE_CLASS` already styles Max Heat as heat-flavoured;
  leave stats (`deriveStats.ts`) **untouched** — it feeds audited numbers.

---

## 4. Design elevation — SUPERSEDED by W2b

The aesthetic pass now has its own spec: **`W2b-flow-aesthetics-spec.md`**
("lit, not flat"). It replaces this section entirely, and it **withdraws**
the earlier suggestion to move the charge orange to the marketing site's
`#f4921d` — the animation's home is the platform, whose brand token is
`#FF8C1A`, which the animation already uses. Palette matches
`packages/dashboard/src/styles.css`.

Two items from the old §4 survive, folded into W2b's rules:
- **Mode chip as headline**: `#lbl-mode-chip` 22px/700 → 26px/800,
  `letter-spacing:-0.02em`.
- **One dominant mode colour at a time** (W2b §6.2).

Sequencing: correctness (§3) first, then W2b as its own commit(s).

---

## 5. Tester (build FIRST — it's how everything else gets verified)

Extend the existing `#test-panel`; keep the show/hide gating exactly as is.

1. **Plant toggle:** `Valved | Slab`.
2. **Mode buttons:** Charge, Charge+Boost, Discharge, Direct, Direct+Boost,
   Max Heat, Idle — i.e. the wire modes, not the internal states, so the
   panel exercises the same mapping production uses.
3. **Truth readout:** a small line showing, live:
   `plant · mode → house:on/off · store:fed/secondary/releasing/bypassed ·
   HP:on/off · boost:on/off · label:<store label>`. This is what makes the
   bug class visible at a glance.
4. **Walk button:** steps through every (plant × mode) combination on a ~3 s
   dwell — 14 states — so Nick can watch the lot hands-free.

**Review loop:** Opus edits on a branch → Nick opens the file locally with
`?test=1` → walks all states → only then commit. To preview from the
marketing repo's server, copy the file to a temp name at the repo root
(dotfile paths are blocked by serve.js) and **delete it after** — it must
never be committed or deployed there.

---

## 6. Acceptance criteria

- [ ] Valved + Direct: tank drawn, HP→store flow OFF, glow neutral, label
      **Bypassed**, house path on, HP on.
- [ ] Valved + Max Heat: both paths on, HP→store visibly secondary, label
      **Secondary**, charge glow.
- [ ] Slab + Direct: HP→store ON with charge glow, label **Charging**.
- [ ] Boost modes show the tell; their base behaviour matches the non-boost
      row.
- [ ] Portal (`FlowScene`) maps `Max Heat` and `Charge Boost` — no more
      idle-during-max-heat.
- [ ] Legacy `Direct Charge` string renders as Max Heat.
- [ ] Charging/Discharging/Idle byte-identical in behaviour to today
      (regression check via the truth readout).
- [ ] Test panel still auto-hides when embedded (`window.parent !== window`).
- [ ] The three copies of v3 in the repo are identical after the change.
- [ ] Nick has walked all 14 states and said so.

## 7. Explicitly out of scope (later ports, in order)

1. Marketing site: regenerate `homepage-flow-v2.html` from fixed v3 via
   `build-homepage-anim.js`, bump `?v=`, Nick's deploy gate. Separate job.
2. HA dashboards: both Pis embed the *old* `thermal-dawn-flow.html?v=25`
   with one iframe per mode (`sites/*/ha/dashboard.yaml:23-52`) — this is
   the surface **the homeowner actually saw**. Port or upgrade to v3 there, manual
   Pi copy + `?v=` bump. Until this ships, the customer-visible bug remains
   — worth saying plainly when reporting done.
3. Stats (`deriveStats.ts`), firmware mode names, anything audited: no.
