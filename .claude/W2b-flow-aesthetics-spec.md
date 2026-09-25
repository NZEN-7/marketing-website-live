# W2b — Flow animation v3: aesthetic spec ("lit, not flat")

**Spec:** Fable, 3 Aug 2026. **Executor:** Opus. Companion to
`W2-flow-animation-spec.md` — this replaces its §4 in full.
**Ships as its own commit(s), after the correctness fix.** Same review gate:
Nick walks it in the tester before anything is committed.

Target file: `TD-Platform/apps/web/public/animations/thermal-dawn-flow-v3.html`.

---

## 1. Design intent

Nick's observation is the brief: Tesla's product visuals are reflective and
lit; ours is very flat. The distinction that matters — **Tesla's UI is flat;
their PRODUCT is shiny.** Chips, labels, buttons: matte, quiet, monochrome.
The car, the Powerwall, the Wall Connector: rendered with real dynamic range,
speculars, contact shadows, and light that responds to the scene.

So the move is not "add gloss everywhere". It is: **treat the tank, heat pump
and house as a product render, and keep every UI element exactly as flat as
it is today.** The `.tag`/`.val` typography, the mode chip, the test panel —
untouched (chip size/weight change comes from W2 §4.4, nothing else).

The platform already agrees. `packages/dashboard/src/styles.css` renders its
`brand-dot` as a lit sphere (`radial-gradient(circle at 50% 55%, #ffd9a0,
var(--brand) 55%, #7a3c00)` + glow shadow) and its header rule as a specular
light-streak with bloom. The dashboard chrome is doing miniature product
lighting; the scene it frames is the flattest thing on the page. This spec
brings the scene up to the chrome.

## 2. Why it currently reads flat (measured, not vibes)

Every material in the scene is a 2–3 stop gradient inside a narrow value
band, with no specular stop and no shadow anchor:

| Surface | Today's ramp | Value range |
|---|---|---|
| Wall | `#2c2c30 → #26262a` | ~2% — imperceptible |
| Roof | `#28282c → #232328` | ~2% |
| Steel tank front | `#8a8d94 → #65686e → #4a4d52` | smooth ramp, no highlight band |
| HP front | `#2a2a2c → #171719` | soft, no edge light |

Real metal never ramps smoothly: a stainless cylinder under one light shows a
**hard bright band** where the curvature faces the light, deep falloff either
side, and a sliver of rim light on the far edge. Flatness = the absence of
those discontinuities. Nothing in the scene casts a contact shadow, and no
surface responds to the sun/moon the scene already animates.

## 3. Palette: match the PLATFORM (correction to W2 §4)

The animation's home is the portal and HA dashboards, so it matches
`packages/dashboard/src/styles.css`, **not** the marketing site:

| Token | Value | Note |
|---|---|---|
| `--charge` / brand | `#FF8C1A` | already correct — W2 §4's suggestion to move to the site's `#f4921d` is **withdrawn** |
| `--discharge` | `#2EC68A` | platform token; keep |
| `--direct` | `#E3654F` | platform token; keep |
| `--bg` | `#0a0a0a` → **`#0d0d0d`** | align to platform `--bg`; trivial |
| neutrals | `--idle #6b7684`, `--info #4fa3e3` | available if needed |

Marketing warmth (`#100c09`) becomes a port-time parameter if it matters
then; not this repo's problem.

## 4. The light model (the actual unlock)

The scene already animates a sun and moon across time-of-day and weather.
**Materials currently ignore them.** One global key light, driven by the
existing `tod`/`wx` state, is what makes the scene feel rendered rather than
drawn:

- **Key light direction** follows the sun's x-position (the code already
  computes `sunFrac()`); at night, a cool dim key from the moon.
- **Light colour**: warm white by day (`#fff4e0`-ish), amber at dawn/dusk,
  cool blue-grey at night (`#8fa3c0`-ish at low intensity).
- **Weather dims it**: overcast/rain/storm reduce specular intensity and
  soften contrast (a single `--key-strength` variable the wx handler sets,
  0.3–1.0, multiplied into highlight opacities).

Implementation shape: define highlight/shadow elements once, drive their
`opacity` and gradient stop positions from `tod`/`wx` in the existing
`positionSun()`/env update path. No per-frame JS beyond what already runs.

## 5. Per-element treatments

Priority order — the tank is the hero and gets the budget.

### 5.1 The thermal store (hero — this is the product)

The real product is **brushed stainless** (see the marketing site's
`thermal-store-build.webp`). Sell that:

- **Specular band**: replace the smooth ramp with a stepped gradient — e.g.
  stops at `0% #565a60 · 30% #6a6e75 · 42% #c9cdd4 · 48% #eef1f5 · 54%
  #b8bcc3 · 70% #5d6167 · 100% #43464b`. The near-white band is the light;
  its x-offset shifts a few percent with sun position (two gradient variants
  cross-faded is enough — no per-frame stop animation).
- **Brushed texture**: 2–3 vertical 1px lines at `rgba(255,255,255,0.06)`
  along the drum. Cheap, reads as brushed metal.
- **Rim light**: 1.5px stroke on the shadow-side silhouette edge,
  `rgba(255,255,255,0.22)`, opacity driven by `--key-strength`.
- **Contact shadow**: soft ellipse under the tank (pre-blurred radial
  gradient, NOT a live filter — see §8), `rgba(0,0,0,0.55)` core fading out.
- **Mode reflex — the signature move**: when the store is being fed
  (charging / maxheat / slab-direct), a faint warm reflection of the charge
  orange sits low on the steel (radial gradient, ~0.18 opacity, breathing
  with the existing glow). When discharging, the same reflex in green. The
  product visibly *responds* to its state the way a Tesla render responds to
  its environment. This is the single highest-value change in the spec.

### 5.2 Heat pump

Dark satin appliance, one step up from matte:

- Top-edge highlight: 1px `rgba(255,255,255,0.14)` line along the top face.
- Fan recess ambient occlusion: darken inside the fan rings with a subtle
  radial gradient so the fans sit *in* the body.
- Contact shadow like the tank's, smaller.
- Boost tell (from W2 §3.3) renders as a warm glow *reflected on the pad
  beneath it*, not just on the unit — grounded light beats floating light.

### 5.3 House

Supporting cast; keep it quiet so the plant reads as the subject.

- Roof: a single low-intensity sheen band by day (opacity ≤0.10).
- **Windows**: warm interior glow at dusk/night *only when the house is
  being fed* (`feedsHouse` from W2 §3.3). Comfort made visible — the most
  human beat available and it costs one gradient.
- Walls: lift the gradient contrast slightly (~6% range) so the lit face
  and shadow face differ; no speculars.

### 5.4 Pipes and flows

- Pipes get a cylindrical gradient (light top edge, dark underside) instead
  of flat stroke — instantly volumetric.
- Active flow dashes keep the existing `glow-orange` bloom; inactive pipes
  drop to near-silhouette so lit vs unlit carries the story.

### 5.5 Ground

- Extend the existing `ground-glow` so active-mode glows reflect faintly on
  the ground plane beneath their source (mirrors the dashboard's header
  streak trick).
- Contact shadows from §5.1/5.2 sit on this plane and anchor everything.

## 6. Hierarchy and restraint rules

1. **One specular per object.** A highlight band is a statement; two is
   noise.
2. **Mode accent outranks everything.** No specular may exceed the active
   mode colour's brightness in the scene. If in doubt, dim the specular.
3. **UI stays flat.** No gradients, shadows or gloss on text, chips, the
   test panel, or labels. (Tesla rule: flat UI, lit product.)
4. **Sum test**: in a screenshot, the eye should land tank → mode chip →
   flows → everything else, in that order.

## 7. Motion polish (small, last)

- Glow/reflex "breathing": 4–6 s ease-in-out sine, amplitude ≤20% — present
  but not noticeable unless you look.
- Existing dash speeds per W2 §3.3 (maxheat secondary slower); no other
  motion added. Stillness is most of the Tesla feel.

## 8. Performance constraints (hard requirements)

This file runs on **Raspberry Pis** in customers' homes, not just desktops:

- **No new live `feGaussianBlur`** on animated elements. Fake all soft
  shadows/reflexes with pre-blurred radial/linear gradients. The four
  existing filters stay as-is.
- Prefer opacity/transform animation (compositable) over gradient-stop or
  filter animation.
- Two cross-faded gradient variants beat per-frame gradient mutation.
- Sanity check on a throttled CPU (Chrome devtools 6× slowdown) — the scene
  must hold its current smoothness. If a treatment costs frames, cut the
  treatment, not the frame rate.

## 9. Tester additions for this pass

Extend the W2 §5 panel with:

- **Lighting toggle: `Flat | Lit`** — instant before/after for Nick's
  review, and a kill-switch if a Pi struggles (could ship as a query param
  `?lit=0` fallback).
- The existing tod slider + weather buttons already exercise the light
  model; the 14-state walk already exercises the mode reflexes.

## 10. Acceptance

- [ ] Side-by-side (Flat/Lit toggle): the Lit scene is unmistakably more
      dimensional at a glance, with zero change to any UI element.
- [ ] Tank shows specular band, rim light, contact shadow, and the mode
      reflex in fed/releasing states.
- [ ] Dragging the tod slider visibly moves/warms/cools the lighting;
      storm visibly flattens it.
- [ ] Windows glow only when `feedsHouse`, only at dusk/night.
- [ ] No new SVG filters on animated elements; smooth at 6× CPU throttle.
- [ ] Hierarchy sum-test (§6.4) holds in day and night screenshots.
- [ ] Nick has toggled Flat/Lit across the mode walk and said ship it.
