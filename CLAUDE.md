# PA46-310P Power Settings — project notes

Offline, installable web app (PWA) that calculates engine power settings and
expected cruise speed for the **Piper PA46-310P Malibu** (Continental
TSIO-520-BE). Built to be shared with a small group of aircraft-owner-association
members via a link — no app store, no login, no server, no internet required
once loaded.

## Status (current)
- **Fully functional and heavily UI-polished.** Service worker at `pa46-v14`.
  53 unit tests pass (`npm test`). Working tree committed.
- **`SPEC.md` is the living source of truth** — read it first. It documents the
  locked calc model AND every UI decision (Notes 1–18 + follow-ups), all marked
  [DONE]/[TODO]. This file is the shorter cross-machine handoff.
- The UI has been iterated extensively with the user (see "UI state" below).
- **Two things still open, both need the owner (Mitch):**
  1. **Verified TAS numbers** off the POH chart — the `TAS_TABLE` in `data.js`
     is still best-estimate digitization. Also seed the `TAS_TRUTH` table in
     `tests.js` with real graph readings once available.
  2. **Deployment** to GitHub Pages (HTTPS) so it installs + runs offline; then
     share the link in the owners' forum. Repo has no remote yet.
- User's last note: "almost perfect for portrait on a phone."

## UI state (what the app looks like now)
Single-column layout, sized in `rem` with root font `clamp(14px,2.2dvh,24px)` so
it scales to fill the height on any device (verified fits: 393×800 medium phone,
iPad portrait/landscape). Input flow top→bottom, color-coded to guide the eye:
- **Assigned altitude** (top), full-width − / value / + stepper.
- **Altimeter** and **OAT**, each their own full-width stepper. Values are
  `readonly` (NO keyboard ever); tapping a value resets it to standard (altimeter
  29.92 / OAT = ISA), and a value shows a subtle blue highlight when it's at
  standard. In the flight levels (≥18,000 ft) the altimeter's ± buttons lock.
  Press-and-hold on any ± auto-repeats.
- **Info line** (muted): "Pressure altitude N ft · ISA X°C" (in FL: "Flight
  levels · ISA X°C").
- **Desired performance** 2×2 buttons.
- **Results** 2×2: RPM · Manifold pressure · Adj. fuel flow (all teal) ·
  Expected airspeed (violet `--speed`). Tap airspeed → shows estimated INDICATED
  airspeed (KIAS) for ~3.5 s for calibration checks. Holding shows "Not Published".
- **Footer** pinned to bottom: "For reference only. Verify against the POH."
- OAT auto-tracks altitude at the ISA lapse rate (−2°C/1000 ft) as you step.

## What it does
Inputs (four):
- **Assigned altitude** (ft) — renamed from "Indicated"; drives everything.
- **Altimeter setting** (in Hg) — auto-locked to 29.92 at/above 18,000 ft.
- **OAT** (°C)
- **Desired performance**: High Speed 75% · Economy 65% · Long Range 55% · Holding

Outputs (all book values, no override):
- **Pressure altitude** = `assigned + (29.92 − altimeter) × 1000` — shown as a
  small info line under the inputs; hidden at/above 18,000 ft (PA == assigned).
- **RPM** and **Manifold pressure** — discrete book values, auto-selected by
  altitude band (see rules below). These step at band boundaries; NOT interpolated.
- **Fuel flow** ("Adj. fuel flow") — book base ± temperature correction.
- **Expected airspeed** (KTAS) — interpolated from the chart, plus a per-aircraft
  airframe bias (%). "Not Published" for Holding.

## Model / rules (all encoded in `data.js` + `calc.js`)
- **ISA standard temp** = 15 °C − 2 °C per 1,000 ft of pressure altitude.
- **Fuel flow correction**: +1 GPH per 20 °C *below* ISA, −1 GPH per 20 °C *above*.
- **RPM band selection** (higher RPM at altitude):
  - 75%: 2400/31" below 20k · 2500/29.5" at/above 20k
  - 65%: 2300/28" below 15k · 2400/26.5" 15–20k · 2500/25" at/above 20k
  - 55%: 2200/25" below 15k · 2300/24" 15–20k · 2400/23" at/above 20k
  - Holding: 2200/21" (warning shown above 20k — "not intended for high altitude")
- **TAS**: table at every 2,000 ft (SL→25,000) at std temp & 3,740 lb reference
  weight. **Linear interpolation** between anchor altitudes; clamped at the ends.
  Weight is fixed at the 3,740 lb reference (no weight input by design); per-plane
  differences are captured by the saved **airframe airspeed bias**.
- **Above 18,000 ft** the altimeter field locks to 29.92 (so PA == indicated).

## Per-aircraft data (saved in browser localStorage)
Multiple aircraft, each with: name/tail, airframe airspeed bias (kt), and one
marked **default** (opens on launch). Switch via the header dropdown; manage via
the gear button. Keys: `pa46.aircraft`, `pa46.activeId`, `pa46.inputs`.

## Files
- `index.html` — markup
- `styles.css` — styling (dark, large touch targets, cockpit-readable)
- `data.js` — **all PA46 numbers live here** (power table + TAS table). Edit this
  to correct data. Bump `sw.js` CACHE_VERSION after any change.
- `calc.js` — pure calculation engine (no DOM). Node-testable.
- `app.js` — UI wiring, persistence, aircraft management, service-worker registration
- `manifest.json` + `sw.js` + `icons/` — PWA install + offline caching

## The TAS table (data.js → TAS_TABLE)
Digitized "Cruise Speed vs. Altitude" (std temp, 3,740 lb), knots, SL→24,000.
Curves are concave (NOT linear); clamps to the 24,000 value at the 25,000 ceiling.
Guarded by `TAS_TRUTH` in `tests.js`. Worth a final eyeball vs. the chart someday.

| Alt(ft) | 55% | 65% | 75% |   | Alt(ft) | 55% | 65% | 75% |
|--------:|----:|----:|----:|---|--------:|----:|----:|----:|
| 0       | 134 | 148 | 161 |   | 14000   | 169 | 181 | 193 |
| 2000    | 139 | 152 | 166 |   | 16000   | 174 | 186 | 197 |
| 4000    | 144 | 157 | 171 |   | 18000   | 179 | 190 | 201 |
| 6000    | 149 | 162 | 175 |   | 20000   | 184 | 194 | 206 |
| 8000    | 154 | 167 | 179 |   | 22000   | 188 | 198 | 209 |
| 10000   | 159 | 172 | 184 |   | 24000   | 193 | 202 | 213 |
| 12000   | 164 | 177 | 188 |   |         |     |     |     |

## Running / previewing
Static file server (a VSCode/machine restart kills the background server — just
start it again). From the repo root:

```
python3 -m http.server 8000       # or: npm run serve   → http://localhost:8000
```

Phone on same Wi-Fi: `http://<LAN-IP>:8000` (get IP: `ipconfig getifaddr en0`).
Real install (Add to Home Screen / offline) needs HTTPS → deploy to GitHub Pages.
After changing any cached asset, bump `sw.js` CACHE_VERSION and reopen the app.

### Verifying the UI on exact mobile sizes (headless, no phone)
Headless Chrome (installed as "Google Chrome Beta"; binary:
`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome Beta`) **clamps
window width to ≥500px and ignores mobile viewport meta**, so it can't render a
true 393px phone via `--window-size`. Use the **CDP device-emulation harness**
(Node v24 has a global `WebSocket`) to emulate exact dimensions, measure fit, and
screenshot. Working scripts from this session are in the scratchpad (may not
persist across restart) — the pattern: launch Chrome with
`--remote-debugging-port`, connect via `ws`, send `Emulation.setDeviceMetricsOverride`
`{width,height,deviceScaleFactor:2,mobile:true}`, navigate, then `Runtime.evaluate`
+ `Page.captureScreenshot`. Set `Network.setCacheDisabled` and a fresh
`--user-data-dir` per run, or the service worker serves stale assets. Reference
medium phone: **393×852** (installed usable height ≈ 800).

## Verifying the engine (no browser needed)
`calc.js` is DOM-free. Run the test suite:

```
npm test        # or: node tests.js
```

`tests.js` (zero deps) covers PA computation incl. forced 29.92 above 18k, RPM
band boundaries, fuel-flow correction, Holding warning/no-TAS, TAS interpolation
+ clamping, and airframe-bias %. It also has a `TAS_TRUTH` table (±2 kt) — replace
its expected values with real POH-chart readings to make it a true cross-check.
Aircraft bias is now a uniform **percentage** (`biasPct`); solve() takes
`{ biasPct }`.

## Deployment (planned)
GitHub Pages: push repo → enable Pages on the default branch root → share the
`https://<user>.github.io/<repo>/` URL in the forum. Members open once online,
"Add to Home Screen", then it works fully offline. Updates propagate when they're
next online (service worker re-caches on CACHE_VERSION bump).

## TODO / open items
- [x] TAS_TABLE digitized (concave curves, SL→24k) + `TAS_TRUTH` test in place.
      Optional: a final eyeball of the numbers against the actual chart.
- [x] **Published** — repo https://github.com/catmando/pa46-power-settings ,
      live at **https://catmando.github.io/pa46-power-settings/** (Pages from
      `master` root, `.nojekyll`). Verified all assets serve 200 + app runs from
      prod. Note: the very first Pages deploy failed twice with a transient
      "Deployment failed, try again later" — a retry (`gh api -X POST .../pages/builds`)
      fixed it. To ship updates: commit, bump `sw.js` CACHE_VERSION, push to master.
- [ ] Exercise the UI on Mitch's real iPhone/iPad in the installed PWA.
- [ ] (Optional) support hPa/mb altimeter entry in addition to in Hg.
- [x] **Multi-variant ready.** Performance data is keyed by aircraft type in
      `data.js` → `AIRCRAFT_DATA` (powerSettings + tas + referenceWeightLb +
      ceilingFt per type). Adding a variant = copy the PA46-310P block, rename,
      fill in that variant's POH numbers (there's a commented TEMPLATE). The
      calc, power buttons, and type dropdown all become type-driven automatically.
      Proven by a multi-type test in `tests.js` (§10). Still need the actual POH
      pages for any new variant — do NOT invent performance numbers.

## Not in this repo (machine-local, survives restart on this Mac)
The witty text-to-speech hooks are personal, in `~/.claude/` (not committed):
`speak_waiting.sh` (needs-input voice), `speak_done.sh` (Stop hook: speaks when a
turn takes >20s), `speak_reset_timer.sh` (UserPromptSubmit timer), and
`~/.claude/stop-messages.yml` (voice: Fred + 30 completion lines). Registered in
`~/.claude/settings.json` hooks.
