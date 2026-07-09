# Missing media — export checklist

These are the images/videos the v2 copy references that we **don't have locally**. Each one shows up on the built site as a dashed, labelled placeholder box (and an `<!-- MISSING WIX MEDIA: … -->` HTML comment in the source) so nothing ships as a broken image. Export each from the **Wix Media Manager** (or the source noted), drop it into `assets/img/`, and replace the placeholder `<div class="media-ph">…</div>` with a normal `<img>` (or `<video>`/embed).

Wherever a suitable local photo existed, it's already used instead of a placeholder — see "Images already in use" at the bottom.

---

## Priority 1 — proof/credibility (used on multiple pages)

- [x] **Real install / product photos — DONE.** Now using real photos from `Design/Photos/Build 1/` (per your go-ahead): the finished branded unit outdoors (`install-unit.webp`, IMG_2527), the system arriving at the home (`install-delivery.webp`, IMG_2526), and install pipework (`install-pipework.webp`, IMG_2366). Wired into **Home** §6, the **Hawthorn case study** (two spots), and the **old-gas-boiler post**.
  - *Still nice to have:* a literal "gas meter removed" close-up doesn't exist in Build 1 — the captions describe what the photos actually show rather than claiming the meter shot. Swap in a true gas-meter photo if/when you have one.
  - *Optional:* **Hydronic** §8 and **Mission** §7 proof sections are still text-only — `install-unit.webp` could be added there too if you want.
- [ ] **Startmate Demo Day talk (video)** — founder pitch, story/credibility, *not* a product demo. Need the video URL (YouTube/Vimeo/Wix video). *(Still a placeholder.)*
  - Appears on: **Home** (§7 "Why we're building this") and **Mission** (§9). Same embed on both.

## Priority 2 — product / app

- [ ] **Real app screenshots** — the **Savings Tracker** screen and the **Forecast View** screen from the live app. (The **energy-dashboard** screenshot we *do* have is already in use on Home, Intelligence, and the case study.)
  - Appears on: **Intelligence** (§6).
- [ ] **Component slider imagery** — heat pump, fan coils, and controls cards for the "What's Included" slider. Confirm the card copy on the live site and export the component images.
  - Appears on: **Pricing** (§3).
- [x] **Old gas boiler post image — DONE.** Now uses real install pipework (`install-pipework.webp`). Swap for an actual boiler-removal photo later if you get one.

## Priority 3 — needs a re-export / edit (not strictly missing)

- [ ] **State generation-mix chart (QLD, "with vs without Thermal Dawn", 2 frames)** — the existing chart's captions still say **"FreeVolt"**. Re-export with **"Thermal Dawn"** captions. Also confirm the 4GW→2GW / 2GW-coal modelling is OK to publish (label as illustrative).
  - Appears on: **Mission** (§8).
- [ ] **System spec sheet (PDF)** — the Pricing page has a "Download the full system spec sheet (PDF)" button pointing to `#` (`<!-- TODO: link spec sheet PDF when available -->`). Add the PDF to `assets/` and update the link.
- [ ] **Founder LinkedIn URL** — Mission §9 bio has a `LinkedIn →` link pointing to `#` (`<!-- TODO: founder LinkedIn URL -->`).

---

## Images already in use (from the Design folder, optimised to WebP)

These were selected, resized, and converted to WebP in `assets/img/` so pages aren't placeholder-heavy:

| File | Used on | Source |
| --- | --- | --- |
| `hero-sunrise-1920.webp` / `-1200.webp` | Hero backgrounds sitewide | Photos/cover image.png |
| `og-image.png` | Social share card (all pages) | cover image + logo |
| `app-dashboard.webp` | Home §6, Intelligence §6, Case study | Photos/App/IMG_3171.PNG (real app UI) |
| `product-unit.webp`, `product-unit-vent.webp` | Hydronic, Pricing, Intelligence, blog | Concept Art (product render) |
| `thermal-store-build.webp` | Pricing §3 | Photos/Build 1 (thermal store in manufacture) |
| `detail-coil.webp` | Blog / technical | Photos/Build 1 (copper coil) |
| `control-board.webp` | Intelligence §7 | Photos/Build 1 (Thermal Dawn control board) |
| `brand-ute-dawn.webp` | Mission | Photos/Build 1 (branded ute at dawn) |
| `logo-black.*`, `logo-white.*` | Header / footer | CI/Logos |

> Product-render shots are concept art of a wall-mounted unit. If you'd rather show the *actual* Hawthorn hardware, swap these for real install photos when available.
