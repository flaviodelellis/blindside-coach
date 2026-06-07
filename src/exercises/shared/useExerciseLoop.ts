import { useEffect, useRef, useState } from "react";
import { playCue } from "../../lib/audio";

/**
 * The phase machine shared by every flash-based exercise:
 *   instructions → [ready] → iti → flash → response → (advance | repeat) → …
 *
 * The engine owns timing, the fixation/flash cadence, the trial counter, the
 * re-exposure counter and session completion. It is deliberately ignorant of
 * *what* the stimulus is and *how* the response is captured — the consumer
 * builds its own per-trial record (any shape) from the timing primitives the
 * engine exposes, then calls `commit()`.
 */
export type LoopPhase =
  | "instructions"
  | "ready"
  | "iti"
  | "flash"
  | "response"
  | "done";

/** Timing of the just-finished flash, relative to session start. */
export type FlashTiming = {
  t_start_ms: number;
  t_end_ms: number;
  exposure_ms_measured: number;
};

export type SessionTiming = {
  started_at: string;
  ended_at: string;
  duration_ms: number;
};

type Options<TParam, TTrial> = {
  params: TParam[];
  getIti: (p: TParam) => number;
  getExposure: (p: TParam) => number;
  /** Gate the very first trial behind an explicit "go" (clinician pacing). */
  readyGate?: boolean;
  /** Sound a cue at the start of each ITI (clinician-guided tachistoscopy). */
  playCueOnIti?: boolean;
  onComplete: (trials: TTrial[], timing: SessionTiming) => void;
};

export type ExerciseLoop<TParam, TTrial> = {
  phase: LoopPhase;
  trialIdx: number;
  /** Current trial param, or undefined when out of range. */
  cur: TParam | undefined;
  /** Re-exposures requested for the current trial so far. */
  nRepetitions: number;
  /** Begin the session (from the instructions screen). */
  start: () => void;
  /** Leave the ready gate and present the first stimulus. */
  go: () => void;
  /** Re-flash the SAME stimulus, incrementing the re-exposure counter. */
  repeat: () => void;
  /** Record the consumer-built trial and advance (or finish). */
  commit: (trial: TTrial) => void;
  /** Timing of the flash that just ended, relative to session start. */
  flashTiming: () => FlashTiming;
  /** Milliseconds elapsed since the end of the flash (response latency). */
  rtSinceFlashEnd: () => number;
};

export function useExerciseLoop<TParam, TTrial>(
  options: Options<TParam, TTrial>,
): ExerciseLoop<TParam, TTrial> {
  const { params, getIti, getExposure, readyGate, playCueOnIti, onComplete } =
    options;

  const [trialIdx, setTrialIdx] = useState(0);
  const [phase, setPhase] = useState<LoopPhase>("instructions");
  const [nRepetitions, setNRepetitions] = useState(0);

  const startedAtRef = useRef<string>("");
  const startedPerfRef = useRef<number>(0);
  const flashStartRef = useRef<number>(0);
  const flashEndRef = useRef<number>(0);
  const trialsOutRef = useRef<TTrial[]>([]);

  const cur = params[trialIdx];

  // ITI → flash. Each presentation (start, advance, repeat) enters the ITI
  // phase; the stimulus appears after the configured interval.
  useEffect(() => {
    if (phase !== "iti" || !cur) return;
    if (playCueOnIti) playCue();
    const id = setTimeout(() => {
      flashStartRef.current = performance.now();
      setPhase("flash");
    }, getIti(cur));
    return () => clearTimeout(id);
  }, [phase, cur, playCueOnIti, getIti]);

  // flash → response, after the exposure window.
  useEffect(() => {
    if (phase !== "flash" || !cur) return;
    const id = setTimeout(() => {
      flashEndRef.current = performance.now();
      setPhase("response");
    }, getExposure(cur));
    return () => clearTimeout(id);
  }, [phase, cur, getExposure]);

  const start = () => {
    startedAtRef.current = new Date().toISOString();
    startedPerfRef.current = performance.now();
    setNRepetitions(0);
    setPhase(readyGate ? "ready" : "iti");
  };

  const go = () => setPhase("iti");

  const repeat = () => {
    setNRepetitions((n) => n + 1);
    setPhase("iti");
  };

  const flashTiming = (): FlashTiming => ({
    t_start_ms: Math.round(flashStartRef.current - startedPerfRef.current),
    t_end_ms: Math.round(flashEndRef.current - startedPerfRef.current),
    exposure_ms_measured: Math.round(flashEndRef.current - flashStartRef.current),
  });

  const rtSinceFlashEnd = () => performance.now() - flashEndRef.current;

  const commit = (trial: TTrial) => {
    trialsOutRef.current.push(trial);
    setNRepetitions(0);
    if (trialIdx + 1 >= params.length) {
      onComplete(trialsOutRef.current, {
        started_at: startedAtRef.current,
        ended_at: new Date().toISOString(),
        duration_ms: performance.now() - startedPerfRef.current,
      });
      setPhase("done");
    } else {
      setTrialIdx((i) => i + 1);
      setPhase("iti");
    }
  };

  return {
    phase,
    trialIdx,
    cur,
    nRepetitions,
    start,
    go,
    repeat,
    commit,
    flashTiming,
    rtSinceFlashEnd,
  };
}
