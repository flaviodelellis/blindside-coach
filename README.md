# BlindSide Coach

Piattaforma di riabilitazione visiva per pazienti con emianopsia. Web app React + TypeScript con esercizi configurabili (tachistoscopia, discriminazione visiva).

## Requisiti

- **Node.js ≥ 20** (consigliato l'LTS più recente)
- **Chrome o Firefox aggiornato**

## Setup

```bash
git clone <repo-url>
cd blindside-coach
npm install
npm run dev         # avvia il dev server su http://localhost:5173
```

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm run dev` | dev server con HMR |
| `npm run build` | type-check + bundle di produzione in `dist/` |
| `npm run preview` | serve il bundle di produzione (sanity check post-build) |
| `npm run lint` | ESLint |

## Struttura

```
src/
├── App.tsx                # routing/shell dell'app
├── i18n/                  # IT/EN translations
├── exercises/
│   ├── tachistoscopic/    # esercizio flash di parole + Runner
│   └── visual-discrimination/
├── components/            # componenti riutilizzabili (grid selector, heatmap)
├── lib/                   # logica pura (rng, runtime, wordLibrary, summary)
└── types/                 # tipi di sessione/protocollo

dist/                      # output di build (non versionato)
```
