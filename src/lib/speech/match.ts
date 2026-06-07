/**
 * Vocabulary matcher for closed-set spoken responses. Given a free-text
 * transcript and the small set of expected answers (each with accepted
 * phrasings), it picks the best match. This is what lets an unconstrained
 * engine like Web Speech work reliably on a tiny domain: we don't trust the
 * raw transcript, we snap it to the nearest allowed answer.
 */

export type VocabEntry = {
  /** Canonical value returned on a match (e.g. a colour hex or a shape id). */
  value: string;
  /** Accepted spoken phrasings, lowercase (synonyms, inflections). */
  phrases: string[];
};

export type MatchOutcome =
  | { kind: "value"; value: string; score: number; matched: string }
  | { kind: "not_seen"; score: number; matched: string }
  | { kind: "none"; score: number };

/** Lowercase, strip accents and punctuation, collapse whitespace. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function words(text: string): string[] {
  const n = normalize(text);
  return n.length === 0 ? [] : n.split(" ");
}

/** Levenshtein edit distance between two short strings. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

/** Similarity in [0,1] between two single words. */
function wordSim(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/** Best similarity of a single phrasing against the transcript words. */
function phraseScore(transcriptWords: string[], phrase: string): number {
  const pw = words(phrase);
  if (pw.length === 0 || transcriptWords.length === 0) return 0;

  if (pw.length === 1) {
    // Exact containment wins outright; otherwise nearest fuzzy word.
    let best = 0;
    for (const tw of transcriptWords) {
      if (tw === pw[0]) return 1;
      best = Math.max(best, wordSim(tw, pw[0]));
    }
    return best;
  }

  // Multi-word phrase ("non ho visto"): fraction of its words present
  // (each satisfied by a sufficiently close transcript word).
  let found = 0;
  for (const p of pw) {
    const present = transcriptWords.some(
      (tw) => tw === p || wordSim(tw, p) >= 0.8,
    );
    if (present) found += 1;
  }
  return found / pw.length;
}

function bestPhrase(
  transcriptWords: string[],
  phrases: string[],
): { score: number; matched: string } {
  let score = 0;
  let matched = "";
  for (const phrase of phrases) {
    const s = phraseScore(transcriptWords, phrase);
    if (s > score) {
      score = s;
      matched = phrase;
    }
  }
  return { score, matched };
}

/**
 * Snap a transcript to the nearest expected answer, or to "not seen", or to
 * nothing if confidence is below `threshold`.
 */
export function matchUtterance(
  transcript: string,
  entries: VocabEntry[],
  notSeenPhrases: string[],
  threshold = 0.7,
): MatchOutcome {
  const tw = words(transcript);
  if (tw.length === 0) return { kind: "none", score: 0 };

  let best: MatchOutcome = { kind: "none", score: 0 };

  for (const entry of entries) {
    const { score, matched } = bestPhrase(tw, entry.phrases);
    if (score > best.score) {
      best = { kind: "value", value: entry.value, score, matched };
    }
  }

  const notSeen = bestPhrase(tw, notSeenPhrases);
  if (notSeen.score > best.score) {
    best = { kind: "not_seen", score: notSeen.score, matched: notSeen.matched };
  }

  return best.score >= threshold ? best : { kind: "none", score: best.score };
}
