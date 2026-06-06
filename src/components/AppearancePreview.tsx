import { useEffect, useState } from "react";
import { useT } from "../i18n";
import "./AppearancePreview.css";

export type PreviewPoint = { x: number; y: number };

// 16:9 mini-screen. Pixel sizes from the config are scaled into this space
// relative to a reference screen width so proportions look realistic.
const VIEW_W = 160;
const VIEW_H = 90;
const REF_SCREEN_W = 1366;
const SCALE = VIEW_W / REF_SCREEN_W;

type Props = {
  background: string;
  wordColor: string;
  fixationColor: string;
  fontSizePx: number;
  fixationSizePx?: number;
  word: string;
  points: PreviewPoint[];
  label?: string;
};

/**
 * A scaled-down mock of the exercise screen (background, fixation cross, sample
 * word at the configured position/size/colour). Click it to blow it up to a
 * true full-screen, real-pixel-size representation.
 */
export function AppearancePreview(props: Props) {
  const {
    background,
    wordColor,
    fixationColor,
    fontSizePx,
    fixationSizePx = 32,
    word,
    points,
    label,
  } = props;
  const t = useT();
  const [expanded, setExpanded] = useState(false);

  const fz = Math.max(3.5, fontSizePx * SCALE);
  const crossSize = Math.max(4, fixationSizePx * SCALE);

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
          <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill={background} />
          {points.map((p, i) => (
            <text
              key={i}
              x={p.x * VIEW_W}
              y={p.y * VIEW_H}
              fill={wordColor}
              fontSize={fz}
              fontFamily="system-ui, sans-serif"
              fontWeight={600}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {word}
            </text>
          ))}
          <text
            x={VIEW_W / 2}
            y={VIEW_H / 2}
            fill={fixationColor}
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
        <AppearanceFullscreen {...props} onClose={() => setExpanded(false)} />
      )}
    </>
  );
}

function AppearanceFullscreen({
  background,
  wordColor,
  fixationColor,
  fontSizePx,
  fixationSizePx = 32,
  word,
  points,
  onClose,
}: Props & { onClose: () => void }) {
  const t = useT();

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
      style={{ background }}
      role="dialog"
      aria-modal="true"
      aria-label={t("preview.expand")}
      onClick={onClose}
    >
      {points.map((p, i) => (
        <span
          key={i}
          className="appearance-fs-word"
          style={{
            left: `${p.x * 100}%`,
            top: `${p.y * 100}%`,
            color: wordColor,
            fontSize: fontSizePx,
          }}
        >
          {word}
        </span>
      ))}
      <span
        className="appearance-fs-cross"
        style={{ color: fixationColor, fontSize: fixationSizePx }}
      >
        +
      </span>
      <button type="button" className="appearance-fs-close" onClick={onClose}>
        ✕ {t("preview.close")}
      </button>
    </div>
  );
}
