import type {
  DiscriminationStimulusKind,
  PresentedStimulus,
} from "../../types/session";

export const SHAPES = ["circle", "square", "triangle", "diamond"] as const;

export const LETTERS = [
  "A", "B", "C", "D", "E", "F", "G", "H",
  "K", "L", "M", "N", "P", "R", "S", "T",
] as const;

export const DEFAULT_COLORS = ["#e53935", "#43a047", "#1e88e5", "#fdd835"] as const;

export function pickStimulus(
  kinds: DiscriminationStimulusKind[],
  colors: string[],
  sizePx: number,
  position: PresentedStimulus["position_norm"],
  rng: () => number,
): PresentedStimulus {
  const kind = kinds[Math.floor(rng() * kinds.length)];
  const color = colors[Math.floor(rng() * colors.length)];

  let value: string;
  if (kind === "shape") {
    value = SHAPES[Math.floor(rng() * SHAPES.length)];
  } else if (kind === "letter") {
    value = LETTERS[Math.floor(rng() * LETTERS.length)];
  } else {
    value = colorNameOf(color);
  }

  return { kind, value, color, position_norm: position, size_px: sizePx };
}

export function renderStimulusHtml(s: PresentedStimulus): string {
  const x = s.position_norm.x * 100;
  const y = s.position_norm.y * 100;
  const baseStyle =
    `position:fixed;left:${x}%;top:${y}%;` +
    `transform:translate(-50%,-50%);` +
    `width:${s.size_px}px;height:${s.size_px}px;` +
    `display:flex;align-items:center;justify-content:center;`;

  if (s.kind === "letter") {
    return `<div style="${baseStyle}font-size:${s.size_px}px;font-weight:bold;color:${s.color};line-height:1;font-family:system-ui,sans-serif;">${escapeHtml(s.value)}</div>`;
  }
  if (s.kind === "color") {
    return `<svg viewBox="0 0 100 100" style="${baseStyle}"><circle cx="50" cy="50" r="45" fill="${s.color}" /></svg>`;
  }
  return `<div style="${baseStyle}">${renderShapeSvg(s.value, s.color)}</div>`;
}

function renderShapeSvg(shape: string, fill: string): string {
  switch (shape) {
    case "square":
      return `<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="5" y="5" width="90" height="90" fill="${fill}" /></svg>`;
    case "triangle":
      return `<svg viewBox="0 0 100 100" width="100%" height="100%"><polygon points="50,8 95,92 5,92" fill="${fill}" /></svg>`;
    case "diamond":
      return `<svg viewBox="0 0 100 100" width="100%" height="100%"><polygon points="50,5 95,50 50,95 5,50" fill="${fill}" /></svg>`;
    case "circle":
    default:
      return `<svg viewBox="0 0 100 100" width="100%" height="100%"><circle cx="50" cy="50" r="45" fill="${fill}" /></svg>`;
  }
}

function colorNameOf(hex: string): string {
  const map: Record<string, string> = {
    "#e53935": "red",
    "#43a047": "green",
    "#1e88e5": "blue",
    "#fdd835": "yellow",
  };
  return map[hex.toLowerCase()] ?? hex;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
