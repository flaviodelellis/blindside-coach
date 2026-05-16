import type {
  Duration,
  NormalizedPoint,
  NormalizedRegion,
  PositionMode,
} from "../types/session";

export function resolveDuration(d: Duration, rng: () => number): number {
  if (d.kind === "fixed") return d.ms;
  if (d.distribution === "gaussian") {
    const mean = (d.min_ms + d.max_ms) / 2;
    const stddev = (d.max_ms - d.min_ms) / 6;
    let u1 = 0;
    let u2 = 0;
    while (u1 === 0) u1 = rng();
    while (u2 === 0) u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.max(d.min_ms, Math.min(d.max_ms, mean + z * stddev));
  }
  return d.min_ms + rng() * (d.max_ms - d.min_ms);
}

function pickPointInRegion(r: NormalizedRegion, rng: () => number): NormalizedPoint {
  return { x: r.x + rng() * r.w, y: r.y + rng() * r.h };
}

export function resolvePosition(
  mode: PositionMode,
  rng: () => number,
  trialIdx: number,
): NormalizedPoint {
  switch (mode.kind) {
    case "central":
      return { x: 0.5, y: 0.5 };
    case "peripheral": {
      const y = 0.5 + (rng() - 0.5) * 0.2;
      if (mode.side === "left") return { x: 0.25, y };
      if (mode.side === "right") return { x: 0.75, y };
      return rng() < 0.5 ? { x: 0.25, y } : { x: 0.75, y };
    }
    case "fixed":
      return mode.positions[trialIdx % mode.positions.length];
    case "random_uniform": {
      const region =
        mode.allowed_regions[Math.floor(rng() * mode.allowed_regions.length)];
      return pickPointInRegion(region, rng);
    }
    case "random_weighted": {
      const totalWeight = mode.regions.reduce((sum, r) => sum + r.weight, 0);
      let target = rng() * totalWeight;
      for (const r of mode.regions) {
        target -= r.weight;
        if (target <= 0) return pickPointInRegion(r.region, rng);
      }
      return pickPointInRegion(mode.regions[mode.regions.length - 1].region, rng);
    }
  }
}

export type Quadrant = "upper_left" | "upper_right" | "lower_left" | "lower_right";

export function quadrantOf(p: NormalizedPoint): Quadrant {
  const left = p.x < 0.5;
  const upper = p.y < 0.5;
  if (upper && left) return "upper_left";
  if (upper && !left) return "upper_right";
  if (!upper && left) return "lower_left";
  return "lower_right";
}
