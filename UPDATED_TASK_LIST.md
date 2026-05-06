# IMAN Updated Task List

Audit date: 2026-05-06

Scope: This task list reconciles `TASKLIST.md`, `BACKLOG.md`, `HISTORY.md`, `PRODUCT_RULES.md`, and the current source code. It is factual where implementation was verified directly and marks uncertainty where behavior was not run end-to-end.

## Fully Completed

- [x] Core local analysis flow exists.
  - Frontend submits to `/api/calculate` and `/api/insights` from `artifacts/engineer-money-os/src/App.tsx` `runAnalysis`.
  - Backend mounts routes under `/api` in `artifacts/api-server/src/app.ts` and `artifacts/api-server/src/routes/index.ts`.
- [x] Backend remains the calculation source of truth.
  - `computeTotals` in `artifacts/api-server/src/lib/analysisEngine.ts` computes totals, ratios, savings opportunities, investment projections, financial score, confidence, and plausibility.
  - `/api/calculate` returns deterministic output from `computeTotals` in `artifacts/api-server/src/routes/analyze.ts`.
- [x] AI is restricted to advisor wording.
  - `/api/insights` builds deterministic optimization opportunities first and prompts the AI to write only the advisor note.
  - The prompt explicitly says not to propose numbers, dollar amounts, percentages, reductions, or new actions.
- [x] Recommendation output has concrete monthly and yearly impact coverage.
  - `impactText` and `secondaryImpactText` in `analysisEngine.ts` generate monthly/yearly impact copy.
  - `analysisEngine.test.mjs` verifies impact text, annualized math, and recommendation ordering.
- [x] Analysis Confidence is separate from Financial Score.
  - `computeInputCompleteness` computes confidence.
  - `computeFinancialScore` returns `scoreAdjustedForCompleteness: false`.
  - Tests cover high score with low confidence and score/confidence independence.
- [x] Plausibility Check is advisory only.
  - `computePlausibilityCheck` returns advisory reasons and notes.
  - Tests verify sparse unrealistic inputs trigger plausibility while realistic and deficit scenarios remain quiet.
- [x] Financial score explanation core is implemented.
  - Frontend renders `ScoreExplanationCard` with top drivers, component breakdown, and score-move estimates.
  - Backend returns `scoreBreakdown`, `weakestCategory`, `scoreLabel`, and `scoreInterpretation`.
- [x] Dynamic category inputs and manual subcategories exist.
  - `CATEGORY_NAMES`, `CATEGORY_DEFAULTS`, `CategoryCard`, and suggestion chips are implemented in `App.tsx`.
- [x] Monthly tracker MVP exists.
  - Expenses are persisted locally under `iman.monthlyTracker.expenses.v1`.
  - `AddExpenseSheet` supports manual expense entry.
  - `analyzeWithActualSpending` rebuilds categories from current-month expenses and reuses the normal analysis path.
- [x] Realtime investment projection update exists in the result view.
  - The result panel has local `investPct` state and recomputes `monthlyContribution`, `fv5`, `fv10`, and `fv20` with `useMemo`.
- [x] Dark Tailwind UI is present in the current app shell.
  - `App.tsx` uses the current dark zinc/blue design system across the main UI.
- [x] Existing analysis-engine regression suite passes.
  - Verified on 2026-05-06 with bundled Node: `analysis engine tests passed (20)`.

## Partially Completed

- [ ] Financial score explanation refinement.
  - Implemented: score breakdown and "Why This Score?" UI.
  - Remaining: wording and hierarchy can be clearer for non-technical users; current explanation still exposes component math without a concise plain-English score thesis.
- [ ] Recommendation realism.
  - Implemented: deterministic ranked recommendations with real monthly/yearly impacts and softer low-confidence targets.
  - Remaining: target reasoning is mostly embedded in insight text, not presented as a distinct "why this target" field or UI pattern.
- [ ] Recommendation target reasoning.
  - Implemented: `insight` fields include "Why it matters" and impact text.
  - Remaining: no explicit target-baseline explanation such as "target chosen because current spend is X vs recommended Y."
- [ ] Financial score weighting clarity.
  - Implemented: current scoring components are `Cash Retention`, `Controllable Waste`, `Debt Burden`, `Subscription Bloat`, `Deficit Risk`, and `Housing Pressure`.
  - Remaining: score weights are not surfaced in one concise explanation and docs still describe older or broader score inputs in places.
- [ ] Tracker execution docs.
  - Implemented in source.
  - Remaining: `TASKLIST.md`, `BACKLOG.md`, `HISTORY.md`, `PROJECT.md`, and `MASTER_CONTEXT.md` still contain stale language saying monthly tracker or live investment updates are future/needed.
- [ ] Input validation UX.
  - Implemented: frontend blocks missing income and empty expenses.
  - Remaining: category-level validation is basic; blank names and invalid rows are silently dropped before submission rather than clearly explained inline.

## Broken Or Weak

- [ ] Planning docs are out of sync with code.
  - `TASKLIST.md` lists monthly tracker, actual spending analysis, and live investment updates as incomplete even though source implements them.
  - `HISTORY.md` and `MASTER_CONTEXT.md` still say monthly tracker and live investment updates are needed.
- [ ] ZIP code context is documented but not implemented.
  - `PROJECT.md` lists ZIP code as required and describes a cost-of-living engine.
  - No ZIP input was found in `App.tsx`; `analysisEngine.ts` only says housing is low-weight until ZIP context is added.
- [ ] `Credit Score Range` is collected but appears unused by backend calculations.
  - `App.tsx` sends `creditScoreRange` in the payload.
  - `analysisEngine.ts` does not reference `creditScoreRange`.
- [ ] Financial score may still feel unclear despite the breakdown.
  - The backend has score parts, but the UI does not yet provide a compact "what made this score high/low in one sentence" summary.
- [ ] Recommendation target reasoning is implicit.
  - The app has impact and "why it matters" copy, but not an explicit target selection explanation.
- [ ] Workspace-wide type/build verification has known friction.
  - `pnpm` was not available on PATH in this shell.
  - Frontend typecheck passed directly with bundled Node and TypeScript.
  - Backend direct typecheck failed because dependent library declaration outputs were not built.
  - Workspace `tsc --build` failed in existing library code unrelated to this audit: duplicate exports in `lib/api-zod/src/index.ts`, missing `node` type definition, and `p-retry` `AbortError` typing errors.

## Still Needs Implementation

### Critical

- [ ] Reconcile stale planning docs with source reality.
  - Update old "needed" items for tracker, actual-spending analysis, and live investment projections.
  - Keep this docs-only unless implementation approval is given.
- [ ] Add clearer score explanation copy using existing backend fields.
  - Keep backend calculations unchanged.
  - Reuse `scoreBreakdown`, `weakestCategory`, `scoreLabel`, and existing `ScoreExplanationCard`.
- [ ] Add explicit recommendation target reasoning.
  - Backend should expose or format deterministic reasons such as current spend, target band, and selected reduction.
  - AI should continue writing only advisor wording.

### High

- [ ] Refine recommendation realism with scenario-based tests.
  - Add focused cases for high-income leakage, efficient users, deficit users, sparse users, and debt-heavy users.
  - Improve deterministic recommendation selection only where scenario output is weak.
- [ ] Improve input validation UX.
  - Surface invalid/ignored line items instead of silently dropping them.
  - Preserve current form structure and dark UI.
- [ ] Clean up unused or misleading inputs.
  - Decide whether `Credit Score Range` should influence advice, be clearly labeled as future context, or be removed later.

### Medium

- [ ] Add weekly summary card to the tracker.
  - Use current local-first `expenses` state.
  - No backend sync, database, OCR, or account system.
- [ ] Add on-track / over / under indicators.
  - Compare current-month actual category totals against planned inputs.
  - Reuse `CATEGORY_NAMES` so tracker and analysis stay aligned.
- [ ] Polish clean vs optimization mode labels and hierarchy.
  - Keep layout and design system intact.

### Future

- [ ] ZIP code cost context.
  - Do not add until housing-score behavior and data source are approved.
- [ ] What-if simulator.
- [ ] Goal-based planning.
- [ ] Receipt OCR.
- [ ] Bank integration.
- [ ] Credit optimization system.

## Verification Notes

- Ran: analysis engine regression suite with bundled Node. Result: passed, 20 tests.
- Ran: frontend TypeScript check directly with bundled Node and TypeScript. Result: passed.
- Attempted: backend direct TypeScript check. Result: blocked by unbuilt dependent library declaration files.
- Attempted: workspace project-reference type build. Result: failed in existing workspace library code unrelated to this audit.
- Not run: production build. Reason: this audit was instructed not to rebuild the app, and production build writes artifacts.

