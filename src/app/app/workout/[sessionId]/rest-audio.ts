/**
 * The end-of-rest cues: a vibration and a short two-tone beep. Browsers only
 * let a page make sound after a user gesture, so the audio is unlocked on the
 * ✓ tap that starts the rest and played later, when the rest ends.
 */

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };
type AudioContextCtor = typeof AudioContext;

let ctx: AudioContext | null = null;

/**
 * iOS before 17 has no way to mix a page's sound with other apps: starting
 * Web Audio there pauses the user's music. Stay silent rather than do that.
 */
function canMixWithOtherAudio() {
  const nav = navigator as AudioSessionNavigator;
  if (nav.audioSession) return true;
  const iOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return !iOS;
}

/** Call from the tap that starts a rest. */
export function unlockRestAudio() {
  try {
    if (!canMixWithOtherAudio()) return;
    const nav = navigator as AudioSessionNavigator;
    // Mix with (never interrupt) the music the user trains to.
    if (nav.audioSession) nav.audioSession.type = "ambient";
    if (!ctx) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
    }
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  } catch {
    /* no audio on this device — the vibration and the bar still signal the end */
  }
}

export function playRestBeep() {
  const audio = ctx;
  if (!audio) return;
  try {
    if (audio.state === "suspended") void audio.resume().catch(() => {});
    const t0 = audio.currentTime + 0.03;
    [880, 1320].forEach((freq, i) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      const start = t0 + i * 0.2;
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.35, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(gain).connect(audio.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  } catch {
    /* ignore */
  }
}

export function vibrateRestEnd() {
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    /* not supported (iOS) */
  }
}
