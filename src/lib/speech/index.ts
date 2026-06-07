import type { SpeechEngineId, SpeechRecognizer } from "./types";
import { WebSpeechRecognizer } from "./webSpeechRecognizer";

export * from "./types";
export * from "./match";
export { useSpeechResponse } from "./useSpeechResponse";

/**
 * Build a recognizer for the requested engine. `web-speech` is the dev engine;
 * `vosk` is the on-device production target (adapter to be added) — it will
 * implement the same SpeechRecognizer contract, so nothing else changes.
 */
export function createRecognizer(engine: SpeechEngineId): SpeechRecognizer {
  switch (engine) {
    case "web-speech":
      return new WebSpeechRecognizer();
    case "vosk":
      throw new Error(
        "On-device Vosk recognizer not wired yet — use 'web-speech' for now.",
      );
  }
}
