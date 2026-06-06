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
  /** The correct forced-choice answer (colour hex, shape name, or "left"/"right"). */
  expected: string;
  /** The alternatives presented to the clinician, in display order. */
  alternatives: string[];
  exposure_ms: number;
  iti_ms: number;
};

/** Probability of a correct forced-choice guess by pure chance for a dimension. */
export function chanceLevel(config: Config): number {
  const n = alternativesFor(config).length;
  return n > 0 ? 1 / n : 0;
}

/** The forced-choice options for the configured dimension, in a stable display order. */
export function alternativesFor(config: Config): string[] {
  switch (config.discrimination_dimension) {
    case "color":
      return config.stimulus_colors;
    case "shape":
      return [...SHAPES];
    case "position":
      return ["left", "right"];
  }
}

/** Build the per-trial schedule. Pure and deterministic given the seed. */
export function buildDiscriminationTrials(config: Config): DiscriminationTrialParam[] {
  const rng = makeRng(config.random_seed);
  const dimension = config.discrimination_dimension;
  const alternatives = alternativesFor(config);

  return Array.from({ length: config.n_trials }, (_, i) => {
    const exposure_ms = Math.round(resolveDuration(config.exposure, rng));
    const iti_ms = Math.round(resolveDuration(config.inter_trial_interval, rng));

    let stimulus: PresentedStimulus;
    let expected: string;

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
      const shape = SHAPES[Math.floor(rng() * SHAPES.length)];
      stimulus = {
        kind: "shape",
        value: shape,
        color: NEUTRAL_FILL,
        position_norm: resolvePosition(config.position_mode, rng, i),
        size_px: config.stimulus_size_px,
      };
      expected = shape;
    } else {
      // position: ignore configured side — the task IS left vs right.
      const side = rng() < 0.5 ? "left" : "right";
      const y = 0.5 + (rng() - 0.5) * 0.2;
      stimulus = {
        kind: "color",
        value: NEUTRAL_FILL,
        color: NEUTRAL_FILL,
        position_norm: { x: side === "left" ? 0.25 : 0.75, y },
        size_px: config.stimulus_size_px,
      };
      expected = side;
    }

    return {
      trial_id: i + 1,
      stimulus,
      dimension,
      expected,
      alternatives,
      exposure_ms,
      iti_ms,
    };
  });
}
