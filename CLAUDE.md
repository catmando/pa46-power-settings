# PA46-310P Power Settings — project notes

Offline, installable web app (PWA) that calculates engine power settings and
expected cruise speed for the **Piper PA46-310P Malibu** (Continental
TSIO-520-BE). Built to be shared with a small group of aircraft-owner-association
members via a link — no app store, no login, no server, no internet required
once loaded.

## Status
- **Working first version complete.** Calculation engine verified with a Node
  harness (see "Verifying" below). UI not yet exercised in a real mobile browser.
- **TAS numbers are best-estimate digitizations** of the POH cruise-speed chart
  and are the main thing still worth verifying against the book (see below).

## What it does
Inputs (only four):
- **Altimeter setting** (in Hg) — persists; auto-locked to 29.92 when indicated
  altitude is above 18,000 ft (flight levels).
- **Indicated altitude** (ft)
- **OAT** (°C)
- **Desired performance**: High Speed 75% · Economy 65% · Long Range 55% · Holding

Outputs (all book values, no override):
- **Pressure altitude** = `indicated + (29.92 − altimeter) × 1000`
- **RPM** and **Manifold pressure** — discrete book values, auto-selected by
  altitude band (see rules below). These step at band boundaries; they are NOT
  interpolated.
- **Fuel flow** — book base ± temperature correction (see below).
- **Expected airspeed** (KTAS) — interpolated from the chart, plus a per-aircraft
  airframe bias. Not shown for Holding (no chart curve).

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

## The TAS table — VERIFY THESE (data.js → TAS_TABLE)
Best-estimate reads of "Cruise Speed vs. Altitude" (std temp, 3,740 lb), knots:

| Alt(ft) | 55% | 65% | 75% |   | Alt(ft) | 55% | 65% | 75% |
|--------:|----:|----:|----:|---|--------:|----:|----:|----:|
| 0       | 133 | 148 | 163 |   | 14000   | 156 | 171 | 186 |
| 2000    | 137 | 152 | 167 |   | 16000   | 158 | 173 | 189 |
| 4000    | 140 | 155 | 170 |   | 18000   | 161 | 176 | 192 |
| 6000    | 144 | 159 | 174 |   | 20000   | 163 | 178 | 195 |
| 8000    | 147 | 162 | 177 |   | 22000   | 164 | 180 | 197 |
| 10000   | 150 | 165 | 180 |   | 24000   | 165 | 181 | 199 |
| 12000   | 153 | 168 | 183 |   | 25000   | 166 | 182 | 200 |

## Running / previewing
Any static file server over HTTPS (PWA install + service worker need a secure
context; `localhost` counts as secure). From the repo root:

```
python3 -m http.server 8000       # then open http://localhost:8000
```

To test on a phone on the same network, serve over the LAN IP; for real install
(Add to Home Screen) you need HTTPS — deploy to GitHub Pages (below).

## Verifying the engine (no browser needed)
`calc.js` is DOM-free. Load `data.js` + `calc.js` in Node and call
`PA46_CALC.solve({indicatedAltFt, altimeterInHg, oatC, powerKey}, {airframeBiasKt})`.
A sanity harness was used during development covering PA computation, the forced
29.92 above 18k, RPM banding, fuel-flow correction, Holding warning, and interp.

## Deployment (planned)
GitHub Pages: push repo → enable Pages on the default branch root → share the
`https://<user>.github.io/<repo>/` URL in the forum. Members open once online,
"Add to Home Screen", then it works fully offline. Updates propagate when they're
next online (service worker re-caches on CACHE_VERSION bump).

## TODO / open items
- [ ] Verify TAS_TABLE against the POH chart; correct in `data.js`.
- [ ] Exercise the UI on a real iOS + Android device.
- [ ] Decide on hosting (GitHub Pages assumed) and publish.
- [ ] (Optional) support hPa/mb altimeter entry in addition to in Hg.
- [ ] (Optional) add other PA46 variants later (data-driven; would need their tables).
