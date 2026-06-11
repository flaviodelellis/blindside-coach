import type { DiscriminationDimension } from "../../types/session";
import { normalize, type VocabEntry } from "../../lib/speech";
import { SHAPES } from "./stimuli";

/** Language of the patient's spoken answer. */
export type SpeechVocabLang = "it" | "en";

/** Derive the vocabulary language from a BCP-47 speech tag (e.g. "en-US" → "en"). */
export function vocabLang(speechLang: string | undefined): SpeechVocabLang {
  return speechLang?.toLowerCase().startsWith("en") ? "en" : "it";
}

/** Accepted phrasings for each forced-choice answer, per language. */
const COLOR_PHRASES: Record<SpeechVocabLang, Record<string, string[]>> = {
  it: {
    "#e53935": ["rosso", "rossa"],
    "#43a047": ["verde"],
    "#1e88e5": ["blu", "azzurro"],
    "#fdd835": ["giallo", "gialla"],
  },
  en: {
    "#e53935": ["red"],
    "#43a047": ["green"],
    "#1e88e5": ["blue"],
    "#fdd835": ["yellow"],
  },
};

const SHAPE_PHRASES: Record<SpeechVocabLang, Record<string, string[]>> = {
  it: {
    circle: ["cerchio", "tondo", "rotondo", "pallino", "palla"],
    square: ["quadrato", "quadrata"],
    triangle: ["triangolo"],
    diamond: ["rombo", "diamante"],
  },
  en: {
    circle: ["circle", "round", "dot"],
    square: ["square"],
    triangle: ["triangle"],
    diamond: ["diamond", "rhombus"],
  },
};

const SIDE_PHRASES: Record<SpeechVocabLang, Record<string, string[]>> = {
  it: {
    left: ["sinistra", "sinistro", "sx"],
    right: ["destra", "destro", "dx"],
  },
  en: {
    left: ["left"],
    right: ["right"],
  },
};

/** Ways a patient may report not seeing anything, per language. */
const NOT_SEEN: Record<SpeechVocabLang, string[]> = {
  it: [
    "niente",
    "nulla",
    "non ho visto",
    "non l ho visto",
    "non vedo",
    "non lo so",
    "non so",
    "boh",
  ],
  en: [
    "nothing",
    "didn't see it",
    "did not see",
    "i didn't see anything",
    "don't know",
    "i don't know",
    "no idea",
    "not sure",
  ],
};

/**
 * Italian not-seen phrases — kept as a flat export for back-compat (the
 * tachistoscopic exercise imports this directly). Use {@link buildVocab} /
 * {@link buildCombinedVocab} for the language-aware path.
 */
export const NOT_SEEN_PHRASES = NOT_SEEN.it;

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
  lang: SpeechVocabLang = "it",
): Vocab {
  const table =
    dimension === "color"
      ? COLOR_PHRASES[lang]
      : dimension === "shape"
        ? SHAPE_PHRASES[lang]
        : SIDE_PHRASES[lang];

  const entries: VocabEntry[] = alternatives.map((value) => {
    const phrases = table[value.toLowerCase()] ?? [value];
    return { value, phrases: phrases.map(normalize) };
  });
  const notSeen = NOT_SEEN[lang].map(normalize);

  const flat = Array.from(
    new Set(
      [...entries.flatMap((e) => e.phrases), ...notSeen].flatMap((p) =>
        p.split(" "),
      ),
    ),
  );

  return { entries, notSeen, flat };
}

export type CombinedVocab = {
  shape: VocabEntry[];
  color: VocabEntry[];
  notSeen: string[];
  /** Flat, de-duplicated word list (shape ∪ colour ∪ not-seen) for grammars. */
  flat: string[];
};

/**
 * Vocabulary for the combined shape+colour task: the patient says both (e.g.
 * "cerchio rosso"), so we keep the two attribute vocabularies separate and match
 * each against the same transcript.
 */
export function buildCombinedVocab(
  colors: string[],
  lang: SpeechVocabLang = "it",
): CombinedVocab {
  const shape = buildVocab("shape", [...SHAPES], lang);
  const color = buildVocab("color", colors, lang);
  const flat = Array.from(new Set([...shape.flat, ...color.flat]));
  return { shape: shape.entries, color: color.entries, notSeen: shape.notSeen, flat };
}
