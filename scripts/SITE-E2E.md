# Website end-to-end checks

Run from the repository root using an existing Playwright installation and installed Chrome:

    node scripts/test-site-e2e.cjs --suite local
    node scripts/test-site-e2e.cjs --suite url --url https://www.thermaldawn.com

The URL suite exits with status 1 when a requirement fails. It deliberately keeps currently failing requirements visible. No package or lockfile changes are needed to use an existing installation. For CI, the proposed new dev dependency is `playwright` (tested with 1.62.1); the owner should decide and install it separately. No installation or browser download occurs in this runner.

For the Codex bundled runtime in PowerShell:

    $env:NODE_PATH = 'C:\Users\nickz\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'

Alternatively set `E2E_PLAYWRIGHT` to an existing Playwright module path. `E2E_BROWSER_CHANNEL` defaults to `chrome`; use `msedge` for installed Edge. `E2E_REPORT` optionally specifies a JSON output path. Default reports are in the OS temporary directory, outside the checkout. `--paths /hydronic/pricing/,/privacy/` limits public-page checks for diagnosis; the separate menu and intake keyboard checks still run. Report subset results as subsets.

## URL suite

Discovers public index.html routes from this checkout: currently 30 canonical pages and the legacy registration route. Check out the matching site revision when using a preview. Canonical pages must return 200; the legacy route must return 301 with a /start/ location. Footer privacy links, the intake consent and footer-strip privacy links, trial class scope, keyboard traversal/focus cues and page-load requests are separate assertions. Native FAQs are opened using Enter before checking their contents. Same-origin diagram frames are included. A dedicated check detects the hidden desktop submenu, and another opens and traverses the mobile menu. Intake S5 exercises radio arrows followed by Enter and Space without submission, with synthetic contact fixtures.

Only GET requests to the selected site origin are transmitted. Browser API requests, non-GET requests and cross-origin requests are intercepted and aborted. No deployed submit, booking link, upload, exit or final confirmation is activated. Service workers are disabled. Node HTTP checks use manual redirects. Unexpected cross-origin attempts fail the request assertion, even when aborted. The exact first-party https://thermal-dawn-platform.vercel.app/api/public/stats endpoint (without query) is exempt, as approved in CTO item 19, but still aborted to avoid reaching a backend service.

YouTube privacy-domain iframe navigations are exempt from the assertion but still aborted before network access. The suite does not inspect the embedded player's internal requests. It checks computed focus cues (outline, shadow, changed SVG stroke), not visual contrast or complete WCAG conformance. Hidden controls are excluded; the desktop submenu has its own explicit check. Single-choice keyboard coverage is representative S5; this is not exhaustive keyboard coverage of every later screen.

## Local suite

A loopback-only static server serves public files from the checkout. It never loads backend handlers, env files or dependencies. All /api/ calls are fulfilled by Playwright with a fixed mock response, and all external requests are blocked. Fixtures use example.invalid and synthetic phone/name values. No email or Supabase code runs.

Twelve assertions cover fit, outside area, split-only, renter, booking, exploration and urgent paths through their terminal screens and mocked payload routes; unticked newsletter consent; announced invalid email/postcode and phone errors; phone error association/clearing; four labelled upload slots with a synthetic PDF payload; and S5 arrow/Enter/Space behavior. Successful paths assert exactly one captured request. These checks verify client behavior and payloads, not server routing, dedupe, file signatures or email delivery.

Use only an authorized target URL. The runner does not push, build or deploy, and does not change production source files.


## Site-wide design rollout

The local suite also renders default H2/H3/card probes on every canonical page and the 404 page at 1280px and 390px, checks the heading clamp/weight/leading/gap, card radius/padding/keyline and absence of retired body classes. Deliberate legal and component typography retains its specificity. For a deployed rollout use --design sitewide; the default URL mode still checks the current live trial contract. This lets the GET-only live suite remain meaningful before the owner ships the rollout. The probe checks CSS defaults, not the visual balance of every specialized component.
