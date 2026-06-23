import type {
  DiscriminationDimension,
  PresentedStimulus,
  VisualDiscriminationExercise,
} from "../../types/session";
import { makeRng } from "../../lib/rng";
import { resolveDuration, resolvePosition } from "../../lib/runtime";
import { SHAPES } from "./stimuli";

type Config = VisualDiscriminationExercise["config"];

/** Neutral fill used when the discriminated feature is NOT colour, so colour can't act as a cue. */
export const NEUTRAL_FILL = "#16171d";

export type DiscriminationTrialParam = {
  trial_id: number;
  stimulus: PresentedStimulus;
  dimension: DiscriminationDimension;
  /** The correct forced-choice answer (colour hex or shape name); single-dim only. */
  expected: string;
  /** The alternatives presented to the clinician, in display order; single-dim only. */
  alternatives: string[];
  /** Combined shape+color task: correct values and per-attribute alternatives. */
  expected_shape?: string;
  expected_color?: string;
  shape_alternatives?: string[];
  color_alternatives?: string[];
  exposure_ms: number;
  iti_ms: number;
};

/** The shapes the operator chose to present (defaults to all for legacy presets). */
export function shapesFor(config: Config): string[] {
  const chosen = config.stimulus_shapes;
  return chosen && chosen.length > 0 ? chosen : [...SHAPES];
}

/** Probability of a correct forced-choice guess by pure chance for a dimension. */
export function chanceLevel(config: Config): number {
  if (config.discrimination_dimension === "shape_color") {
    const n = shapesFor(config).length * config.stimulus_colors.length;
    return n > 0 ? 1 / n : 0;
  }
  const n = alternativesFor(config).length;
  return n > 0 ? 1 / n : 0;
}

/** The forced-choice options for the configured dimension, in a stable display order. */
export function alternativesFor(config: Config): string[] {
  switch (config.discrimination_dimension) {
    case "color":
      return config.stimulus_colors;
    case "shape":
    case "shape_color":
      return shapesFor(config);
  }
}

/** Build the per-trial schedule. Pure and deterministic given the seed. */
export function buildDiscriminationTrials(config: Config): DiscriminationTrialParam[] {
  const rng = makeRng(config.random_seed);
  const dimension = config.discrimination_dimension;
  const alternatives = alternativesFor(config);
  const shapes = shapesFor(config);

  return Array.from({ length: config.n_trials }, (_, i) => {
    const exposure_ms = Math.round(resolveDuration(config.exposure, rng));
    const iti_ms = Math.round(resolveDuration(config.inter_trial_interval, rng));

    let stimulus: PresentedStimulus;
    let expected = "";
    let expected_shape: string | undefined;
    let expected_color: string | undefined;

    if (dimension === "color") {
      const color =
        config.stimulus_colors[Math.floor(rng() * config.stimulus_colors.length)];
      stimulus = {
        kind: "color",
        value: color,
        color,
        position_norm: resolvePosition(config.position_mode, rng, i),
        size_px: config.stimulus_size_px,
      };
      expected = color;
    } else if (dimension === "shape") {
      const shape = shapes[Math.floor(rng() * shapes.length)];
      stimulus = {
        kind: "shape",
        value: shape,
        color: NEUTRAL_FILL,
        position_norm: resolvePosition(config.position_mode, rng, i),
        size_px: config.stimulus_size_px,
      };
      expected = shape;
    } else {
      // shape_color: one coloured shape; the patient reports BOTH attributes.
      const shape = shapes[Math.floor(rng() * shapes.length)];
      const color =
        config.stimulus_colors[Math.floor(rng() * config.stimulus_colors.length)];
      stimulus = {
        kind: "shape",
        value: shape,
        color,
        position_norm: resolvePosition(config.position_mode, rng, i),
        size_px: config.stimulus_size_px,
      };
      expected_shape = shape;
      expected_color = color;
    }

    return {
      trial_id: i + 1,
      stimulus,
      dimension,
      expected,
      alternatives,
      expected_shape,
      expected_color,
      shape_alternatives: dimension === "shape_color" ? shapes : undefined,
      color_alternatives:
        dimension === "shape_color" ? config.stimulus_colors : undefined,
      exposure_ms,
      iti_ms,
    };
  });
}
