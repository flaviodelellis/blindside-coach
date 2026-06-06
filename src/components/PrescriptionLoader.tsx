import { useRef, useState } from "react";
import { type SavedConfig, parseConfigFile } from "../lib/configStore";
import { BackButton } from "./BackButton";
import { useT } from "../i18n";
import "./PrescriptionLoader.css";

/**
 * "Apri prescrizione": load a saved configuration file (.json) and hand it back
 * so the app can open the matching exercise pre-filled and ready to start.
 */
export function PrescriptionLoader({
  onBack,
  onLoaded,
}: {
  onBack: () => void;
  onLoaded: (cfg: SavedConfig) => void;
}) {
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const cfg = parseConfigFile(await file.text());
    if (!cfg) {
      setError(t("cfg.error.invalid"));
      return;
    }
    setError(null);
    onLoaded(cfg);
  };

  return (
    <main className="page prescription-page">
      <BackButton onClick={onBack} className="fixed" />
      <header>
        <h1>{t("home.prescription.title")}</h1>
        <p className="subtitle">{t("prescription.intro")}</p>
      </header>

      <div className="prescription-drop">
        <span className="prescription-mark" aria-hidden="true">
          ℞
        </span>
        <button
          type="button"
          className="prescription-choose"
          onClick={() => fileRef.current?.click()}
        >
          {t("prescription.choose")}
        </button>
        <p className="form-hint">{t("prescription.hint")}</p>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={handleFile}
        />
      </div>

      {error && <p className="validation-error">{error}</p>}
    </main>
  );
}
