# PA46-310P Power Settings — Specification

Single source of truth for what this app does and how it behaves. Update this
first, then change code to match. (Project notes / status live in `CLAUDE.md`.)

Status legend: **[DONE]** implemented · **[TODO]** agreed, not yet built ·
**[OPEN]** needs a decision.

---

## 1. Purpose & scope
Offline, installable web app (PWA) that computes engine power settings and
expected cruise speed for the **Piper PA46-310P Malibu** (Continental
TSIO-520-BE). Distributed by link to a small aircraft-owner-association group.
No server, no login, no internet after first load. Reference tool only — not for
flight.

Architecture is **data-driven per aircraft type** so more types can be added
later, but only the PA46-310P exists today.

---

## 2. Target devices & layout  (Note 4, revised)  [DONE]
- **Single column on ALL devices.** The whole UI is sized in **rem**, and the
  root font-size **scales with viewport height** (`font-size: clamp(14px,
  2.05dvh, 23px)`). So the phone-portrait layout simply **scales up to fill an
  iPad** (portrait or landscape) and down to fit shorter screens — same layout,
  proportionally sized. Column width = `min(94vw, 34rem)`, centered.
- **Reference device = medium phone (393×852).** Verified via CDP device
  emulation: at the installed usable height (393×800) the content is ~619px with
  ~116px headroom; also fits iPad portrait/landscape. To keep it compact & clean:
  Altimeter + OAT share one row (`.field-row`); power-button sub-text is one line
  (RPM range without the word "RPM"); the pressure-altitude line collapses (not
  just blanks) in the flight levels.
- **Phone landscape (`orientation:landscape & max-height:560px`):** compact
  **two-column** grid — left = inputs (altitude/altimeter/OAT + info), right =
  **Desired performance + results**. The performance buttons are relocated from
  the inputs card into the results column here via a `matchMedia` listener in
  app.js (`placePerf`), so portrait DOM/appearance is untouched. Fits with
  headroom (verified 844×390: ~67px).
- Body is `100dvh`, `overflow:hidden`; only `.app-main` scrolls when it must.
- Viewport-based throughout; no device sniffing.
- **Tablet PORTRAIT (`min-width:680px & orientation:portrait`):** render as a
  **phone-width panel** — phone-sized font (fixed 18px, NOT height-scaled) and
  `width: min(430px, 50vw)` (≈ half the screen or less), anchored to one side
  with a divider; the rest is empty so it coexists with an EFB. Side is a saved
  user preference (`pa46.panelSide`, default **right**; toggle in the gear dialog
  → `body.panel-left`). Verified iPad mini 768×1024: body 384px, font 18px.
- **Tablet landscape:** unchanged for now (fills a centered column) — TODO next.

---

## 2b. Input controls & visual grouping  (Notes 12–18)  [DONE]
- **No keyboard, ever.** All three value fields are `readonly` (so a tap never
  raises the keyboard); adjustment is entirely via the on-screen ± steppers.
  Assigned altitude has full-width − / + ; Altimeter and OAT have compact − / + .
- **Tap the value = set standard.** The altimeter / OAT value display doubles as
  its own reset button: tap → altimeter 29.92, OAT → ISA for the current pressure
  altitude. (Replaced the earlier separate STD buttons.) In the flight levels the
  altimeter + its steppers are locked. Readonly fields never show a focus ring;
  instead a value gets a **subtle highlight when it is at standard** (so you can
  see at a glance which are standard and which have been adjusted).
- Fuel-flow readout is labelled **"Adj. fuel flow"** (temperature-corrected).
- **Press-and-hold auto-repeat** on all ± buttons: tap = one step, hold = repeat
  after ~400 ms (Note 15).
- **Order:** assigned altitude at the very top (Note 13); then the Altimeter/OAT
  row; then the info line; then desired performance.
- **Pressure altitude** is a small muted info line **below** the Altimeter/OAT
  row, combined with ISA temp, e.g. "Pressure altitude 9,620 ft · ISA −4°C"
  (Notes 13/18). In the flight levels it reads "Flight levels · ISA …".
- **Expected airspeed** sits in the 2×2 results grid at normal size (Note 17).
- **Subtle color coding** (Note 18): input labels + power = soft blue; info line =
  muted; pilot-set values (RPM / manifold / fuel flow) = teal; expected airspeed =
  **violet** (`--speed #b9a3ff`; gold was too warning-like). Guides the eye through
  the flow: altitude → baro/temp → performance → RPM/MP/FF → airspeed.
- **Tap expected airspeed → indicated (est.)** for ~3.5 s: shows IAS = TAS ×
  √(density ratio) as "Indicated (est.) · NNN KIAS" (blue), for airspeed-indicator
  calibration checks; any input change reverts to TAS. `PA46_CALC.tasToIas()`.
- The above-ceiling warning is a short one line ("Pressure altitude is above the
  published ceiling (25,000 ft).") so it never pushes content off-screen.
- **Holding** shows "Not Published" (violet) for airspeed — no cruise-speed curve.
- Disclaimer ("For reference only. Verify against the POH.") is a footer **pinned
  to the bottom** of the viewport, outside the scrollable main area.
- **Layout note:** root font-size now `clamp(14px, 2.2dvh, 24px)` so the single
  column fills the height; verified ~92px headroom on the 393×800 medium phone.

## 3. Inputs  (four)
| Input | Units | Notes |
|---|---|---|
| Altimeter setting | in Hg | Persists across sessions. **Auto-locked to 29.92** and disabled at/above 18,000 ft (the flight levels). |
| Assigned altitude | ft | Renamed from "Indicated" (Note, revised). Stepper: **+/- 500 below 18,000 ft, +/- 1,000 at/above** (Note 1). **Default 18,000 on first startup** (Note 2). |
| OAT | °C | Used only for the fuel-flow temperature correction. **Auto-tracks altitude** (Note 11): when indicated altitude changes, OAT shifts −2 °C/1,000 ft from its current value (preserving the pilot's ISA deviation). A manual OAT edit sets a new baseline. Tracks on stepper clicks and committed (blur/Enter) altitude edits, not per keystroke. |
| Desired performance | — | One of: High Speed 75% · Economy 65% · Long Range 55% · Holding. |

---

## 4. Outputs  (book values, no override)
| Output | Notes |
|---|---|
| Pressure altitude | `assigned + (29.92 − altimeter) × 1000`. Shown as a **small hint line under the assigned-altitude field** (ISA-hint font), NOT a big result. **Hidden at/above 18,000 ft** (flight levels), where PA == assigned. **[DONE]** |
| RPM | Discrete book value, auto-selected by altitude band. **Not interpolated.** **[DONE]** |
| Manifold pressure | in Hg, paired with the selected RPM. **Not interpolated.** **[DONE]** |
| Fuel flow | GPH. Book base ± temperature correction. **[DONE]** |
| Expected airspeed | KTAS. Interpolated from the chart, then adjusted by the per-aircraft bias %. Not shown for Holding. **[DONE]** |

The fuel-flow **explanatory note line is removed** (Note 3). **[DONE]**

---

## 5. Calculation model  (locked)
All constants/tables in `data.js`; pure functions in `calc.js`.

- **ISA standard temp** = 15 °C − 2 °C per 1,000 ft of pressure altitude.
- **Fuel-flow correction**: +1 GPH per 20 °C **below** ISA, −1 GPH per 20 °C
  **above** ISA. `FF = base + (ISA_temp − OAT) / 20`.
- **RPM/MAP band selection** (higher RPM at altitude):
  | Power | below 15k | 15k–20k | at/above 20k |
  |---|---|---|---|
  | 75% High Speed | 2400 / 31.0" | 2400 / 31.0" | 2500 / 29.5" |
  | 65% Economy | 2300 / 28.0" | 2400 / 26.5" | 2500 / 25.0" |
  | 55% Long Range | 2200 / 25.0" | 2300 / 24.0" | 2400 / 23.0" |
  | Holding | 2200 / 21.0" | 2200 / 21.0" | 2200 / 21.0" |
  (75% has only a 20k split; Holding is single-value. Boundaries: <15k, then
  <20k, then ≥20k.)
- **Base fuel flow**: 75% = 16 · 65% = 14 · 55% = 12 · Holding = 10 GPH.
- **TAS**: table at every 2,000 ft (SL → 25,000) at standard temp & the chart's
  3,740 lb reference weight. **Linear interpolation** between anchor altitudes;
  **clamped** below SL and above 25,000. Weight is fixed at 3,740 lb (no weight
  input by design); per-airframe differences are handled by the bias (§7).
- **Holding**: no TAS curve → airspeed shown as "—". Warning displayed if used
  above 20,000 ft ("not intended for high altitude").
- **Above 18,000 ft**: altimeter field locks to 29.92.

### TAS table (knots, std temp, 3,740 lb) — digitized, SL→24,000
Concave curves (not linear). Clamps to the 24,000 value at the 25,000 ceiling.

| Alt(ft) | 55% | 65% | 75% | | Alt(ft) | 55% | 65% | 75% |
|--:|--:|--:|--:|--|--:|--:|--:|--:|
| 0 | 134 | 148 | 161 | | 14000 | 169 | 181 | 193 |
| 2000 | 139 | 152 | 166 | | 16000 | 174 | 186 | 197 |
| 4000 | 144 | 157 | 171 | | 18000 | 179 | 190 | 201 |
| 6000 | 149 | 162 | 175 | | 20000 | 184 | 194 | 206 |
| 8000 | 154 | 167 | 179 | | 22000 | 188 | 198 | 209 |
| 10000 | 159 | 172 | 184 | | 24000 | 193 | 202 | 213 |
| 12000 | 164 | 177 | 188 | | | | | |

---

## 6. Aircraft management  [DONE]
- Multiple saved aircraft; one marked **default** (opens on launch).
- Switch active aircraft via the **header dropdown**.
- **Settings/manage screen** contents:
  - **Aircraft type** dropdown (Note 7): only "PA46-310P" today, but selectable
    for future types. Each aircraft record carries its type. **[TODO]**
  - Name / tail number.
  - **Airframe airspeed bias** (see §7). **[TODO: change from kt to %]**
  - Mark as default.
- **Add vs. edit must be unambiguous** (Note 8): a clear **"+ Add aircraft"**
  action; the editor appears only in an explicit add/edit context; **remove the
  separate "New" button.** **[TODO]**

---

## 7. Airframe airspeed bias  (Note 9)  [DONE]
- Stored and applied as a **percentage** of book TAS, **uniformly at all
  altitudes**: `displayedTAS = chartTAS × (1 + bias% / 100)`.
- Entry accepted **two ways**, both resolving to the stored %:
  1. **Direct percentage** (e.g. −3%).
  2. **Knots at a reference altitude** (e.g. "−10 kt at 18,000 ft"): app computes
     `bias% = (enteredKt / chartTAS_at(refAlt, 75%)) × 100`, then applies that %
     uniformly at all altitudes.
     - **[RESOLVED]** Conversion always uses the **75% High-Speed Cruise** curve
       — that is where most owners measure their airframe's speed. Only kt + a
       reference altitude are entered; no power picker needed.

---

## 8. Persistence  [DONE, evolving]
Browser `localStorage`:
- `pa46.aircraft` — array of `{ id, type, name, biasPct, isDefault }`
  (currently `airframeBiasKt`; migrate to `type` + `biasPct`).
- `pa46.activeId` — active aircraft id.
- `pa46.inputs` — last `{ baro, indAlt, oat, powerKey }`.

---

## 9. Header  (Note 5)  [DONE]
Combine the current two header rows (aircraft picker + title) into a **single
line**: aircraft dropdown + settings gear together, no separate title row (or a
compact inline title).

---

## 10. PWA / offline / native feel  (Note 6)  [DONE]
- `display: standalone`, iOS `apple-mobile-web-app-capable`, theme color,
  installable manifest, service-worker cache-first for full offline use.
- Installed app shows **no browser chrome** — only the OS status bar. Behave as
  much like a native app as possible.
- Bump `sw.js` `CACHE_VERSION` on every asset change so installed copies update.

---

## 11. Testing  (Note 10)  [DONE — TAS truth values pending POH]
- Zero-dependency Node suite in `tests.js` (`npm test` or `node tests.js`).
  42 checks, all passing.
- **Engine unit tests:** pressure altitude incl. forced 29.92 above 18k; RPM
  band boundaries (14,999 / 15,000 / 19,999 / 20,000 ft); fuel-flow correction
  sign & magnitude; Holding warning + no-TAS; interpolation midpoints; clamping
  at SL and 25,000; airframe-bias % (incl. kt→% conversion).
- **TAS truth table** (`TAS_TRUTH` in tests.js): a few `(power, altitude)` points
  asserted within **±2 kt**. Currently mirrors the digitized table (so it passes);
  **replace the expected values with readings taken off the POH chart** to turn it
  into a real cross-check.

---

## 12. Deployment  [TODO]
GitHub Pages (HTTPS) → share `https://<user>.github.io/<repo>/` in the forum.
Members open once online, Add to Home Screen, then fully offline. Install +
service worker require HTTPS (localhost exempt; LAN IP is not).

---

## 13. Open items summary
- **[DONE, worth a final eyeball]** TAS table digitized (concave curves), SL→24k
  in `data.js`; guarded by `TAS_TRUTH` in `tests.js`.
- **[TODO]** All Note 1–10 UI/behavior changes above.
- **[TODO]** Exercise on real iPad mini + phone; publish to GitHub Pages.
