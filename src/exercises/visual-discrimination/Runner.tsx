import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  DiscriminationTrial,
  PresentedStimulus,
  VisualDiscriminationExercise,
} from "../../types/session";
import {
  buildDiscriminationTrials,
  type DiscriminationTrialParam,
} from "./engine";
import { useExerciseLoop } from "../shared/useExerciseLoop";
import { useEdgeClamp } from "../shared/useEdgeClamp";
import { useT } from "../../i18n";
import { colorLabel, shapeLabel } from "./labels";
import { useSpeechResponse, matchUtterance, type MatchOutcome } from "../../lib/speech";
import { buildVocab, buildCombinedVocab, vocabLang } from "./speechVocab";
import { playBeep } from "../../lib/audio";

/** How long the patient sees per-attempt feedback before the next presentation. */
const PATIENT_FEEDBACK_MS = 1100;

/** Clinician auto-record window: time to tap-correct before the answer commits. */
const AUTO_CONFIRM_MS = 1500;

type Config = VisualDiscriminationExercise["config"];

type Translate = (key: string, params?: Record<string, string | number>) => string;

export type EngineResult = {
  trials: DiscriminationTrial[];
  started_at: string;
  ended_at: string;
  duration_ms: number;
};


export function VisualDiscriminationRunner({
  config,
  onComplete,
  onCancel,
}: {
  config: Config;
  onComplete: (r: EngineResult) => void;
  onCancel: () => void;
}) {
  const params = useMemo<DiscriminationTrialParam[]>(
    () => buildDiscriminationTrials(config),
    [config],
  );

  const {
    phase,
    trialIdx,
    cur,
    nRepetitions,
    start,
    repeat,
    commit,
    flashTiming,
    rtSinceFlashEnd,
  } = useExerciseLoop<DiscriminationTrialParam, DiscriminationTrial>({
    params,
    getIti: (p) => p.iti_ms,
    getExposure: (p) => p.exposure_ms,
    onComplete: (trials, timing) => onComplete({ trials, ...timing }),
  });

  // Esc cancels the session.
  useEffect(() => {
    if (phase === "instructions" || phase === "done") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, onCancel]);

  // guess === null means the patient did not see the stimulus.
  const submit = (
    guess: string | null,
    extra?: { transcript?: string; asr_confidence?: number },
  ) => {
    if (!cur) return;
    const t = flashTiming();
    const seen = guess !== null;
    const trial: DiscriminationTrial = {
      trial_id: cur.trial_id,
      t_start_ms: t.t_start_ms,
      t_end_ms: t.t_end_ms,
      stimuli: [cur.stimulus],
      dimension: cur.dimension,
      expected_response: cur.expected,
      response: {
        given: seen,
        value: seen ? guess : undefined,
        rt_ms: Math.round(rtSinceFlashEnd()),
        aware: seen,
        transcript: extra?.transcript,
        asr_confidence: extra?.asr_confidence,
      },
      n_repetitions: nRepetitions,
      correct: seen ? guess === cur.expected : false,
    };
    commit(trial);
  };

  // Combined shape+color: both null means the patient did not see the stimulus.
  const submitCombined = (
    shape: string | null,
    color: string | null,
    extra?: { transcript?: string; asr_confidence?: number },
  ) => {
    if (!cur) return;
    const t = flashTiming();
    const seen = shape !== null && color !== null;
    const trial: DiscriminationTrial = {
      trial_id: cur.trial_id,
      t_start_ms: t.t_start_ms,
      t_end_ms: t.t_end_ms,
      stimuli: [cur.stimulus],
      dimension: cur.dimension,
      expected_shape: cur.expected_shape,
      expected_color: cur.expected_color,
      response: {
        given: seen,
        value_shape: shape ?? undefined,
        value_color: color ?? undefined,
        rt_ms: Math.round(rtSinceFlashEnd()),
        aware: seen,
        transcript: extra?.transcript,
        asr_confidence: extra?.asr_confidence,
      },
      n_repetitions: nRepetitions,
      correct: seen
        ? shape === cur.expected_shape && color === cur.expected_color
        : false,
    };
    commit(trial);
  };

  // Autonomous patient mode (prescription, no clinician): the voice answer is
  // auto-accepted; a wrong answer re-exposes the stimulus until max_attempts.
  const patientAuto = config.response_collector === "patient";
  const maxAttempts = Math.max(1, config.max_attempts ?? 1);

  const onPatientResult = (
    shape: string | null,
    color: string | null,
    correct: boolean,
    extra?: { transcript?: string; asr_confidence?: number },
  ) => {
    if (!cur) return;
    if (!correct && nRepetitions + 1 < maxAttempts) {
      repeat();
      return;
    }
    const t = flashTiming();
    const seen = shape !== null && color !== null;
    commit({
      trial_id: cur.trial_id,
      t_start_ms: t.t_start_ms,
      t_end_ms: t.t_end_ms,
      stimuli: [cur.stimulus],
      dimension: cur.dimension,
      expected_shape: cur.expected_shape,
      expected_color: cur.expected_color,
      response: {
        given: seen,
        value_shape: shape ?? undefined,
        value_color: color ?? undefined,
        rt_ms: Math.round(rtSinceFlashEnd()),
        aware: seen,
        transcript: extra?.transcript,
        asr_confidence: extra?.asr_confidence,
      },
      n_repetitions: nRepetitions,
      correct,
    });
  };

  // Patient mode skips the clinician instructions screen — the patient's own
  // intro (with the «Inizia» gesture that unlocks the mic) already ran.
  useEffect(() => {
    if (patientAuto && phase === "instructions") start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "instructions") {
    if (patientAuto) return null;
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

  return (
    <div className="tach-host" style={{ background: config.background_color }}>
      <Fixation config={config} />
      {phase === "flash" && <StimulusFlash stim={cur.stimulus} />}
      <div className="tach-tiny-counter" aria-live="polite">
        {trialIdx + 1} / {params.length}
      </div>
      {phase === "response" &&
        (patientAuto ? (
          <PatientCombinedPanel
            key={`${cur.trial_id}-${nRepetitions}`}
            param={cur}
            config={config}
            attempt={nRepetitions + 1}
            maxAttempts={maxAttempts}
            onResult={onPatientResult}
          />
        ) : (
          <ResponsePanel
            key={`${cur.trial_id}-${nRepetitions}`}
            param={cur}
            config={config}
            onSubmit={submit}
            onSubmitCombined={submitCombined}
            onRepeat={repeat}
            onCancel={onCancel}
          />
        ))}
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

function StimulusFlash({ stim }: { stim: PresentedStimulus }) {
  const { ref, transform } = useEdgeClamp<HTMLDivElement>([
    stim.position_norm.x,
    stim.position_norm.y,
    stim.size_px,
    stim.value,
  ]);
  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: `${stim.position_norm.x * 100}%`,
        top: `${stim.position_norm.y * 100}%`,
        transform,
        width: stim.size_px,
        height: stim.size_px,
      }}
    >
      <ShapeSvg
        shape={stim.kind === "shape" ? stim.value : "circle"}
        fill={stim.color}
      />
    </div>
  );
}

function ShapeSvg({ shape, fill }: { shape: string; fill: string }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      {shape === "square" && (
        <rect x="5" y="5" width="90" height="90" fill={fill} />
      )}
      {shape === "triangle" && (
        <polygon points="50,8 95,92 5,92" fill={fill} />
      )}
      {shape === "diamond" && (
        <polygon points="50,5 95,50 50,95 5,50" fill={fill} />
      )}
      {(shape === "circle" || !["square", "triangle", "diamond"].includes(shape)) && (
        <circle cx="50" cy="50" r="45" fill={fill} />
      )}
    </svg>
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
  const dim = config.discrimination_dimension;
  const what =
    dim === "color"
      ? t("vd.run.ask.color")
      : dim === "shape"
        ? t("vd.run.ask.shape")
        : t("vd.run.ask.shape_color");
  return (
    <div className="tach-host" style={{ background: "#fff", color: "#16171d" }}>
      <div className="tach-instructions">
        <h2>{t("vd.run.title")}</h2>
        <p>{t("vd.run.intro.fixate")}</p>
        <p>
          {t("vd.run.intro.flash")}{" "}
          {t("vd.run.intro.ask.pre")}<b>{what}</b>{t("vd.run.intro.ask.post")}
        </p>
        <ul>
          <li>{t("vd.run.intro.li_identify")}</li>
          <li>
            {t("vd.run.intro.li_notseen.pre")}
            <b>«{t("vd.run.notseen")}»</b>
            {t("vd.run.intro.li_notseen.post")}
          </li>
        </ul>
        <p>
          {t("vd.run.intro.esc.pre")}<kbd>Esc</kbd>{t("vd.run.intro.esc.post")}
        </p>
        <div className="form-actions" style={{ marginTop: "1.5rem" }}>
          <button type="button" onClick={onStart}>
            {t("vd.run.start", { n: nTrials })}
          </button>
          <button type="button" className="secondary" onClick={onCancel}>
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResponsePanel(props: {
  param: DiscriminationTrialParam;
  config: Config;
  onSubmit: (
    guess: string | null,
    extra?: { transcript?: string; asr_confidence?: number },
  ) => void;
  onSubmitCombined: (shape: string | null, color: string | null) => void;
  onRepeat: () => void;
  onCancel: () => void;
}) {
  if (props.param.dimension === "shape_color") {
    return (
      <CombinedResponsePanel
        param={props.param}
        config={props.config}
        onSubmit={props.onSubmitCombined}
        onRepeat={props.onRepeat}
        onCancel={props.onCancel}
      />
    );
  }
  return (
    <SingleResponsePanel
      param={props.param}
      config={props.config}
      onSubmit={props.onSubmit}
      onRepeat={props.onRepeat}
      onCancel={props.onCancel}
    />
  );
}

/**
 * Combined shape + colour (clinician in-office). Minimal & non-invasive: the
 * screen stays calm (just the fixation cross); a small bottom bar shows what the
 * engine heard and **auto-records** after a short window — no Invio. The clinician
 * only intervenes if needed via «✎ correggi», which opens compact chips and
 * pauses the auto-record until they pick (or cancel).
 */
function CombinedResponsePanel({
  param,
  config,
  onSubmit,
  onRepeat,
  onCancel,
}: {
  param: DiscriminationTrialParam;
  config: Config;
  onSubmit: (
    shape: string | null,
    color: string | null,
    extra?: { transcript?: string; asr_confidence?: number },
  ) => void;
  onRepeat: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [selShape, setSelShape] = useState<string | null>(null);
  const [selColor, setSelColor] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const submittedRef = useRef(false);

  const vocab = useMemo(
    () =>
      buildCombinedVocab(
        param.color_alternatives ?? [],
        param.shape_alternatives ?? [],
        vocabLang(config.speech_lang),
      ),
    [param.color_alternatives, param.shape_alternatives, config.speech_lang],
  );

  const { status, transcript } = useSpeechResponse({
    active: true,
    engine: "web-speech",
    lang: config.speech_lang ?? "it-IT",
    entries: [...vocab.shape, ...vocab.color],
    notSeenPhrases: vocab.notSeen,
    vocabulary: vocab.flat,
  });

  const shapeMatch: MatchOutcome = transcript
    ? matchUtterance(transcript, vocab.shape, vocab.notSeen)
    : { kind: "none", score: 0 };
  const colorMatch: MatchOutcome = transcript
    ? matchUtterance(transcript, vocab.color, vocab.notSeen)
    : { kind: "none", score: 0 };

  const proposedShape = shapeMatch.kind === "value" ? shapeMatch.value : null;
  const proposedColor = colorMatch.kind === "value" ? colorMatch.value : null;
  const proposedNotSeen =
    shapeMatch.kind === "not_seen" || colorMatch.kind === "not_seen";

  const overrideActive = selShape !== null || selColor !== null;
  const effShape = selShape ?? proposedShape;
  const effColor = selColor ?? proposedColor;
  const isNotSeen = !overrideActive && proposedNotSeen;
  const haveAnswer = isNotSeen || (effShape !== null && effColor !== null);

  const asrConfidence = Math.min(
    shapeMatch.kind === "value" ? shapeMatch.score : 1,
    colorMatch.kind === "value" ? colorMatch.score : 1,
  );

  const submit = (shape: string | null, color: string | null) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    onSubmit(shape, color, { transcript, asr_confidence: asrConfidence });
  };

  // Auto-record once an answer is settled — unless the clinician is correcting.
  useEffect(() => {
    if (correcting || !haveAnswer) return;
    const id = setTimeout(
      () => submit(isNotSeen ? null : effShape, isNotSeen ? null : effColor),
      AUTO_CONFIRM_MS,
    );
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [correcting, haveAnswer, isNotSeen, effShape, effColor]);

  // R re-flashes the same stimulus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        onRepeat();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onRepeat]);

  const chip = (active: boolean, proposed: boolean) =>
    `vd-chip${active ? " is-selected" : proposed ? " is-proposed" : ""}`;

  const settledLabel = isNotSeen
    ? t("vd.run.notseen")
    : effShape !== null && effColor !== null
      ? `${shapeLabel(effShape, t)} ${colorLabel(effColor, t)}`
      : null;

  return (
    <div className="runbar-wrap">
      {correcting && (
        <div className="vd-correct">
          <div className="vd-correct-row">
            <span className="vd-correct-label">{t("vd.run.field.shape")}</span>
            {(param.shape_alternatives ?? []).map((s) => (
              <button
                key={s}
                type="button"
                className={chip(selShape === s, selShape === null && proposedShape === s)}
                onClick={() => setSelShape(s)}
                title={altLabel("shape", s, t)}
              >
                <AltGlyph dimension="shape" value={s} />
              </button>
            ))}
          </div>
          <div className="vd-correct-row">
            <span className="vd-correct-label">{t("vd.run.field.color")}</span>
            {(param.color_alternatives ?? []).map((c) => (
              <button
                key={c}
                type="button"
                className={chip(selColor === c, selColor === null && proposedColor === c)}
                onClick={() => setSelColor(c)}
                title={altLabel("color", c, t)}
              >
                <AltGlyph dimension="color" value={c} />
              </button>
            ))}
          </div>
          <div className="vd-correct-actions">
            <button type="button" className="runbar-link" onClick={() => submit(null, null)}>
              {t("vd.run.notseen")}
            </button>
            <button
              type="button"
              className="vd-correct-save"
              disabled={effShape === null || effColor === null}
              onClick={() => submit(effShape, effColor)}
            >
              {t("vd.run.record")}
            </button>
            <button type="button" className="runbar-link" onClick={() => setCorrecting(false)}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      <div className="runbar">
        <span className={`runbar-mic runbar-mic-${status}`} aria-hidden>
          🎤
        </span>
        <span className="runbar-answer">
          {settledLabel
            ? `«${settledLabel}»`
            : transcript
              ? `«${transcript}»`
              : t("vd.run.listening")}
        </span>
        {!correcting && settledLabel && (
          <span className="runbar-state">{t("vd.run.recording")}</span>
        )}
        {!correcting && (
          <button
            type="button"
            className="runbar-fix"
            onClick={() => setCorrecting(true)}
          >
            {t("vd.run.correct")}
          </button>
        )}
        <button type="button" className="runbar-link" onClick={onRepeat}>
          {t("vd.run.repeat")}
        </button>
        <button type="button" className="runbar-link" onClick={onCancel}>
          {t("vd.run.exit")}
        </button>
      </div>
    </div>
  );
}

/**
 * Autonomous patient panel (prescription mode): voice only, auto-accepted. As
 * soon as the engine confidently hears a shape+colour (or "non visto"), it shows
 * brief feedback and reports the result; the Runner re-exposes on error. No
 * clinician, no manual buttons. Falls back to a "wrong" attempt if the patient
 * stays silent too long, so the session can never get stuck.
 */
function PatientCombinedPanel({
  param,
  config,
  attempt,
  maxAttempts,
  onResult,
}: {
  param: DiscriminationTrialParam;
  config: Config;
  attempt: number;
  maxAttempts: number;
  onResult: (
    shape: string | null,
    color: string | null,
    correct: boolean,
    extra?: { transcript?: string; asr_confidence?: number },
  ) => void;
}) {
  const t = useT();
  const vocab = useMemo(
    () =>
      buildCombinedVocab(
        param.color_alternatives ?? [],
        param.shape_alternatives ?? [],
        vocabLang(config.speech_lang),
      ),
    [param.color_alternatives, param.shape_alternatives, config.speech_lang],
  );
  const { status, transcript } = useSpeechResponse({
    active: true,
    engine: "web-speech",
    lang: config.speech_lang ?? "it-IT",
    entries: [...vocab.shape, ...vocab.color],
    notSeenPhrases: vocab.notSeen,
    vocabulary: vocab.flat,
  });

  const [feedback, setFeedback] = useState<null | "correct" | "wrong">(null);
  const decidedRef = useRef(false);
  const advanceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ onResult, transcript });
  useEffect(() => {
    latest.current = { onResult, transcript };
  });

  // Clear the pending advance timer on unmount (per trial / re-exposure remount).
  useEffect(() => () => {
    if (advanceRef.current) clearTimeout(advanceRef.current);
  }, []);

  const decide = (
    shape: string | null,
    color: string | null,
    extra: { transcript?: string; asr_confidence?: number },
  ) => {
    if (decidedRef.current) return;
    decidedRef.current = true;
    const correct =
      shape !== null &&
      color !== null &&
      shape === param.expected_shape &&
      color === param.expected_color;
    setFeedback(correct ? "correct" : "wrong");
    playBeep(
      correct
        ? { frequency: 880, durationMs: 180 }
        : { frequency: 300, durationMs: 260, type: "sawtooth" },
    );
    advanceRef.current = setTimeout(
      () => latest.current.onResult(shape, color, correct, extra),
      PATIENT_FEEDBACK_MS,
    );
  };

  // Accept as soon as both attributes (or "non visto") are heard confidently.
  useEffect(() => {
    if (decidedRef.current || !transcript) return;
    const sm = matchUtterance(transcript, vocab.shape, vocab.notSeen);
    const cm = matchUtterance(transcript, vocab.color, vocab.notSeen);
    const shape = sm.kind === "value" ? sm.value : null;
    const color = cm.kind === "value" ? cm.value : null;
    const notSeen = sm.kind === "not_seen" || cm.kind === "not_seen";
    if ((shape === null || color === null) && !notSeen) return;
    const conf = Math.min(
      sm.kind === "value" ? sm.score : 1,
      cm.kind === "value" ? cm.score : 1,
    );
    decide(shape, color, { transcript, asr_confidence: conf });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, vocab]);

  // Never get stuck: if nothing is understood in time, count a failed attempt.
  useEffect(() => {
    const id = setTimeout(() => {
      if (!decidedRef.current)
        decide(null, null, { transcript: latest.current.transcript });
    }, 9000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="patient-response">
      <div className="patient-prompt">{t("vd.run.patient.prompt")}</div>
      <div className={`patient-mic patient-mic-${status}`}>{micHint(status, t)}</div>
      {transcript && <div className="patient-heard">«{transcript}»</div>}
      {feedback && (
        <div className={`patient-feedback patient-feedback-${feedback}`}>
          {feedback === "correct"
            ? t("vd.run.patient.correct")
            : t("vd.run.patient.retry")}
        </div>
      )}
      {maxAttempts > 1 && (
        <div className="patient-attempt">
          {t("vd.run.patient.attempt", { n: attempt, total: maxAttempts })}
        </div>
      )}
    </div>
  );
}

function micHint(status: string, t: Translate): string {
  if (status === "unsupported") return t("vd.run.mic.unsupported");
  if (status === "error") return t("vd.run.mic.error");
  if (status === "loading") return t("vd.run.mic.loading");
  if (status === "listening") return t("vd.run.mic.listening");
  return "";
}

function SingleResponsePanel({
  param,
  config,
  onSubmit,
  onRepeat,
  onCancel,
}: {
  param: DiscriminationTrialParam;
  config: Config;
  onSubmit: (
    guess: string | null,
    extra?: { transcript?: string; asr_confidence?: number },
  ) => void;
  onRepeat: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const dim = param.dimension;
  const speech = config.response_input === "speech";
  const prompt =
    dim === "color"
      ? t("vd.run.prompt.color")
      : t("vd.run.prompt.shape");

  const vocab = useMemo(
    () => buildVocab(param.dimension, param.alternatives, vocabLang(config.speech_lang)),
    [param.dimension, param.alternatives, config.speech_lang],
  );

  const { status, transcript, match } = useSpeechResponse({
    active: speech,
    engine: "web-speech",
    lang: config.speech_lang ?? "it-IT",
    entries: vocab.entries,
    notSeenPhrases: vocab.notSeen,
    vocabulary: vocab.flat,
  });

  // The voice-proposed answer: a value, "not seen", or nothing yet.
  const proposedValue = match.kind === "value" ? match.value : null;
  const proposedNotSeen = match.kind === "not_seen";
  const hasProposal = match.kind !== "none";

  const confirmProposal = useCallback(() => {
    if (match.kind === "value") {
      onSubmit(match.value, {
        transcript,
        asr_confidence: match.score,
      });
    } else if (match.kind === "not_seen") {
      onSubmit(null, { transcript, asr_confidence: match.score });
    }
  }, [match, transcript, onSubmit]);

  // In speech mode, Enter confirms the proposed answer.
  useEffect(() => {
    if (!speech) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && hasProposal) {
        e.preventDefault();
        confirmProposal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [speech, hasProposal, confirmProposal]);

  return (
    <div className="tach-panel-slide is-visible vd-response-panel">
      <div className="vd-response-prompt">{prompt}</div>

      {speech && (
        <SpeechStatusBar
          status={status}
          transcript={transcript}
          matched={
            match.kind === "value"
              ? altLabel(dim, match.value, t)
              : match.kind === "not_seen"
                ? t("vd.run.notseen")
                : null
          }
        />
      )}

      <div className="vd-response-options">
        {param.alternatives.map((alt) => (
          <button
            key={alt}
            type="button"
            className={`vd-option${proposedValue === alt ? " is-proposed" : ""}`}
            onClick={() => onSubmit(alt)}
          >
            <AltGlyph dimension={dim} value={alt} />
            <span>{altLabel(dim, alt, t)}</span>
          </button>
        ))}
        <button
          type="button"
          className={`vd-option vd-not-seen${proposedNotSeen ? " is-proposed" : ""}`}
          onClick={() => onSubmit(null)}
        >
          <span className="vd-glyph vd-glyph-empty" aria-hidden>
            ✕
          </span>
          <span>{t("vd.run.notseen")}</span>
        </button>
      </div>

      {speech && (
        <button
          type="button"
          className="vd-confirm"
          onClick={confirmProposal}
          disabled={!hasProposal}
        >
          {t("vd.run.confirm", {
            value: proposedNotSeen
              ? t("vd.run.notseen")
              : proposedValue
                ? altLabel(dim, proposedValue, t)
                : "—",
          })}
        </button>
      )}

      <button type="button" className="vd-repeat" onClick={onRepeat}>
        {t("vd.run.repeat")} <kbd>R</kbd>
      </button>

      <button type="button" className="vd-cancel" onClick={onCancel}>
        {t("vd.run.stop")}
      </button>
    </div>
  );
}

function SpeechStatusBar({
  status,
  transcript,
  matched,
}: {
  status: string;
  transcript: string;
  matched: string | null;
}) {
  const t = useT();
  let hint: string;
  if (status === "unsupported") hint = t("vd.run.speech.unsupported");
  else if (status === "error") hint = t("vd.run.speech.error");
  else if (status === "loading") hint = t("vd.run.speech.loading");
  else if (status === "listening") hint = t("vd.run.speech.listening");
  else hint = "";

  return (
    <div className="vd-speech-bar">
      <span className={`vd-speech-status vd-speech-${status}`}>{hint}</span>
      {transcript && <span className="vd-speech-transcript">«{transcript}»</span>}
      {matched && <span className="vd-speech-matched">→ {matched}</span>}
    </div>
  );
}

function AltGlyph({ dimension, value }: { dimension: string; value: string }) {
  if (dimension === "color") {
    return (
      <span
        className="vd-glyph color-swatch"
        style={{ background: value }}
        aria-hidden
      />
    );
  }
  if (dimension === "shape") {
    return (
      <span className="vd-glyph" aria-hidden>
        <ShapeSvg shape={value} fill="#16171d" />
      </span>
    );
  }
  return null;
}

function altLabel(dimension: string, value: string, t: Translate): string {
  if (dimension === "color") return colorLabel(value, t);
  if (dimension === "shape") return shapeLabel(value, t);
  return value;
}
