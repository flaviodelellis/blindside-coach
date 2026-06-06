import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type {
  NormalizedPoint,
  TachistoscopicExercise,
  TachistoscopicTrial,
} from "../../types/session";
import type { WordEntry } from "../../types/wordLibrary";
import { pickWords } from "../../lib/wordLibrary";
import { makeRng } from "../../lib/rng";
import { resolveDuration, resolvePosition } from "../../lib/runtime";
import { useT } from "../../i18n";

type Config = TachistoscopicExercise["config"];

export type EngineResult = {
  trials: TachistoscopicTrial[];
  started_at: string;
  ended_at: string;
  duration_ms: number;
};

type TrialParam = {
  trial_id: number;
  word: string;
  is_pseudoword: boolean;
  position_norm: NormalizedPoint;
  exposure_ms_requested: number;
  iti_ms: number;
};

type Phase = "instructions" | "iti" | "flash" | "awaiting" | "done";

function normalize(s: string): string {
  return s.trim().toLocaleLowerCase("it");
}

export function TachistoscopicRunner({
  config,
  onComplete,
  onCancel,
}: {
  config: Config;
  onComplete: (r: EngineResult) => void;
  onCancel: () => void;
}) {
  const params = useMemo<TrialParam[]>(() => {
    const rng = makeRng(config.random_seed);
    const words = resolveWordPool(config.word_pool, config.n_trials, rng);
    return words.map((w, i) => ({
      trial_id: i + 1,
      word: w.word,
      is_pseudoword: w.is_pseudoword,
      position_norm: resolvePosition(config.position_mode, rng, i),
      exposure_ms_requested: Math.round(resolveDuration(config.exposure, rng)),
      iti_ms: Math.round(resolveDuration(config.inter_trial_interval, rng)),
    }));
  }, [config]);

  const [trialIdx, setTrialIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("instructions");
  const [nRepetitions, setNRepetitions] = useState(0);

  const startedAtRef = useRef<string>("");
  const startedPerfRef = useRef<number>(0);
  const flashStartRef = useRef<number>(0);
  const flashEndRef = useRef<number>(0);
  const trialsOutRef = useRef<TachistoscopicTrial[]>([]);

  const cur = params[trialIdx];

  // ITI → flash transition
  useEffect(() => {
    if (phase !== "iti" || !cur) return;
    const id = setTimeout(() => {
      flashStartRef.current = performance.now();
      setPhase("flash");
    }, cur.iti_ms);
    return () => clearTimeout(id);
  }, [phase, cur]);

  // flash → awaiting transition
  useEffect(() => {
    if (phase !== "flash" || !cur) return;
    const id = setTimeout(() => {
      flashEndRef.current = performance.now();
      setPhase("awaiting");
    }, cur.exposure_ms_requested);
    return () => clearTimeout(id);
  }, [phase, cur]);

  const finish = () => {
    const endedPerf = performance.now();
    onComplete({
      trials: trialsOutRef.current,
      started_at: startedAtRef.current,
      ended_at: new Date().toISOString(),
      duration_ms: endedPerf - startedPerfRef.current,
    });
    setPhase("done");
  };

  const start = () => {
    startedAtRef.current = new Date().toISOString();
    startedPerfRef.current = performance.now();
    setNRepetitions(0);
    setPhase("iti");
  };

  const repeat = () => {
    setNRepetitions((n) => n + 1);
    setPhase("iti");
  };

  const recordAndAdvance = (response?: TachistoscopicTrial["response"]) => {
    if (!cur) return;
    const t: TachistoscopicTrial = {
      trial_id: cur.trial_id,
      t_start_ms: Math.round(flashStartRef.current - startedPerfRef.current),
      t_end_ms: Math.round(flashEndRef.current - startedPerfRef.current),
      word: cur.word,
      is_pseudoword: cur.is_pseudoword,
      position_norm: cur.position_norm,
      exposure_ms_requested: cur.exposure_ms_requested,
      exposure_ms_measured: Math.round(
        flashEndRef.current - flashStartRef.current,
      ),
      n_repetitions: nRepetitions,
      response,
    };
    trialsOutRef.current.push(t);
    setNRepetitions(0);

    if (trialIdx + 1 >= params.length) {
      finish();
    } else {
      setTrialIdx((i) => i + 1);
      setPhase("iti");
    }
  };

  const next = () => recordAndAdvance();

  const submitPatientCorrect = (typed: string) => {
    const rt_ms = performance.now() - flashEndRef.current;
    recordAndAdvance({
      detected: true,
      recognized_word: typed,
      recognition_correct: true,
      rt_ms,
    });
  };

  const submitPatientSkip = (typed: string) => {
    recordAndAdvance({
      detected: typed.length > 0,
      recognized_word: typed.length > 0 ? typed : undefined,
      recognition_correct: false,
    });
  };

  const submitPatientWrong = () => {
    setNRepetitions((n) => n + 1);
    setPhase("iti");
  };

  if (phase === "instructions") {
    return (
      <Instructions
        config={config}
        nTrials={params.length}
        onStart={start}
        onCancel={onCancel}
      />
    );
  }

  if (!cur) return null;

  const isClinician = config.response_mode !== "patient_types";

  return (
    <div className="tach-host" style={{ background: config.background_color }}>
      <Fixation config={config} />
      {phase === "flash" && (
        <WordDisplay
          word={cur.word}
          position={cur.position_norm}
          config={config}
        />
      )}
      {isClinician && (
        <TinyCounter idx={trialIdx + 1} total={params.length} />
      )}
      {phase === "awaiting" &&
        (isClinician ? (
          <ClinicianPanel
            trialIdx={trialIdx}
            total={params.length}
            repetitions={nRepetitions}
            onRepeat={repeat}
            onNext={next}
            onCancel={onCancel}
          />
        ) : (
          <PatientInputPanel
            key={`${cur.trial_id}-${nRepetitions}`}
            trialIdx={trialIdx}
            total={params.length}
            repetitions={nRepetitions}
            targetWord={cur.word}
            onCorrect={submitPatientCorrect}
            onWrong={submitPatientWrong}
            onSkip={submitPatientSkip}
            onRepeat={repeat}
            onCancel={onCancel}
          />
        ))}
    </div>
  );
}

function TinyCounter({ idx, total }: { idx: number; total: number }) {
  const t = useT();
  return (
    <div className="tach-tiny-counter" aria-live="polite">
      {t("tach.run.tiny_counter", { idx, tot: total })}
    </div>
  );
}

function Instructions({
  config,
  nTrials,
  onStart,
  onCancel,
}: {
  config: Config;
  nTrials: number;
  onStart: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const patientMode = config.response_mode === "patient_types";
  return (
    <div className="tach-host" style={{ background: "#fff", color: "#16171d" }}>
      <div className="tach-instructions">
        <h2>
          {patientMode
            ? t("tach.run.title.patient")
            : t("tach.run.title.clinician")}
        </h2>
        <p>{t("tach.run.position")}</p>
        {patientMode ? (
          <>
            <p>{t("tach.run.patient.p1")}</p>
            <ul>
              <li>{t("tach.run.patient.li1")}</li>
              <li>{t("tach.run.patient.li2")}</li>
              <li>
                {t("tach.run.patient.li3.pre")}
                <b>{t("tach.run.patient.li3.btn")}</b>
                {t("tach.run.patient.li3.mid")}
                <kbd>↑</kbd>
                {t("tach.run.patient.li3.post")}
              </li>
              <li>
                {t("tach.run.patient.li4.pre")}
                <b>{t("tach.run.patient.li4.btn")}</b>
                {t("tach.run.patient.li4.post")}
              </li>
            </ul>
          </>
        ) : (
          <>
            <p>{t("tach.run.clinician.intro")}</p>
            <ul>
              <li>
                <b>{t("tach.run.clinician.li1.btn")}</b>
                {t("tach.run.clinician.li1.mid")}
                <kbd>R</kbd>
                {t("tach.run.clinician.li1.post")}
              </li>
              <li>
                <b>{t("tach.run.clinician.li2.btn")}</b>
                {t("tach.run.clinician.li2.mid")}
                <kbd>Invio</kbd>
                {t("tach.run.clinician.li2.sep")}
                <kbd>Spazio</kbd>
                {t("tach.run.clinician.li2.post")}
              </li>
            </ul>
          </>
        )}
        <p>{t("tach.run.session_size", { n: nTrials })}</p>
        <div className="tach-controls">
          <button type="button" onClick={onStart}>
            {t("common.start")}
          </button>
          <button type="button" className="secondary" onClick={onCancel}>
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Fixation({ config }: { config: Config }) {
  const { position_norm, size_px, color } = config.fixation;
  return (
    <div
      style={{
        position: "fixed",
        left: `${position_norm.x * 100}%`,
        top: `${position_norm.y * 100}%`,
        transform: "translate(-50%, -50%)",
        fontSize: size_px,
        color,
        fontFamily: "monospace",
        lineHeight: 1,
        userSelect: "none",
        pointerEvents: "none",
      }}
    >
      +
    </div>
  );
}

function WordDisplay({
  word,
  position,
  config,
}: {
  word: string;
  position: NormalizedPoint;
  config: Config;
}) {
  return (
    <div
      style={{
        position: "fixed",
        left: `${position.x * 100}%`,
        top: `${position.y * 100}%`,
        transform: "translate(-50%, -50%)",
        fontSize: config.font_size_px,
        fontFamily: config.font_family ?? "system-ui, sans-serif",
        color: config.text_color,
        fontWeight: 600,
        letterSpacing: "0.05em",
        userSelect: "none",
        pointerEvents: "none",
      }}
    >
      {word}
    </div>
  );
}

function ClinicianPanel({
  trialIdx,
  total,
  repetitions,
  onRepeat,
  onNext,
  onCancel,
}: {
  trialIdx: number;
  total: number;
  repetitions: number;
  onRepeat: () => void;
  onNext: () => void;
  onCancel: () => void;
}) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        onRepeat();
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onRepeat, onNext]);

  useEffect(() => {
    let hideTimer: number | undefined;
    const onMove = () => {
      setRevealed(true);
      if (hideTimer) window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setRevealed(false), 1800);
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, []);

  const t = useT();
  return (
    <div
      className={`tach-panel tach-panel-slide${revealed ? " is-visible" : ""}`}
      onMouseEnter={() => setRevealed(true)}
    >
      <div className="tach-panel-meta">
        {t("tach.panel.trial", { idx: trialIdx + 1, tot: total })}
        {repetitions > 0 && t("tach.panel.repetitions", { n: repetitions })}
      </div>
      <div className="tach-panel-actions">
        <button type="button" className="secondary" onClick={onRepeat}>
          {t("tach.panel.repeat")} <kbd>R</kbd>
        </button>
        <button type="button" onClick={onNext}>
          {t("tach.panel.next")} <kbd>↵</kbd>
        </button>
      </div>
      <button type="button" className="link-btn" onClick={onCancel}>
        {t("common.endSession")}
      </button>
    </div>
  );
}

function PatientInputPanel({
  trialIdx,
  total,
  repetitions,
  targetWord,
  onCorrect,
  onWrong,
  onSkip,
  onRepeat,
  onCancel,
}: {
  trialIdx: number;
  total: number;
  repetitions: number;
  targetWord: string;
  onCorrect: (typed: string) => void;
  onWrong: () => void;
  onSkip: (lastTyped: string) => void;
  onRepeat: () => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    const trimmed = value.trim();
    if (trimmed.length === 0) return;
    if (normalize(trimmed) === normalize(targetWord)) {
      onCorrect(trimmed);
    } else {
      setError(true);
      window.setTimeout(() => onWrong(), 600);
    }
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      onRepeat();
    }
  };

  const t = useT();
  return (
    <div className="tach-panel">
      <div className="tach-panel-meta">
        {t("tach.panel.trial", { idx: trialIdx + 1, tot: total })}
        {repetitions > 0 && t("tach.panel.attempts", { n: repetitions + 1 })}
      </div>
      <input
        ref={inputRef}
        type="text"
        className={`tach-input${error ? " error" : ""}`}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (error) setError(false);
        }}
        onKeyDown={onKeyDown}
        placeholder={t("tach.panel.placeholder")}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        disabled={error}
      />
      <div className="tach-panel-actions">
        <button type="button" className="secondary" onClick={onRepeat}>
          {t("tach.panel.repeat")} <kbd>↑</kbd>
        </button>
        <button type="button" onClick={submit} disabled={error}>
          {t("tach.panel.confirm")} <kbd>↵</kbd>
        </button>
      </div>
      <button
        type="button"
        className="link-btn"
        onClick={() => onSkip(value.trim())}
      >
        {t("tach.panel.skip")}
      </button>
      <button
        type="button"
        className="link-btn"
        style={{ marginLeft: "0.8rem" }}
        onClick={onCancel}
      >
        {t("common.endSession")}
      </button>
    </div>
  );
}

function resolveWordPool(
  pool: Config["word_pool"],
  n: number,
  rng: () => number,
): WordEntry[] {
  if (pool.kind === "inline") {
    return pool.words.slice(0, n).map((w) => ({
      word: w,
      language: "it",
      categories: [],
      length: w.length,
      is_pseudoword: false,
    }));
  }
  const ratio = pool.include_pseudowords ? (pool.pseudoword_ratio ?? 0.3) : 0;
  return pickWords(
    {
      language: pool.language ?? "both",
      categories: pool.categories,
      lengthRange: pool.length_range,
    },
    n,
    ratio,
    rng,
  );
}
