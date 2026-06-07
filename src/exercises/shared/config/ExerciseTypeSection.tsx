import { useT } from "../../../i18n";
import {
  EXERCISE_KINDS,
  TASKS_FOR,
  type ExerciseKind,
  type Task,
} from "./grid";

/**
 * The Esercizio × Modalità selector: pick Tachistoscopia or Discriminazione, then
 * Clinico or Paziente.
 */
export function ExerciseTypeSection({
  exercise,
  task,
  onExerciseChange,
  onTaskChange,
}: {
  exercise: ExerciseKind;
  task: Task;
  onExerciseChange: (e: ExerciseKind) => void;
  onTaskChange: (t: Task) => void;
}) {
  const t = useT();
  const tasks = TASKS_FOR[exercise];
  const showMode = tasks.length > 1;

  return (
    <section className="form-section">
      <h2 className="form-section-title">{t("ex.section.type")}</h2>
      <div className="form-row">
        <label htmlFor="ex_exercise">{t("ex.field.exercise")}</label>
        <select
          id="ex_exercise"
          value={exercise}
          onChange={(e) => onExerciseChange(e.target.value as ExerciseKind)}
        >
          {EXERCISE_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`ex.ex.${k}`)}
            </option>
          ))}
        </select>
      </div>
      {showMode && (
        <div className="form-row">
          <label htmlFor="ex_task">{t("ex.field.task")}</label>
          <select
            id="ex_task"
            value={task}
            onChange={(e) => onTaskChange(e.target.value as Task)}
          >
            {tasks.map((tk) => (
              <option key={tk} value={tk}>
                {t(`ex.task.${tk}`)}
              </option>
            ))}
          </select>
        </div>
      )}
    </section>
  );
}
