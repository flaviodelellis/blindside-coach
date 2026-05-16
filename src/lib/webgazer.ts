// WebGazer is loaded as a <script> tag in index.html from /public/webgazer.js.
// We don't import the npm package because Vite mis-bundles its MediaPipe
// dependency (the FaceMesh class ends up undefined → "(void 0) is not a
// constructor"). The standalone bundle in /public has everything inlined.
type WebGazerLib = typeof import("webgazer").default;
const webgazer = (window as unknown as { webgazer: WebGazerLib }).webgazer;
if (!webgazer) {
  throw new Error(
    "WebGazer not found on window. Make sure /public/webgazer.js is loaded.",
  );
}

(webgazer.params as { faceMeshSolutionPath?: string }).faceMeshSolutionPath =
  "/mediapipe/face_mesh";

export type GazeSample = {
  t: number;
  x: number;
  y: number;
};

type SampleListener = (sample: GazeSample) => void;

let starting: Promise<void> | null = null;
let running = false;
const listeners = new Set<SampleListener>();

function onGaze(data: { x: number; y: number } | null) {
  if (!data) return;
  const sample: GazeSample = {
    t: performance.now(),
    x: data.x,
    y: data.y,
  };
  for (const fn of listeners) fn(sample);
}

export async function ensureWebGazerStarted(): Promise<void> {
  if (running) return;
  if (starting) return starting;
  starting = (async () => {
    webgazer
      .setRegression("ridge")
      .setGazeListener(onGaze)
      .saveDataAcrossSessions(false);

    // begin() rejects its returned promise with the real DOMException when
    // getUserMedia or init fails. The onFail callback is fired *before* the
    // reject — keep it as a side-effect logger only; do NOT throw from it
    // (that would short-circuit the reject path and leak an unhandled rejection).
    try {
      await webgazer.begin();
    } catch (err) {
      const e = err as DOMException | Error;
      const name = (e as DOMException).name || "Error";
      const msg = e.message || String(err);
      console.error("[webgazer] begin() failed:", e);
      throw new Error(`${name}: ${msg}`);
    }

    // Keep the video element visible — on Chrome, display:none on the video
    // pauses the frame pipeline and the gaze listener stops firing. We hide
    // only WebGazer's red prediction dot (we render our own overlay).
    webgazer.showPredictionPoints(false);
    running = true;
  })();
  try {
    await starting;
  } catch (e) {
    running = false;
    throw e;
  } finally {
    starting = null;
  }
}

export function stopWebGazer(): void {
  if (!running) return;
  try {
    webgazer.end();
  } catch {
    // ignore — end() can throw if video stream already gone
  }
  running = false;
  listeners.clear();
}

export function pauseWebGazer(): void {
  if (running) webgazer.pause();
}

export function resumeWebGazer(): void {
  if (running) webgazer.resume();
}

export function setPredictionPointVisible(visible: boolean): void {
  if (running) webgazer.showPredictionPoints(visible);
}

export function setVideoPreviewVisible(visible: boolean): void {
  if (!running) return;
  // Toggle only the face overlay / feedback decorations. NEVER hide the
  // <video> element itself: display:none on it pauses Chrome's frame pipeline
  // and the gaze tracker stops emitting samples.
  webgazer
    .showFaceOverlay(visible)
    .showFaceFeedbackBox(visible);
}

export function recordCalibrationPoint(x: number, y: number): void {
  if (!running) return;
  webgazer.recordScreenPosition(x, y, "click");
}

export async function clearCalibrationData(): Promise<void> {
  await webgazer.clearData();
}

export function subscribeGaze(listener: SampleListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isWebGazerRunning(): boolean {
  return running;
}
