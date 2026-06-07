/*
 * This hook synchronizes React with an external system (the speech engine):
 * its status is a lifecycle state machine driven from init/listen callbacks, so
 * setting state inside the effect is intentional here.
 */
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from "react";
import { createRecognizer } from "./index";
import { matchUtterance, type MatchOutcome, type VocabEntry } from "./match";
import type { SpeechEngineId, SpeechRecognizer, SpeechStatus } from "./types";

type Options = {
  /** Listen now (true during the response phase when speech input is enabled). */
  active: boolean;
  engine: SpeechEngineId;
  lang: string;
  entries: VocabEntry[];
  notSeenPhrases: string[];
  /** Flat allowed-word list passed to engines that support a grammar. */
  vocabulary: string[];
  threshold?: number;
};

type SpeechResponseState = {
  status: SpeechStatus;
  transcript: string;
  match: MatchOutcome;
  onsetMs?: number;
  error?: string;
};

const EMPTY_MATCH: MatchOutcome = { kind: "none", score: 0 };

/**
 * Drives a SpeechRecognizer for one response phase, snapping the live transcript
 * to the nearest allowed answer. The owning panel is remounted per trial (via
 * React `key`), so a fresh recognizer + transcript is obtained each trial.
 *
 * NOTE: a per-trial recognizer is fine for the cheap Web Speech dev engine. The
 * on-device Vosk engine (heavy model load) should instead be created once above
 * this hook and passed in — a small refactor when that adapter lands.
 */
export function useSpeechResponse(options: Options): SpeechResponseState {
  const {
    active,
    engine,
    lang,
    entries,
    notSeenPhrases,
    vocabulary,
    threshold = 0.7,
  } = options;

  const recognizerRef = useRef<SpeechRecognizer | null>(null);

  const [status, setStatus] = useState<SpeechStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [onsetMs, setOnsetMs] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const match = transcript
    ? matchUtterance(transcript, entries, notSeenPhrases, threshold)
    : EMPTY_MATCH;

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let rec: SpeechRecognizer;
    try {
      rec = createRecognizer(engine);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
      return;
    }
    if (!rec.supported) {
      setStatus("unsupported");
      return;
    }
    recognizerRef.current = rec;
    setStatus("loading");

    const handle = (r: { transcript: string; onsetMs?: number }) => {
      setTranscript(r.transcript);
      if (r.onsetMs !== undefined) setOnsetMs(r.onsetMs);
    };

    rec
      .init({ lang, vocabulary })
      .then(() => {
        if (cancelled) return;
        setStatus("listening");
        rec.start(handle);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      });

    return () => {
      cancelled = true;
      rec.dispose();
      recognizerRef.current = null;
    };
  }, [active, engine, lang, vocabulary]);

  return { status, transcript, match, onsetMs, error };
}
