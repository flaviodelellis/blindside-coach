import { useEffect, useRef, useState } from "react";
import type {
  DiscriminationStimulusKind,
  DiscriminationTrial,
  PositionMode,
  SessionFile,
  VisualDiscriminationExercise,
} from "../../types/session";
import { runDiscrimination } from "./engine";
import { computeDiscriminationSummary } from "../../lib/summary";
import { DEFAULT_COLORS } from "./stimuli";
import { HeatmapReport, type HeatmapPoint } from "../../components/HeatmapReport";
import { BackButton } from "../../components/BackButton";
import "jspsych/css/jspsych.css";
import "../tachistoscopic/Tachistoscopic.css";

type Config = VisualDiscriminationExercise["config"];
type Mode = "configure" | "running" | "results";

type FormState = {
  n_trials: number;
  exposure_ms: number;
  iti_min_ms: number;
  iti_max_ms: number;
  kinds: { shape: boolean; letter: boolean; color: boolean };
  stimulus_size_px: number;
  colors: { red: boolean; green: boolean; blue: boolean; yellow: boolean };
  position: "central" | "peripheral_left" | "peripheral_right" | "peripheral_both";
  random_seed: string;
};

const DEFAULT_FORM: FormState = {
  n_trials: 20,
  exposure_ms: 200,
  iti_min_ms: 1000,
  iti_max_ms: 1500,
  kinds: { shape: true, letter: false, color: false },
  stimulus_size_px: 80,
  colors: { red: true, green: true, blue: true, yellow: true },
  position: "peripheral_both",
  random_seed: "",
};

const COLOR_HEX: Record<keyof FormState["colors"], string> = {
  red: DEFAULT_COLORS[0],
  green: DEFAULT_COLORS[1],
  blue: DEFAULT_COLORS[2],
  yellow: DEFAULT_COLORS[3],
};

function positionFromForm(p: FormState["position"]): PositionMode {
  switch (p) {
    case "central":
      return { kind: "central" };
    case "peripheral_left":
      return { kind: "peripheral", side: "left" };
    case "peripheral_right":
      return { kind: "peripheral", side: "right" };
    case "peripheral_both":
      return { kind: "peripheral", side: "both" };
  }
}

function configFromForm(form: FormState): Config | null {
  const kinds: DiscriminationStimulusKind[] = [];
  if (form.kinds.shape) kinds.push("shape");
  if (form.kinds.letter) kinds.push("letter");
  if (form.kinds.color) kinds.push("color");
  if (kinds.length === 0) return null;

  const colors = (Object.keys(form.colors) as Array<keyof FormState["colors"]>)
    .filter((c) => form.colors[c])
    .map((c) => COLOR_HEX[c]);
  if (colors.length === 0) return null;

  const seed = form.random_seed.trim() === "" ? undefined : Number(form.random_seed);

  return {
    stimulus_kinds: kinds,
    stimulus_size_px: form.stimulus_size_px,
    stimulus_colors: colors,
    n_simultaneous: 1,
    position_mode: positionFromForm(form.position),
    exposure: { kind: "fixed", ms: form.exposure_ms },
    inter_trial_interval: {
      kind: "jitter",
      min_ms: form.iti_min_ms,
      max_ms: form.iti_max_ms,
      distribution: "uniform",
    },
    n_trials: form.n_trials,
    response_mode: "keypress",
    fixation: {
      position_norm: { x: 0.5, y: 0.5 },
      size_px: 32,
      color: "#000",
    },
    feedback: {},
    random_seed: seed,
  };
}

type RunOutcome = {
  trials: DiscriminationTrial[];
  durationMs: number;
  sessionFile: SessionFile;
};

export function VisualDiscrimination({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<Mode>("configure");
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [outcome, setOutcome] = useState<RunOutcome | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const displayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode !== "running") return;
    const display = displayRef.current;
    if (!display) return;

    const config = configFromForm(form);
    if (!config) {
      setValidationError("Seleziona almeno un tipo di stimolo e un colore.");
      setMode("configure");
      return;
    }

    void runDiscrimination(config, display).then((engineResult) => {
      const summary = computeDiscriminationSummary(
        engineResult.trials,
        engineResult.duration_ms,
      );
      const sessionFile: SessionFile = {
        schema_version: "1.0",
        session: {
          id: crypto.randomUUID(),
          patient_id: "P-DEMO",
          started_at: engineResult.started_at,
          ended_at: engineResult.ended_at,
          duration_ms: engineResult.duration_ms,
          app_version: "0.1.0",
          context: "hospital",
          screen: {
            width_px: window.innerWidth,
            height_px: window.innerHeight,
            device_pixel_ratio: window.devicePixelRatio,
          },
        },
        exercise: {
          type: "visual_discrimination",
          config,
          trials: engineResult.trials,
        },
        events: [],
        summary,
      };
      setOutcome({
        trials: engineResult.trials,
        durationMs: engineResult.duration_ms,
        sessionFile,
      });
      setMode("results");
    });
  }, [mode, form]);

  if (mode === "running") {
    return (
      <div className="tach-host">
        <div ref={displayRef} className="tach-display" />
      </div>
    );
  }

  if (mode === "results" && outcome) {
    return (
      <Results
        outcome={outcome}
        onRestart={() => {
          setOutcome(null);
          setMode("configure");
        }}
        onBack={onBack}
      />
    );
  }

  return (
    <ConfigureForm
      form={form}
      validationError={validationError}
      onChange={(next) => {
        setForm(next);
        setValidationError(null);
      }}
      onStart={() => {
        const config = configFromForm(form);
        if (!config) {
          setValidationError("Seleziona almeno un tipo di stimolo e un colore.");
          return;
        }
        setMode("running");
      }}
      onBack={onBack}
    />
  );
}

function ConfigureForm({
  form,
  validationError,
  onChange,
  onStart,
  onBack,
}: {
  form: FormState;
  validationError: string | null;
  onChange: (next: FormState) => void;
  onStart: () => void;
  onBack: () => void;
}) {
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    onChange({ ...form, [key]: value });

  return (
    <main className="page">
      <BackButton onClick={onBack} className="fixed" />
      <header>
        <h1>Discriminazione visiva</h1>
        <p className="subtitle">Configura la sessione e premi Avvia.</p>
      </header>

      <section className="form">
        <div className="form-row">
          <label htmlFor="n_trials">Numero di trial</label>
          <input
            id="n_trials"
            type="number"
            min={1}
            max={500}
            value={form.n_trials}
            onChange={(e) => update("n_trials", Number(e.target.value))}
          />
        </div>

        <div className="form-row">
          <label htmlFor="exposure_ms">Esposizione (ms)</label>
          <input
            id="exposure_ms"
            type="number"
            min={20}
            max={2000}
            step={10}
            value={form.exposure_ms}
            onChange={(e) => update("exposure_ms", Number(e.target.value))}
          />
        </div>

        <div className="form-row">
          <label>Intervallo tra trial (ms)</label>
          <div className="dual-input">
            <input
              type="number"
              min={200}
              max={5000}
              step={50}
              value={form.iti_min_ms}
              onChange={(e) => update("iti_min_ms", Number(e.target.value))}
              aria-label="min"
            />
            <span>–</span>
            <input
              type="number"
              min={200}
              max={5000}
              step={50}
              value={form.iti_max_ms}
              onChange={(e) => update("iti_max_ms", Number(e.target.value))}
              aria-label="max"
            />
          </div>
        </div>

        <div className="form-row">
          <label>Tipo di stimolo</label>
          <div className="multi-check">
            <label>
              <input
                type="checkbox"
                checked={form.kinds.shape}
                onChange={(e) => update("kinds", { ...form.kinds, shape: e.target.checked })}
              />
              Forme
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.kinds.letter}
                onChange={(e) => update("kinds", { ...form.kinds, letter: e.target.checked })}
              />
              Lettere
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.kinds.color}
                onChange={(e) => update("kinds", { ...form.kinds, color: e.target.checked })}
              />
              Colori
            </label>
          </div>
        </div>

        <div className="form-row">
          <label htmlFor="stim_size">Dimensione stimolo (px)</label>
          <input
            id="stim_size"
            type="number"
            min={20}
            max={400}
            step={5}
            value={form.stimulus_size_px}
            onChange={(e) => update("stimulus_size_px", Number(e.target.value))}
          />
        </div>

        <div className="form-row">
          <label>Colori</label>
          <div className="multi-check">
            {(Object.keys(form.colors) as Array<keyof FormState["colors"]>).map((c) => (
              <label key={c}>
                <input
                  type="checkbox"
                  checked={form.colors[c]}
                  onChange={(e) => update("colors", { ...form.colors, [c]: e.target.checked })}
                />
                <span
                  className="color-swatch"
                  style={{ background: COLOR_HEX[c] }}
                  aria-hidden
                />
                {colorLabel(c)}
              </label>
            ))}
          </div>
        </div>

        <div className="form-row">
          <label htmlFor="position">Posizione stimoli</label>
          <select
            id="position"
            value={form.position}
            onChange={(e) => update("position", e.target.value as FormState["position"])}
          >
            <option value="peripheral_both">Periferica (entrambi i lati)</option>
            <option value="peripheral_left">Periferica sinistra</option>
            <option value="peripheral_right">Periferica destra</option>
            <option value="central">Centrale</option>
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="random_seed">Random seed (opzionale)</label>
          <input
            id="random_seed"
            type="text"
            inputMode="numeric"
            placeholder="vuoto = casuale"
            value={form.random_seed}
            onChange={(e) => update("random_seed", e.target.value)}
          />
        </div>
      </section>

      {validationError && <p className="validation-error">{validationError}</p>}

      <div className="form-actions">
        <button type="button" onClick={onStart}>
          Avvia esercizio
        </button>
      </div>
    </main>
  );
}

function Results({
  outcome,
  onRestart,
  onBack,
}: {
  outcome: RunOutcome;
  onRestart: () => void;
  onBack: () => void;
}) {
  const { sessionFile } = outcome;
  const s = sessionFile.summary;

  const cfg =
    sessionFile.exercise.type === "visual_discrimination"
      ? sessionFile.exercise.config
      : null;
  const requestedMs = cfg?.exposure.kind === "fixed" ? cfg.exposure.ms : null;
  const measuredAvg =
    outcome.trials.length > 0
      ? outcome.trials.reduce((sum, t) => sum + (t.t_end_ms - t.t_start_ms), 0) /
        outcome.trials.length
      : 0;
  const meanDelta = requestedMs !== null ? measuredAvg - requestedMs : null;

  const heatmapPoints: HeatmapPoint[] = outcome.trials.flatMap((tr) =>
    tr.stimuli.map((s) => ({
      position: s.position_norm,
      correct: tr.response.given === true && tr.correct !== false,
      rt_ms: tr.response.rt_ms,
    })),
  );
  const screenAspect =
    sessionFile.session.screen.height_px > 0
      ? sessionFile.session.screen.width_px / sessionFile.session.screen.height_px
      : 16 / 9;
  const fixationNorm =
    sessionFile.exercise.type === "visual_discrimination"
      ? sessionFile.exercise.config.fixation.position_norm
      : { x: 0.5, y: 0.5 };

  const download = () => {
    const blob = new Blob([JSON.stringify(sessionFile, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-${sessionFile.session.id.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <main className="page">
      <BackButton onClick={onBack} className="fixed" />
      <header>
        <h1>Risultati</h1>
        <p className="subtitle">
          Sessione di {Math.round(outcome.durationMs / 1000)} secondi,{" "}
          {s.n_trials} trial completati.
        </p>
      </header>

      <section className="result-grid">
        <div className="metric">
          <div className="metric-label">Accuracy</div>
          <div className="metric-value">
            {s.accuracy !== undefined ? `${(s.accuracy * 100).toFixed(0)}%` : "-"}
          </div>
        </div>
        <div className="metric">
          <div className="metric-label">RT medio</div>
          <div className="metric-value">
            {s.rt_mean_ms !== undefined ? `${Math.round(s.rt_mean_ms)} ms` : "-"}
          </div>
        </div>
        <div className="metric">
          <div className="metric-label">Delta esposizione</div>
          <div className="metric-value">
            {meanDelta !== null ? `${meanDelta.toFixed(1)} ms` : "-"}
          </div>
        </div>
      </section>

      {heatmapPoints.length > 0 && (
        <HeatmapReport
          points={heatmapPoints}
          aspectRatio={screenAspect}
          fixation={fixationNorm}
        />
      )}

      {s.per_quadrant && (
        <section className="breakdown">
          <h2>Per quadrante</h2>
          <table>
            <thead>
              <tr>
                <th>Quadrante</th>
                <th>Presentati</th>
                <th>Rilevati</th>
                <th>RT medio</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(s.per_quadrant).map(([q, stats]) => (
                <tr key={q}>
                  <td>{quadrantLabel(q)}</td>
                  <td>{stats.n_presented}</td>
                  <td>{stats.n_detected}</td>
                  <td>
                    {stats.rt_mean_ms !== undefined
                      ? `${Math.round(stats.rt_mean_ms)} ms`
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <div className="form-actions">
        <button type="button" onClick={download}>
          Scarica file di sessione (JSON)
        </button>
        <button type="button" className="secondary" onClick={onRestart}>
          Nuova configurazione
        </button>
      </div>
    </main>
  );
}

function colorLabel(c: keyof FormState["colors"]): string {
  switch (c) {
    case "red":
      return "Rosso";
    case "green":
      return "Verde";
    case "blue":
      return "Blu";
    case "yellow":
      return "Giallo";
  }
}

function quadrantLabel(q: string): string {
  switch (q) {
    case "upper_left":
      return "Alto sinistra";
    case "upper_right":
      return "Alto destra";
    case "lower_left":
      return "Basso sinistra";
    case "lower_right":
      return "Basso destra";
    default:
      return q;
  }
}
