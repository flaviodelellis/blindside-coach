import { useEffect, useRef, useState } from "react";
import {
  ensureWebGazerStarted,
  recordCalibrationPoint,
  setVideoPreviewVisible,
} from "../lib/webgazer";
import { useT } from "../i18n";
import "./GazeCalibration.css";

const CALIBRATION_POINTS: Array<{ x: number; y: number }> = [
  { x: 0.1, y: 0.1 },
  { x: 0.5, y: 0.1 },
  { x: 0.9, y: 0.1 },
  { x: 0.1, y: 0.5 },
  { x: 0.5, y: 0.5 },
  { x: 0.9, y: 0.5 },
  { x: 0.1, y: 0.9 },
  { x: 0.5, y: 0.9 },
  { x: 0.9, y: 0.9 },
];

const CLICKS_PER_POINT = 5;

export function GazeCalibration({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [status, setStatus] = useState<"starting" | "ready" | "error">(
    "starting",
  );
  const [errMsg, setErrMsg] = useState<string>("");
  const [pointIdx, setPointIdx] = useState(0);
  const [clicks, setClicks] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        await ensureWebGazerStarted();
        if (!mountedRef.current) return;
        setVideoPreviewVisible(true);
        setStatus("ready");
      } catch (e) {
        if (!mountedRef.current) return;
        setStatus("error");
        setErrMsg(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      mountedRef.current = false;
      setVideoPreviewVisible(false);
    };
  }, []);

  const handleClick = (px: number, py: number) => {
    recordCalibrationPoint(px, py);
    const nextClicks = clicks + 1;
    if (nextClicks >= CLICKS_PER_POINT) {
      const nextIdx = pointIdx + 1;
      if (nextIdx >= CALIBRATION_POINTS.length) {
        setVideoPreviewVisible(false);
        onDone();
        return;
      }
      setPointIdx(nextIdx);
      setClicks(0);
    } else {
      setClicks(nextClicks);
    }
  };

  if (status === "error") {
    return (
      <div className="gaze-cal-host">
        <div className="gaze-cal-panel">
          <h2>{t("gaze.cal.error.title")}</h2>
          <p>{t("gaze.cal.error.body")}</p>
          <pre className="gaze-cal-err">{errMsg}</pre>
          <button type="button" onClick={onCancel}>
            {t("common.cancel")}
          </button>
        </div>
      </div>
    );
  }

  if (status === "starting") {
    return (
      <div className="gaze-cal-host">
        <div className="gaze-cal-panel">
          <h2>{t("gaze.cal.starting.title")}</h2>
          <p>{t("gaze.cal.starting.body")}</p>
        </div>
      </div>
    );
  }

  const cur = CALIBRATION_POINTS[pointIdx];
  const total = CALIBRATION_POINTS.length;
  const progress = (clicks / CLICKS_PER_POINT) * 100;

  return (
    <div className="gaze-cal-host">
      <div className="gaze-cal-hint">
        {t("gaze.cal.hint", { idx: pointIdx + 1, tot: total })}
      </div>
      <button
        type="button"
        className="gaze-cal-cancel"
        onClick={onCancel}
      >
        {t("common.cancel")}
      </button>
      <CalibrationDot
        x={cur.x}
        y={cur.y}
        progress={progress}
        onClick={(px, py) => handleClick(px, py)}
      />
    </div>
  );
}

function CalibrationDot({
  x,
  y,
  progress,
  onClick,
}: {
  x: number;
  y: number;
  progress: number;
  onClick: (px: number, py: number) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const handleClick = () => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    onClick(r.left + r.width / 2, r.top + r.height / 2);
  };
  return (
    <button
      ref={ref}
      type="button"
      className="gaze-cal-dot"
      style={{
        left: `${x * 100}%`,
        top: `${y * 100}%`,
      }}
      onClick={handleClick}
    >
      <span
        className="gaze-cal-dot-fill"
        style={{ background: `conic-gradient(#3aa3ff ${progress}%, transparent 0)` }}
      />
    </button>
  );
}
