# PA46-310P Power Settings

A lightweight, **offline** power-setting and cruise-speed calculator for the
Piper **PA46-310P Malibu** (Continental TSIO-520-BE), built as an installable
web app (PWA). No server, no login, no internet needed once loaded.

> **For reference only — not for flight. Always verify against the POH.**

## Use it
Open the hosted URL on a phone (iOS or Android), then **Add to Home Screen**. It
then runs fully offline, like a native app.

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
