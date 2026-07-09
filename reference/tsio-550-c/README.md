# TSIO-550-C conversion — reference documents (for future analysis)

Source data for the **Continental TSIO-550-C** engine *conversion* of the PA46
Malibu (derated to 310 HP). Archived here for a future "add this as an aircraft
type" effort — **not yet implemented** in the app. Compiled by an MMOPA member
from VK / TCM / their own engine data.

> These are **reference only** and (per the source) **not** a POH substitute.

## Files
| File | What it is |
|---|---|
| `power-chart-rop-lop.pdf` | Sea-level constant-speed power curve + the **power-setting table** (%, HP, MP, RPM, Hi/Lo fuel flow). The clean table is transcribed below. |
| `cruise-speed-vs-altitude.pdf` | **Cruise Speed vs. Altitude** chart — TAS curves for 45/55/65/75% + MCP (same format as the 310P chart). |
| `tcm-power-chart.pdf` | TCM chart showing the ROP-vs-LOP HP difference. |
| `550-engine-2008.xls` | The author's Excel workbook the PDFs were generated from (raw numbers; editable per engine). |
| `mmopa-550-power-chart.docx` | The MMOPA forum write-up (context, caveats, how to adapt fuel flows). |
| `chart.doc` | Additional detail chart referenced in the write-up. |

## Extracted power table (from `power-chart-rop-lop.pdf`)
TSIO-550-C, 350 HP derated to 310 HP. Fuel flow is **Hi = ROP / Lo = LOP** (GPH),
for the author's engine — see caveats.

| %PWR | HP | MP (inHg) | RPM | F/F Hi(ROP) | F/F Lo(LOP) |
|--:|--:|--:|--:|--:|--:|
| 88 | 310 | 35.5 | 2600 | 40 | 38 |
| 80 | 280 | 33.5 | 2500 | 33 | 28 |
| 75 | 262 | 32.3 | 2450 | 25 | 21 |
| 70 | 245 | 31.0 | 2400 | 23 | 19 |
| 65 | 227 | 29.8 | 2350 | 21 | 17 |
| 60 | 210 | 28.5 | 2300 | 18 | 15 |
| 55 | 193 | 27.5 | 2200 | 15 | 12 |
| 50 | 175 | 26.2 | 2150 | 13 | 12 |
| 45 | 157 | 25.0 | 2100 | 12 | 11 |

## Cruise-speed chart (`cruise-speed-vs-altitude.pdf`)
TAS vs pressure altitude (std temp), curves for: **Long Range 45%, Long Range
55%, Economy 65%, High Speed 75%, MCP**. NOT yet digitized (would need the same
gridline-reading pass we did for the 310P).

## Key notes / caveats (from the MMOPA write-up)
- The power-setting table **assumes ROP**. Leaning to **LOP** keeps the same
  RPM/MP but makes less HP, so the airplane is **~7–10 kt slower** than the speed
  chart for a given setting.
- Rule of thumb from the author: **520 ROP ≈ 550 LOP** (the old 520 speed chart
  approximates 550 LOP performance).
- **Fuel flows are engine-specific** — the values above are the author's plane
  (set to max 380 °F CHT / 1650 °F TIT). Every owner must measure and adjust
  their own; treat these as *targets*, and note they drift with OAT/season/altitude.
- So, unlike the 310P (which uses a simple ±1 GPH per 20 °C ISA correction), the
  550 fuel flows are **not** a clean temp-corrected formula.

## If/when we implement this as an aircraft type
Decisions to settle first (raised but deferred):
1. **ROP vs LOP** — likely a Rich/Lean toggle (shows Hi or Lo fuel flow; LOP
   speed ≈ chart − ~8 kt). The app is currently single-fuel-flow.
2. **Which power buttons** — the 4 with speed curves (75/65/55/45) map cleanly to
   the current UI; the other 5 rows have no cruise-speed curve.
3. **Fuel flow = engine-specific target** — surface a clear disclaimer; likely no
   temp correction; maybe a future per-aircraft fuel-flow adjustment.
4. Add as a new **aircraft type** (e.g. "PA46 TSIO-550-C") in `data.js`
   `AIRCRAFT_DATA` — the engine is already type-driven, so 310P owners are
   unaffected. (Turbo/turbine caveats don't apply — this is still MP/RPM piston.)

Original download: `tsio550cpowercharts.zip` (2026-07-09).
