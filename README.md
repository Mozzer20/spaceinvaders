# Space Invaders

A fan recreation of the classic 1978 arcade game **Space Invaders**, built as a static HTML5 canvas game (vanilla JavaScript, no framework, no backend, no CDN assets).

This is an unofficial tribute. Space Invaders is a trademark of Taito / the current rights holders. This project is not affiliated with them.

## How to run

Open the game in a desktop browser (keyboard required):

1. **Simplest:** double-click `index.html`, or drag it into a browser tab.
2. **Local static server** (recommended if a browser blocks `file://` modules or audio):

```bash
# Python 3
python3 -m http.server 8000

# or Node
npx --yes serve .
```

Then visit [http://localhost:8000](http://localhost:8000).

GitHub Pages also works if you enable it on this repo (root of `main`).

## Controls

| Key | Action |
| --- | --- |
| **Left / Right arrows** or **A / D** | Move the cannon |
| **Space** | Fire (classic: only one player shot on screen) |
| **Enter** | Start / restart after game over |
| **P** or **Esc** | Pause / resume |

## How to play

- You have **3 lives**. Destroy the formation of aliens before they reach the ground.
- Aliens **march sideways**, drop a row at the edge, and **speed up** as their numbers fall.
- Hide behind **destructible bunkers** — shots from both sides chew them apart.
- A **mystery UFO** sometimes flies across the top for bonus points.
- Clear a wave to start the next, slightly faster and a little lower.
- Extra life at **1500** points. High score is saved in the browser.

## Files

```
index.html      page shell + canvas
css/style.css   retro arcade chrome
js/sprites.js   pixel-art grids
js/audio.js     Web Audio beeps (shoot / hit / death)
js/game.js      game loop, collisions, waves
```

## License

Source in this repo is provided for personal / educational use as a fan recreation.
