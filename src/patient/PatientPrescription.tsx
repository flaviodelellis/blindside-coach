import { useMemo, useState } from "react";
import type { SessionFile, VisualDiscriminationExercise } from "../types/session";
import type { Prescription } from "../lib/prescription";
import {
  configFromForm,
  buildVDSessionFile,
  type VDFormState,
} from "../exercises/visual-discrimination/VisualDiscrimination";
import {
  VisualDiscriminationRunner,
  type EngineResult,
} from "../exercises/visual-discrimination/Runner";
import { saveSession, downloadSession } from "../lib/resultsStore";
import "./PatientPrescription.css";

type Phase = "running" | "done";
type VDConfig = VisualDiscriminationExercise["config"];

/**
 * The patient's view of a prescribed exercise (opened from a link). No config
 * form, no clinician UI: the exercise starts immediately (the browser's own mic
 * prompt is the only gate), then a thank-you with the downloadable results.
 * Discriminazione only (this slice).
 */
export function PatientPrescription({ prescription }: { prescription: Prescription }) {
  const [phase, setPhase] = useState<Phase>("running");
  const [runKey, setRunKey] = useState(0);
  const [session, setSession] = useState<SessionFile | null>(null);

  // Force autonomous voice mode regardless of how the config was saved.
  const config = useMemo<VDConfig>(
    () => ({
      ...configFromForm(prescription.form as VDFormState),
      response_collector: "patient",
      max_attempts: prescription.prescription.max_attempts,
    }),
    [prescription],
  );

  const onComplete = (r: EngineResult) => {
    const { sessionFile } = buildVDSessionFile(config, r);
    saveSession(sessionFile);
    setSession(sessionFile);
    setPhase("done");
  };

  if (phase === "running") {
    return (
      <VisualDiscriminationRunner
        key={runKey}
        config={config}
        onComplete={onComplete}
        onCancel={() => setRunKey((k) => k + 1)}
      />
    );
  }

  if (phase === "done") {
    const correct =
      session?.exercise.type === "visual_discrimination"
        ? session.exercise.trials.filter((t) => t.correct === true).length
        : 0;
    const total = session?.summary.n_trials ?? 0;
    return (
      <main className="patient-page">
        <div className="patient-card">
          <h1>Hai finito! 👏</h1>
          <p className="patient-lead">Grazie, esercizio completato.</p>
          <p className="patient-score">
            {correct} risposte corrette su {total}
          </p>
          {session && (
            <button
              type="button"
              className="patient-cta"
              onClick={() => downloadSession(session)}
            >
              Scarica i risultati
            </button>
          )}
          <p className="patient-note">
            Invia il file dei risultati alla dottoressa.
          </p>
        </div>
      </main>
    );
  }

  return null;
}
