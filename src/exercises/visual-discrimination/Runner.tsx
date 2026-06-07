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
import { colorLabel, shapeLabel } from "./labels";
import { useSpeechResponse, matchUtterance, type MatchOutcome } from "../../lib/speech";
import { buildVocab, buildCombinedVocab } from "./speechVocab";
import { playBeep } from "../../lib/audio";

/** How long the patient sees per-attempt feedback before the next presentation. */
const PATIENT_FEEDBACK_MS = 1100;

/** Clinician auto-record window: time to tap-correct before the answer commits. */
const AUTO_CONFIRM_MS = 1500;

type Config = VisualDiscriminationExercise["config"];

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
  return (
    <div
      style={{
        position: "fixed",
        left: `${stim.position_norm.x * 100}%`,
        top: `${stim.position_norm.y * 100}%`,
        transform: "translate(-50%, -50%)",
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
  const dim = config.discrimination_dimension;
  const what =
    dim === "color"
      ? "che colore era lo stimolo"
      : dim === "shape"
        ? "che forma aveva lo stimolo"
        : "che forma e che colore aveva lo stimolo";
  return (
    <div className="tach-host" style={{ background: "#fff", color: "#16171d" }}>
      <div className="tach-instructions">
        <h2>Discriminazione visiva — scelta forzata</h2>
        <p>Il paziente fissa la crocetta al centro dello schermo.</p>
        <p>
          A ogni tentativo compare per pochissimo tempo uno stimolo in periferia.
          Subito dopo, chiedi al paziente <b>{what}</b> e registra la sua risposta.
        </p>
        <ul>
          <li>Se identifica lo stimolo, seleziona la risposta indicata.</li>
          <li>Se dichiara di non aver visto nulla, seleziona <b>«Non ha visto»</b>.</li>
        </ul>
        <p>Premi <kbd>Esc</kbd> in qualunque momento per interrompere.</p>
        <div className="form-actions" style={{ marginTop: "1.5rem" }}>
          <button type="button" onClick={onStart}>
            Avvia ({nTrials} tentativi) →
          </button>
          <button type="button" className="secondary" onClick={onCancel}>
            Annulla
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
  const [selShape, setSelShape] = useState<string | null>(null);
  const [selColor, setSelColor] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const submittedRef = useRef(false);

  const vocab = useMemo(
    () => buildCombinedVocab(param.color_alternatives ?? []),
    [param.color_alternatives],
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
    ? "Non ha visto"
    : effShape !== null && effColor !== null
      ? `${shapeLabel(effShape)} ${colorLabel(effColor)}`
      : null;

  return (
    <div className="runbar-wrap">
      {correcting && (
        <div className="vd-correct">
          <div className="vd-correct-row">
            <span className="vd-correct-label">Forma</span>
            {(param.shape_alternatives ?? []).map((s) => (
              <button
                key={s}
                type="button"
                className={chip(selShape === s, selShape === null && proposedShape === s)}
                onClick={() => setSelShape(s)}
                title={altLabel("shape", s)}
              >
                <AltGlyph dimension="shape" value={s} />
              </button>
            ))}
          </div>
          <div className="vd-correct-row">
            <span className="vd-correct-label">Colore</span>
            {(param.color_alternatives ?? []).map((c) => (
              <button
                key={c}
                type="button"
                className={chip(selColor === c, selColor === null && proposedColor === c)}
                onClick={() => setSelColor(c)}
                title={altLabel("color", c)}
              >
                <AltGlyph dimension="color" value={c} />
              </button>
            ))}
          </div>
          <div className="vd-correct-actions">
            <button type="button" className="runbar-link" onClick={() => submit(null, null)}>
              Non ha visto
            </button>
            <button
              type="button"
              className="vd-correct-save"
              disabled={effShape === null || effColor === null}
              onClick={() => submit(effShape, effColor)}
            >
              Registra
            </button>
            <button type="button" className="runbar-link" onClick={() => setCorrecting(false)}>
              Annulla
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
              : "in ascolto…"}
        </span>
        {!correcting && settledLabel && (
          <span className="runbar-state">registro…</span>
        )}
        {!correcting && (
          <button
            type="button"
            className="runbar-fix"
            onClick={() => setCorrecting(true)}
          >
            ✎ correggi
          </button>
        )}
        <button type="button" className="runbar-link" onClick={onRepeat}>
          Ripeti
        </button>
        <button type="button" className="runbar-link" onClick={onCancel}>
          Esci
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
  const vocab = useMemo(
    () => buildCombinedVocab(param.color_alternatives ?? []),
    [param.color_alternatives],
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
      <div className="patient-prompt">Che cosa hai visto? Dillo ad alta voce.</div>
      <div className={`patient-mic patient-mic-${status}`}>{micHint(status)}</div>
      {transcript && <div className="patient-heard">«{transcript}»</div>}
      {feedback && (
        <div className={`patient-feedback patient-feedback-${feedback}`}>
          {feedback === "correct" ? "Giusto!" : "Riproviamo"}
        </div>
      )}
      {maxAttempts > 1 && (
        <div className="patient-attempt">
          Tentativo {attempt} di {maxAttempts}
        </div>
      )}
    </div>
  );
}

function micHint(status: string): string {
  if (status === "unsupported") return "Microfono non disponibile";
  if (status === "error") return "Problema con il microfono";
  if (status === "loading") return "Attendi…";
  if (status === "listening") return "🎤 Ti ascolto…";
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
  const dim = param.dimension;
  const speech = config.response_input === "speech";
  const prompt =
    dim === "color"
      ? "Che colore ha indicato il paziente?"
      : "Che forma ha indicato il paziente?";

  const vocab = useMemo(
    () => buildVocab(param.dimension, param.alternatives),
    [param.dimension, param.alternatives],
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
              ? altLabel(dim, match.value)
              : match.kind === "not_seen"
                ? "Non ha visto"
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
            <span>{altLabel(dim, alt)}</span>
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
          <span>Non ha visto</span>
        </button>
      </div>

      {speech && (
        <button
          type="button"
          className="vd-confirm"
          onClick={confirmProposal}
          disabled={!hasProposal}
        >
          Conferma «{proposedNotSeen ? "Non ha visto" : proposedValue ? altLabel(dim, proposedValue) : "—"}» (Invio)
        </button>
      )}

      <button type="button" className="vd-repeat" onClick={onRepeat}>
        Ripeti <kbd>R</kbd>
      </button>

      <button type="button" className="vd-cancel" onClick={onCancel}>
        Interrompi (Esc)
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
  let hint: string;
  if (status === "unsupported") hint = "Riconoscimento vocale non disponibile in questo browser.";
  else if (status === "error") hint = "Errore microfono / riconoscimento.";
  else if (status === "loading") hint = "Avvio microfono…";
  else if (status === "listening") hint = "In ascolto…";
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

function altLabel(dimension: string, value: string): string {
  if (dimension === "color") return colorLabel(value);
  if (dimension === "shape") return shapeLabel(value);
  return value;
}
