# Space Invaders

A fan recreation of the classic 1978 arcade game **Space Invaders**, built as a static HTML5 canvas game (vanilla JavaScript, no framework, no backend, no CDN assets).

**Play it live:** [https://mozzer20.github.io/spaceinvaders/](https://mozzer20.github.io/spaceinvaders/)

Works on **iPhone / Android** (on-screen arcade buttons) and desktop (keyboard). High scores are stored **on this device** only — GitHub Pages is static, so there is no internet leaderboard.

This is an unofficial tribute. Space Invaders is a trademark of Taito / the current rights holders. This project is not affiliated with them.

## How to run

1. **Live site:** [https://mozzer20.github.io/spaceinvaders/](https://mozzer20.github.io/spaceinvaders/)
2. **Phone:** open that URL in Safari or Chrome. Add to Home Screen for a full-screen PWA-lite. Tap **START**, then use **◀ ▶** and **FIRE**.
3. **Simplest local:** double-click `index.html`, or drag it into a browser tab.
4. **Local static server** (recommended if a browser blocks `file://` audio):

```bash
# Python 3
python3 -m http.server 8000

# or Node
npx --yes serve .
```

Then visit [http://localhost:8000](http://localhost:8000).

## How to play on a phone

- Rotate either way: **portrait** puts the pad under the screen; **landscape** tucks controls to the side.
- The playfield scales to the phone width and keeps the classic 672×768 aspect (letterboxed if needed).
- **◀ / ▶** hold to move, **FIRE** to shoot (one shot on screen, classic rules), **START** to begin / restart, **PAUSE** to freeze.
- First tap unmutes audio (mobile autoplay policy).
- Safe-area insets keep buttons above the home indicator / away from the notch.
- Pinch-zoom and page-scroll are blocked on the game so swipes stay on the cannon.

## Controls

| Input | Action |
| --- | --- |
| **◀ ▶** on-screen, **Left / Right** or **A / D** | Move the cannon |
| **FIRE**, **Space** | Fire (only one player shot on screen) |
| **START**, **Enter** / **Space** on title | Start / restart after game over |
| **PAUSE**, **P** or **Esc** | Pause / resume |
| **CRT** | Toggle scanlines (turn off if it hurts performance) |

## High scores (this device)

- Arcade table of the **top 10** runs, shown on the title screen.
- Beat the 10th score (or fill an empty slot) after game over → enter **3-letter initials** (tap ▲▼, type A–Z, then **PUT ON TABLE**).
- Scores persist in `localStorage` on that phone/browser. Clearing site data wipes them.
- **Last run** is kept and a new table row is highlighted.
- There is **no** global / internet leaderboard.

## How to play

- You have **3 lives**. Destroy the formation of aliens before they reach the ground.
- Aliens **march sideways**, drop a row at the edge, and **speed up** as their numbers fall.
- Hide behind **destructible bunkers** — shots from both sides chew them apart.
- A **mystery UFO** sometimes flies across the top for bonus points.
- Clear a wave to start the next, slightly faster and a little lower.
- Extra life at **1500** points.

## Files

```
index.html              page shell, PWA meta, on-screen pad, initials overlay
css/style.css           cabinet layout, safe areas, touch targets
js/sprites.js           pixel-art grids
js/audio.js             Web Audio beeps (unlocks on first tap)
js/game.js              loop, collisions, attract mode, high scores, particles
manifest.webmanifest    Add to Home Screen
sw.js                   caches the app shell only
icon-192.png / icon-512.png / apple-touch-icon.png
```

## License

Source in this repo is provided for personal / educational use as a fan recreation.
