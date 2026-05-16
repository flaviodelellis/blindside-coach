import type {
  DiscriminationTrial,
  QuadrantStats,
  SessionSummary,
  TachistoscopicTrial,
} from "../types/session";
import { quadrantOf } from "./runtime";
import type { Quadrant } from "./runtime";

export function computeTachistoscopicSummary(
  trials: TachistoscopicTrial[],
  durationMs: number,
): SessionSummary {
  const nTrials = trials.length;
  const detected = trials.filter((t) => t.response?.detected === true);
  const rts = trials
    .map((t) => t.response?.rt_ms)
    .filter((rt): rt is number => rt !== undefined && rt !== null);

  const perQuadrant: Record<Quadrant, QuadrantStats> = {
    upper_left: { n_presented: 0, n_detected: 0 },
    upper_right: { n_presented: 0, n_detected: 0 },
    lower_left: { n_presented: 0, n_detected: 0 },
    lower_right: { n_presented: 0, n_detected: 0 },
  };
  const quadrantRts: Record<Quadrant, number[]> = {
    upper_left: [],
    upper_right: [],
    lower_left: [],
    lower_right: [],
  };

  for (const t of trials) {
    const q = quadrantOf(t.position_norm);
    perQuadrant[q].n_presented += 1;
    if (t.response?.detected) perQuadrant[q].n_detected += 1;
    if (t.response?.rt_ms != null) quadrantRts[q].push(t.response.rt_ms);
  }
  for (const q of Object.keys(perQuadrant) as Quadrant[]) {
    if (quadrantRts[q].length > 0) {
      perQuadrant[q].rt_mean_ms = mean(quadrantRts[q]);
    }
  }

  const reals = trials.filter((t) => !t.is_pseudoword);
  const pseudos = trials.filter((t) => t.is_pseudoword);

  return {
    duration_ms: durationMs,
    n_trials: nTrials,
    n_correct: detected.length,
    accuracy: nTrials > 0 ? detected.length / nTrials : 0,
    rt_mean_ms: rts.length > 0 ? mean(rts) : undefined,
    rt_median_ms: rts.length > 0 ? percentile(rts, 0.5) : undefined,
    rt_p10_ms: rts.length > 0 ? percentile(rts, 0.1) : undefined,
    rt_p90_ms: rts.length > 0 ? percentile(rts, 0.9) : undefined,
    per_quadrant: perQuadrant,
    blocks: computeBlocks(trials),
    recognition_breakdown: {
      real_words: breakdown(reals),
      pseudowords: breakdown(pseudos),
    },
  };
}

function breakdown(trials: TachistoscopicTrial[]) {
  const detected = trials.filter((t) => t.response?.detected === true);
  const rts = trials
    .map((t) => t.response?.rt_ms)
    .filter((rt): rt is number => rt !== undefined && rt !== null);
  return {
    n_presented: trials.length,
    n_correct: detected.length,
    rt_mean_ms: rts.length > 0 ? mean(rts) : undefined,
  };
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
}

function computeBlocks(trials: TachistoscopicTrial[]): SessionSummary["blocks"] {
  if (trials.length === 0) return [];
  const blockSize = Math.max(5, Math.ceil(trials.length / 4));
  const out: SessionSummary["blocks"] = [];
  for (let i = 0; i < trials.length; i += blockSize) {
    const block = trials.slice(i, i + blockSize);
    const detected = block.filter((t) => t.response?.detected === true);
    const rts = block
      .map((t) => t.response?.rt_ms)
      .filter((rt): rt is number => rt !== undefined && rt !== null);
    out.push({
      block_idx: out.length,
      n_trials: block.length,
      accuracy: block.length > 0 ? detected.length / block.length : undefined,
      rt_mean_ms: rts.length > 0 ? mean(rts) : undefined,
    });
  }
  return out;
}

export function computeDiscriminationSummary(
  trials: DiscriminationTrial[],
  durationMs: number,
): SessionSummary {
  const nTrials = trials.length;
  const detected = trials.filter((t) => t.response.given === true);
  const rts = trials
    .map((t) => t.response.rt_ms)
    .filter((rt): rt is number => rt !== undefined && rt !== null);

  const perQuadrant: Record<Quadrant, QuadrantStats> = {
    upper_left: { n_presented: 0, n_detected: 0 },
    upper_right: { n_presented: 0, n_detected: 0 },
    lower_left: { n_presented: 0, n_detected: 0 },
    lower_right: { n_presented: 0, n_detected: 0 },
  };
  const quadrantRts: Record<Quadrant, number[]> = {
    upper_left: [],
    upper_right: [],
    lower_left: [],
    lower_right: [],
  };

  for (const t of trials) {
    // A trial may have multiple stimuli; count each by its quadrant.
    for (const s of t.stimuli) {
      const q = quadrantOf(s.position_norm);
      perQuadrant[q].n_presented += 1;
      if (t.response.given) perQuadrant[q].n_detected += 1;
      if (t.response.rt_ms != null) quadrantRts[q].push(t.response.rt_ms);
    }
  }
  for (const q of Object.keys(perQuadrant) as Quadrant[]) {
    if (quadrantRts[q].length > 0) {
      perQuadrant[q].rt_mean_ms = mean(quadrantRts[q]);
    }
  }

  return {
    duration_ms: durationMs,
    n_trials: nTrials,
    n_correct: detected.length,
    accuracy: nTrials > 0 ? detected.length / nTrials : 0,
    rt_mean_ms: rts.length > 0 ? mean(rts) : undefined,
    rt_median_ms: rts.length > 0 ? percentile(rts, 0.5) : undefined,
    rt_p10_ms: rts.length > 0 ? percentile(rts, 0.1) : undefined,
    rt_p90_ms: rts.length > 0 ? percentile(rts, 0.9) : undefined,
    per_quadrant: perQuadrant,
    blocks: computeDiscriminationBlocks(trials),
  };
}

function computeDiscriminationBlocks(
  trials: DiscriminationTrial[],
): SessionSummary["blocks"] {
  if (trials.length === 0) return [];
  const blockSize = Math.max(5, Math.ceil(trials.length / 4));
  const out: SessionSummary["blocks"] = [];
  for (let i = 0; i < trials.length; i += blockSize) {
    const block = trials.slice(i, i + blockSize);
    const detected = block.filter((t) => t.response.given === true);
    const rts = block
      .map((t) => t.response.rt_ms)
      .filter((rt): rt is number => rt !== undefined && rt !== null);
    out.push({
      block_idx: out.length,
      n_trials: block.length,
      accuracy: block.length > 0 ? detected.length / block.length : undefined,
      rt_mean_ms: rts.length > 0 ? mean(rts) : undefined,
    });
  }
  return out;
}
