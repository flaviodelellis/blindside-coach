import type { DiscriminationDimension } from "../../types/session";
import { normalize, type VocabEntry } from "../../lib/speech";

/** Accepted Italian phrasings for each forced-choice answer. */
const COLOR_PHRASES: Record<string, string[]> = {
  "#e53935": ["rosso", "rossa"],
  "#43a047": ["verde"],
  "#1e88e5": ["blu", "azzurro"],
  "#fdd835": ["giallo", "gialla"],
};

const SHAPE_PHRASES: Record<string, string[]> = {
  circle: ["cerchio", "tondo", "rotondo", "pallino", "palla"],
  square: ["quadrato", "quadrata"],
  triangle: ["triangolo"],
  diamond: ["rombo", "diamante"],
};

const SIDE_PHRASES: Record<string, string[]> = {
  left: ["sinistra", "sinistro", "sx"],
  right: ["destra", "destro", "dx"],
};

/** Ways a patient may report not seeing anything. */
export const NOT_SEEN_PHRASES = [
  "niente",
  "nulla",
  "non ho visto",
  "non l ho visto",
  "non vedo",
  "non lo so",
  "non so",
  "boh",
];

export type Vocab = {
  entries: VocabEntry[];
  notSeen: string[];
  /** Flat, de-duplicated word list for grammar-constrained engines. */
  flat: string[];
};

/** Build the matcher vocabulary for a dimension and its alternatives. */
export function buildVocab(
  dimension: DiscriminationDimension,
  alternatives: string[],
): Vocab {
  const table =
    dimension === "color"
      ? COLOR_PHRASES
      : dimension === "shape"
        ? SHAPE_PHRASES
        : SIDE_PHRASES;

  const entries: VocabEntry[] = alternatives.map((value) => {
    const phrases = table[value.toLowerCase()] ?? [value];
    return { value, phrases: phrases.map(normalize) };
  });
  const notSeen = NOT_SEEN_PHRASES.map(normalize);

  const flat = Array.from(
    new Set(
      [...entries.flatMap((e) => e.phrases), ...notSeen].flatMap((p) =>
        p.split(" "),
      ),
    ),
  );

  return { entries, notSeen, flat };
}
