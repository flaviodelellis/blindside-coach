import { useEffect, useState } from "react";
import type {
  DiscriminationDimension,
  PositionMode,
  SessionFile,
  VisualDiscriminationExercise,
} from "../../types/session";
import { VisualDiscriminationRunner, type EngineResult } from "./Runner";
import { computeDiscriminationSummary } from "../../lib/summary";
import { DEFAULT_COLORS, SHAPES } from "./stimuli";
import { HeatmapReport, type HeatmapPoint } from "../../components/HeatmapReport";
import { ColorField } from "../../components/ColorField";
import { NumberField } from "../../components/NumberField";
import { ConfigManager } from "../../components/ConfigManager";
import { BackButton } from "../../components/BackButton";
import { LanguageToggle, useT } from "../../i18n";
import type { PreviewPoint } from "../../components/AppearancePreview";
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
  response_input: "manual" | "speech";
  random_seed: string;
};

export type VDFormState = FormState;

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
  response_input: "manual",
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

/** Returns an i18n error key if the form is not ready, otherwise null. */
function validateForm(form: FormState): string | null {
  if (form.dimension === "color" && selectedColorCount(form) < 2) {
    return "vd.validate.colors";
  }
  if (
    form.dimension !== "position" &&
    form.position === "custom_grid" &&
    gridToPositionMode(form.position_grid) === null
  ) {
    return "vd.validate.grid";
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
    response_input: form.response_input,
    speech_lang: "it-IT",
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

export function VisualDiscrimination({
  onBack,
  initialForm,
}: {
  onBack: () => void;
  initialForm?: FormState;
}) {
  const [mode, setMode] = useState<Mode>("configure");
  const [form, setForm] = useState<FormState>(
    initialForm ? { ...DEFAULT_FORM, ...initialForm } : DEFAULT_FORM,
  );
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
  const t = useT();
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    onChange({ ...form, [key]: value });

  return (
    <>
      <header className="config-topbar">
        <div className="config-topbar-left">
          <button
            type="button"
            className="config-back"
            onClick={onBack}
            aria-label={t("common.home")}
          >
            {t("common.home")}
          </button>
        </div>
        <LanguageToggle />
      </header>
      <main className="page page-config">
        <div className="form-layout">
          <div className="form-main">
            <section className="form">
              <section className="form-section">
                <h2 className="form-section-title">{t("vd.section.task")}</h2>
                <div className="form-row">
                  <label htmlFor="dimension">{t("vd.field.dimension")}</label>
                  <select
                    id="dimension"
                    value={form.dimension}
                    onChange={(e) =>
                      update("dimension", e.target.value as DiscriminationDimension)
                    }
                  >
                    <option value="color">{t("vd.dim.color")}</option>
                    <option value="shape">{t("vd.dim.shape")}</option>
                    <option value="position">{t("vd.dim.position")}</option>
                  </select>
                </div>
              </section>

              <section className="form-section">
                <h2 className="form-section-title">{t("vd.section.response")}</h2>
                <div className="form-row">
                  <label htmlFor="response_input">
                    {t("vd.field.response_input")}
                  </label>
                  <select
                    id="response_input"
                    value={form.response_input}
                    onChange={(e) =>
                      update(
                        "response_input",
                        e.target.value as FormState["response_input"],
                      )
                    }
                  >
                    <option value="manual">{t("vd.response.manual")}</option>
                    <option value="speech">{t("vd.response.speech")}</option>
                  </select>
                </div>
                {form.response_input === "speech" && (
                  <p className="form-hint">
                    {t("vd.hint.speech", {
                      what: t(`vd.what.${form.dimension}`),
                    })}
                  </p>
                )}
              </section>

              <section className="form-section">
                <h2 className="form-section-title">{t("vd.section.stimuli")}</h2>
                <div className="form-row">
                  <label htmlFor="stim_size">{t("vd.field.stim_size")}</label>
                  <NumberField
                    id="stim_size"
                    min={20}
                    max={400}
                    step={5}
                    value={form.stimulus_size_px}
                    onChange={(n) => update("stimulus_size_px", n)}
                  />
                </div>

                {form.dimension === "color" && (
                  <div className="form-row full">
                    <label>{t("vd.field.colors")}</label>
                    <div className="multi-check">
                      {(
                        Object.keys(form.colors) as Array<
                          keyof FormState["colors"]
                        >
                      ).map((c) => (
                        <label key={c}>
                          <input
                            type="checkbox"
                            checked={form.colors[c]}
                            onChange={(e) =>
                              update("colors", {
                                ...form.colors,
                                [c]: e.target.checked,
                              })
                            }
                          />
                          <span
                            className="color-swatch"
                            style={{ background: COLOR_HEX[c] }}
                            aria-hidden
                          />
                          {t(`vd.color.${c}`)}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {form.dimension !== "position" && (
                <section className="form-section">
                  <h2 className="form-section-title">
                    {t("vd.section.position")}
                  </h2>
                  <div className="form-row">
                    <label htmlFor="position">{t("vd.field.position")}</label>
                    <select
                      id="position"
                      value={form.position}
                      onChange={(e) =>
                        update("position", e.target.value as PositionChoice)
                      }
                    >
                      <option value="peripheral_both">
                        {t("vd.pos.peripheral_both")}
                      </option>
                      <option value="peripheral_left">
                        {t("vd.pos.peripheral_left")}
                      </option>
                      <option value="peripheral_right">
                        {t("vd.pos.peripheral_right")}
                      </option>
                      <option value="central">{t("vd.pos.central")}</option>
                      <option value="custom_grid">
                        {t("vd.pos.custom_grid")}
                      </option>
                    </select>
                  </div>

                  {form.position === "custom_grid" && (
                    <div className="form-row full">
                      <label>{t("vd.field.allowed_regions")}</label>
                      <PositionGridSelector
                        grid={form.position_grid}
                        onChange={(g) => update("position_grid", g)}
                        fixationNorm={{ x: 0.5, y: 0.5 }}
                      />
                    </div>
                  )}
                </section>
              )}

              <section className="form-section">
                <h2 className="form-section-title">
                  {t("vd.section.appearance")}
                </h2>
                <ColorField
                  id="vd_background_color"
                  label={t("vd.field.background_color")}
                  value={form.background_color}
                  onChange={(c) => update("background_color", c)}
                />
                <ColorField
                  id="vd_fixation_color"
                  label={t("vd.field.fixation_color")}
                  value={form.fixation_color}
                  onChange={(c) => update("fixation_color", c)}
                />
              </section>

              <section className="form-section">
                <h2 className="form-section-title">{t("vd.section.timing")}</h2>
                <div className="form-row">
                  <label htmlFor="n_trials">{t("vd.field.n_trials")}</label>
                  <NumberField
                    id="n_trials"
                    min={1}
                    max={500}
                    value={form.n_trials}
                    onChange={(n) => update("n_trials", n)}
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="exposure_ms">{t("vd.field.exposure")}</label>
                  <NumberField
                    id="exposure_ms"
                    min={50}
                    max={2000}
                    step={50}
                    value={form.exposure_ms}
                    onChange={(n) => update("exposure_ms", n)}
                  />
                </div>
                <div className="form-row full">
                  <label>{t("vd.field.iti")}</label>
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
              </section>

              <details className="form-section form-section-collapsible">
                <summary className="form-section-title">
                  {t("vd.section.advanced")}
                </summary>
                <div className="form-row full">
                  <label htmlFor="random_seed">
                    {t("vd.field.random_seed")}
                  </label>
                  <input
                    id="random_seed"
                    type="text"
                    inputMode="numeric"
                    placeholder={t("vd.placeholder.random_seed")}
                    value={form.random_seed}
                    onChange={(e) => update("random_seed", e.target.value)}
                  />
                </div>
              </details>
            </section>

            {validationError && (
              <div className="validation-error">{t(validationError)}</div>
            )}
          </div>

          <aside className="form-summary">
            <VDLiveSummary
              form={form}
              onStart={onStart}
              onLoad={(f) => onChange({ ...DEFAULT_FORM, ...f })}
            />
          </aside>
        </div>
      </main>
    </>
  );
}

/** Representative stimulus positions (normalized) for the preview. */
function previewPoints(form: FormState): PreviewPoint[] {
  if (form.dimension === "position") {
    return [
      { x: 0.25, y: 0.5 },
      { x: 0.75, y: 0.5 },
    ];
  }
  switch (form.position) {
    case "central":
      return [{ x: 0.5, y: 0.5 }];
    case "peripheral_left":
      return [{ x: 0.2, y: 0.5 }];
    case "peripheral_right":
      return [{ x: 0.8, y: 0.5 }];
    case "peripheral_both":
      return [
        { x: 0.18, y: 0.5 },
        { x: 0.82, y: 0.5 },
      ];
    case "custom_grid": {
      const { rows, cols, cells } = form.position_grid;
      const pts: PreviewPoint[] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (cells[r][c] > 0) {
            pts.push({ x: (c + 0.5) / cols, y: (r + 0.5) / rows });
          }
        }
      }
      return pts.length > 0 ? pts : [{ x: 0.5, y: 0.5 }];
    }
  }
}

function VDLiveSummary({
  form,
  onStart,
  onLoad,
}: {
  form: FormState;
  onStart: () => void;
  onLoad: (form: FormState) => void;
}) {
  const t = useT();

  const stimuliText =
    form.dimension === "color"
      ? `${t("vd.dim.color")} · ${t("vd.summary.stimuli.color", {
          n: selectedColorCount(form),
        })}`
      : form.dimension === "shape"
        ? `${t("vd.dim.shape")} · ${t("vd.summary.stimuli.shape", {
            n: SHAPES.length,
          })}`
        : t("vd.summary.stimuli.position");

  let positionText: string;
  if (form.position === "custom_grid") {
    const active = form.position_grid.cells.flat().filter((v) => v > 0).length;
    positionText =
      active === 0
        ? t("vd.summary.pos.custom_empty")
        : t("vd.summary.pos.custom", { n: active });
  } else {
    positionText = t(`vd.pos.${form.position}`);
  }

  const exposureLine = t("vd.summary.timing.exposure", { ms: form.exposure_ms });
  const itiLine =
    form.iti_min_ms === form.iti_max_ms
      ? t("vd.summary.timing.iti_fixed", { ms: form.iti_min_ms })
      : t("vd.summary.timing.iti_range", {
          min: form.iti_min_ms,
          max: form.iti_max_ms,
        });

  return (
    <div className="summary-card">
      <div className="summary-eyebrow">{t("vd.summary.live")}</div>
      <VDStimulusPreview form={form} label={t("vd.summary.preview")} />
      <dl className="summary-rows">
        <div>
          <dt>{t("vd.summary.response")}</dt>
          <dd>
            {form.response_input === "speech"
              ? t("vd.response.speech")
              : t("vd.response.manual")}
          </dd>
        </div>
        <div>
          <dt>{t("vd.summary.stimuli")}</dt>
          <dd>{stimuliText}</dd>
        </div>
        {form.dimension !== "position" && (
          <div>
            <dt>{t("vd.summary.position")}</dt>
            <dd>{positionText}</dd>
          </div>
        )}
        <div>
          <dt>{t("vd.summary.timing")}</dt>
          <dd>
            {exposureLine}
            <br />
            <span className="dim">{itiLine}</span>
          </dd>
        </div>
        <div>
          <dt>{t("vd.summary.trials")}</dt>
          <dd>{form.n_trials}</dd>
        </div>
      </dl>
      <button type="button" className="summary-start" onClick={onStart}>
        {t("common.startExercise")} →
      </button>
      <ConfigManager
        exerciseType="visual_discrimination"
        current={form}
        onLoad={onLoad}
      />
    </div>
  );
}

/** The representative stimulus colour shown in the preview. */
function representativeColor(form: FormState): string {
  return (
    (Object.keys(form.colors) as Array<keyof FormState["colors"]>)
      .filter((c) => form.colors[c])
      .map((c) => COLOR_HEX[c])[0] ?? DEFAULT_COLORS[0]
  );
}

/**
 * Scaled-down mock of the discrimination screen with a sample stimulus. Click it
 * to blow it up to a true full-screen, real-pixel-size representation.
 */
function VDStimulusPreview({ form, label }: { form: FormState; label: string }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);

  const VIEW_W = 160;
  const VIEW_H = 90;
  const SCALE = VIEW_W / 1366;
  const size = Math.max(5, form.stimulus_size_px * SCALE);
  const points = previewPoints(form);
  const firstColor = representativeColor(form);
  const crossSize = Math.max(4, 32 * SCALE);

  return (
    <>
      <button
        type="button"
        className="appearance-preview-trigger"
        onClick={() => setExpanded(true)}
        aria-label={t("preview.expand")}
        title={t("preview.expand")}
      >
        <svg
          className="appearance-preview"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          role="img"
          aria-label={label}
          preserveAspectRatio="xMidYMid slice"
        >
          <rect
            x={0}
            y={0}
            width={VIEW_W}
            height={VIEW_H}
            fill={form.background_color}
          />
          {points.map((p, i) => (
            <PreviewGlyph
              key={i}
              dimension={form.dimension}
              cx={p.x * VIEW_W}
              cy={p.y * VIEW_H}
              size={size}
              color={firstColor}
              stroke={form.fixation_color}
            />
          ))}
          <text
            x={VIEW_W / 2}
            y={VIEW_H / 2}
            fill={form.fixation_color}
            fontSize={crossSize}
            fontFamily="monospace"
            fontWeight={700}
            textAnchor="middle"
            dominantBaseline="central"
          >
            +
          </text>
        </svg>
        <span className="appearance-preview-zoom" aria-hidden="true">
          ⤢
        </span>
      </button>

      {expanded && (
        <VDStimulusFullscreen form={form} onClose={() => setExpanded(false)} />
      )}
    </>
  );
}

/** Full-screen, real-pixel-size representation of the stimulus screen. */
function VDStimulusFullscreen({
  form,
  onClose,
}: {
  form: FormState;
  onClose: () => void;
}) {
  const t = useT();
  const points = previewPoints(form);
  const firstColor = representativeColor(form);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="appearance-fullscreen"
      style={{ background: form.background_color }}
      role="dialog"
      aria-modal="true"
      aria-label={t("preview.expand")}
      onClick={onClose}
    >
      {points.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${p.x * 100}%`,
            top: `${p.y * 100}%`,
            transform: "translate(-50%, -50%)",
            width: form.stimulus_size_px,
            height: form.stimulus_size_px,
            lineHeight: 0,
          }}
        >
          <StimGlyphSvg
            dimension={form.dimension}
            color={firstColor}
            stroke={form.fixation_color}
          />
        </div>
      ))}
      <span
        className="appearance-fs-cross"
        style={{ color: form.fixation_color, fontSize: 32 }}
      >
        +
      </span>
      <button type="button" className="appearance-fs-close" onClick={onClose}>
        ✕ {t("preview.close")}
      </button>
    </div>
  );
}

/** Self-contained glyph SVG (100×100 viewBox) used at full pixel size. */
function StimGlyphSvg({
  dimension,
  color,
  stroke,
}: {
  dimension: DiscriminationDimension;
  color: string;
  stroke: string;
}) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 100">
      {dimension === "color" ? (
        <circle cx={50} cy={50} r={48} fill={color} />
      ) : dimension === "shape" ? (
        <polygon
          points="50,6 94,94 6,94"
          fill="#16171d"
          stroke={stroke}
          strokeWidth={4}
        />
      ) : (
        <rect
          x={6}
          y={6}
          width={88}
          height={88}
          fill="#16171d"
          stroke={stroke}
          strokeWidth={4}
        />
      )}
    </svg>
  );
}

function PreviewGlyph({
  dimension,
  cx,
  cy,
  size,
  color,
  stroke,
}: {
  dimension: DiscriminationDimension;
  cx: number;
  cy: number;
  size: number;
  color: string;
  stroke: string;
}) {
  const r = size / 2;
  if (dimension === "color") {
    return <circle cx={cx} cy={cy} r={r} fill={color} />;
  }
  // shape / position: a neutral glyph with a thin outline so it stays visible
  // on any background.
  const fill = "#16171d";
  const sw = Math.max(0.5, r * 0.12);
  if (dimension === "shape") {
    return (
      <polygon
        points={`${cx},${cy - r} ${cx + r},${cy + r} ${cx - r},${cy + r}`}
        fill={fill}
        stroke={stroke}
        strokeWidth={sw}
      />
    );
  }
  return (
    <rect
      x={cx - r}
      y={cy - r}
      width={r * 2}
      height={r * 2}
      fill={fill}
      stroke={stroke}
      strokeWidth={sw}
    />
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
