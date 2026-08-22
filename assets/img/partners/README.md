# Partner / backer logos

**Status: all ten files are in place (Jul 2026)** and render on the site.
Sources: Startmate wordmark from startmate.com's own site assets; Cicada
Innovations wordmark extracted from cicadainnovations.com's inline header SVG;
EnergyLab from energylab.org.au (they publish white only, the dark variant is
a mono recolour); the two NSW lockups are composed from the official NSW
Government waratah SVG (nsw.gov.au) plus the agency name, following NSW
co-branding layout. If any organisation supplies an official lockup file,
replace ours with theirs.

Files here appear automatically, no code change needed. If a file is
missing, the site renders the organisation's name as a bordered text label
instead (see `upgradePartnerLogos()` in `assets/js/site.js`).

## Filenames

Each logo is referenced by the `data-logo` value in the markup:

| `data-logo` | Light-background file | Dark-background file |
| --- | --- | --- |
| `cicada` | `cicada.svg` | `cicada-white.svg` |
| `nsw-ocse` | `nsw-ocse.svg` | `nsw-ocse-white.svg` |
| `energylab` | `energylab.svg` | `energylab-white.svg` |
| `investment-nsw` | `investment-nsw.svg` | `investment-nsw-white.svg` |
| `startmate` | `startmate.svg` | `startmate-white.svg` |

The `-white` variant is used inside `.section--dark` / `.section--cocoa` and on
any page with `<body class="dark">`, which is every page except the homepage.
The homepage credibility strip sits on white, so it uses the plain file.

## Where they appear

- **Home**, credibility strip ("Backed By"): cicada, nsw-ocse, energylab
- **Home**, About us row: all five

## Format

- **SVG preferred** (crisp at any size, tiny). PNG at 2× also works, change
  the extension in `upgradePartnerLogos()` if you only have PNG.
- Logos are capped at 34px tall (26px in the credibility strip); supply
  something that reads clearly at that height.
- Use each organisation's official mark from their brand kit / partner pack,
  not a screenshot or a traced copy.

## Permission

All five are cleared for use (Nick, Jul 2026): Cicada Innovations, NSW Office
of the Chief Scientist & Engineer, EnergyLab, Investment NSW, Startmate.

Still check each organisation's brand guidelines for clear-space, minimum-size
and colour rules before publishing, permission to use the mark usually comes
with conditions on how it's shown.

## Home Assistant

In place. The official lockup, taken unmodified from the project's own
repository (`home-assistant/home-assistant.io`, `source/images/`), which
serves the same files as home-assistant.io:

| `data-logo` | Light-background file | Dark-background file |
|---|---|---|
| `home-assistant` | `home-assistant.svg` | `home-assistant-white.svg` |

The white variant is the one that renders today: the brand card in
`intelligence/index.html` sits on Home Assistant's own blue (#18BCF2, taken
from their colour logo), and `upgradePartnerLogos()` picks the white file
because the page is `body.dark`.

Both files are byte-identical to the source, with no scripts or external
references. The lockup is about 7:1 (viewBox 1705x241), so any height rule
needs a max-width clearing height x 7.1 or `object-fit: contain` letterboxes
it and the logo renders short.

Using their mark to state a real integration is ordinary practice, but it
stays their trademark: do not recolour, restyle or redraw it. If it needs to
sit on a different background, take the matching official variant instead.
