import { useMemo } from "react";
import type { PositionMode } from "../types/session";
import { useT } from "../i18n";
import "./PositionGridSelector.css";

export type GridState = {
  rows: number;
  cols: number;
  cells: number[][]; // 0 = off; >0 = weight (always 1 in uniform mode)
  weighted: boolean;
};

const MAX_WEIGHT = 5;

export function makeEmptyGrid(rows = 3, cols = 4): GridState {
  return {
    rows,
    cols,
    cells: Array.from({ length: rows }, () => Array(cols).fill(0)),
    weighted: false,
  };
}

function fixationCell(
  rows: number,
  cols: number,
  fix: { x: number; y: number },
): { r: number; c: number } {
  return {
    r: Math.min(rows - 1, Math.max(0, Math.floor(fix.y * rows))),
    c: Math.min(cols - 1, Math.max(0, Math.floor(fix.x * cols))),
  };
}

export function gridToPositionMode(grid: GridState): PositionMode | null {
  const toRegion = (r: number, c: number) => ({
    x: c / grid.cols,
    y: r / grid.rows,
    w: 1 / grid.cols,
    h: 1 / grid.rows,
  });

  const active: Array<{ r: number; c: number; weight: number }> = [];
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const v = grid.cells[r]?.[c] ?? 0;
      if (v > 0) active.push({ r, c, weight: v });
    }
  }
  if (active.length === 0) return null;

  if (grid.weighted) {
    return {
      kind: "random_weighted",
      regions: active.map((a) => ({
        region: toRegion(a.r, a.c),
        weight: a.weight,
      })),
    };
  }
  return {
    kind: "random_uniform",
    allowed_regions: active.map((a) => toRegion(a.r, a.c)),
  };
}

type Props = {
  grid: GridState;
  onChange: (next: GridState) => void;
  fixationNorm?: { x: number; y: number };
};

export function PositionGridSelector({ grid, onChange, fixationNorm }: Props) {
  const resize = (rows: number, cols: number) => {
    const cells = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) =>
        r < grid.rows && c < grid.cols ? grid.cells[r][c] : 0,
      ),
    );
    onChange({ ...grid, rows, cols, cells });
  };

  const fixCell = fixationCell(grid.rows, grid.cols, {
    x: fixationNorm?.x ?? 0.5,
    y: fixationNorm?.y ?? 0.5,
  });

  const cycleCell = (r: number, c: number) => {
    const next = grid.cells.map((row) => row.slice());
    if (grid.weighted) {
      next[r][c] = (next[r][c] + 1) % (MAX_WEIGHT + 1);
    } else {
      next[r][c] = next[r][c] > 0 ? 0 : 1;
    }
    onChange({ ...grid, cells: next });
  };

  const clear = () => {
    onChange({
      ...grid,
      cells: Array.from({ length: grid.rows }, () => Array(grid.cols).fill(0)),
    });
  };

  const totalWeight = useMemo(() => {
    let s = 0;
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const v = grid.cells[r]?.[c] ?? 0;
        if (v > 0) s += v;
      }
    }
    return s;
  }, [grid.cells, grid.rows, grid.cols]);

  const activeCount = useMemo(() => {
    let n = 0;
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const v = grid.cells[r]?.[c] ?? 0;
        if (v > 0) n += 1;
      }
    }
    return n;
  }, [grid.cells, grid.rows, grid.cols]);

  const t = useT();
  return (
    <div className="grid-selector">
      <div className="grid-controls">
        <label>
          {t("grid.rows")}
          <input
            type="number"
            min={1}
            max={10}
            value={grid.rows}
            onChange={(e) =>
              resize(
                Math.max(1, Math.min(10, Number(e.target.value))),
                grid.cols,
              )
            }
          />
        </label>
        <label>
          {t("grid.cols")}
          <input
            type="number"
            min={1}
            max={10}
            value={grid.cols}
            onChange={(e) =>
              resize(
                grid.rows,
                Math.max(1, Math.min(10, Number(e.target.value))),
              )
            }
          />
        </label>
        <label className="weighted-toggle">
          <input
            type="checkbox"
            checked={grid.weighted}
            onChange={(e) => onChange({ ...grid, weighted: e.target.checked })}
          />
          {t("grid.weighted")}
        </label>
        <button type="button" className="link-btn" onClick={clear}>
          {t("grid.clear")}
        </button>
      </div>

      <div className="grid-canvas-wrap">
        <div
          className="grid-canvas"
          style={{
            gridTemplateColumns: `repeat(${grid.cols}, 1fr)`,
            gridTemplateRows: `repeat(${grid.rows}, 1fr)`,
          }}
        >
          {grid.cells.map((row, r) =>
            row.map((v, c) => {
              const isFix = r === fixCell.r && c === fixCell.c;
              const enabled = v > 0;
              const pct =
                grid.weighted && totalWeight > 0 && enabled
                  ? Math.round((v / totalWeight) * 100)
                  : null;
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  className={`cell${enabled ? " on" : ""}${isFix ? " is-fixation" : ""}`}
                  onClick={() => cycleCell(r, c)}
                  aria-label={
                    isFix
                      ? `${t("grid.fix.label")}${enabled ? `, ${t("grid.fix.selected")}` : ""}`
                      : `riga ${r + 1} colonna ${c + 1}${enabled ? `, peso ${v}` : ""}`
                  }
                >
                  {isFix && !enabled && (
                    <span className="fix-marker" aria-hidden>
                      +
                    </span>
                  )}
                  {enabled && grid.weighted ? (
                    <span className="weight">
                      <span className="weight-num">{v}</span>
                      {pct !== null && (
                        <span className="weight-pct">{pct}%</span>
                      )}
                    </span>
                  ) : (
                    isFix &&
                    enabled && (
                      <span className="fix-marker on" aria-hidden>
                        +
                      </span>
                    )
                  )}
                </button>
              );
            }),
          )}
        </div>
      </div>

      <p className="grid-hint">
        {activeCount === 0
          ? t("grid.hint.empty")
          : grid.weighted
            ? t("grid.hint.weighted", { max: MAX_WEIGHT })
            : t("grid.hint.uniform", { n: activeCount })}
      </p>
    </div>
  );
}
