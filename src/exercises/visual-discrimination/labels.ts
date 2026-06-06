const COLOR_NAMES: Record<string, string> = {
  "#e53935": "Rosso",
  "#43a047": "Verde",
  "#1e88e5": "Blu",
  "#fdd835": "Giallo",
};

const SHAPE_NAMES: Record<string, string> = {
  circle: "Cerchio",
  square: "Quadrato",
  triangle: "Triangolo",
  diamond: "Rombo",
};

export function colorLabel(hex: string): string {
  return COLOR_NAMES[hex.toLowerCase()] ?? hex;
}

export function shapeLabel(shape: string): string {
  return SHAPE_NAMES[shape] ?? shape;
}

export function sideLabel(side: string): string {
  if (side === "left") return "Sinistra";
  if (side === "right") return "Destra";
  return side;
}
