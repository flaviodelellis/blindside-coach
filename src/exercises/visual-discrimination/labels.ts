type Translate = (key: string, params?: Record<string, string | number>) => string;

const COLOR_KEYS: Record<string, string> = {
  "#e53935": "red",
  "#43a047": "green",
  "#1e88e5": "blue",
  "#fdd835": "yellow",
};

const SHAPE_VALUES = new Set(["circle", "square", "triangle", "diamond"]);

export function colorLabel(hex: string, t: Translate): string {
  const key = COLOR_KEYS[hex.toLowerCase()];
  return key ? t(`vd.color.${key}`) : hex;
}

export function shapeLabel(shape: string, t: Translate): string {
  return SHAPE_VALUES.has(shape) ? t(`vd.shape.${shape}`) : shape;
}
