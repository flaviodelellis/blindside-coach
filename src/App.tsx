import { useState } from "react";
import { Tachistoscopic } from "./exercises/tachistoscopic/Tachistoscopic";
import { VisualDiscrimination } from "./exercises/visual-discrimination/VisualDiscrimination";
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
  const [view, setView] = useState<View>("home");
  const t = useT();

  if (view === "tachistoscopic") {
    return <Tachistoscopic onBack={() => setView("home")} />;
  }

  if (view === "discrimination") {
    return (
      <>
        <LanguageToggle className="fixed" />
        <VisualDiscrimination onBack={() => setView("home")} />
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
