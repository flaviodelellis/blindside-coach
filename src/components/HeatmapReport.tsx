import { useEffect, useMemo, useRef, useState } from "react";
import type { NormalizedPoint } from "../types/session";
import { useT } from "../i18n";
import "./HeatmapReport.css";

export type HeatmapPoint = {
  position: NormalizedPoint;
  correct: boolean;
  rt_ms?: number;
};

type Metric = "accuracy" | "rt";

type Props = {
  points: HeatmapPoint[];
  aspectRatio?: number;
  fixation?: NormalizedPoint;
  cellsX?: number;
  cellsY?: number;
  sigmaCells?: number;
  compact?: boolean;
};

type CellAgg = {
  n: number;
  nCorrect: number;
  rtSum: number;
  rtN: number;
};

type CellSmoothed = {
  ix: number;
  iy: number;
  weight: number;
  accuracy: number;
  rtMean: number;
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
      row.push({ n: 0, nCorrect: 0, rtSum: 0, rtN: 0 });
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
  }
  return grid;
}

function smoothGrid(
  grid: CellAgg[][],
  sigmaCells: number,
): CellSmoothed[][] {
  const cellsY = grid.length;
  const cellsX = grid[0].length;
  const radius = Math.max(1, Math.ceil(sigmaCells * 2.5));
  const inv2s2 = 1 / (2 * sigmaCells * sigmaCells);

  const out: CellSmoothed[][] = [];
  for (let iy = 0; iy < cellsY; iy++) {
    const row: CellSmoothed[] = [];
    for (let ix = 0; ix < cellsX; ix++) {
      let wSum = 0;
      let accSum = 0;
      let rtSum = 0;
      let rtWSum = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const jy = iy + dy;
        if (jy < 0 || jy >= cellsY) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const jx = ix + dx;
          if (jx < 0 || jx >= cellsX) continue;
          const cell = grid[jy][jx];
          if (cell.n === 0) continue;
          const w = Math.exp(-(dx * dx + dy * dy) * inv2s2);
          wSum += w * cell.n;
          accSum += w * cell.nCorrect;
          if (cell.rtN > 0) {
            rtSum += w * cell.rtSum;
            rtWSum += w * cell.rtN;
          }
        }
      }
      row.push({
        ix,
        iy,
        weight: wSum,
        accuracy: wSum > 0 ? accSum / wSum : 0,
        rtMean: rtWSum > 0 ? rtSum / rtWSum : 0,
      });
    }
    out.push(row);
  }
  return out;
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

function renderHeatmap(
  canvas: HTMLCanvasElement,
  smoothed: CellSmoothed[][],
  raw: CellAgg[][],
  points: HeatmapPoint[],
  fixation: NormalizedPoint,
  metric: Metric,
  rtMin: number,
  rtMax: number,
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

  const cellsY = smoothed.length;
  const cellsX = smoothed[0].length;
  const cellW = cssW / cellsX;
  const cellH = cssH / cellsY;

  let wMax = 0;
  for (const row of smoothed) for (const c of row) if (c.weight > wMax) wMax = c.weight;
  const alphaScale = wMax > 0 ? 1 / Math.min(wMax, 4) : 0;

  const palette = metric === "accuracy" ? PALETTE_ACC : PALETTE_RT;
  for (let iy = 0; iy < cellsY; iy++) {
    for (let ix = 0; ix < cellsX; ix++) {
      const c = smoothed[iy][ix];
      if (c.weight === 0) continue;
      let v: number;
      if (metric === "accuracy") {
        v = c.accuracy;
      } else {
        v = rtMax > rtMin ? (c.rtMean - rtMin) / (rtMax - rtMin) : 0.5;
        v = Math.max(0, Math.min(1, v));
      }
      const [r, g, b] = sampleColor(palette, v);
      const a = Math.min(0.85, c.weight * alphaScale);
      ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
      ctx.fillRect(ix * cellW, iy * cellH, cellW + 0.5, cellH + 0.5);
    }
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

  void raw;
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
  sigmaCells = 1.2,
  compact = false,
}: Props) {
  const t = useT();
  const accCanvasRef = useRef<HTMLCanvasElement>(null);
  const rtCanvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverAcc, setHoverAcc] = useState<Hover>(null);
  const [hoverRt, setHoverRt] = useState<Hover>(null);

  const raw = useMemo(() => aggregateCells(points, cellsX, cellsY), [points, cellsX, cellsY]);
  const smoothed = useMemo(() => smoothGrid(raw, sigmaCells), [raw, sigmaCells]);
  const [rtMin, rtMax] = useMemo(() => rtRange(points), [points]);

  useEffect(() => {
    if (accCanvasRef.current) {
      renderHeatmap(
        accCanvasRef.current,
        smoothed,
        raw,
        points,
        fixation,
        "accuracy",
        rtMin,
        rtMax,
      );
    }
    if (rtCanvasRef.current) {
      renderHeatmap(
        rtCanvasRef.current,
        smoothed,
        raw,
        points,
        fixation,
        "rt",
        rtMin,
        rtMax,
      );
    }
  }, [smoothed, raw, points, fixation, rtMin, rtMax]);

  useEffect(() => {
    const onResize = () => {
      if (accCanvasRef.current) {
        renderHeatmap(
          accCanvasRef.current,
          smoothed,
          raw,
          points,
          fixation,
          "accuracy",
          rtMin,
          rtMax,
        );
      }
      if (rtCanvasRef.current) {
        renderHeatmap(
          rtCanvasRef.current,
          smoothed,
          raw,
          points,
          fixation,
          "rt",
          rtMin,
          rtMax,
        );
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [smoothed, raw, points, fixation, rtMin, rtMax]);

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
          {tooltipFor(hoverAcc, "accuracy")}
        </div>
        <div className="heatmap-legend">
          <span>0%</span>
          <div className="heatmap-legend-bar heatmap-legend-accuracy" />
          <span>100%</span>
        </div>
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
