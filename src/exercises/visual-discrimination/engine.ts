import { initJsPsych } from "jspsych";
import htmlKeyboardResponse from "@jspsych/plugin-html-keyboard-response";
import type {
  DiscriminationTrial,
  PresentedStimulus,
  VisualDiscriminationExercise,
} from "../../types/session";
import { makeRng } from "../../lib/rng";
import { resolveDuration, resolvePosition } from "../../lib/runtime";
import { pickStimulus, renderStimulusHtml } from "./stimuli";

type Config = VisualDiscriminationExercise["config"];

export type EngineResult = {
  trials: DiscriminationTrial[];
  started_at: string;
  ended_at: string;
  duration_ms: number;
};

type TrialParam = {
  trial_id: number;
  stimuli: PresentedStimulus[];
  exposure_ms_requested: number;
  iti_ms: number;
};

type TrialMeasurements = {
  stim_start: number;
  stim_end: number;
  stim_response_rt: number | null;
  iti_response_rt: number | null;
};

export async function runDiscrimination(
  config: Config,
  displayElement: HTMLElement,
): Promise<EngineResult> {
  const rng = makeRng(config.random_seed);

  const params: TrialParam[] = Array.from({ length: config.n_trials }, (_, i) => {
    const stimuli: PresentedStimulus[] = [];
    for (let k = 0; k < Math.max(1, config.n_simultaneous); k++) {
      const pos = resolvePosition(config.position_mode, rng, i * config.n_simultaneous + k);
      stimuli.push(
        pickStimulus(
          config.stimulus_kinds,
          config.stimulus_colors,
          config.stimulus_size_px,
          pos,
          rng,
        ),
      );
    }
    return {
      trial_id: i + 1,
      stimuli,
      exposure_ms_requested: Math.round(resolveDuration(config.exposure, rng)),
      iti_ms: Math.round(resolveDuration(config.inter_trial_interval, rng)),
    };
  });

  const measurements = new Map<number, TrialMeasurements>();
  for (const p of params) {
    measurements.set(p.trial_id, {
      stim_start: 0,
      stim_end: 0,
      stim_response_rt: null,
      iti_response_rt: null,
    });
  }

  const startedAt = new Date().toISOString();
  const startedPerf = performance.now();

  return new Promise((resolve) => {
    const jsPsych = initJsPsych({
      display_element: displayElement,
      on_finish: () => {
        const endedPerf = performance.now();
        const endedAt = new Date().toISOString();
        const trials = params.map((p) =>
          buildTrialOutput(p, measurements.get(p.trial_id)),
        );
        resolve({
          trials,
          started_at: startedAt,
          ended_at: endedAt,
          duration_ms: endedPerf - startedPerf,
        });
      },
    });

    const timeline = buildTimeline(config, params, measurements);
    void (jsPsych.run as (t: unknown) => Promise<void>)(timeline);
  });
}

function buildTimeline(
  config: Config,
  params: TrialParam[],
  measurements: Map<number, TrialMeasurements>,
): unknown[] {
  const fixHtml = buildFixationHtml(config);

  const instructions = {
    type: htmlKeyboardResponse,
    stimulus: `
      <div style="text-align:center;max-width:600px;margin:0 auto;">
        <h2>Discriminazione visiva</h2>
        <p>Fissa la crocetta al centro dello schermo.</p>
        <p>Compariranno stimoli (forme, lettere o colori) in posizioni periferiche
           per pochi millisecondi.</p>
        <p>Premi <b>SPAZIO</b> ogni volta che vedi qualcosa apparire. Se non vedi
           nulla, non fare niente.</p>
        <p style="margin-top:2rem;">Premi <b>SPAZIO</b> per iniziare.</p>
      </div>
    `,
    choices: [" "],
  };

  const initialFixation = {
    type: htmlKeyboardResponse,
    stimulus: fixHtml,
    choices: "NO_KEYS",
    trial_duration: 1500,
  };

  const trialNodes = params.flatMap((p) => {
    const m = measurements.get(p.trial_id);
    const stimHtml = fixHtml + p.stimuli.map(renderStimulusHtml).join("");

    return [
      {
        type: htmlKeyboardResponse,
        stimulus: stimHtml,
        choices: [" "],
        trial_duration: p.exposure_ms_requested,
        response_ends_trial: false,
        on_start: () => {
          if (m) m.stim_start = performance.now();
        },
        on_finish: (data: { response?: string | null; rt?: number | null }) => {
          if (!m) return;
          m.stim_end = performance.now();
          if (data.response === " " && data.rt != null) {
            m.stim_response_rt = data.rt;
          }
        },
      },
      {
        type: htmlKeyboardResponse,
        stimulus: fixHtml,
        choices: [" "],
        trial_duration: p.iti_ms,
        response_ends_trial: false,
        on_finish: (data: { response?: string | null; rt?: number | null }) => {
          if (!m) return;
          if (data.response === " " && data.rt != null && m.stim_response_rt === null) {
            m.iti_response_rt = data.rt;
          }
        },
      },
    ];
  });

  const ending = {
    type: htmlKeyboardResponse,
    stimulus: `
      <div style="text-align:center;">
        <h2>Sessione completata</h2>
        <p>Premi un tasto qualsiasi per vedere i risultati.</p>
      </div>
    `,
    choices: "ALL_KEYS",
  };

  return [instructions, initialFixation, ...trialNodes, ending];
}

function buildFixationHtml(config: Config): string {
  const { position_norm, size_px, color } = config.fixation;
  const x = position_norm.x * 100;
  const y = position_norm.y * 100;
  return `
    <div style="position:fixed;inset:0;background:#fff;"></div>
    <div style="position:fixed;left:${x}%;top:${y}%;
                transform:translate(-50%,-50%);
                font-size:${size_px}px;color:${color};
                font-family:monospace;line-height:1;">+</div>
  `;
}

function buildTrialOutput(
  p: TrialParam,
  m: TrialMeasurements | undefined,
): DiscriminationTrial {
  const stimStart = m?.stim_start ?? 0;
  const stimEnd = m?.stim_end ?? stimStart;
  const stimRt = m?.stim_response_rt ?? null;
  const itiRt = m?.iti_response_rt ?? null;

  let given = false;
  let rt_ms: number | undefined;
  if (stimRt !== null) {
    given = true;
    rt_ms = stimRt;
  } else if (itiRt !== null) {
    given = true;
    rt_ms = p.exposure_ms_requested + itiRt;
  }

  return {
    trial_id: p.trial_id,
    t_start_ms: Math.round(stimStart),
    t_end_ms: Math.round(stimEnd),
    stimuli: p.stimuli,
    response: {
      given,
      value: given ? " " : undefined,
      rt_ms,
    },
    correct: given,
  };
}
