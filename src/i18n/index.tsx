import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Lang = "it" | "en";

const STORAGE_KEY = "blindside-lang";

type Dict = Record<string, string>;

const it: Dict = {
  // app shell
  "app.title": "BlindSide Coach",
  "app.subtitle": "Piattaforma di riabilitazione visiva per emianopsia",
  "app.lang.toggle": "Lingua",

  // home buttons
  "home.tach.title": "Tachistoscopia",
  "home.tach.desc": "Stimoli flash, posizioni periferiche",
  "home.disc.title": "Discriminazione",
  "home.disc.desc": "Forma · colore · orientamento",
  "home.prescription.title": "Apri prescrizione",
  "home.prescription.desc": "Carica protocollo salvato",
  "home.review.title": "Rivedi sessione",
  "home.review.desc": "Risultati passati, export",

  // common
  "common.back": "← Torna alla home",
  "common.home": "← Home",
  "common.cancel": "Annulla",
  "common.start": "Inizia",
  "common.startExercise": "Avvia esercizio",
  "common.endSession": "Termina sessione",
  "common.under_construction": "In costruzione",
  "common.under_construction_msg":
    'La vista "{view}" non è ancora implementata.',

  // saved configurations
  "cfg.section": "Configurazioni",
  "cfg.save": "Salva configurazione",
  "cfg.load": "Carica configurazione",
  "cfg.load.placeholder": "Configurazioni salvate…",
  "cfg.delete": "Elimina configurazione",
  "cfg.export": "Esporta",
  "cfg.import": "Importa",
  "cfg.prompt.save": "Nome della configurazione:",
  "cfg.prompt.export": "Nome del file da esportare:",
  "cfg.confirm.delete": "Eliminare la configurazione «{name}»?",
  "cfg.error.invalid": "File non valido: non è una configurazione BlindSide.",
  "cfg.error.wrong_type":
    "Questa configurazione è per un altro esercizio.",

  // open prescription / load configuration
  "prescription.intro":
    "Carica un file di configurazione (.json) per aprire l'esercizio già impostato.",
  "prescription.choose": "Scegli file…",
  "prescription.hint":
    "Sono i file esportati dal pulsante «Esporta» nella schermata di configurazione di un esercizio.",

  // tach configure form
  "tach.title": "Tachistoscopia",
  "tach.subtitle": "Configura la sessione e premi Avvia.",
  "tach.breadcrumb": "Configura · Tachistoscopia",
  "tach.summary.live": "Riepilogo · live",
  "tach.summary.preview": "Anteprima schermata",
  "tach.preview.sample": "esempio",
  "preview.expand": "Ingrandisci l'anteprima a schermo intero",
  "preview.close": "Chiudi (Esc)",
  "tach.section.mode": "Modalità sessione",
  "tach.section.stimuli": "Stimoli",
  "tach.section.position": "Posizione",
  "tach.section.appearance": "Aspetto",
  "tach.section.timing": "Tempi",
  "tach.section.advanced": "Avanzato",
  "tach.field.background_color": "Colore di sfondo",
  "tach.field.text_color": "Colore parole",
  "tach.field.fixation_color": "Colore punto di fissazione",
  "tach.summary.title": "Riepilogo sessione",
  "tach.summary.mode": "Modalità",
  "tach.summary.mode.clinician": "Guidata dal clinico",
  "tach.summary.mode.patient": "Paziente",
  "tach.summary.stimuli": "Stimoli",
  "tach.summary.lang.it": "italiane",
  "tach.summary.lang.en": "inglesi",
  "tach.summary.lang.both": "italiane e inglesi",
  "tach.summary.stimuli.words": "{n} tentativi · parole {lang} ({len} lettere)",
  "tach.summary.stimuli.pseudo": "con {pct}% di pseudoparole",
  "tach.summary.stimuli.no_pseudo": "solo parole reali",
  "tach.summary.stimuli.custom": "{n} parole · lista personalizzata",
  "tach.summary.stimuli.custom_sub": "nell'ordine inserito",
  "tach.summary.position": "Posizione",
  "tach.summary.pos.custom": "Griglia personalizzata ({n} celle)",
  "tach.summary.pos.custom_empty": "Griglia personalizzata (nessuna cella selezionata)",
  "tach.summary.timing": "Tempi",
  "tach.summary.timing.exposure": "Esposizione {ms} ms",
  "tach.summary.timing.iti_fixed": "intervallo {ms} ms",
  "tach.summary.timing.iti_range": "intervallo {min}–{max} ms",
  "tach.field.n_trials": "Numero di tentativi",
  "tach.field.exposure": "Esposizione (ms)",
  "tach.field.iti": "Intervallo tra tentativi (ms)",
  "tach.field.word_source": "Sorgente parole",
  "tach.word_source.library": "Libreria",
  "tach.word_source.custom": "Lista personalizzata",
  "tach.field.custom_words": "Parole personalizzate",
  "tach.placeholder.custom_words":
    "Una parola per riga (o separate da virgola)…",
  "tach.hint.custom_words":
    "{n} parole. Verranno mostrate nell'ordine inserito, una per tentativo.",
  "tach.custom_words.empty_error":
    "Inserisci almeno una parola nella lista personalizzata, oppure scegli la libreria.",
  "tach.n_trials.from_list": "{n} (dalla lista)",
  "tach.field.language": "Lingua parole",
  "tach.lang.it": "Italiano",
  "tach.lang.en": "Inglese",
  "tach.lang.both": "Entrambe",
  "tach.field.length": "Lunghezza parole (lettere)",
  "tach.field.word_size": "Dimensione parole (px)",
  "tach.field.position": "Posizione stimoli",
  "tach.pos.peripheral_both": "Periferica",
  "tach.pos.peripheral_left": "Periferica sinistra",
  "tach.pos.peripheral_right": "Periferica destra",
  "tach.pos.custom_grid": "Personalizzata (griglia)",
  "tach.field.allowed_regions": "Zone consentite",
  "tach.field.include_pseudo": "Includere pseudoparole",
  "tach.field.pseudo_ratio": "Rateo pseudoparole",
  "tach.field.patient_mode": "Modalità paziente",
  "tach.hint.patient_mode":
    "Il paziente scrive la parola dopo ogni prova e riprova finché non la indovina. Se disattivata, è il clinico a guidare l'esercizio.",
  "tach.field.random_seed": "Random seed (opzionale)",
  "tach.placeholder.random_seed": "vuoto = casuale",
  "tach.grid.empty_error":
    "Seleziona almeno una cella nella griglia delle zone consentite, oppure scegli un'altra modalità di posizione.",

  // tach runner: instructions
  "tach.run.title.clinician": "Tachistoscopia: modalità guidata",
  "tach.run.title.patient": "Tachistoscopia: modalità paziente",
  "tach.run.position":
    "Posizionati davanti allo schermo, con lo sguardo sulla crocetta centrale.",
  "tach.run.patient.p1":
    "Ogni parola apparirà brevemente in un punto dello schermo. Subito dopo, digita la parola che hai visto e premi Invio.",
  "tach.run.patient.li1": "Se è corretta, si passa alla parola successiva.",
  "tach.run.patient.li2":
    "Se è sbagliata, la parola verrà mostrata di nuovo finché non la riconoscerai.",
  "tach.run.patient.li3.pre": "Premi ",
  "tach.run.patient.li3.btn": "Ripeti",
  "tach.run.patient.li3.mid": " (tasto ",
  "tach.run.patient.li3.post":
    ") per rivedere la parola senza inserire un tentativo.",
  "tach.run.patient.li4.pre": "Usa ",
  "tach.run.patient.li4.btn": "Passa",
  "tach.run.patient.li4.post": " se non riesci proprio a vederla.",
  "tach.run.clinician.intro":
    "Le parole appariranno brevemente. Dopo ogni parola potrai scegliere:",
  "tach.run.clinician.li1.btn": "Ripeti",
  "tach.run.clinician.li1.mid": " (tasto ",
  "tach.run.clinician.li1.post":
    ") per mostrare di nuovo la stessa parola al paziente",
  "tach.run.clinician.li2.btn": "Prossima",
  "tach.run.clinician.li2.mid": " (tasto ",
  "tach.run.clinician.li2.sep": " o ",
  "tach.run.clinician.li2.post": ") per passare al tentativo successivo",
  "tach.run.session_size": "Sessione di {n} tentativi.",

  // tach runner: panels
  "tach.ready.prompt":
    "Premi Invio o Spazio per mostrare la prima parola.",
  "tach.ready.go": "Mostra prima parola",
  "tach.panel.trial": "Tentativo {idx} / {tot}",
  "tach.panel.repetitions": " · ripetizioni: {n}",
  "tach.panel.attempts": " · tentativi: {n}",
  "tach.panel.repeat": "Ripeti",
  "tach.panel.next": "Prossima",
  "tach.panel.confirm": "Conferma",
  "tach.panel.skip": "Passa",
  "tach.panel.placeholder": "Scrivi la parola che hai visto…",

  // tach results
  "tach.results.title": "Risultati",
  "tach.results.subtitle":
    "Sessione di {sec} secondi, {n} tentativi completati.",
  "tach.results.accuracy": "Accuracy",
  "tach.results.rt_mean": "RT medio",
  "tach.results.rep_mean": "Ripetizioni medie",
  "tach.results.rep_first": "1ª esposizione",
  "tach.results.rep_title": "Distribuzione ripetizioni",
  "tach.results.rep_asymmetry": "Asimmetria sx–dx",
  "tach.results.rep_blocks": "Ripetizioni per blocco",
  "tach.results.block_short": "B{n}",
  "tach.results.delta_exposure": "Delta esposizione",
  "tach.results.real_vs_pseudo": "Reali vs Pseudoparole",
  "tach.results.col.empty": "",
  "tach.results.col.presented": "Presentate",
  "tach.results.col.detected": "Rilevate",
  "tach.results.col.rt": "RT medio",
  "tach.results.row.real": "Reali",
  "tach.results.row.pseudo": "Pseudo",
  "tach.results.per_quadrant": "Per quadrante",
  "tach.results.quad": "Quadrante",
  "tach.results.col.presented_q": "Presentati",
  "tach.results.col.detected_q": "Rilevati",
  "tach.results.download": "Scarica file di sessione (JSON)",
  "tach.results.download_csv": "Scarica CSV",
  "tach.results.restart": "Nuova configurazione",
  "tach.results.trials": "Tentativi",
  "tach.results.trials_table": "Tentativo per tentativo",
  "tach.results.col.trial_n": "#",
  "tach.results.col.position": "pos",
  "tach.results.col.stimulus": "stim",
  "tach.results.col.response": "resp",
  "tach.results.col.rt_short": "rt",
  "tach.run.tiny_counter": "{idx} / {tot}",
  "quadrant.upper_left": "Alto sinistra",
  "quadrant.upper_right": "Alto destra",
  "quadrant.lower_left": "Basso sinistra",
  "quadrant.lower_right": "Basso destra",

  // heatmap report
  "heatmap.title": "Mappa di calore",
  "heatmap.meta": "Basata su {n} tentativi. L'incrocio segna il punto di fissazione.",
  "heatmap.fig.accuracy": "Accuratezza per zona",
  "heatmap.fig.rt": "Tempo di reazione per zona",
  "heatmap.tooltip.trials": "Tentativi",
  "heatmap.tooltip.accuracy": "Accuratezza",
  "heatmap.tooltip.rt": "RT medio",
  "heatmap.tooltip.no_data": "Nessun tentativo in questa zona",

  // grid selector
  "grid.rows": "Righe",
  "grid.cols": "Colonne",
  "grid.weighted": "Pesi per cella",
  "grid.clear": "Pulisci",
  "grid.hint.empty": "Clicca le celle dove dovranno apparire gli stimoli.",
  "grid.hint.weighted":
    "Click ripetuti aumentano il peso (1 → {max} → off). Le percentuali mostrano la probabilità relativa.",
  "grid.hint.uniform":
    "{n} cella/e attiva/e. Gli stimoli appariranno con uguale probabilità in una di esse.",
  "grid.fix.label": "cella centrale (punto di fissazione)",
  "grid.fix.selected": "selezionata",
};

const en: Dict = {
  "app.title": "BlindSide Coach",
  "app.subtitle": "Visual rehabilitation platform for hemianopia",
  "app.lang.toggle": "Language",

  "home.tach.title": "Tachistoscopy",
  "home.tach.desc": "Flashed stimuli, peripheral positions",
  "home.disc.title": "Discrimination",
  "home.disc.desc": "Shape · color · orientation",
  "home.prescription.title": "Open prescription",
  "home.prescription.desc": "Load a saved protocol",
  "home.review.title": "Review session",
  "home.review.desc": "Past results, export",

  "common.back": "← Back to home",
  "common.home": "← Home",
  "common.cancel": "Cancel",
  "common.start": "Start",
  "common.startExercise": "Start exercise",
  "common.endSession": "End session",
  "common.under_construction": "Under construction",
  "common.under_construction_msg": 'The "{view}" view is not implemented yet.',

  "cfg.section": "Configurations",
  "cfg.save": "Save configuration",
  "cfg.load": "Load configuration",
  "cfg.load.placeholder": "Saved configurations…",
  "cfg.delete": "Delete configuration",
  "cfg.export": "Export",
  "cfg.import": "Import",
  "cfg.prompt.save": "Configuration name:",
  "cfg.prompt.export": "Name of the file to export:",
  "cfg.confirm.delete": 'Delete the configuration "{name}"?',
  "cfg.error.invalid": "Invalid file: not a BlindSide configuration.",
  "cfg.error.wrong_type": "This configuration is for a different exercise.",

  "prescription.intro":
    "Load a configuration file (.json) to open the exercise already set up.",
  "prescription.choose": "Choose file…",
  "prescription.hint":
    "These are the files exported with the “Export” button on an exercise's configuration screen.",

  "tach.title": "Tachistoscopy",
  "tach.subtitle": "Configure the session and press Start.",
  "tach.breadcrumb": "Configure · Tachistoscopy",
  "tach.summary.live": "Summary · live",
  "tach.summary.preview": "Screen preview",
  "tach.preview.sample": "sample",
  "preview.expand": "Expand preview to full screen",
  "preview.close": "Close (Esc)",
  "tach.section.mode": "Session mode",
  "tach.section.stimuli": "Stimuli",
  "tach.section.position": "Position",
  "tach.section.appearance": "Appearance",
  "tach.section.timing": "Timing",
  "tach.section.advanced": "Advanced",
  "tach.field.background_color": "Background color",
  "tach.field.text_color": "Word color",
  "tach.field.fixation_color": "Fixation point color",
  "tach.summary.title": "Session summary",
  "tach.summary.mode": "Mode",
  "tach.summary.mode.clinician": "Clinician-paced",
  "tach.summary.mode.patient": "Patient",
  "tach.summary.stimuli": "Stimuli",
  "tach.summary.lang.it": "Italian",
  "tach.summary.lang.en": "English",
  "tach.summary.lang.both": "Italian and English",
  "tach.summary.stimuli.words": "{n} trials · {lang} words ({len} letters)",
  "tach.summary.stimuli.pseudo": "with {pct}% pseudowords",
  "tach.summary.stimuli.no_pseudo": "real words only",
  "tach.summary.stimuli.custom": "{n} words · custom list",
  "tach.summary.stimuli.custom_sub": "in the order entered",
  "tach.summary.position": "Position",
  "tach.summary.pos.custom": "Custom grid ({n} cells)",
  "tach.summary.pos.custom_empty": "Custom grid (no cells selected)",
  "tach.summary.timing": "Timing",
  "tach.summary.timing.exposure": "Exposure {ms} ms",
  "tach.summary.timing.iti_fixed": "interval {ms} ms",
  "tach.summary.timing.iti_range": "interval {min}–{max} ms",
  "tach.field.n_trials": "Number of trials",
  "tach.field.exposure": "Exposure (ms)",
  "tach.field.iti": "Inter-trial interval (ms)",
  "tach.field.word_source": "Word source",
  "tach.word_source.library": "Library",
  "tach.word_source.custom": "Custom list",
  "tach.field.custom_words": "Custom words",
  "tach.placeholder.custom_words": "One word per line (or comma-separated)…",
  "tach.hint.custom_words":
    "{n} words. They will be shown in the order entered, one per trial.",
  "tach.custom_words.empty_error":
    "Enter at least one word in the custom list, or choose the library.",
  "tach.n_trials.from_list": "{n} (from the list)",
  "tach.field.language": "Word language",
  "tach.lang.it": "Italian",
  "tach.lang.en": "English",
  "tach.lang.both": "Both",
  "tach.field.length": "Word length (letters)",
  "tach.field.word_size": "Word size (px)",
  "tach.field.position": "Stimulus position",
  "tach.pos.peripheral_both": "Peripheral",
  "tach.pos.peripheral_left": "Peripheral left",
  "tach.pos.peripheral_right": "Peripheral right",
  "tach.pos.custom_grid": "Custom (grid)",
  "tach.field.allowed_regions": "Allowed regions",
  "tach.field.include_pseudo": "Include pseudowords",
  "tach.field.pseudo_ratio": "Pseudoword ratio",
  "tach.field.patient_mode": "Patient mode",
  "tach.hint.patient_mode":
    "The patient types the word after each trial and retries until correct. When off, the clinician guides the exercise.",
  "tach.field.random_seed": "Random seed (optional)",
  "tach.placeholder.random_seed": "blank = random",
  "tach.grid.empty_error":
    "Select at least one cell in the allowed-regions grid, or pick a different position mode.",

  "tach.run.title.clinician": "Tachistoscopy: clinician-paced",
  "tach.run.title.patient": "Tachistoscopy: patient mode",
  "tach.run.position":
    "Sit in front of the screen and keep your eyes on the central cross.",
  "tach.run.patient.p1":
    "Each word will briefly appear somewhere on the screen. Right after, type the word you saw and press Enter.",
  "tach.run.patient.li1": "If correct, you move on to the next word.",
  "tach.run.patient.li2":
    "If wrong, the word will be shown again until you recognize it.",
  "tach.run.patient.li3.pre": "Press ",
  "tach.run.patient.li3.btn": "Repeat",
  "tach.run.patient.li3.mid": " (key ",
  "tach.run.patient.li3.post": ") to see the word again without submitting.",
  "tach.run.patient.li4.pre": "Use ",
  "tach.run.patient.li4.btn": "Skip",
  "tach.run.patient.li4.post": " if you really can't see it.",
  "tach.run.clinician.intro":
    "Words will appear briefly. After each word you can choose:",
  "tach.run.clinician.li1.btn": "Repeat",
  "tach.run.clinician.li1.mid": " (key ",
  "tach.run.clinician.li1.post": ") to show the same word to the patient again",
  "tach.run.clinician.li2.btn": "Next",
  "tach.run.clinician.li2.mid": " (key ",
  "tach.run.clinician.li2.sep": " or ",
  "tach.run.clinician.li2.post": ") to move to the next trial",
  "tach.run.session_size": "Session of {n} trials.",

  "tach.ready.prompt": "Press Enter or Space to show the first word.",
  "tach.ready.go": "Show first word",
  "tach.panel.trial": "Trial {idx} / {tot}",
  "tach.panel.repetitions": " · repetitions: {n}",
  "tach.panel.attempts": " · attempts: {n}",
  "tach.panel.repeat": "Repeat",
  "tach.panel.next": "Next",
  "tach.panel.confirm": "Confirm",
  "tach.panel.skip": "Skip",
  "tach.panel.placeholder": "Type the word you saw…",

  "tach.results.title": "Results",
  "tach.results.subtitle": "Session of {sec} seconds, {n} trials completed.",
  "tach.results.accuracy": "Accuracy",
  "tach.results.rt_mean": "Mean RT",
  "tach.results.rep_mean": "Mean re-exposures",
  "tach.results.rep_first": "First exposure",
  "tach.results.rep_title": "Re-exposure distribution",
  "tach.results.rep_asymmetry": "Asymmetry L–R",
  "tach.results.rep_blocks": "Re-exposures per block",
  "tach.results.block_short": "B{n}",
  "tach.results.delta_exposure": "Exposure delta",
  "tach.results.real_vs_pseudo": "Real vs Pseudowords",
  "tach.results.col.empty": "",
  "tach.results.col.presented": "Presented",
  "tach.results.col.detected": "Detected",
  "tach.results.col.rt": "Mean RT",
  "tach.results.row.real": "Real",
  "tach.results.row.pseudo": "Pseudo",
  "tach.results.per_quadrant": "Per quadrant",
  "tach.results.quad": "Quadrant",
  "tach.results.col.presented_q": "Presented",
  "tach.results.col.detected_q": "Detected",
  "tach.results.download": "Download session file (JSON)",
  "tach.results.download_csv": "Download CSV",
  "tach.results.restart": "New configuration",
  "tach.results.trials": "Trials",
  "tach.results.trials_table": "Trial-by-trial",
  "tach.results.col.trial_n": "#",
  "tach.results.col.position": "pos",
  "tach.results.col.stimulus": "stim",
  "tach.results.col.response": "resp",
  "tach.results.col.rt_short": "rt",
  "tach.run.tiny_counter": "{idx} / {tot}",
  "quadrant.upper_left": "Upper left",
  "quadrant.upper_right": "Upper right",
  "quadrant.lower_left": "Lower left",
  "quadrant.lower_right": "Lower right",

  "heatmap.title": "Result heatmap",
  "heatmap.meta": "Based on {n} trials. The cross marks the fixation point.",
  "heatmap.fig.accuracy": "Accuracy by zone",
  "heatmap.fig.rt": "Reaction time by zone",
  "heatmap.tooltip.trials": "Trials",
  "heatmap.tooltip.accuracy": "Accuracy",
  "heatmap.tooltip.rt": "Mean RT",
  "heatmap.tooltip.no_data": "No trials in this zone",

  "grid.rows": "Rows",
  "grid.cols": "Columns",
  "grid.weighted": "Per-cell weights",
  "grid.clear": "Clear",
  "grid.hint.empty": "Click the cells where stimuli should appear.",
  "grid.hint.weighted":
    "Repeated clicks raise the weight (1 → {max} → off). The percentages show the relative probability.",
  "grid.hint.uniform":
    "{n} active cell(s). Stimuli will appear with equal probability in one of them.",
  "grid.fix.label": "central cell (fixation point)",
  "grid.fix.selected": "selected",
};

const DICTIONARIES: Record<Lang, Dict> = { it, en };

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const LangContext = createContext<Ctx | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof localStorage === "undefined") return "it";
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "en" || stored === "it" ? stored : "it";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const t = (key: string, params?: Record<string, string | number>) => {
    const raw = DICTIONARIES[lang][key] ?? DICTIONARIES.it[key] ?? key;
    if (!params) return raw;
    return Object.keys(params).reduce(
      (s, k) =>
        s.replace(new RegExp(`\\{${k}\\}`, "g"), String(params[k])),
      raw,
    );
  };

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useT() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useT must be used inside LangProvider");
  return ctx.t;
}

export function useLang(): readonly [Lang, (l: Lang) => void] {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used inside LangProvider");
  return [ctx.lang, ctx.setLang] as const;
}

export function LanguageToggle({ className }: { className?: string }) {
  const [lang, setLang] = useLang();
  return (
    <div className={`lang-toggle${className ? ` ${className}` : ""}`}>
      <button
        type="button"
        className={lang === "it" ? "active" : ""}
        onClick={() => setLang("it")}
        aria-label="Italiano"
      >
        IT
      </button>
      <button
        type="button"
        className={lang === "en" ? "active" : ""}
        onClick={() => setLang("en")}
        aria-label="English"
      >
        EN
      </button>
    </div>
  );
}
