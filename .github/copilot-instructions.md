# Copilot / AI Agent Instructions — Neuro

Purpose: short, actionable guidance so an AI coding agent can be productive in this repo immediately.

## Big picture
- Frontend single-page app built with React + TypeScript + Vite. UI components live under `components/`.
- Core trading & AI logic lives in `services/` (backtesting, optimizer, market-simulator, technical analysis).
- Types and shared constants: `types.ts`, `constants.ts` (root) and `services/constants.ts`.
- External integrations: Firebase (`src/firebaseConfig.ts`, `firebase.json`, `firestore.rules`) and Gemini/GenAI (`@google/genai` + `GEMINI_API_KEY`).

## Key files to inspect (examples)
- UI: `components/AIOptimizer.tsx` — shows the UI pattern: compute client-side backtest (`runBacktest`) on props change and debounce the update.
- Algorithm: `services/optimizer.ts` — genetic optimizer with `runGeneticOptimization`, `mutate`, `crossover`, and a domain-specific `calculateFitness` (prioritizes reliability over raw profit).
- Simulation: `services/backtesting.ts` — single-source-of-truth for the deterministic backtest used across UI and optimizer.
- Persistence & integrations: `services/persistence.ts`, `src/firebaseConfig.ts`.

## Project-specific conventions & patterns
- Business logic is in `services/*`; UI should call into these functions rather than duplicating algorithms.
- Backtests are deterministic and synchronous (many functions call `runBacktest` directly). Expect CPU-bound operations — avoid excessive re-renders and use debouncing (see `AIOptimizer.tsx`).
- Optimizer uses small populations and synchronous evaluation (see `POPULATION_SIZE`, `GENERATIONS` in `services/optimizer.ts`). Modify these values conservatively.
- No global state library: state is passed via props and lifted to top-level components. Favor explicit prop updates over introducing global stores.
- Types are authoritative: update `types.ts` when adding fields used across UI/services.

## Developer workflows / commands
- Install: `npm install`
- Dev server (hot reload): `npm run dev` (uses Vite)
- Build: `npm run build`
- Preview production build: `npm run preview`
- Env: create `.env.local` and set `GEMINI_API_KEY` (referenced in README). Firebase config is in `src/firebaseConfig.ts`.

## Integration notes and safety
- `@google/genai` is a dependency — calls to external LLM/Gemini must be guarded with env var checks and try/catch.
- Firebase rules and `firebase.json` exist; do not change production rules without CI/owner review.

## When you change algo code (rules for the agent)
- Edit `services/*` for algorithmic changes and update `components/*` only for UI concerns.
- Preserve deterministic behavior of `runBacktest`; tests and reproducibility depend on that.
- If you change `types.ts` or `constants.ts`, update all usage sites across `components/` and `services/`.

## How to find examples quickly
- Auto-backtest pattern: search for `runBacktest(` — used in `components/AIOptimizer.tsx` and many services.
- Genetic optimizer pattern: open `services/optimizer.ts` to see mutation/crossover/fitness logic.
- Environment & secrets: README mentions `.env.local` and `GEMINI_API_KEY`.

## Quick checklist for PRs the agent should follow
- Add or update `types.ts` when adding cross-cutting fields.
- Keep algorithm unit changes in `services/` and UI-only fixes in `components/`.
- Run the dev server locally (`npm run dev`) and visually verify UI changes that touch `components/`.

If anything here is unclear or you want more examples for a specific area (UI, optimizer, backtesting, or integrations), tell me which area and I'll expand this file with targeted examples and code snippets.
