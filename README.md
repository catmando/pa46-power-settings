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

Enter altimeter setting, indicated altitude, OAT, and pick a power setting
(75% / 65% / 55% / Holding). It shows pressure altitude, RPM, manifold pressure,
temperature-corrected fuel flow, and expected true airspeed.

Add your own aircraft (name + airframe airspeed bias) via the gear icon; mark one
as the default that opens on launch.

## Develop
Pure static files — no build step. Serve locally:

```
python3 -m http.server 8000    # http://localhost:8000
```

All aircraft numbers live in [`data.js`](data.js). The calculation engine is in
[`calc.js`](calc.js) and is DOM-free / Node-testable. See [CLAUDE.md](CLAUDE.md)
for the full model, rules, and project notes.
