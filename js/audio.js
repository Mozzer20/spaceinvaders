/**
 * Tiny self-contained Web Audio beeps. No files, no CDN.
 * Audio is unlocked on the first user gesture.
 */
const Sfx = (() => {
  let ctx = null;
  let muted = false;

  function getCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function beep({ freq = 440, dur = 0.08, type = "square", gain = 0.06, slide = 0 }) {
    if (muted) return;
    const ac = getCtx();
    if (!ac) return;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    if (slide) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(40, freq + slide),
        ac.currentTime + dur
      );
    }
    g.gain.setValueAtTime(gain, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    osc.connect(g);
    g.connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + dur);
  }

  return {
    unlock() {
      getCtx();
    },
    shoot() {
      beep({ freq: 880, dur: 0.07, type: "square", gain: 0.05, slide: -420 });
    },
    hit() {
      beep({ freq: 220, dur: 0.12, type: "square", gain: 0.07, slide: -140 });
    },
    bunker() {
      beep({ freq: 140, dur: 0.05, type: "triangle", gain: 0.04 });
    },
    death() {
      beep({ freq: 180, dur: 0.45, type: "sawtooth", gain: 0.08, slide: -150 });
    },
    ufo() {
      beep({ freq: 620, dur: 0.09, type: "square", gain: 0.04, slide: 180 });
    },
    step(n) {
      const notes = [110, 98, 87, 73];
      beep({ freq: notes[n % 4], dur: 0.07, type: "square", gain: 0.035 });
    },
    extra() {
      beep({ freq: 660, dur: 0.18, type: "square", gain: 0.05, slide: 220 });
    },
    wave() {
      beep({ freq: 520, dur: 0.2, type: "square", gain: 0.05, slide: 300 });
    },
  };
})();
