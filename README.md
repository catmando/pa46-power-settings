# PA46-310P Power Settings

A lightweight, **offline** power-setting and cruise-speed calculator for the
Piper **PA46-310P Malibu** (Continental TSIO-520-BE), built as an installable
web app (PWA). No server, no login, no internet needed once loaded.

> **For reference only — not for flight. Always verify against the POH.**

## Use it → https://catmando.github.io/pa46-power-settings/

Open that link on your phone/tablet, then install it so it runs offline like a
native app:

- **iPhone / iPad (Safari):** Share button → **Add to Home Screen** → Add.
- **Android (Chrome):** ⋮ menu → **Install app** / **Add to Home Screen**.
- **iPad + EFB:** open it, then drag it into **Slide Over** to keep it beside
  ForeFlight/Garmin. In the ⚙ settings you can pin the panel to the left or right.

Once installed it works with **no internet** and updates automatically the next
time you open it online.

## How to use
*(This mirrors the in-app **Help** — tap the **?** in the header. Keep the two in
sync when either changes.)*

**Entering conditions**
- Set **Assigned altitude**, **Altimeter**, and **OAT** with the − / + buttons.
  Press and hold to change quickly.
- **Tap the Altimeter or OAT value to reset it to standard** — 29.92 in Hg for the
  altimeter, and ISA standard temperature for the current altitude. A value glows
  blue when it is at standard.
- As you change altitude, OAT follows the standard lapse rate (−2 °C per 1,000 ft)
  from wherever you set it.

**Flight levels (18,000 ft and up)**
- At or above 18,000 ft the **altimeter locks to 29.92** (standard), and pressure
  altitude equals your assigned altitude.

**Your airplane**
- Tap the **gear (⚙)** to add or switch aircraft.
- Each aircraft can carry an **airspeed adjustment** so the Expected airspeed
  matches your specific airframe (e.g. "runs 3 kt slow"). Enter it as a percentage,
  or as "−X kt at an altitude."

**Checking your airspeed**
- Tap the **Expected airspeed** to briefly see the estimated **indicated** airspeed
  (KIAS) — handy for checking your ASI.

> **Fuel flow:** these calculations are per the POH and should yield **50° lean of
> peak** if you have an accurate fuel-flow meter to set the fuel flow. Every few
> flights, use the standard lean-of-peak procedure to confirm your fuel meter is
> correct.

*For reference only — always verify against your POH.*

## Develop
Pure static files — no build step. Serve locally:

```
python3 -m http.server 8000    # http://localhost:8000
```

All aircraft numbers live in [`data.js`](data.js). The calculation engine is in
[`calc.js`](calc.js) and is DOM-free / Node-testable. See [CLAUDE.md](CLAUDE.md)
for the full model, rules, and project notes.
