import { useEffect, useMemo, useRef, useState } from "react";
import type {
  DiscriminationTrial,
  PresentedStimulus,
  VisualDiscriminationExercise,
} from "../../types/session";
import {
  buildDiscriminationTrials,
  type DiscriminationTrialParam,
} from "./engine";
import { colorLabel, shapeLabel, sideLabel } from "./labels";

type Config = VisualDiscriminationExercise["config"];

export type EngineResult = {
  trials: DiscriminationTrial[];
  started_at: string;
  ended_at: string;
  duration_ms: number;
};

type Phase = "instructions" | "iti" | "flash" | "response" | "done";

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

  const [trialIdx, setTrialIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("instructions");

  const startedAtRef = useRef<string>("");
  const startedPerfRef = useRef<number>(0);
  const flashStartRef = useRef<number>(0);
  const flashEndRef = useRef<number>(0);
  const trialsOutRef = useRef<DiscriminationTrial[]>([]);

  const cur = params[trialIdx];

  // iti → flash
  useEffect(() => {
    if (phase !== "iti" || !cur) return;
    const id = setTimeout(() => {
      flashStartRef.current = performance.now();
      setPhase("flash");
    }, cur.iti_ms);
    return () => clearTimeout(id);
  }, [phase, cur]);

  // flash → response
  useEffect(() => {
    if (phase !== "flash" || !cur) return;
    const id = setTimeout(() => {
      flashEndRef.current = performance.now();
      setPhase("response");
    }, cur.exposure_ms);
    return () => clearTimeout(id);
  }, [phase, cur]);

  // Esc cancels the session.
  useEffect(() => {
    if (phase === "instructions" || phase === "done") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, onCancel]);

  const start = () => {
    startedAtRef.current = new Date().toISOString();
    startedPerfRef.current = performance.now();
    setPhase("iti");
  };

  // guess === null means the patient did not see the stimulus.
  const submit = (guess: string | null) => {
    if (!cur) return;
    const rt_ms = performance.now() - flashEndRef.current;
    const seen = guess !== null;
    const trial: DiscriminationTrial = {
      trial_id: cur.trial_id,
      t_start_ms: Math.round(flashStartRef.current - startedPerfRef.current),
      t_end_ms: Math.round(flashEndRef.current - startedPerfRef.current),
      stimuli: [cur.stimulus],
      dimension: cur.dimension,
      expected_response: cur.expected,
      response: {
        given: seen,
        value: seen ? guess : undefined,
        rt_ms: Math.round(rt_ms),
        aware: seen,
      },
      correct: seen ? guess === cur.expected : false,
    };
    trialsOutRef.current.push(trial);

    if (trialIdx + 1 >= params.length) {
      onComplete({
        trials: trialsOutRef.current,
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

  return (
    <div className="tach-host" style={{ background: config.background_color }}>
      <Fixation config={config} />
      {phase === "flash" && <StimulusFlash stim={cur.stimulus} />}
      <div className="tach-tiny-counter" aria-live="polite">
        {trialIdx + 1} / {params.length}
      </div>
      {phase === "response" && (
        <ResponsePanel
          key={cur.trial_id}
          param={cur}
          onSubmit={submit}
          onCancel={onCancel}
        />
      )}
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
        : "da che lato è apparso lo stimolo";
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

function ResponsePanel({
  param,
  onSubmit,
  onCancel,
}: {
  param: DiscriminationTrialParam;
  onSubmit: (guess: string | null) => void;
  onCancel: () => void;
}) {
  const dim = param.dimension;
  const prompt =
    dim === "color"
      ? "Che colore ha indicato il paziente?"
      : dim === "shape"
        ? "Che forma ha indicato il paziente?"
        : "Da che lato ha indicato il paziente?";

  return (
    <div className="tach-panel-slide is-visible vd-response-panel">
      <div className="vd-response-prompt">{prompt}</div>
      <div className="vd-response-options">
        {param.alternatives.map((alt) => (
          <button
            key={alt}
            type="button"
            className="vd-option"
            onClick={() => onSubmit(alt)}
          >
            <AltGlyph dimension={dim} value={alt} />
            <span>{altLabel(dim, alt)}</span>
          </button>
        ))}
        <button
          type="button"
          className="vd-option vd-not-seen"
          onClick={() => onSubmit(null)}
        >
          <span className="vd-glyph vd-glyph-empty" aria-hidden>
            ✕
          </span>
          <span>Non ha visto</span>
        </button>
      </div>
      <button type="button" className="vd-cancel" onClick={onCancel}>
        Interrompi (Esc)
      </button>
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
  return sideLabel(value);
}
