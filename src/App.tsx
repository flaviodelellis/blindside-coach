import { useState } from "react";
import { UnifiedExercise } from "./exercises/shared/config/UnifiedExercise";
import type { TachFormState } from "./exercises/tachistoscopic/Tachistoscopic";
import type { VDFormState } from "./exercises/visual-discrimination/VisualDiscrimination";
import { PrescriptionLoader } from "./components/PrescriptionLoader";
import { PatientPrescription } from "./patient/PatientPrescription";
import { readPrescriptionFromHash } from "./lib/prescription";
import type { SavedConfig } from "./lib/configStore";
import { LanguageToggle, useT } from "./i18n";
import { BackButton } from "./components/BackButton";
import "./App.css";

type View =
  | "home"
  | "tachistoscopic"
  | "discrimination"
  | "prescription"
  | "review";

type HomeAction = {
  view: Exclude<View, "home">;
  icon: string;
  titleKey: string;
  descKey: string;
};

const HOME_ACTIONS: HomeAction[] = [
  {
    view: "tachistoscopic",
    icon: "◐",
    titleKey: "home.tach.title",
    descKey: "home.tach.desc",
  },
  {
    view: "discrimination",
    icon: "◧",
    titleKey: "home.disc.title",
    descKey: "home.disc.desc",
  },
  {
    view: "prescription",
    icon: "℞",
    titleKey: "home.prescription.title",
    descKey: "home.prescription.desc",
  },
  {
    view: "review",
    icon: "↻",
    titleKey: "home.review.title",
    descKey: "home.review.desc",
  },
];

function Logo() {
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden="true" />
      <span className="brand-name">BlindSide Coach</span>
    </div>
  );
}

function App() {
  // A prescription link (#rx=…) puts the app in patient mode: the patient never
  // sees the clinician home/config.
  const [prescription] = useState(() => readPrescriptionFromHash());
  const [view, setView] = useState<View>("home");
  const [pending, setPending] = useState<SavedConfig | null>(null);
  const t = useT();

  if (prescription) {
    return <PatientPrescription prescription={prescription} />;
  }

  const goHome = () => {
    setPending(null);
    setView("home");
  };

  if (view === "tachistoscopic") {
    return (
      <UnifiedExercise
        onBack={goHome}
        initialExercise="tachistoscopia"
        initialTachForm={
          pending?.exercise_type === "tachistoscopic"
            ? (pending.form as TachFormState)
            : undefined
        }
      />
    );
  }

  if (view === "discrimination") {
    return (
      <UnifiedExercise
        onBack={goHome}
        initialExercise="discriminazione"
        initialVdForm={
          pending?.exercise_type === "visual_discrimination"
            ? (pending.form as VDFormState)
            : undefined
        }
      />
    );
  }

  if (view === "prescription") {
    return (
      <>
        <LanguageToggle className="fixed" />
        <PrescriptionLoader
          onBack={goHome}
          onLoaded={(cfg) => {
            setPending(cfg);
            setView(
              cfg.exercise_type === "tachistoscopic"
                ? "tachistoscopic"
                : "discrimination",
            );
          }}
        />
      </>
    );
  }

  if (view !== "home") {
    return (
      <>
        <LanguageToggle className="fixed" />
        <BackButton onClick={() => setView("home")} className="fixed" />
        <main className="page">
          <h1>{t("common.under_construction")}</h1>
          <p>{t("common.under_construction_msg", { view })}</p>
        </main>
      </>
    );
  }

  return (
    <>
      <header className="app-topbar">
        <Logo />
        <LanguageToggle />
      </header>
      <main className="page page-home">
        <nav className="home-grid" aria-label={t("app.title")}>
          {HOME_ACTIONS.map((a) => (
            <button
              key={a.view}
              type="button"
              className="home-tile"
              onClick={() => setView(a.view)}
            >
              <span className="home-tile-icon" aria-hidden="true">
                {a.icon}
              </span>
              <span className="home-tile-title">{t(a.titleKey)}</span>
              <span className="home-tile-desc">{t(a.descKey)}</span>
            </button>
          ))}
        </nav>
      </main>
    </>
  );
}

export default App;
