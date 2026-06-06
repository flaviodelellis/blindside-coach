// Saving and reusing exercise configurations.
//
// Two storage paths, same payload:
//  - localStorage  → named presets for quick reuse on this machine
//  - JSON file     → portable export/import (and the "Apri prescrizione" flow)
//
// The payload is the exercise's UI form state, tagged with the exercise type so
// it can be routed back to the right exercise on load.

export type ExerciseTypeId = "tachistoscopic" | "visual_discrimination";

export type SavedConfig<T = unknown> = {
  schema_version: "1.0";
  kind: "blindside-config";
  exercise_type: ExerciseTypeId;
  name: string;
  created_at: string;
  form: T;
};

const STORAGE_KEY = "blindside-saved-configs";

function readAll(): SavedConfig[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as SavedConfig[]) : [];
  } catch {
    return [];
  }
}

function writeAll(list: SavedConfig[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function makeConfig<T>(
  exerciseType: ExerciseTypeId,
  name: string,
  form: T,
): SavedConfig<T> {
  return {
    schema_version: "1.0",
    kind: "blindside-config",
    exercise_type: exerciseType,
    name,
    created_at: new Date().toISOString(),
    form,
  };
}

/** Presets saved for a given exercise, newest first. */
export function listConfigs<T = unknown>(
  exerciseType: ExerciseTypeId,
): SavedConfig<T>[] {
  return readAll()
    .filter((c) => c.exercise_type === exerciseType)
    .reverse() as SavedConfig<T>[];
}

/** Upsert a preset by (exercise_type, name). */
export function saveConfig<T>(
  exerciseType: ExerciseTypeId,
  name: string,
  form: T,
): void {
  const all = readAll().filter(
    (c) => !(c.exercise_type === exerciseType && c.name === name),
  );
  all.push(makeConfig(exerciseType, name, form));
  writeAll(all);
}

export function deleteConfig(
  exerciseType: ExerciseTypeId,
  name: string,
): void {
  writeAll(
    readAll().filter(
      (c) => !(c.exercise_type === exerciseType && c.name === name),
    ),
  );
}

/** Trigger a browser download of a config as a .json file. */
export function downloadConfig<T>(
  exerciseType: ExerciseTypeId,
  name: string,
  form: T,
): void {
  const cfg = makeConfig(exerciseType, name, form);
  const safe = name.replace(/[^\w.-]+/g, "_").slice(0, 60) || "config";
  const blob = new Blob([JSON.stringify(cfg, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `blindside-config-${safe}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Parse and validate a config file's text. Returns null if it isn't one. */
export function parseConfigFile(text: string): SavedConfig | null {
  try {
    const obj = JSON.parse(text) as Partial<SavedConfig>;
    if (
      obj &&
      obj.kind === "blindside-config" &&
      (obj.exercise_type === "tachistoscopic" ||
        obj.exercise_type === "visual_discrimination") &&
      typeof obj.form === "object" &&
      obj.form !== null
    ) {
      return obj as SavedConfig;
    }
    return null;
  } catch {
    return null;
  }
}
