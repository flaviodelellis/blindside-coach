import libraryData from "../assets/word_library.json";
import type { Language, WordEntry, WordLibrary } from "../types/wordLibrary";

const library = libraryData as WordLibrary;

export function getAllWords(): WordEntry[] {
  return library.entries;
}

export type WordFilter = {
  language?: Language | "both";
  categories?: string[];
  lengthRange?: [number, number];
  includePseudowords?: boolean;
};

export function filterWords(filter: WordFilter): WordEntry[] {
  return library.entries.filter((entry) => {
    if (filter.language && filter.language !== "both" && entry.language !== filter.language) {
      return false;
    }
    if (filter.lengthRange) {
      const [min, max] = filter.lengthRange;
      if (entry.length < min || entry.length > max) return false;
    }
    if (filter.includePseudowords === false && entry.is_pseudoword) return false;
    if (filter.categories && filter.categories.length > 0 && !entry.is_pseudoword) {
      const hasAny = filter.categories.some((c) => entry.categories.includes(c));
      if (!hasAny) return false;
    }
    return true;
  });
}

export function pickWords(
  filter: WordFilter,
  count: number,
  pseudowordRatio = 0,
  rng: () => number = Math.random,
): WordEntry[] {
  const reals = filterWords({ ...filter, includePseudowords: false });
  const pseudos = library.entries.filter(
    (e) =>
      e.is_pseudoword &&
      (!filter.language || filter.language === "both" || e.language === filter.language),
  );

  const nPseudo = Math.round(count * pseudowordRatio);
  const nReal = count - nPseudo;

  return [...sampleWithoutReplacement(reals, nReal, rng), ...sampleWithoutReplacement(pseudos, nPseudo, rng)];
}

function sampleWithoutReplacement<T>(source: T[], n: number, rng: () => number): T[] {
  const pool = [...source];
  const result: T[] = [];
  const take = Math.min(n, pool.length);
  for (let i = 0; i < take; i++) {
    const idx = Math.floor(rng() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}
