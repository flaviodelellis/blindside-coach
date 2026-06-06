import { useState } from "react";
import type {
  PositionMode,
  SessionFile,
  SessionSummary,
  TachistoscopicExercise,
  TachistoscopicTrial,
} from "../../types/session";
import { TachistoscopicRunner, type EngineResult } from "./Runner";
import { computeTachistoscopicSummary } from "../../lib/summary";
import {
  PositionGridSelector,
  makeEmptyGrid,
  gridToPositionMode,
  type GridState,
} from "../../components/PositionGridSelector";
import { HeatmapReport, type HeatmapPoint } from "../../components/HeatmapReport";
import { ColorField } from "../../components/ColorField";
import { NumberField } from "../../components/NumberField";
import { BackButton } from "../../components/BackButton";
import { LanguageToggle, useT } from "../../i18n";
import "./Tachistoscopic.css";

type Config = TachistoscopicExercise["config"];
type Mode = "configure" | "running" | "results";

type PositionChoice =
  | "peripheral_left"
  | "peripheral_right"
  | "peripheral_both"
  | "custom_grid";

type WordSource = "library" | "custom";

type FormState = {
  n_trials: number;
  exposure_ms: number;
  iti_min_ms: number;
  iti_max_ms: number;
  word_source: WordSource;
  custom_words: string;
  language: "it" | "en" | "both";
  length_min: number;
  length_max: number;
  font_size_px: number;
  position: PositionChoice;
  position_grid: GridState;
  include_pseudowords: boolean;
  pseudoword_ratio: number;
  patient_self_test: boolean;
  background_color: string;
  text_color: string;
  fixation_color: string;
  random_seed: string;
};

const DEFAULT_FORM: FormState = {
  n_trials: 5,
  exposure_ms: 250,
  iti_min_ms: 1000,
  iti_max_ms: 1500,
  word_source: "library",
  custom_words: "",
  language: "it",
  length_min: 4,
  length_max: 7,
  font_size_px: 48,
  position: "peripheral_both",
  position_grid: makeEmptyGrid(5, 5),
  include_pseudowords: true,
  pseudoword_ratio: 0.3,
  patient_self_test: false,
  background_color: "#000000",
  text_color: "#ffffff",
  fixation_color: "#ffffff",
  random_seed: "",
};

/** Split a free-text custom word list on newlines or commas. */
function parseCustomWords(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
}

function positionFromForm(form: FormState): PositionMode {
  switch (form.position) {
    case "peripheral_left":
      return { kind: "peripheral", side: "left" };
    case "peripheral_right":
      return { kind: "peripheral", side: "right" };
    case "peripheral_both":
      return { kind: "peripheral", side: "both" };
    case "custom_grid": {
      const mode = gridToPositionMode(form.position_grid);
      return mode ?? { kind: "peripheral", side: "both" };
    }
  }
}

function configFromForm(form: FormState): Config {
  const seed = form.random_seed.trim() === "" ? undefined : Number(form.random_seed);
  const customWords = parseCustomWords(form.custom_words);
  const isCustom = form.word_source === "custom";
  return {
    word_pool: isCustom
      ? { kind: "inline", words: customWords }
      : {
          kind: "library",
          language: form.language,
          length_range: [form.length_min, form.length_max],
          include_pseudowords: form.include_pseudowords,
          pseudoword_ratio: form.pseudoword_ratio,
        },
    font_size_px: form.font_size_px,
    text_color: form.text_color,
    background_color: form.background_color,
    exposure: { kind: "fixed", ms: form.exposure_ms },
    inter_trial_interval: {
      kind: "jitter",
      min_ms: form.iti_min_ms,
      max_ms: form.iti_max_ms,
      distribution: "uniform",
    },
    n_trials: isCustom ? customWords.length : form.n_trials,
    position_mode: positionFromForm(form),
    response_mode: form.patient_self_test ? "patient_types" : "clinician_marks",
    clinician_captures: form.patient_self_test ? undefined : ["detection"],
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
  trials: TachistoscopicTrial[];
  durationMs: number;
  sessionFile: SessionFile;
};

export function Tachistoscopic({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<Mode>("configure");
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [outcome, setOutcome] = useState<RunOutcome | null>(null);

  const handleComplete = (engineResult: EngineResult) => {
    const config = configFromForm(form);
    const summary = computeTachistoscopicSummary(
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
        type: "tachistoscopic",
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
  };

  if (mode === "running") {
    return (
      <TachistoscopicRunner
        config={configFromForm(form)}
        onComplete={handleComplete}
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
      onChange={setForm}
      onStart={() => setMode("running")}
      onBack={onBack}
    />
  );
}

function ConfigureForm({
  form,
  onChange,
  onStart,
  onBack,
}: {
  form: FormState;
  onChange: (next: FormState) => void;
  onStart: () => void;
  onBack: () => void;
}) {
  const t = useT();
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    onChange({ ...form, [key]: value });

  const gridEmpty =
    form.position === "custom_grid" &&
    gridToPositionMode(form.position_grid) === null;

  const customWordCount = parseCustomWords(form.custom_words).length;
  const customEmpty = form.word_source === "custom" && customWordCount === 0;
  const cannotStart = gridEmpty || customEmpty;

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
              <h2 className="form-section-title">{t("tach.section.mode")}</h2>
              <div className="form-row full checkbox">
                <input
                  id="patient_self_test"
                  type="checkbox"
                  checked={form.patient_self_test}
                  onChange={(e) =>
                    update("patient_self_test", e.target.checked)
                  }
                />
                <label htmlFor="patient_self_test">
                  {t("tach.field.patient_mode")}
                </label>
                <p className="hint">{t("tach.hint.patient_mode")}</p>
              </div>
            </section>

            <section className="form-section">
              <h2 className="form-section-title">{t("tach.section.stimuli")}</h2>
              <div className="form-row">
                <label htmlFor="word_source">
                  {t("tach.field.word_source")}
                </label>
                <select
                  id="word_source"
                  value={form.word_source}
                  onChange={(e) =>
                    update("word_source", e.target.value as WordSource)
                  }
                >
                  <option value="library">
                    {t("tach.word_source.library")}
                  </option>
                  <option value="custom">
                    {t("tach.word_source.custom")}
                  </option>
                </select>
              </div>

              <div className="form-row">
                <label htmlFor="font_size_px">
                  {t("tach.field.word_size")}
                </label>
                <NumberField
                  id="font_size_px"
                  min={16}
                  max={200}
                  step={2}
                  value={form.font_size_px}
                  onChange={(n) => update("font_size_px", n)}
                />
              </div>

              {form.word_source === "custom" ? (
                <div className="form-row full">
                  <label htmlFor="custom_words">
                    {t("tach.field.custom_words")}
                  </label>
                  <textarea
                    id="custom_words"
                    className="custom-words-input"
                    rows={6}
                    placeholder={t("tach.placeholder.custom_words")}
                    value={form.custom_words}
                    onChange={(e) => update("custom_words", e.target.value)}
                  />
                  <p className="hint">
                    {t("tach.hint.custom_words", {
                      n: parseCustomWords(form.custom_words).length,
                    })}
                  </p>
                </div>
              ) : (
                <>
                  <div className="form-row">
                    <label htmlFor="language">{t("tach.field.language")}</label>
                    <select
                      id="language"
                      value={form.language}
                      onChange={(e) =>
                        update(
                          "language",
                          e.target.value as FormState["language"],
                        )
                      }
                    >
                      <option value="it">{t("tach.lang.it")}</option>
                      <option value="en">{t("tach.lang.en")}</option>
                      <option value="both">{t("tach.lang.both")}</option>
                    </select>
                  </div>

                  <div className="form-row">
                    <label>{t("tach.field.length")}</label>
                    <div className="dual-input">
                      <NumberField
                        min={2}
                        max={15}
                        value={form.length_min}
                        onChange={(n) => update("length_min", n)}
                        aria-label="min"
                      />
                      <span>–</span>
                      <NumberField
                        min={2}
                        max={15}
                        value={form.length_max}
                        onChange={(n) => update("length_max", n)}
                        aria-label="max"
                      />
                    </div>
                  </div>

                  <div className="form-row checkbox">
                    <input
                      id="include_pseudo"
                      type="checkbox"
                      checked={form.include_pseudowords}
                      onChange={(e) =>
                        update("include_pseudowords", e.target.checked)
                      }
                    />
                    <label htmlFor="include_pseudo">
                      {t("tach.field.include_pseudo")}
                    </label>
                  </div>

                  {form.include_pseudowords && (
                    <div className="form-row">
                      <label htmlFor="pseudo_ratio">
                        {t("tach.field.pseudo_ratio")}
                      </label>
                      <NumberField
                        id="pseudo_ratio"
                        min={0}
                        max={1}
                        step={0.05}
                        inputMode="decimal"
                        value={form.pseudoword_ratio}
                        onChange={(n) => update("pseudoword_ratio", n)}
                      />
                    </div>
                  )}
                </>
              )}
            </section>

            <section className="form-section">
              <h2 className="form-section-title">{t("tach.section.position")}</h2>
              <div className="form-row">
                <label htmlFor="position">{t("tach.field.position")}</label>
                <select
                  id="position"
                  value={form.position}
                  onChange={(e) =>
                    update("position", e.target.value as PositionChoice)
                  }
                >
                  <option value="peripheral_both">
                    {t("tach.pos.peripheral_both")}
                  </option>
                  <option value="peripheral_left">
                    {t("tach.pos.peripheral_left")}
                  </option>
                  <option value="peripheral_right">
                    {t("tach.pos.peripheral_right")}
                  </option>
                  <option value="custom_grid">
                    {t("tach.pos.custom_grid")}
                  </option>
                </select>
              </div>

              {form.position === "custom_grid" && (
                <div className="form-row full">
                  <label>{t("tach.field.allowed_regions")}</label>
                  <PositionGridSelector
                    grid={form.position_grid}
                    onChange={(g) => update("position_grid", g)}
                    fixationNorm={{ x: 0.5, y: 0.5 }}
                  />
                </div>
              )}
            </section>

            <section className="form-section">
              <h2 className="form-section-title">
                {t("tach.section.appearance")}
              </h2>
              <ColorField
                id="background_color"
                label={t("tach.field.background_color")}
                value={form.background_color}
                onChange={(c) => update("background_color", c)}
              />
              <ColorField
                id="text_color"
                label={t("tach.field.text_color")}
                value={form.text_color}
                onChange={(c) => update("text_color", c)}
              />
              <ColorField
                id="fixation_color"
                label={t("tach.field.fixation_color")}
                value={form.fixation_color}
                onChange={(c) => update("fixation_color", c)}
              />
            </section>

            <section className="form-section">
              <h2 className="form-section-title">{t("tach.section.timing")}</h2>
              {form.word_source === "custom" ? (
                <div className="form-row">
                  <label>{t("tach.field.n_trials")}</label>
                  <span className="derived-value">
                    {t("tach.n_trials.from_list", {
                      n: parseCustomWords(form.custom_words).length,
                    })}
                  </span>
                </div>
              ) : (
                <div className="form-row">
                  <label htmlFor="n_trials">{t("tach.field.n_trials")}</label>
                  <NumberField
                    id="n_trials"
                    min={1}
                    max={500}
                    value={form.n_trials}
                    onChange={(n) => update("n_trials", n)}
                  />
                </div>
              )}

              <div className="form-row">
                <label htmlFor="exposure_ms">
                  {t("tach.field.exposure")}
                </label>
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
                <label>{t("tach.field.iti")}</label>
                <div className="dual-input">
                  <NumberField
                    min={0}
                    max={10000}
                    step={50}
                    value={form.iti_min_ms}
                    onChange={(n) => update("iti_min_ms", n)}
                    aria-label="min"
                  />
                  <span>–</span>
                  <NumberField
                    min={0}
                    max={10000}
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
                {t("tach.section.advanced")}
              </summary>
              <div className="form-row full">
                <label htmlFor="random_seed">
                  {t("tach.field.random_seed")}
                </label>
                <input
                  id="random_seed"
                  type="text"
                  inputMode="numeric"
                  placeholder={t("tach.placeholder.random_seed")}
                  value={form.random_seed}
                  onChange={(e) => update("random_seed", e.target.value)}
                />
              </div>
            </details>
          </section>

          {gridEmpty && (
            <div className="validation-error">
              {t("tach.grid.empty_error")}
            </div>
          )}
          {customEmpty && (
            <div className="validation-error">
              {t("tach.custom_words.empty_error")}
            </div>
          )}
        </div>

        <aside className="form-summary">
          <LiveSummary form={form} onStart={onStart} disabled={cannotStart} />
        </aside>
      </div>
    </main>
    </>
  );
}

function LiveSummary({
  form,
  onStart,
  disabled,
}: {
  form: FormState;
  onStart: () => void;
  disabled: boolean;
}) {
  const t = useT();

  const isCustom = form.word_source === "custom";
  const customCount = parseCustomWords(form.custom_words).length;

  const lenText =
    form.length_min === form.length_max
      ? `${form.length_min}`
      : `${form.length_min}–${form.length_max}`;
  const langText = t(`tach.summary.lang.${form.language}`);
  const stimuliMain = isCustom
    ? t("tach.summary.stimuli.custom", { n: customCount })
    : t("tach.summary.stimuli.words", {
        n: form.n_trials,
        lang: langText,
        len: lenText,
      });
  const pseudoLine = isCustom
    ? t("tach.summary.stimuli.custom_sub")
    : form.include_pseudowords
      ? t("tach.summary.stimuli.pseudo", {
          pct: Math.round(form.pseudoword_ratio * 100),
        })
      : t("tach.summary.stimuli.no_pseudo");

  let positionText: string;
  if (form.position === "custom_grid") {
    const active = form.position_grid.cells
      .flat()
      .filter((v) => v > 0).length;
    positionText =
      active === 0
        ? t("tach.summary.pos.custom_empty")
        : t("tach.summary.pos.custom", { n: active });
  } else {
    positionText = t(`tach.pos.${form.position}`);
  }

  const exposureLine = t("tach.summary.timing.exposure", {
    ms: form.exposure_ms,
  });
  const itiLine =
    form.iti_min_ms === form.iti_max_ms
      ? t("tach.summary.timing.iti_fixed", { ms: form.iti_min_ms })
      : t("tach.summary.timing.iti_range", {
          min: form.iti_min_ms,
          max: form.iti_max_ms,
        });

  return (
    <div className="summary-card">
      <div className="summary-eyebrow">{t("tach.summary.live")}</div>
      <dl className="summary-rows">
        <div>
          <dt>{t("tach.summary.mode")}</dt>
          <dd>
            {form.patient_self_test
              ? t("tach.summary.mode.patient")
              : t("tach.summary.mode.clinician")}
          </dd>
        </div>
        <div>
          <dt>{t("tach.summary.stimuli")}</dt>
          <dd>
            {stimuliMain}
            <br />
            <span className="dim">{pseudoLine}</span>
          </dd>
        </div>
        <div>
          <dt>{t("tach.summary.position")}</dt>
          <dd>{positionText}</dd>
        </div>
        <div>
          <dt>{t("tach.summary.timing")}</dt>
          <dd>
            {exposureLine}
            <br />
            <span className="dim">{itiLine}</span>
          </dd>
        </div>
      </dl>
      <button
        type="button"
        className="summary-start"
        onClick={onStart}
        disabled={disabled}
      >
        {t("common.startExercise")} →
      </button>
    </div>
  );
}

function formatPositionShort(p: { x: number; y: number }): string {
  const h = p.x < 0.45 ? "sx" : p.x > 0.55 ? "dx" : "ctr";
  const v = p.y < 0.45 ? "sup" : p.y > 0.55 ? "inf" : "med";
  return `${h} ${v}`;
}

function toCsv(trials: TachistoscopicTrial[]): string {
  const head = [
    "trial",
    "x",
    "y",
    "word",
    "is_pseudoword",
    "detected",
    "rt_ms",
    "exposure_requested_ms",
    "exposure_measured_ms",
    "n_repetitions",
  ];
  const rows = trials.map((tr) =>
    [
      tr.trial_id,
      tr.position_norm.x.toFixed(4),
      tr.position_norm.y.toFixed(4),
      JSON.stringify(tr.word),
      tr.is_pseudoword ? 1 : 0,
      tr.response?.detected === true ? 1 : 0,
      tr.response?.rt_ms !== undefined ? Math.round(tr.response.rt_ms) : "",
      tr.exposure_ms_requested,
      tr.exposure_ms_measured,
      tr.n_repetitions,
    ].join(","),
  );
  return [head.join(","), ...rows].join("\n");
}

function RepetitionReport({
  repetitions,
  blocks,
}: {
  repetitions: NonNullable<SessionSummary["repetitions"]>;
  blocks: SessionSummary["blocks"];
}) {
  const t = useT();
  const maxCount = Math.max(...repetitions.histogram.map((h) => h.count), 1);
  const blockReps = blocks
    .map((b) => b.rep_mean)
    .filter((r): r is number => r !== undefined);
  const maxBlockRep = Math.max(...blockReps, 0.001);

  return (
    <>
      <div className="results-side-title">{t("tach.results.rep_title")}</div>
      <ul className="bar-list">
        {repetitions.histogram.map(({ reps, count }) => (
          <li key={reps}>
            <span className="bar-label">{reps}×</span>
            <span className="bar-track">
              <span
                className="bar-fill"
                style={{ width: `${(count / maxCount) * 100}%` }}
              />
            </span>
            <span className="bar-count">{count}</span>
          </li>
        ))}
      </ul>
      {repetitions.asymmetry_lr !== undefined && (
        <div className="rep-asymmetry">
          <span>{t("tach.results.rep_asymmetry")}</span>
          <b>
            {repetitions.asymmetry_lr > 0 ? "+" : ""}
            {repetitions.asymmetry_lr.toFixed(1)}×
          </b>
        </div>
      )}
      {blockReps.length > 1 && (
        <>
          <div className="results-side-title">{t("tach.results.rep_blocks")}</div>
          <ul className="bar-list">
            {blocks.map((b) =>
              b.rep_mean === undefined ? null : (
                <li key={b.block_idx}>
                  <span className="bar-label">
                    {t("tach.results.block_short", { n: b.block_idx + 1 })}
                  </span>
                  <span className="bar-track">
                    <span
                      className="bar-fill"
                      style={{ width: `${(b.rep_mean / maxBlockRep) * 100}%` }}
                    />
                  </span>
                  <span className="bar-count">{b.rep_mean.toFixed(1)}</span>
                </li>
              ),
            )}
          </ul>
        </>
      )}
    </>
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
  const t = useT();
  const { sessionFile } = outcome;
  const s = sessionFile.summary;

  const heatmapPoints: HeatmapPoint[] = outcome.trials.map((tr) => ({
    position: tr.position_norm,
    correct: tr.response?.detected === true,
    rt_ms: tr.response?.rt_ms,
  }));
  const screenAspect =
    sessionFile.session.screen.height_px > 0
      ? sessionFile.session.screen.width_px / sessionFile.session.screen.height_px
      : 16 / 9;

  const downloadBlob = (data: string, mime: string, ext: string) => {
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-${sessionFile.session.id.slice(0, 8)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadJson = () =>
    downloadBlob(JSON.stringify(sessionFile, null, 2), "application/json", "json");
  const downloadCsv = () =>
    downloadBlob(toCsv(outcome.trials), "text/csv", "csv");

  return (
    <main className="page page-results">
      <BackButton onClick={onBack} className="fixed" />
      <header className="results-header">
        <div>
          <h1>{t("tach.results.title")}</h1>
          <p className="subtitle">
            {t("tach.results.subtitle", {
              sec: Math.round(outcome.durationMs / 1000),
              n: s.n_trials,
            })}
          </p>
        </div>
        <div className="results-header-actions">
          <LanguageToggle />
          <button type="button" className="secondary" onClick={downloadJson}>
            ↓ JSON
          </button>
          <button type="button" className="secondary" onClick={downloadCsv}>
            ↓ CSV
          </button>
          <button type="button" onClick={onRestart}>
            + {t("tach.results.restart")}
          </button>
        </div>
      </header>

      <section className="kpi-strip">
        <div className="kpi">
          <div className="kpi-value">
            {s.accuracy !== undefined ? `${(s.accuracy * 100).toFixed(0)}%` : "—"}
          </div>
          <div className="kpi-label">{t("tach.results.accuracy")}</div>
        </div>
        <div className="kpi">
          <div className="kpi-value">
            {s.rt_mean_ms !== undefined ? Math.round(s.rt_mean_ms) : "—"}
            <span className="kpi-unit">ms</span>
          </div>
          <div className="kpi-label">{t("tach.results.rt_mean")}</div>
        </div>
        <div className="kpi">
          <div className="kpi-value">{s.n_trials}</div>
          <div className="kpi-label">{t("tach.results.trials")}</div>
        </div>
        {s.repetitions && (
          <>
            <div className="kpi">
              <div className="kpi-value">{s.repetitions.mean.toFixed(1)}</div>
              <div className="kpi-label">{t("tach.results.rep_mean")}</div>
            </div>
            <div className="kpi">
              <div className="kpi-value">
                {Math.round(s.repetitions.pct_first_exposure * 100)}
                <span className="kpi-unit">%</span>
              </div>
              <div className="kpi-label">{t("tach.results.rep_first")}</div>
            </div>
          </>
        )}
      </section>

      <div className="results-split">
        <section className="trial-table" aria-label={t("tach.results.trials_table")}>
          <div className="trial-table-head">
            <span>{t("tach.results.col.trial_n")}</span>
            <span>{t("tach.results.col.position")}</span>
            <span>{t("tach.results.col.stimulus")}</span>
            <span>{t("tach.results.col.response")}</span>
            <span>{t("tach.results.col.rt_short")}</span>
          </div>
          <div className="trial-table-body">
            {outcome.trials.map((tr) => {
              const ok = tr.response?.detected === true;
              const rt = tr.response?.rt_ms;
              return (
                <div key={tr.trial_id} className="trial-table-row">
                  <span className="trial-cell-mono">{tr.trial_id}</span>
                  <span>{formatPositionShort(tr.position_norm)}</span>
                  <span className="trial-cell-stim">{tr.word}</span>
                  <span className={ok ? "trial-cell-ok" : "trial-cell-err"}>
                    {ok ? "✓" : "✗"}
                  </span>
                  <span className="trial-cell-mono">
                    {rt !== undefined ? `${Math.round(rt)} ms` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="results-side">
          <div className="results-side-title">{t("heatmap.title")}</div>
          {heatmapPoints.length > 0 && (
            <HeatmapReport
              points={heatmapPoints}
              aspectRatio={screenAspect}
              fixation={
                sessionFile.exercise.type === "tachistoscopic"
                  ? sessionFile.exercise.config.fixation.position_norm
                  : { x: 0.5, y: 0.5 }
              }
              compact
            />
          )}
          {s.per_quadrant && (
            <>
              <div className="results-side-title">
                {t("tach.results.per_quadrant")}
              </div>
              <ul className="quadrant-list">
                {Object.entries(s.per_quadrant).map(([q, stats]) => (
                  <li key={q}>
                    <span>{t(`quadrant.${q}`)}</span>
                    <b>
                      {stats.rep_mean !== undefined
                        ? `${stats.rep_mean.toFixed(1)}×`
                        : "—"}
                    </b>
                  </li>
                ))}
              </ul>
            </>
          )}
          {s.repetitions && <RepetitionReport repetitions={s.repetitions} blocks={s.blocks} />}
        </aside>
      </div>
    </main>
  );
}
