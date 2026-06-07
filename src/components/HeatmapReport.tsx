import { useEffect, useMemo, useRef, useState } from "react";
import type { NormalizedPoint } from "../types/session";
import { useT } from "../i18n";
import "./HeatmapReport.css";

export type HeatmapPoint = {
  position: NormalizedPoint;
  correct: boolean;
  rt_ms?: number;
  /** Number of re-exposures needed (tachistoscopic clinician mode). */
  reps?: number;
};

type Metric = "accuracy" | "rt" | "reps";

type Props = {
  points: HeatmapPoint[];
  aspectRatio?: number;
  fixation?: NormalizedPoint;
  cellsX?: number;
  cellsY?: number;
  compact?: boolean;
  /** Metric shown by the single canvas in compact mode. Default: accuracy. */
  metric?: Metric;
};

type CellAgg = {
  n: number;
  nCorrect: number;
  rtSum: number;
  rtN: number;
  repsSum: number;
  repsN: number;
};

const PALETTE_ACC: Array<[number, [number, number, number]]> = [
  [0.0, [200, 30, 30]],
  [0.5, [240, 200, 60]],
  [1.0, [40, 170, 80]],
];

const PALETTE_RT: Array<[number, [number, number, number]]> = [
  [0.0, [40, 170, 80]],
  [0.5, [240, 200, 60]],
  [1.0, [200, 30, 30]],
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function sampleColor(
  palette: Array<[number, [number, number, number]]>,
  v: number,
): [number, number, number] {
  const x = Math.max(0, Math.min(1, v));
  for (let i = 0; i < palette.length - 1; i++) {
    const [x0, c0] = palette[i];
    const [x1, c1] = palette[i + 1];
    if (x >= x0 && x <= x1) {
      const t = (x - x0) / (x1 - x0);
      return [
        Math.round(lerp(c0[0], c1[0], t)),
        Math.round(lerp(c0[1], c1[1], t)),
        Math.round(lerp(c0[2], c1[2], t)),
      ];
    }
  }
  return palette[palette.length - 1][1];
}

function aggregateCells(
  points: HeatmapPoint[],
  cellsX: number,
  cellsY: number,
): CellAgg[][] {
  const grid: CellAgg[][] = [];
  for (let iy = 0; iy < cellsY; iy++) {
    const row: CellAgg[] = [];
    for (let ix = 0; ix < cellsX; ix++) {
      row.push({ n: 0, nCorrect: 0, rtSum: 0, rtN: 0, repsSum: 0, repsN: 0 });
    }
    grid.push(row);
  }
  for (const p of points) {
    const ix = Math.max(0, Math.min(cellsX - 1, Math.floor(p.position.x * cellsX)));
    const iy = Math.max(0, Math.min(cellsY - 1, Math.floor(p.position.y * cellsY)));
    const cell = grid[iy][ix];
    cell.n += 1;
    if (p.correct) cell.nCorrect += 1;
    if (p.rt_ms != null && p.correct) {
      cell.rtSum += p.rt_ms;
      cell.rtN += 1;
    }
    if (p.reps != null) {
      cell.repsSum += p.reps;
      cell.repsN += 1;
    }
  }
  return grid;
}

function rtRange(points: HeatmapPoint[]): [number, number] {
  const rts = points
    .filter((p) => p.correct && p.rt_ms != null)
    .map((p) => p.rt_ms as number)
    .sort((a, b) => a - b);
  if (rts.length === 0) return [0, 1];
  const p10 = rts[Math.floor(rts.length * 0.1)];
  const p90 = rts[Math.min(rts.length - 1, Math.floor(rts.length * 0.9))];
  if (p90 === p10) return [p10, p10 + 1];
  return [p10, p90];
}

/** Difficulty scale for the re-exposure ("reps") map: 0 → max observed reps. */
function repsRange(points: HeatmapPoint[]): [number, number] {
  const reps = points.map((p) => p.reps ?? 0);
  const max = reps.length > 0 ? Math.max(...reps) : 0;
  return [0, max > 0 ? max : 1];
}

/** Normalized [0,1] metric value for a single point, or null if not applicable. */
function pointValue(
  p: HeatmapPoint,
  metric: Metric,
  rtMin: number,
  rtMax: number,
  repMin: number,
  repMax: number,
): number | null {
  if (metric === "accuracy") return p.correct ? 1 : 0;
  if (metric === "reps") {
    const r = p.reps ?? 0;
    return repMax > repMin ? (r - repMin) / (repMax - repMin) : 0.5;
  }
  if (p.rt_ms == null || !p.correct) return null;
  return rtMax > rtMin ? (p.rt_ms - rtMin) / (rtMax - rtMin) : 0.5;
}

/** Halo radius as a fraction of the canvas' shorter side. */
const HALO_FRAC = 0.16;
const HALO_PEAK_ALPHA = 0.55;

function renderHeatmap(
  canvas: HTMLCanvasElement,
  points: HeatmapPoint[],
  fixation: NormalizedPoint,
  metric: Metric,
  rtMin: number,
  rtMax: number,
  repMin: number,
  repMax: number,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  if (cssW === 0 || cssH === 0) return;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const palette = metric === "accuracy" ? PALETTE_ACC : PALETTE_RT;
  const radius = HALO_FRAC * Math.min(cssW, cssH);

  // One soft radial halo per word, centered exactly where it fell and fading to
  // zero at `radius`. Untouched regions of the field stay transparent — the
  // sfumatura never colors areas no word ever landed on.
  for (const p of points) {
    const raw = pointValue(p, metric, rtMin, rtMax, repMin, repMax);
    if (raw == null) continue;
    const v = Math.max(0, Math.min(1, raw));
    const [r, g, b] = sampleColor(palette, v);
    const cx = p.position.x * cssW;
    const cy = p.position.y * cssH;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, `rgba(${r},${g},${b},${HALO_PEAK_ALPHA})`);
    grad.addColorStop(0.5, `rgba(${r},${g},${b},${HALO_PEAK_ALPHA * 0.5})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  for (const p of points) {
    const px = p.position.x * cssW;
    const py = p.position.y * cssH;
    ctx.beginPath();
    ctx.arc(px, py, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = 1;
  const fx = fixation.x * cssW;
  const fy = fixation.y * cssH;
  ctx.beginPath();
  ctx.moveTo(fx - 6, fy);
  ctx.lineTo(fx + 6, fy);
  ctx.moveTo(fx, fy - 6);
  ctx.lineTo(fx, fy + 6);
  ctx.stroke();

  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, cssH / 2);
  ctx.lineTo(cssW, cssH / 2);
  ctx.moveTo(cssW / 2, 0);
  ctx.lineTo(cssW / 2, cssH);
  ctx.stroke();
}

type Hover = {
  ix: number;
  iy: number;
  cssX: number;
  cssY: number;
} | null;

export function HeatmapReport({
  points,
  aspectRatio = 16 / 9,
  fixation = { x: 0.5, y: 0.5 },
  cellsX = 12,
  cellsY = 8,
  compact = false,
  metric = "accuracy",
}: Props) {
  const t = useT();
  const accCanvasRef = useRef<HTMLCanvasElement>(null);
  const rtCanvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverAcc, setHoverAcc] = useState<Hover>(null);
  const [hoverRt, setHoverRt] = useState<Hover>(null);

  // In compact mode the single canvas shows the requested metric; the full
  // view always pairs accuracy + RT.
  const primaryMetric: Metric = compact ? metric : "accuracy";

  const raw = useMemo(() => aggregateCells(points, cellsX, cellsY), [points, cellsX, cellsY]);
  const [rtMin, rtMax] = useMemo(() => rtRange(points), [points]);
  const [repMin, repMax] = useMemo(() => repsRange(points), [points]);

  useEffect(() => {
    const draw = () => {
      if (accCanvasRef.current) {
        renderHeatmap(
          accCanvasRef.current,
          points,
          fixation,
          primaryMetric,
          rtMin,
          rtMax,
          repMin,
          repMax,
        );
      }
      if (rtCanvasRef.current) {
        renderHeatmap(
          rtCanvasRef.current,
          points,
          fixation,
          "rt",
          rtMin,
          rtMax,
          repMin,
          repMax,
        );
      }
    };
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [points, fixation, primaryMetric, rtMin, rtMax, repMin, repMax]);

  const onMove = (
    setHover: (h: Hover) => void,
    e: React.MouseEvent<HTMLCanvasElement>,
  ) => {
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ix = Math.max(0, Math.min(cellsX - 1, Math.floor((x / rect.width) * cellsX)));
    const iy = Math.max(0, Math.min(cellsY - 1, Math.floor((y / rect.height) * cellsY)));
    setHover({ ix, iy, cssX: x, cssY: y });
  };

  const tooltipFor = (h: Hover, kind: Metric) => {
    if (!h) return null;
    const cell = raw[h.iy][h.ix];
    if (cell.n === 0) {
      return (
        <div
          className="heatmap-tooltip"
          style={{ left: h.cssX + 12, top: h.cssY + 12 }}
        >
          {t("heatmap.tooltip.no_data")}
        </div>
      );
    }
    const acc = cell.nCorrect / cell.n;
    const rt = cell.rtN > 0 ? cell.rtSum / cell.rtN : null;
    const reps = cell.repsN > 0 ? cell.repsSum / cell.repsN : null;
    return (
      <div
        className="heatmap-tooltip"
        style={{ left: h.cssX + 12, top: h.cssY + 12 }}
      >
        <div>
          {t("heatmap.tooltip.trials")}: <b>{cell.n}</b>
        </div>
        {kind === "accuracy" && (
          <div>
            {t("heatmap.tooltip.accuracy")}: <b>{(acc * 100).toFixed(0)}%</b>
          </div>
        )}
        {kind === "rt" && (
          <div>
            {t("heatmap.tooltip.rt")}:{" "}
            <b>{rt != null ? `${Math.round(rt)} ms` : "-"}</b>
          </div>
        )}
        {kind === "reps" && (
          <div>
            {t("heatmap.tooltip.reps")}:{" "}
            <b>{reps != null ? `${reps.toFixed(1)}×` : "-"}</b>
          </div>
        )}
      </div>
    );
  };

  const nWithData = points.length;

  if (compact) {
    return (
      <div className="heatmap-report heatmap-compact">
        <div
          className="heatmap-canvas-wrap"
          style={{ aspectRatio: `${aspectRatio}` }}
        >
          <canvas
            ref={accCanvasRef}
            onMouseMove={(e) => onMove(setHoverAcc, e)}
            onMouseLeave={() => setHoverAcc(null)}
          />
          {tooltipFor(hoverAcc, primaryMetric)}
        </div>
        {primaryMetric === "reps" ? (
          <div className="heatmap-legend">
            <span>{t("heatmap.legend.few")}</span>
            <div className="heatmap-legend-bar heatmap-legend-rt" />
            <span>{t("heatmap.legend.many")}</span>
          </div>
        ) : (
          <div className="heatmap-legend">
            <span>0%</span>
            <div className="heatmap-legend-bar heatmap-legend-accuracy" />
            <span>100%</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="heatmap-report">
      <header className="heatmap-header">
        <h2>{t("heatmap.title")}</h2>
        <p className="heatmap-meta">
          {t("heatmap.meta", { n: nWithData })}
        </p>
      </header>

      <div className="heatmap-grid">
        <figure className="heatmap-figure">
          <figcaption>{t("heatmap.fig.accuracy")}</figcaption>
          <div
            className="heatmap-canvas-wrap"
            style={{ aspectRatio: `${aspectRatio}` }}
          >
            <canvas
              ref={accCanvasRef}
              onMouseMove={(e) => onMove(setHoverAcc, e)}
              onMouseLeave={() => setHoverAcc(null)}
            />
            {tooltipFor(hoverAcc, "accuracy")}
          </div>
          <div className="heatmap-legend">
            <span>0%</span>
            <div className="heatmap-legend-bar heatmap-legend-accuracy" />
            <span>100%</span>
          </div>
        </figure>

        <figure className="heatmap-figure">
          <figcaption>{t("heatmap.fig.rt")}</figcaption>
          <div
            className="heatmap-canvas-wrap"
            style={{ aspectRatio: `${aspectRatio}` }}
          >
            <canvas
              ref={rtCanvasRef}
              onMouseMove={(e) => onMove(setHoverRt, e)}
              onMouseLeave={() => setHoverRt(null)}
            />
            {tooltipFor(hoverRt, "rt")}
          </div>
          <div className="heatmap-legend">
            <span>{Math.round(rtMin)} ms</span>
            <div className="heatmap-legend-bar heatmap-legend-rt" />
            <span>{Math.round(rtMax)} ms</span>
          </div>
        </figure>
      </div>
    </section>
  );
}
