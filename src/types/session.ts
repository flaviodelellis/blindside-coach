export type SchemaVersion = "1.0";

export type NormalizedPoint = { x: number; y: number };
export type NormalizedRegion = { x: number; y: number; w: number; h: number };

export type Duration =
  | { kind: "fixed"; ms: number }
  | {
      kind: "jitter";
      min_ms: number;
      max_ms: number;
      distribution?: "uniform" | "gaussian";
    };

export type PositionMode =
  | { kind: "fixed"; positions: NormalizedPoint[] }
  | { kind: "random_uniform"; allowed_regions: NormalizedRegion[] }
  | {
      kind: "random_weighted";
      regions: Array<{ region: NormalizedRegion; weight: number }>;
    }
  | { kind: "central" }
  | { kind: "peripheral"; side: "left" | "right" | "both" };

export type FixationPoint = {
  position_norm: NormalizedPoint;
  size_px: number;
  color: string;
};

export type FixationCheckConfig = {
  enabled: boolean;
  interval_ms: { min: number; max: number };
  change_duration_ms: number;
  change_type: "color_shift" | "digit_change" | "shape_swap";
  response_key: string;
  response_window_ms: number;
};

export type FeedbackConfig = {
  during_trial?: "none" | "sound_correct_incorrect" | "visual_correct_incorrect" | "both";
  end_of_block?: {
    show_accuracy: boolean;
    show_rt: boolean;
    encouraging_message: boolean;
  };
  end_of_session?: {
    show_summary: boolean;
    show_comparison?: boolean;
  };
};

export type DiscriminationStimulusKind = "shape" | "letter" | "color";

export type PresentedStimulus = {
  kind: DiscriminationStimulusKind;
  value: string;
  color: string;
  position_norm: NormalizedPoint;
  size_px: number;
};

export type DiscriminationDimension = "color" | "shape" | "position";

export type DiscriminationTrial = {
  trial_id: number;
  t_start_ms: number;
  t_end_ms: number;
  stimuli: PresentedStimulus[];
  /** The forced-choice dimension under test for this trial. */
  dimension: DiscriminationDimension;
  /** The correct alternative the patient should pick (color hex, shape name, or "left"/"right"). */
  expected_response?: string;
  response: {
    /** Forced choice: a guess is always recorded. Kept for schema compatibility. */
    given: boolean;
    /** The patient's forced-choice guess. */
    value?: string;
    rt_ms?: number;
    /** Patient's subjective awareness: did they report seeing anything? */
    aware?: boolean;
  };
  correct?: boolean;
};

export type VisualDiscriminationExercise = {
  type: "visual_discrimination";
  config: {
    /** Which feature the patient must guess in forced choice. */
    discrimination_dimension: DiscriminationDimension;
    stimulus_kinds: DiscriminationStimulusKind[];
    stimulus_size_px: number;
    stimulus_colors: string[];
    outline_color?: string;
    background_color: string;
    n_simultaneous: number;
    position_mode: PositionMode;
    exposure: Duration;
    inter_trial_interval: Duration;
    n_trials: number;
    response_mode: "keypress" | "click" | "none";
    /** Who records the response. Blindsight protocol uses clinician-recorded answers. */
    response_collector: "clinician" | "patient";
    /** Awareness scale collected alongside the forced choice. */
    awareness_scale: "binary";
    fixation: FixationPoint;
    fixation_check?: FixationCheckConfig;
    feedback: FeedbackConfig;
    random_seed?: number;
  };
  trials: DiscriminationTrial[];
};

export type TachistoscopicWordPool =
  | { kind: "inline"; words: string[] }
  | {
      kind: "library";
      language?: "it" | "en" | "both";
      categories?: string[];
      length_range?: [number, number];
      include_pseudowords?: boolean;
      pseudoword_ratio?: number;
    };

export type TachistoscopicTrial = {
  trial_id: number;
  t_start_ms: number;
  t_end_ms: number;
  word: string;
  is_pseudoword: boolean;
  position_norm: NormalizedPoint;
  exposure_ms_requested: number;
  exposure_ms_measured: number;
  n_repetitions: number;
  response?: {
    detected?: boolean;
    recognized_word?: string;
    recognition_correct?: boolean;
    rt_ms?: number;
  };
};

export type TachistoscopicExercise = {
  type: "tachistoscopic";
  config: {
    word_pool: TachistoscopicWordPool;
    font_size_px: number;
    font_family?: string;
    text_color: string;
    background_color: string;
    exposure: Duration;
    inter_trial_interval: Duration;
    n_trials: number;
    position_mode: PositionMode;
    response_mode: "patient_types" | "clinician_marks" | "none";
    clinician_captures?: Array<"detection" | "recognition">;
    fixation: FixationPoint;
    fixation_check?: FixationCheckConfig;
    feedback: FeedbackConfig;
    random_seed?: number;
  };
  trials: TachistoscopicTrial[];
};

export type Exercise = VisualDiscriminationExercise | TachistoscopicExercise;
export type ExerciseType = Exercise["type"];

export type TimelineEventType =
  | "session_start"
  | "session_end"
  | "trial_start"
  | "trial_end"
  | "stimulus_on"
  | "stimulus_off"
  | "response"
  | "fixation_check_shown"
  | "fixation_check_responded"
  | "fixation_check_missed"
  | "pause"
  | "resume"
  | "adaptive_update";

export type TimelineEvent = {
  t_ms: number;
  type: TimelineEventType;
  payload?: Record<string, unknown>;
};

export type EyeTrackingData = {
  device: "pupil_neon" | "pupil_core";
  device_serial?: string;
  clock_alignment: {
    browser_t0_iso: string;
    device_t0_unix_ns: number;
  };
  surface_calibration?: {
    tag_ids: number[];
    screen_corners_in_scene: Array<[number, number]>;
  };
  samples_sidecar_file?: string;
};

export type SessionMetadata = {
  id: string;
  patient_id: string;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  app_version: string;
  context: "hospital" | "home";
  prescription_id?: string;
  clinician_notes?: string;
  screen: {
    width_px: number;
    height_px: number;
    device_pixel_ratio: number;
  };
};

export type QuadrantStats = {
  n_presented: number;
  n_detected: number;
  rt_mean_ms?: number;
  /** Mean number of re-exposures ("Ripeti") needed for stimuli in this quadrant. */
  rep_mean?: number;
};

export type SessionSummary = {
  duration_ms: number;
  n_trials: number;
  n_correct?: number;
  accuracy?: number;
  rt_mean_ms?: number;
  rt_median_ms?: number;
  rt_p10_ms?: number;
  rt_p90_ms?: number;
  per_quadrant?: Record<
    "upper_left" | "upper_right" | "lower_left" | "lower_right",
    QuadrantStats
  >;
  per_region?: Array<{
    region_id: string;
    n_presented: number;
    n_detected: number;
    rt_mean_ms?: number;
  }>;
  fixation_compliance?: {
    n_checks: number;
    n_responded: number;
    compliance_rate: number;
    rt_mean_ms: number;
  };
  blocks: Array<{
    block_idx: number;
    n_trials: number;
    accuracy?: number;
    rt_mean_ms?: number;
    /** Mean number of re-exposures ("Ripeti") per trial within this block. */
    rep_mean?: number;
  }>;
  /**
   * Re-exposure ("Ripeti") analysis for tachistoscopic clinical mode. The number
   * of times the clinician re-flashed a word before the patient recognized it is
   * a behavioral proxy for the effective exposure threshold.
   */
  repetitions?: {
    mean: number;
    median: number;
    max: number;
    /** Fraction of trials recognized at first exposure (0 re-exposures). */
    pct_first_exposure: number;
    /** Fraction of trials needing >= 3 re-exposures. */
    pct_three_plus: number;
    /** Distribution of re-exposure counts across trials, ascending by count. */
    histogram: Array<{ reps: number; count: number }>;
    /**
     * mean(left-hemifield reps) - mean(right-hemifield reps). Positive means the
     * left visual field needed more re-exposures (relevant for neglect/hemianopia).
     */
    asymmetry_lr?: number;
  };
  recognition_breakdown?: {
    real_words: { n_presented: number; n_correct: number; rt_mean_ms?: number };
    pseudowords: { n_presented: number; n_correct: number; rt_mean_ms?: number };
  };
  /** Forced-choice + awareness dissociation (visual discrimination / blindsight). */
  blindsight?: {
    dimension: DiscriminationDimension;
    /** Probability of a correct guess by chance (1 / number of alternatives). */
    chance_level: number;
    n_aware: number;
    n_unaware: number;
    /** Forced-choice accuracy on trials the patient reported seeing. */
    accuracy_aware?: number;
    /** Forced-choice accuracy on trials the patient reported NOT seeing (blindsight). */
    accuracy_unaware?: number;
  };
};

export type SessionFile = {
  schema_version: SchemaVersion;
  session: SessionMetadata;
  exercise: Exercise;
  events: TimelineEvent[];
  eye_tracking?: EyeTrackingData;
  summary: SessionSummary;
};

export type Prescription = {
  schema_version: SchemaVersion;
  prescription_id: string;
  patient_id: string;
  prescribed_at: string;
  prescribed_by?: string;
  exercise: Exercise;
  notes_for_patient?: string;
  expected_context: "home" | "hospital";
};
