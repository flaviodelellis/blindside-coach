import type {
  SpeechInitOptions,
  SpeechRecognizer,
  SpeechResult,
} from "./types";

/**
 * Web Speech API adapter — the DEVELOPMENT engine. It is trivial to run (Chrome
 * / Edge, no model download) and lets us validate the whole interaction flow,
 * BUT it streams the patient's audio to Google's servers and needs internet.
 * For the real hospital build use the on-device Vosk adapter, which implements
 * this same interface. Do not ship this as the default for patient data.
 */

// Minimal typings for the non-standard Web Speech API.
type SpeechRecognitionAlternativeLike = { transcript: string };
type SpeechRecognitionResultLike = {
  0: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export class WebSpeechRecognizer implements SpeechRecognizer {
  readonly engine = "web-speech" as const;
  readonly supported = getCtor() !== null;

  private recognition: SpeechRecognitionLike | null = null;
  private onResult: ((r: SpeechResult) => void) | null = null;
  private listening = false;
  private onsetMs: number | undefined;

  async init(options: SpeechInitOptions): Promise<void> {
    const Ctor = getCtor();
    if (!Ctor) throw new Error("Web Speech API not supported");
    const rec = new Ctor();
    rec.lang = options.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      if (!this.onResult) return;
      let transcript = "";
      let isFinal = false;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        transcript += res[0].transcript;
        if (res.isFinal) isFinal = true;
      }
      if (transcript.trim().length > 0 && this.onsetMs === undefined) {
        this.onsetMs = performance.now();
      }
      this.onResult({ transcript, isFinal, onsetMs: this.onsetMs });
    };
    // Keep the session alive across natural pauses while we're meant to listen.
    rec.onend = () => {
      if (this.listening) {
        try {
          rec.start();
        } catch {
          /* already started */
        }
      }
    };
    this.recognition = rec;
  }

  start(onResult: (r: SpeechResult) => void): void {
    if (!this.recognition) throw new Error("init() not called");
    this.onResult = onResult;
    this.onsetMs = undefined;
    this.listening = true;
    try {
      this.recognition.start();
    } catch {
      /* start() throws if already running; ignore */
    }
  }

  stop(): void {
    this.listening = false;
    this.onResult = null;
    this.recognition?.stop();
  }

  dispose(): void {
    this.listening = false;
    this.onResult = null;
    if (this.recognition) {
      this.recognition.onresult = null;
      this.recognition.onend = null;
      this.recognition.onerror = null;
      this.recognition.abort();
      this.recognition = null;
    }
  }
}
