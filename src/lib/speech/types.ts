/**
 * Engine-agnostic speech recognition contract. The exercise logic only ever
 * talks to this interface, so the underlying engine (Web Speech for dev, an
 * on-device Vosk/Whisper WASM engine for the private hospital build) can be
 * swapped without touching any exercise code.
 */

export type SpeechEngineId = "web-speech" | "vosk";

export type SpeechStatus =
  | "unsupported"
  | "idle"
  | "loading"
  | "ready"
  | "listening"
  | "error";

export type SpeechResult = {
  /** Best transcript so far for the current utterance. */
  transcript: string;
  /** True once the engine considers the utterance finalized. */
  isFinal: boolean;
  /** performance.now() timestamp of the first detected speech, if known. */
  onsetMs?: number;
};

export type SpeechInitOptions = {
  /** BCP-47 language tag, e.g. "it-IT". */
  lang: string;
  /**
   * Optional closed vocabulary. Engines that support a grammar (Vosk) restrict
   * recognition to these words for much higher accuracy; engines that don't
   * (Web Speech) ignore it and rely on post-hoc matching.
   */
  vocabulary?: string[];
};

export interface SpeechRecognizer {
  readonly engine: SpeechEngineId;
  /** Whether this engine can run in the current environment. */
  readonly supported: boolean;
  /** Load model / acquire microphone. Safe to call once; resolves when ready. */
  init(options: SpeechInitOptions): Promise<void>;
  /** Begin a listening session; onResult fires for partial and final results. */
  start(onResult: (r: SpeechResult) => void): void;
  /** Stop the current listening session but keep the engine warm. */
  stop(): void;
  /** Release every resource (mic, worker, model). */
  dispose(): void;
}
