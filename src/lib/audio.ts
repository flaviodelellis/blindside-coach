// Lightweight Web Audio beeps — no audio assets, generated on the fly.
// Must be triggered from a user gesture (e.g. a click) so the browser's
// autoplay policy lets the AudioContext start.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

type Tone = {
  freq: number;
  durMs: number;
  volume: number;
  type: OscillatorType;
  at: number;
};

function scheduleTone(audio: AudioContext, t: Tone): void {
  const dur = t.durMs / 1000;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = t.type;
  osc.frequency.value = t.freq;
  // Short attack + exponential release to avoid audible clicks.
  gain.gain.setValueAtTime(0.0001, t.at);
  gain.gain.exponentialRampToValueAtTime(t.volume, t.at + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t.at + dur);
  osc.connect(gain).connect(audio.destination);
  osc.start(t.at);
  osc.stop(t.at + dur + 0.02);
}

export function playBeep(opts?: {
  frequency?: number;
  durationMs?: number;
  volume?: number;
  type?: OscillatorType;
}): void {
  const audio = getCtx();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume();
  scheduleTone(audio, {
    freq: opts?.frequency ?? 880,
    durMs: opts?.durationMs ?? 180,
    volume: opts?.volume ?? 0.2,
    type: opts?.type ?? "sine",
    at: audio.currentTime,
  });
}

/**
 * Prominent, attention-grabbing double beep used as the clinician's "go" cue
 * each time a word presentation is launched. Square wave + high volume so it
 * is clearly audible across the room.
 */
export function playCue(): void {
  const audio = getCtx();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume();
  const now = audio.currentTime;
  const tone = { volume: 0.6, type: "square" as OscillatorType };
  scheduleTone(audio, { freq: 1000, durMs: 130, at: now, ...tone });
  scheduleTone(audio, { freq: 1000, durMs: 130, at: now + 0.18, ...tone });
}
