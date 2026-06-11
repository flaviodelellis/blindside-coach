import { useEffect, useState, type ReactNode } from "react";
import type {
  DiscriminationDimension,
  PositionMode,
  SessionFile,
  VisualDiscriminationExercise,
} from "../../types/session";
import type { EngineResult } from "./Runner";
import { computeDiscriminationSummary } from "../../lib/summary";
import { DEFAULT_COLORS, SHAPES } from "./stimuli";
import { HeatmapReport, type HeatmapPoint } from "../../components/HeatmapReport";
import { NumberField } from "../../components/NumberField";
import { ConfigManager } from "../../components/ConfigManager";
import { buildPrescriptionLink } from "../../lib/prescription";
import { BackButton } from "../../components/BackButton";
import { useT } from "../../i18n";
import type { PreviewPoint } from "../../components/AppearancePreview";
import {
  makeEmptyGrid,
  gridToPositionMode,
  type GridState,
} from "../../components/PositionGridSelector";
import {
  PositionSection,
  AppearanceSection,
  TimingSection,
  AdvancedSection,
} from "../shared/config/sections";
import "../tachistoscopic/Tachistoscopic.css";
import "./VisualDiscrimination.css";

type Config = VisualDiscriminationExercise["config"];

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
  /** Language the patient answers in — drives speech recognition. */
  speech_language: "it" | "en";
  random_seed: string;
};

export type VDFormState = FormState;

export const VD_DEFAULT_FORM: FormState = {
  n_trials: 5,
  exposure_ms: 250,
  iti_min_ms: 1000,
  iti_max_ms: 1500,
  dimension: "shape_color",
  stimulus_size_px: 80,
  colors: { red: true, green: true, blue: true, yellow: true },
  background_color: "#000000",
  fixation_color: "#ffffff",
  position: "peripheral_both",
  position_grid: makeEmptyGrid(5, 5),
  // Discriminazione is always voice + clinician confirmation (manual fallback).
  response_input: "speech",
  speech_language: "it",
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
  // Combined and colour tasks need at least two colours to be a real choice.
  if (form.dimension !== "shape" && selectedColorCount(form) < 2) {
    return "vd.validate.colors";
  }
  if (
    form.position === "custom_grid" &&
    gridToPositionMode(form.position_grid) === null
  ) {
    return "vd.validate.grid";
  }
  return null;
}

export function configFromForm(form: FormState): Config {
  const colors = (Object.keys(form.colors) as Array<keyof FormState["colors"]>)
    .filter((c) => form.colors[c])
    .map((c) => COLOR_HEX[c]);

  const seed = form.random_seed.trim() === "" ? undefined : Number(form.random_seed);

  const kinds =
    form.dimension === "shape"
      ? (["shape"] as const)
      : form.dimension === "shape_color"
        ? (["shape", "color"] as const)
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
    speech_lang: form.speech_language === "en" ? "en-US" : "it-IT",
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

export type RunOutcome = {
  durationMs: number;
  sessionFile: SessionFile;
};

/** Run the form through validation; returns an i18n error key or null. */
export { validateForm as vdValidateForm };

/** Assemble the downloadable session file from a completed run. */
export function buildVDSessionFile(
  config: Config,
  engineResult: EngineResult,
): RunOutcome {
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
  return { durationMs: engineResult.duration_ms, sessionFile };
}

/**
 * Discrimination-specific config-form body (everything below the Stimolo×Compito
 * selector): response input, stimuli, position, appearance, timing, advanced.
 * The dimension (forma/colore/posizione) is driven by the unified selector's
 * Stimolo, so the old "Compito" section is gone — `form.dimension` is set by the
 * parent.
 */
export function VDConfigBody({
  form,
  onChange,
  typeSelector,
  validationError,
}: {
  form: FormState;
  onChange: (next: FormState) => void;
  typeSelector: ReactNode;
  validationError: string | null;
}) {
  const t = useT();
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    onChange({ ...form, [key]: value });

  return (
    <div className="form-main">
      <section className="form">
        {typeSelector}
        {form.response_input === "speech" && (
          <>
            <p className="form-hint">
              {t("vd.hint.speech", { what: t(`vd.what.${form.dimension}`) })}
            </p>
            <div className="form-row">
              <label htmlFor="speech_language">
                {t("vd.field.speech_language")}
              </label>
              <select
                id="speech_language"
                value={form.speech_language}
                onChange={(e) =>
                  update(
                    "speech_language",
                    e.target.value as FormState["speech_language"],
                  )
                }
              >
                <option value="it">{t("vd.speech_lang.it")}</option>
                <option value="en">{t("vd.speech_lang.en")}</option>
              </select>
            </div>
          </>
        )}

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

                {form.dimension !== "shape" && (
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

              <PositionSection
                value={form.position}
                grid={form.position_grid}
                includeCentral
                onValueChange={(v) => update("position", v)}
                onGridChange={(g) => update("position_grid", g)}
              />

              <AppearanceSection
                backgroundColor={form.background_color}
                fixationColor={form.fixation_color}
                onBackgroundChange={(c) => update("background_color", c)}
                onFixationChange={(c) => update("fixation_color", c)}
              />

              <TimingSection
                nTrials={form.n_trials}
                exposureMs={form.exposure_ms}
                itiMinMs={form.iti_min_ms}
                itiMaxMs={form.iti_max_ms}
                itiBounds={{ min: 200, max: 5000, step: 50 }}
                onNTrialsChange={(n) => update("n_trials", n)}
                onExposureChange={(n) => update("exposure_ms", n)}
                onItiMinChange={(n) => update("iti_min_ms", n)}
                onItiMaxChange={(n) => update("iti_max_ms", n)}
              />

              <AdvancedSection
                randomSeed={form.random_seed}
                onRandomSeedChange={(v) => update("random_seed", v)}
              />
            </section>

            {validationError && (
              <div className="validation-error">{t(validationError)}</div>
            )}
    </div>
  );
}

/** Representative stimulus positions (normalized) for the preview. */
function previewPoints(form: FormState): PreviewPoint[] {
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

export function VDLiveSummary({
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
        : t("vd.summary.stimuli.shape_color", {
            shapes: SHAPES.length,
            colors: selectedColorCount(form),
          });

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
        <div>
          <dt>{t("vd.summary.position")}</dt>
          <dd>{positionText}</dd>
        </div>
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
      <PrescriptionLinkBuilder form={form} />
    </div>
  );
}

/** Clinician control: turn the current config into a patient prescription link. */
function PrescriptionLinkBuilder({ form }: { form: FormState }) {
  const t = useT();
  const [attempts, setAttempts] = useState(3);
  const [label, setLabel] = useState("");
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const link = buildPrescriptionLink({
      schema_version: "1.0",
      kind: "blindside-config",
      exercise_type: "visual_discrimination",
      name: "Prescrizione",
      created_at: new Date().toISOString(),
      form,
      prescription: {
        max_attempts: attempts,
        patient_label: label.trim() || undefined,
      },
    });
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked (e.g. insecure context): show the link to copy by hand.
      window.prompt(t("rx.build.copy_manual"), link);
    }
  };

  return (
    <details className="rx-builder">
      <summary>{t("rx.build.title")}</summary>
      <div className="form-row">
        <label htmlFor="rx_label">{t("rx.build.label")}</label>
        <input
          id="rx_label"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t("rx.build.label_ph")}
        />
      </div>
      <div className="form-row">
        <label htmlFor="rx_attempts">{t("rx.build.attempts")}</label>
        <NumberField
          id="rx_attempts"
          min={1}
          max={10}
          value={attempts}
          onChange={setAttempts}
        />
      </div>
      <button type="button" className="rx-copy" onClick={copy}>
        {copied ? t("rx.build.copied") : t("rx.build.copy")}
      </button>
    </details>
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
        // shape_color: a coloured shape (both attributes vary).
        <polygon points="50,6 94,94 6,94" fill={color} />
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
  const sw = Math.max(0.5, r * 0.12);
  if (dimension === "shape_color") {
    // A coloured shape: both attributes vary.
    return (
      <polygon
        points={`${cx},${cy - r} ${cx + r},${cy + r} ${cx - r},${cy + r}`}
        fill={color}
      />
    );
  }
  // shape: a neutral glyph with a thin outline so it stays visible on any bg.
  return (
    <polygon
      points={`${cx},${cy - r} ${cx + r},${cy + r} ${cx - r},${cy + r}`}
      fill="#16171d"
      stroke={stroke}
      strokeWidth={sw}
    />
  );
}

export function VDResults({
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

  // Combined shape+colour: per-attribute accuracy among the trials the patient saw.
  const combined =
    sessionFile.exercise.type === "visual_discrimination" &&
    sessionFile.exercise.config.discrimination_dimension === "shape_color";
  const seenTrials = trials.filter((tr) => tr.response.aware === true);
  const attrAcc = (pick: (tr: (typeof trials)[number]) => boolean) =>
    seenTrials.length > 0
      ? seenTrials.filter(pick).length / seenTrials.length
      : undefined;
  const shapeAcc = attrAcc((tr) => tr.response.value_shape === tr.expected_shape);
  const colorAcc = attrAcc((tr) => tr.response.value_color === tr.expected_color);

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
        {combined && (
          <>
            <div className="metric">
              <div className="metric-label">Forma corretta</div>
              <div className="metric-value">{pct(shapeAcc)}</div>
              <div className="metric-sub">tra i rilevati</div>
            </div>
            <div className="metric">
              <div className="metric-label">Colore corretto</div>
              <div className="metric-value">{pct(colorAcc)}</div>
              <div className="metric-sub">tra i rilevati</div>
            </div>
          </>
        )}
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
