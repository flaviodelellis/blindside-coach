import { useRef, useState } from "react";
import {
  type ExerciseTypeId,
  type SavedConfig,
  listConfigs,
  saveConfig,
  deleteConfig,
  downloadConfig,
  parseConfigFile,
} from "../lib/configStore";
import { useT } from "../i18n";
import "./ConfigManager.css";

/**
 * Toolbar for saving/loading exercise configurations: named presets in
 * localStorage plus JSON export/import. Generic over the exercise's form state.
 */
export function ConfigManager<T>({
  exerciseType,
  current,
  onLoad,
}: {
  exerciseType: ExerciseTypeId;
  current: T;
  onLoad: (form: T) => void;
}) {
  const t = useT();
  const [presets, setPresets] = useState<SavedConfig<T>[]>(() =>
    listConfigs<T>(exerciseType),
  );
  const [selected, setSelected] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => setPresets(listConfigs<T>(exerciseType));

  const handleSave = () => {
    const name = window.prompt(t("cfg.prompt.save"));
    if (!name || !name.trim()) return;
    saveConfig(exerciseType, name.trim(), current);
    refresh();
    setSelected(name.trim());
  };

  const handleSelect = (name: string) => {
    setSelected(name);
    if (!name) return;
    const cfg = presets.find((c) => c.name === name);
    if (cfg) onLoad(cfg.form);
  };

  const handleDelete = () => {
    if (!selected) return;
    if (!window.confirm(t("cfg.confirm.delete", { name: selected }))) return;
    deleteConfig(exerciseType, selected);
    setSelected("");
    refresh();
  };

  const handleExport = () => {
    const name = window.prompt(t("cfg.prompt.export"), selected || "");
    if (!name || !name.trim()) return;
    downloadConfig(exerciseType, name.trim(), current);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same file later
    if (!file) return;
    const cfg = parseConfigFile(await file.text());
    if (!cfg) {
      window.alert(t("cfg.error.invalid"));
      return;
    }
    if (cfg.exercise_type !== exerciseType) {
      window.alert(t("cfg.error.wrong_type"));
      return;
    }
    onLoad(cfg.form as T);
  };

  return (
    <div className="config-manager">
      <div className="cfg-title">{t("cfg.section")}</div>

      <button
        type="button"
        className="cfg-btn cfg-block primary"
        onClick={handleSave}
      >
        ⊕ {t("cfg.save")}
      </button>

      <div className="cfg-row">
        <select
          className="cfg-select"
          value={selected}
          onChange={(e) => handleSelect(e.target.value)}
          aria-label={t("cfg.load")}
        >
          <option value="">{t("cfg.load.placeholder")}</option>
          {presets.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="cfg-btn cfg-icon"
          onClick={handleDelete}
          disabled={!selected}
          aria-label={t("cfg.delete")}
          title={t("cfg.delete")}
        >
          🗑
        </button>
      </div>

      <div className="cfg-row">
        <button
          type="button"
          className="cfg-btn cfg-block"
          onClick={handleExport}
        >
          ↓ {t("cfg.export")}
        </button>
        <button
          type="button"
          className="cfg-btn cfg-block"
          onClick={() => fileRef.current?.click()}
        >
          ↑ {t("cfg.import")}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={handleImportFile}
        />
      </div>
    </div>
  );
}
