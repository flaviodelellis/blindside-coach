import { useState } from "react";
import { LanguageToggle, useT } from "../../../i18n";
import { ExerciseTypeSection } from "./ExerciseTypeSection";
import {
  exerciseTypeFor,
  defaultTaskFor,
  type ExerciseKind,
  type Task,
} from "./grid";
import { TachistoscopicRunner } from "../../tachistoscopic/Runner";
import { VisualDiscriminationRunner } from "../../visual-discrimination/Runner";
import {
  TachConfigBody,
  TachLiveSummary,
  TachResults,
  buildTachSessionFile,
  tachCannotStart,
  configFromForm as tachConfigFromForm,
  TACH_DEFAULT_FORM,
  type TachFormState,
  type RunOutcome as TachRunOutcome,
} from "../../tachistoscopic/Tachistoscopic";
import {
  VDConfigBody,
  VDLiveSummary,
  VDResults,
  buildVDSessionFile,
  vdValidateForm,
  configFromForm as vdConfigFromForm,
  VD_DEFAULT_FORM,
  type VDFormState,
  type RunOutcome as VDRunOutcome,
} from "../../visual-discrimination/VisualDiscrimination";

type Mode = "configure" | "running" | "results";

/**
 * The single configure → run → results screen. The Esercizio×Modalità selector
 * picks the exercise and who responds; the matching exercise's own body, summary,
 * runner and results are reused unchanged. Both per-exercise form states are kept
 * so switching exercise preserves each side's settings.
 */
export function UnifiedExercise({
  onBack,
  initialExercise,
  initialTachForm,
  initialVdForm,
}: {
  onBack: () => void;
  initialExercise: ExerciseKind;
  initialTachForm?: TachFormState;
  initialVdForm?: VDFormState;
}) {
  const t = useT();

  const [tachForm, setTachForm] = useState<TachFormState>(
    initialTachForm
      ? { ...TACH_DEFAULT_FORM, ...initialTachForm }
      : TACH_DEFAULT_FORM,
  );
  const [vdForm, setVdForm] = useState<VDFormState>(
    initialVdForm ? { ...VD_DEFAULT_FORM, ...initialVdForm } : VD_DEFAULT_FORM,
  );

  // A loaded preset's nature wins over the generic initialExercise from the home.
  const initialExerciseResolved: ExerciseKind = initialVdForm
    ? "discriminazione"
    : initialTachForm
      ? "tachistoscopia"
      : initialExercise;
  const [exercise, setExercise] = useState<ExerciseKind>(initialExerciseResolved);
  const [task, setTask] = useState<Task>(() => {
    if (initialTachForm)
      return initialTachForm.patient_self_test ? "paziente" : "clinico";
    if (initialVdForm)
      return initialVdForm.response_input === "speech" ? "paziente" : "clinico";
    return defaultTaskFor(initialExerciseResolved);
  });

  const [mode, setMode] = useState<Mode>("configure");
  const [tachOutcome, setTachOutcome] = useState<TachRunOutcome | null>(null);
  const [vdOutcome, setVdOutcome] = useState<VDRunOutcome | null>(null);
  const [vdRunConfig, setVdRunConfig] = useState<ReturnType<
    typeof vdConfigFromForm
  > | null>(null);
  const [vdError, setVdError] = useState<string | null>(null);

  const exType = exerciseTypeFor(exercise);

  const onExerciseChange = (k: ExerciseKind) => {
    setExercise(k);
    // Modalità is Clinico/Paziente; restore the destination side's stored mode.
    if (k === "tachistoscopia") {
      setTask(tachForm.patient_self_test ? "paziente" : "clinico");
    } else {
      setTask(vdForm.response_input === "speech" ? "paziente" : "clinico");
    }
  };

  const onTaskChange = (tk: Task) => {
    setTask(tk);
    // Only Tachistoscopia exposes Modalità; Discriminazione is always voice.
    if (exercise === "tachistoscopia") {
      setTachForm((f) => ({ ...f, patient_self_test: tk === "paziente" }));
    }
  };

  const selector = (
    <ExerciseTypeSection
      exercise={exercise}
      task={task}
      onExerciseChange={onExerciseChange}
      onTaskChange={onTaskChange}
    />
  );

  // ---- running ----
  if (mode === "running") {
    if (exType === "tachistoscopic") {
      return (
        <TachistoscopicRunner
          config={tachConfigFromForm(tachForm)}
          onComplete={(r) => {
            setTachOutcome(buildTachSessionFile(tachForm, r));
            setMode("results");
          }}
          onCancel={() => setMode("configure")}
        />
      );
    }
    if (vdRunConfig) {
      return (
        <VisualDiscriminationRunner
          config={vdRunConfig}
          onComplete={(r) => {
            setVdOutcome(buildVDSessionFile(vdRunConfig, r));
            setMode("results");
          }}
          onCancel={() => setMode("configure")}
        />
      );
    }
  }

  // ---- results ----
  if (mode === "results") {
    const restart = () => {
      setTachOutcome(null);
      setVdOutcome(null);
      setMode("configure");
    };
    if (exType === "tachistoscopic" && tachOutcome) {
      return (
        <TachResults outcome={tachOutcome} onRestart={restart} onBack={onBack} />
      );
    }
    if (exType === "visual_discrimination" && vdOutcome) {
      return (
        <VDResults outcome={vdOutcome} onRestart={restart} onBack={onBack} />
      );
    }
  }

  // ---- configure ----
  const startTach = () => {
    if (!tachCannotStart(tachForm)) setMode("running");
  };
  const startVd = () => {
    const err = vdValidateForm(vdForm);
    if (err) {
      setVdError(err);
      return;
    }
    setVdRunConfig(vdConfigFromForm(vdForm));
    setMode("running");
  };

  return (
    <>
      <header className="config-topbar">
        <div className="config-topbar-left">
          <button
            type="button"
            className="config-back"
            onClick={onBack}
            aria-label={t("common.home")}
          >
            {t("common.home")}
          </button>
        </div>
        <LanguageToggle />
      </header>
      <main className="page page-config">
        <div className="form-layout">
          {exType === "tachistoscopic" ? (
            <>
              <TachConfigBody
                form={tachForm}
                onChange={setTachForm}
                typeSelector={selector}
              />
              <aside className="form-summary">
                <TachLiveSummary
                  form={tachForm}
                  onStart={startTach}
                  disabled={tachCannotStart(tachForm)}
                  onLoad={(f) => {
                    const merged = { ...TACH_DEFAULT_FORM, ...f };
                    setTachForm(merged);
                    setTask(merged.patient_self_test ? "paziente" : "clinico");
                  }}
                />
              </aside>
            </>
          ) : (
            <>
              <VDConfigBody
                form={vdForm}
                onChange={(next) => {
                  setVdForm(next);
                  setVdError(null);
                }}
                typeSelector={selector}
                validationError={vdError}
              />
              <aside className="form-summary">
                <VDLiveSummary
                  form={vdForm}
                  onStart={startVd}
                  onLoad={(f) => {
                    // Discriminazione is always voice — force it regardless of preset.
                    const merged = {
                      ...VD_DEFAULT_FORM,
                      ...f,
                      response_input: "speech" as const,
                    };
                    setVdForm(merged);
                    setVdError(null);
                    setExercise("discriminazione");
                  }}
                />
              </aside>
            </>
          )}
        </div>
      </main>
    </>
  );
}
