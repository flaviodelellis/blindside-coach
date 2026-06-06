import { useState } from "react";
import type {
  DiscriminationDimension,
  PositionMode,
  SessionFile,
  VisualDiscriminationExercise,
} from "../../types/session";
import { VisualDiscriminationRunner, type EngineResult } from "./Runner";
import { computeDiscriminationSummary } from "../../lib/summary";
import { DEFAULT_COLORS } from "./stimuli";
import { HeatmapReport, type HeatmapPoint } from "../../components/HeatmapReport";
import { ColorField } from "../../components/ColorField";
import { NumberField } from "../../components/NumberField";
import { BackButton } from "../../components/BackButton";
import {
  PositionGridSelector,
  makeEmptyGrid,
  gridToPositionMode,
  type GridState,
} from "../../components/PositionGridSelector";
import "../tachistoscopic/Tachistoscopic.css";
import "./VisualDiscrimination.css";

type Config = VisualDiscriminationExercise["config"];
type Mode = "configure" | "running" | "results";

type PositionChoice =
  | "central"
  | "peripheral_left"
  | "peripheral_right"
  | "peripheral_both"
  | "custom_grid";

type FormState = {
  n_trials: number;
  exposure_ms: number;
  iti_min_ms: number;
  iti_max_ms: number;
  dimension: DiscriminationDimension;
  stimulus_size_px: number;
  colors: { red: boolean; green: boolean; blue: boolean; yellow: boolean };
  background_color: string;
  fixation_color: string;
  position: PositionChoice;
  position_grid: GridState;
  random_seed: string;
};

const DEFAULT_FORM: FormState = {
  n_trials: 5,
  exposure_ms: 250,
  iti_min_ms: 1000,
  iti_max_ms: 1500,
  dimension: "color",
  stimulus_size_px: 80,
  colors: { red: true, green: true, blue: true, yellow: true },
  background_color: "#000000",
  fixation_color: "#ffffff",
  position: "peripheral_both",
  position_grid: makeEmptyGrid(5, 5),
  random_seed: "",
};

const COLOR_HEX: Record<keyof FormState["colors"], string> = {
  red: DEFAULT_COLORS[0],
  green: DEFAULT_COLORS[1],
  blue: DEFAULT_COLORS[2],
  yellow: DEFAULT_COLORS[3],
};

function positionFromForm(form: FormState): PositionMode {
  switch (form.position) {
    case "central":
      return { kind: "central" };
    case "peripheral_left":
      return { kind: "peripheral", side: "left" };
    case "peripheral_right":
      return { kind: "peripheral", side: "right" };
    case "peripheral_both":
      return { kind: "peripheral", side: "both" };
    case "custom_grid":
      return gridToPositionMode(form.position_grid) ?? { kind: "peripheral", side: "both" };
  }
}

function selectedColorCount(form: FormState): number {
  return (Object.keys(form.colors) as Array<keyof FormState["colors"]>).filter(
    (c) => form.colors[c],
  ).length;
}

/** Returns an error message if the form is not ready, otherwise null. */
function validateForm(form: FormState): string | null {
  if (form.dimension === "color" && selectedColorCount(form) < 2) {
    return "Seleziona almeno due colori da discriminare.";
  }
  if (
    form.dimension !== "position" &&
    form.position === "custom_grid" &&
    gridToPositionMode(form.position_grid) === null
  ) {
    return "Seleziona almeno una cella nella griglia delle posizioni.";
  }
  return null;
}

function configFromForm(form: FormState): Config {
  const colors = (Object.keys(form.colors) as Array<keyof FormState["colors"]>)
    .filter((c) => form.colors[c])
    .map((c) => COLOR_HEX[c]);

  const seed = form.random_seed.trim() === "" ? undefined : Number(form.random_seed);

  const kinds =
    form.dimension === "shape"
      ? (["shape"] as const)
      : (["color"] as const);

  return {
    discrimination_dimension: form.dimension,
    stimulus_kinds: [...kinds],
    stimulus_size_px: form.stimulus_size_px,
    stimulus_colors: colors.length > 0 ? colors : [...DEFAULT_COLORS],
    background_color: form.background_color,
    n_simultaneous: 1,
    position_mode: positionFromForm(form),
    exposure: { kind: "fixed", ms: form.exposure_ms },
    inter_trial_interval: {
      kind: "jitter",
      min_ms: form.iti_min_ms,
      max_ms: form.iti_max_ms,
      distribution: "uniform",
    },
    n_trials: form.n_trials,
    response_mode: "click",
    response_collector: "clinician",
    awareness_scale: "binary",
    fixation: {
      position_norm: { x: 0.5, y: 0.5 },
      size_px: 32,
      color: form.fixation_color,
    },
    feedback: {},
    random_seed: seed,
  };
}

type RunOutcome = {
  durationMs: number;
  sessionFile: SessionFile;
};

export function VisualDiscrimination({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<Mode>("configure");
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [runConfig, setRunConfig] = useState<Config | null>(null);
  const [outcome, setOutcome] = useState<RunOutcome | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleComplete = (config: Config, engineResult: EngineResult) => {
    const summary = computeDiscriminationSummary(
      engineResult.trials,
      engineResult.duration_ms,
      config,
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
    setOutcome({ durationMs: engineResult.duration_ms, sessionFile });
    setMode("results");
  };

  if (mode === "running" && runConfig) {
    return (
      <VisualDiscriminationRunner
        config={runConfig}
        onComplete={(r) => handleComplete(runConfig, r)}
        onCancel={() => setMode("configure")}
      />
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
        const error = validateForm(form);
        if (error) {
          setValidationError(error);
          return;
        }
        setRunConfig(configFromForm(form));
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
      </header>

      <section className="form">
        <div className="form-row">
          <label htmlFor="dimension">Cosa deve discriminare il paziente</label>
          <select
            id="dimension"
            value={form.dimension}
            onChange={(e) =>
              update("dimension", e.target.value as DiscriminationDimension)
            }
          >
            <option value="color">Colore</option>
            <option value="shape">Forma</option>
            <option value="position">Posizione (sinistra / destra)</option>
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="n_trials">Numero di tentativi</label>
          <NumberField
            id="n_trials"
            min={1}
            max={500}
            value={form.n_trials}
            onChange={(n) => update("n_trials", n)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="exposure_ms">Esposizione (ms)</label>
          <NumberField
            id="exposure_ms"
            min={50}
            max={2000}
            step={50}
            value={form.exposure_ms}
            onChange={(n) => update("exposure_ms", n)}
          />
        </div>

        <div className="form-row">
          <label>Intervallo tra tentativi (ms)</label>
          <div className="dual-input">
            <NumberField
              min={200}
              max={5000}
              step={50}
              value={form.iti_min_ms}
              onChange={(n) => update("iti_min_ms", n)}
              aria-label="min"
            />
            <span>–</span>
            <NumberField
              min={200}
              max={5000}
              step={50}
              value={form.iti_max_ms}
              onChange={(n) => update("iti_max_ms", n)}
              aria-label="max"
            />
          </div>
        </div>

        <div className="form-row">
          <label htmlFor="stim_size">Dimensione stimolo (px)</label>
          <NumberField
            id="stim_size"
            min={20}
            max={400}
            step={5}
            value={form.stimulus_size_px}
            onChange={(n) => update("stimulus_size_px", n)}
          />
        </div>

        <ColorField
          id="vd_background_color"
          label="Colore di sfondo"
          value={form.background_color}
          onChange={(c) => update("background_color", c)}
        />

        <ColorField
          id="vd_fixation_color"
          label="Colore punto di fissazione"
          value={form.fixation_color}
          onChange={(c) => update("fixation_color", c)}
        />

        {form.dimension === "color" && (
          <div className="form-row">
            <label>Colori da discriminare</label>
            <div className="multi-check">
              {(Object.keys(form.colors) as Array<keyof FormState["colors"]>).map(
                (c) => (
                  <label key={c}>
                    <input
                      type="checkbox"
                      checked={form.colors[c]}
                      onChange={(e) =>
                        update("colors", { ...form.colors, [c]: e.target.checked })
                      }
                    />
                    <span
                      className="color-swatch"
                      style={{ background: COLOR_HEX[c] }}
                      aria-hidden
                    />
                    {colorName(c)}
                  </label>
                ),
              )}
            </div>
          </div>
        )}

        {form.dimension !== "position" && (
          <>
            <div className="form-row">
              <label htmlFor="position">Posizione stimoli</label>
              <select
                id="position"
                value={form.position}
                onChange={(e) =>
                  update("position", e.target.value as PositionChoice)
                }
              >
                <option value="peripheral_both">Periferica (entrambi i lati)</option>
                <option value="peripheral_left">Periferica sinistra</option>
                <option value="peripheral_right">Periferica destra</option>
                <option value="central">Centrale</option>
                <option value="custom_grid">Griglia personalizzata</option>
              </select>
            </div>

            {form.position === "custom_grid" && (
              <div className="form-row full">
                <label>Zone consentite</label>
                <PositionGridSelector
                  grid={form.position_grid}
                  onChange={(g) => update("position_grid", g)}
                  fixationNorm={{ x: 0.5, y: 0.5 }}
                />
              </div>
            )}
          </>
        )}

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
  const bs = s.blindsight;

  const trials =
    sessionFile.exercise.type === "visual_discrimination"
      ? sessionFile.exercise.trials
      : [];

  const heatmapPoints: HeatmapPoint[] = trials.flatMap((tr) =>
    tr.stimuli.map((st) => ({
      position: st.position_norm,
      correct: tr.correct === true,
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

  const pct = (v?: number) => (v !== undefined ? `${(v * 100).toFixed(0)}%` : "-");

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
          {s.n_trials} tentativi completati.
        </p>
      </header>

      <section className="result-grid">
        {bs && (
          <div className="metric">
            <div className="metric-label">Rilevati</div>
            <div className="metric-value">
              {pct(s.n_trials > 0 ? bs.n_aware / s.n_trials : undefined)}
            </div>
            <div className="metric-sub">
              {bs.n_aware}/{s.n_trials} visti
            </div>
          </div>
        )}
        <div className="metric metric-highlight">
          <div className="metric-label">Identificazione</div>
          <div className="metric-value">{pct(bs?.accuracy_aware)}</div>
          {bs && (
            <div className="metric-sub">
              corrette tra i rilevati · caso {pct(bs.chance_level)}
            </div>
          )}
        </div>
        <div className="metric">
          <div className="metric-label">RT medio</div>
          <div className="metric-value">
            {s.rt_mean_ms !== undefined ? `${Math.round(s.rt_mean_ms)} ms` : "-"}
          </div>
        </div>
      </section>

      {bs && (
        <p className="form-hint">
          <b>Rilevati</b>: quante volte il paziente ha visto lo stimolo.{" "}
          <b>Identificazione</b>: tra i rilevati, quante volte ha indicato la
          risposta corretta (livello di caso {pct(bs.chance_level)}). La heatmap
          mostra dove l'identificazione è corretta nel campo visivo.
        </p>
      )}

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
                <th>Corrette</th>
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

function colorName(c: keyof FormState["colors"]): string {
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
