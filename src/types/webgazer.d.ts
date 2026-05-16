declare module "webgazer" {
  export type GazePrediction = { x: number; y: number } | null;
  export type GazeListener = (
    data: GazePrediction,
    elapsedTime: number,
  ) => void;

  interface WebGazer {
    setRegression(name: "ridge" | "weightedRidge" | "threadedRidge"): WebGazer;
    setGazeListener(listener: GazeListener): WebGazer;
    clearGazeListener(): WebGazer;
    begin(): Promise<WebGazer>;
    end(): void;
    pause(): WebGazer;
    resume(): WebGazer;
    isReady(): boolean;
    showVideoPreview(b: boolean): WebGazer;
    showVideo(b: boolean): WebGazer;
    showFaceOverlay(b: boolean): WebGazer;
    showFaceFeedbackBox(b: boolean): WebGazer;
    showPredictionPoints(b: boolean): WebGazer;
    saveDataAcrossSessions(b: boolean): WebGazer;
    clearData(): Promise<void> | void;
    recordScreenPosition(x: number, y: number, eventType?: string): void;
    getCurrentPrediction(): Promise<GazePrediction> | GazePrediction;
    params: Record<string, unknown>;
  }

  const webgazer: WebGazer;
  export default webgazer;
}
