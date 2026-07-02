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

## 2. Target devices & layout  (Note 4)  [TODO]
- **Must fit on screen with no scrolling** to see all inputs + results, in the
  **installed** (standalone) viewport.
- Layout decisions are **viewport-based** (size + orientation via CSS media
  queries / `matchMedia`), not device sniffing.
- **iPad mini (primary target), landscape:** app occupies roughly the **left
  half** of the screen width and the **full height**. (Two-column feel: inputs
  and results side by side, sized to the left half.)
- **Phone:** **fill the screen**; adapt to **portrait or landscape**. Portrait =
  stacked; landscape = inputs/results side by side. Never require scrolling.
- Breakpoints/orientation drive the choice; no hard-coded device models.

---

## 3. Inputs  (four)
| Input | Units | Notes |
|---|---|---|
| Altimeter setting | in Hg | Persists across sessions. **Auto-locked to 29.92** and disabled when indicated altitude > 18,000 ft. |
| Indicated altitude | ft | Stepper: **+/- 500 below 18,000 ft, +/- 1,000 at/above 18,000 ft** (Note 1). **Default 18,000 on first startup** (Note 2). |
| OAT | °C | Used only for the fuel-flow temperature correction. |
| Desired performance | — | One of: High Speed 75% · Economy 65% · Long Range 55% · Holding. |

---

## 4. Outputs  (book values, no override)
| Output | Notes |
|---|---|
| Pressure altitude | `indicated + (29.92 − altimeter) × 1000`. Above 18,000 ft altimeter is 29.92, so PA == indicated. **[DONE]** |
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

### TAS table (knots — PENDING POH VERIFICATION)
Best-estimate digitization of "Cruise Speed vs. Altitude" (std temp, 3,740 lb):

| Alt(ft) | 55% | 65% | 75% | | Alt(ft) | 55% | 65% | 75% |
|--:|--:|--:|--:|--|--:|--:|--:|--:|
| 0 | 133 | 148 | 163 | | 14000 | 156 | 171 | 186 |
| 2000 | 137 | 152 | 167 | | 16000 | 158 | 173 | 189 |
| 4000 | 140 | 155 | 170 | | 18000 | 161 | 176 | 192 |
| 6000 | 144 | 159 | 174 | | 20000 | 163 | 178 | 195 |
| 8000 | 147 | 162 | 177 | | 22000 | 164 | 180 | 197 |
| 10000 | 150 | 165 | 180 | | 24000 | 165 | 181 | 199 |
| 12000 | 153 | 168 | 183 | | 25000 | 166 | 182 | 200 |

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

## 11. Testing  (Note 10)  [TODO]
- **TAS validation test:** pick a few `(power, altitude)` points, take the true
  value read from the POH graph, and assert the app's interpolated output is
  within tolerance (proposed **±2 kt**, tune as needed). Covers digitized curves
  + interpolation.
- **Engine unit tests** (already exercised informally; formalize): pressure
  altitude incl. forced 29.92 above 18k; RPM band boundaries (14,999 / 15,000 /
  19,999 / 20,000 ft); fuel-flow correction sign & magnitude; Holding warning +
  no-TAS; interpolation midpoints; clamping at SL and 25,000.
- Runnable in Node against `data.js` + `calc.js` (DOM-free engine).

---

## 12. Deployment  [TODO]
GitHub Pages (HTTPS) → share `https://<user>.github.io/<repo>/` in the forum.
Members open once online, Add to Home Screen, then fully offline. Install +
service worker require HTTPS (localhost exempt; LAN IP is not).

---

## 13. Open items summary
- **[TODO]** Verify TAS table against POH; correct in `data.js`.
- **[TODO]** All Note 1–10 UI/behavior changes above.
- **[TODO]** Exercise on real iPad mini + phone; publish to GitHub Pages.
