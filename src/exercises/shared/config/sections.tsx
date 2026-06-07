import type { ReactNode } from "react";
import { ColorField } from "../../../components/ColorField";
import { NumberField } from "../../../components/NumberField";
import {
  PositionGridSelector,
  type GridState,
} from "../../../components/PositionGridSelector";
import { useT } from "../../../i18n";

/**
 * Config-form sections shared by every exercise. They are prop-driven (not
 * form-state coupled), so the same Position / Appearance / Timing / Advanced
 * blocks serve both the tachistoscopy and discrimination forms today and the
 * unified screen tomorrow.
 */

export type PositionValue =
  | "peripheral_both"
  | "peripheral_left"
  | "peripheral_right"
  | "central"
  | "custom_grid";

export function PositionSection({
  value,
  grid,
  includeCentral,
  onValueChange,
  onGridChange,
}: {
  value: PositionValue;
  grid: GridState;
  /** Discrimination offers a central option; tachistoscopy does not. */
  includeCentral?: boolean;
  onValueChange: (v: PositionValue) => void;
  onGridChange: (g: GridState) => void;
}) {
  const t = useT();
  return (
    <section className="form-section">
      <h2 className="form-section-title">{t("ex.section.position")}</h2>
      <div className="form-row">
        <label htmlFor="position">{t("ex.field.position")}</label>
        <select
          id="position"
          value={value}
          onChange={(e) => onValueChange(e.target.value as PositionValue)}
        >
          <option value="peripheral_both">{t("ex.pos.peripheral_both")}</option>
          <option value="peripheral_left">{t("ex.pos.peripheral_left")}</option>
          <option value="peripheral_right">
            {t("ex.pos.peripheral_right")}
          </option>
          {includeCentral && (
            <option value="central">{t("ex.pos.central")}</option>
          )}
          <option value="custom_grid">{t("ex.pos.custom_grid")}</option>
        </select>
      </div>

      {value === "custom_grid" && (
        <div className="form-row full">
          <label>{t("ex.field.allowed_regions")}</label>
          <PositionGridSelector
            grid={grid}
            onChange={onGridChange}
            fixationNorm={{ x: 0.5, y: 0.5 }}
          />
        </div>
      )}
    </section>
  );
}

export function AppearanceSection({
  backgroundColor,
  fixationColor,
  textColor,
  onBackgroundChange,
  onFixationChange,
  onTextChange,
}: {
  backgroundColor: string;
  fixationColor: string;
  /** Provided only when the stimulus has its own ink colour (a word). */
  textColor?: string;
  onBackgroundChange: (c: string) => void;
  onFixationChange: (c: string) => void;
  onTextChange?: (c: string) => void;
}) {
  const t = useT();
  return (
    <section className="form-section">
      <h2 className="form-section-title">{t("ex.section.appearance")}</h2>
      <ColorField
        id="ex_background_color"
        label={t("ex.field.background_color")}
        value={backgroundColor}
        onChange={onBackgroundChange}
      />
      {textColor !== undefined && onTextChange && (
        <ColorField
          id="ex_text_color"
          label={t("ex.field.text_color")}
          value={textColor}
          onChange={onTextChange}
        />
      )}
      <ColorField
        id="ex_fixation_color"
        label={t("ex.field.fixation_color")}
        value={fixationColor}
        onChange={onFixationChange}
      />
    </section>
  );
}

export function TimingSection({
  nTrials,
  nTrialsDerived,
  exposureMs,
  itiMinMs,
  itiMaxMs,
  itiBounds = { min: 0, max: 10000, step: 50 },
  onNTrialsChange,
  onExposureChange,
  onItiMinChange,
  onItiMaxChange,
}: {
  nTrials: number;
  /** When set, the trial count is derived (read-only) instead of editable. */
  nTrialsDerived?: string;
  exposureMs: number;
  itiMinMs: number;
  itiMaxMs: number;
  itiBounds?: { min: number; max: number; step: number };
  onNTrialsChange: (n: number) => void;
  onExposureChange: (n: number) => void;
  onItiMinChange: (n: number) => void;
  onItiMaxChange: (n: number) => void;
}) {
  const t = useT();
  return (
    <section className="form-section">
      <h2 className="form-section-title">{t("ex.section.timing")}</h2>
      {nTrialsDerived !== undefined ? (
        <div className="form-row">
          <label>{t("ex.field.n_trials")}</label>
          <span className="derived-value">{nTrialsDerived}</span>
        </div>
      ) : (
        <div className="form-row">
          <label htmlFor="n_trials">{t("ex.field.n_trials")}</label>
          <NumberField
            id="n_trials"
            min={1}
            max={500}
            value={nTrials}
            onChange={onNTrialsChange}
          />
        </div>
      )}

      <div className="form-row">
        <label htmlFor="exposure_ms">{t("ex.field.exposure")}</label>
        <NumberField
          id="exposure_ms"
          min={50}
          max={2000}
          step={50}
          value={exposureMs}
          onChange={onExposureChange}
        />
      </div>

      <div className="form-row full">
        <label>{t("ex.field.iti")}</label>
        <div className="dual-input">
          <NumberField
            min={itiBounds.min}
            max={itiBounds.max}
            step={itiBounds.step}
            value={itiMinMs}
            onChange={onItiMinChange}
            aria-label="min"
          />
          <span>–</span>
          <NumberField
            min={itiBounds.min}
            max={itiBounds.max}
            step={itiBounds.step}
            value={itiMaxMs}
            onChange={onItiMaxChange}
            aria-label="max"
          />
        </div>
      </div>
    </section>
  );
}

export function AdvancedSection({
  randomSeed,
  onRandomSeedChange,
  children,
}: {
  randomSeed: string;
  onRandomSeedChange: (v: string) => void;
  /** Extra advanced fields specific to an exercise, rendered above the seed. */
  children?: ReactNode;
}) {
  const t = useT();
  return (
    <details className="form-section form-section-collapsible">
      <summary className="form-section-title">{t("ex.section.advanced")}</summary>
      {children}
      <div className="form-row full">
        <label htmlFor="random_seed">{t("ex.field.random_seed")}</label>
        <input
          id="random_seed"
          type="text"
          inputMode="numeric"
          placeholder={t("ex.placeholder.random_seed")}
          value={randomSeed}
          onChange={(e) => onRandomSeedChange(e.target.value)}
        />
      </div>
    </details>
  );
}
