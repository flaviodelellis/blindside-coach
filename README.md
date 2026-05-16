# BlindSide Coach

Piattaforma di riabilitazione visiva per pazienti con emianopsia. Web app React + TypeScript con esercizi configurabili (tachistoscopia, discriminazione visiva) e validazione opzionale della fissazione tramite webcam (WebGazer + MediaPipe FaceMesh).

## Requisiti

- **Node.js ≥ 20** (consigliato l'LTS più recente)
- **Webcam** se vuoi usare la validazione della fissazione
- **Chrome o Firefox aggiornato** (Safari ha qualche limite con MediaPipe)

## Setup

```bash
git clone <repo-url>
cd blindside-coach
npm install         # installa tutto + copia gli asset WebGazer/MediaPipe in public/
npm run dev         # avvia il dev server su http://localhost:5173
```

Lo script `postinstall` copia automaticamente `webgazer.js` e gli asset MediaPipe da `node_modules/` a `public/`. Se per qualche motivo non viene eseguito (o cancelli gli asset), rilancialo manualmente:

```bash
npm run setup-assets
```

## Permessi webcam

L'app chiede l'accesso alla webcam **solo** se attivi il toggle "Validazione fissazione" nella schermata di configurazione di un esercizio. Al primo avvio:

1. Chrome mostra un popup: clicca **Allow**
2. Su macOS, anche `Impostazioni di sistema → Privacy → Fotocamera` deve avere il browser abilitato
3. `localhost:5173` è considerato secure context, quindi non serve HTTPS in dev

Se il permesso è bloccato e non vedi più il popup: icona ⓘ a sinistra dell'URL → Site settings → Camera → Allow → ricarica.

## Comandi utili

| Comando | Cosa fa |
|---|---|
| `npm run dev` | dev server con HMR |
| `npm run build` | type-check + bundle di produzione in `dist/` |
| `npm run preview` | serve il bundle di produzione (sanity check post-build) |
| `npm run lint` | ESLint |
| `npm run setup-assets` | rigenera `public/webgazer.js` e `public/mediapipe/` da `node_modules/` |

## Struttura

```
src/
├── App.tsx                # routing/shell dell'app
├── i18n/                  # IT/EN translations
├── exercises/
│   ├── tachistoscopic/    # esercizio flash di parole + Runner
│   └── visual-discrimination/
├── components/            # componenti riutilizzabili (calibrazione, grid, heatmap)
├── lib/                   # logica pura (rng, runtime, wordLibrary, webgazer wrapper)
└── types/                 # tipi di sessione/protocollo

public/
├── webgazer.js            # bundle WebGazer pre-built (rigenerato da postinstall)
└── mediapipe/face_mesh/   # asset MediaPipe (rigenerati da postinstall)

scripts/
└── setup-vendor-assets.mjs  # copia webgazer.js + mediapipe in public/

dist/                      # output di build (non versionato)
```

## Test rapidi della webcam (standalone)

Per testare WebGazer / EyeGestures senza passare per il runner:

- `http://localhost:5173/gaze-test.html` — WebGazer puro, calibrazione a 9 punti
- `http://localhost:5173/eyegestures-test.html` — EyeGestures.js, calibrazione automatica

## Note

- Gli asset `public/webgazer.js` e `public/mediapipe/` sono **rigenerati** ad ogni `npm install` e NON sono versionati. Non modificarli a mano.
- Per cambiare versione di WebGazer, aggiorna `webgazer` in `package.json` e rilancia `npm install`.
