import type { ExerciseTypeId } from "../../../lib/configStore";

/**
 * The product exposes two exercises — Tachistoscopia and Discriminazione — each
 * runnable in two Modalità (who responds): Clinico or Paziente. A chosen pair
 * maps to one of the two engines via {@link exerciseTypeFor}.
 */

export type ExerciseKind = "tachistoscopia" | "discriminazione";
/** Modalità (who responds). Labelled "Modalità" in the UI. */
export type Task = "clinico" | "paziente";

export const EXERCISE_KINDS: ExerciseKind[] = [
  "tachistoscopia",
  "discriminazione",
];

/**
 * Valid Modalità per exercise (first entry is the default). Tachistoscopia offers
 * Clinico/Paziente; Discriminazione is always voice + clinician confirm, so it has
 * a single (hidden) Modalità.
 */
export const TASKS_FOR: Record<ExerciseKind, Task[]> = {
  tachistoscopia: ["clinico", "paziente"],
  discriminazione: ["clinico"],
};

export function exerciseTypeFor(kind: ExerciseKind): ExerciseTypeId {
  return kind === "tachistoscopia" ? "tachistoscopic" : "visual_discrimination";
}

/** The default (first) Modalità for an exercise. */
export function defaultTaskFor(kind: ExerciseKind): Task {
  return TASKS_FOR[kind][0];
}
