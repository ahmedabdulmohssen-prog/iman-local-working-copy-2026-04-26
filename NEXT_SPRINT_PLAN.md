# IMAN Next Sprint Plan

Audit date: 2026-05-06

Sprint theme: Improve trust in recommendations and scoring without changing architecture, rebuilding the app, or expanding beyond the local-first MVP.

## Sprint Guardrails

- Backend calculations remain the source of truth.
- AI only writes advisor wording.
- Do not add auth, database, payments, bank integration, OCR, or ZIP-cost data in this sprint.
- Preserve current dark UI and local-first workflow.
- Keep changes focused and scenario-tested.
- Do not change backend score math unless explicitly approved as a scoring task.

## Critical

### 1. Sync Project Docs With Current Source

Goal: Stop stale docs from creating duplicate or misleading work.

Actions:
- Mark monthly tracker MVP as implemented.
- Mark actual-spending analysis as implemented.
- Mark live investment projection updates as implemented.
- Keep weekly summary, on-track indicators, ZIP context, and target reasoning as open items.
- Align `TASKLIST.md`, `BACKLOG.md`, `HISTORY.md`, `PROJECT.md`, and `MASTER_CONTEXT.md`.

Acceptance:
- No doc says monthly tracker MVP is missing unless it specifically means future tracker enhancements.
- No doc says live investment projection is missing unless it specifically means further polish.
- Source-of-truth rules still say backend numbers are truth and AI only writes wording.

### 2. Improve Financial Score Explanation Without Changing Score Math

Goal: Make users understand the score quickly.

Actions:
- Add a concise score thesis above or inside the existing `ScoreExplanationCard`.
- Use existing fields: `financialScore`, `scoreLabel`, `scoreBreakdown`, `weakestCategory`, `netCashFlow`, and `analysisConfidence`.
- Keep the current component breakdown.
- Do not change `computeFinancialScore`.

Acceptance:
- User can tell in one sentence why the score is high, medium, or low.
- Existing score numbers remain unchanged for current test scenarios.
- Frontend still typechecks.

### 3. Add Recommendation Target Reasoning

Goal: Explain why each recommendation target was chosen.

Actions:
- Extend deterministic recommendation metadata or wording with target reasoning.
- Examples:
  - current spend driver
  - target or reduction basis
  - why the target is realistic
  - monthly/yearly impact already calculated
- Keep AI out of target selection.

Acceptance:
- Each short-term recommendation can explain the reason for its target.
- AI prompt still says the system already chose the recommendations.
- Existing tests for monthly/yearly impact still pass.

## High

### 4. Add Scenario Tests For Recommendation Realism

Goal: Improve recommendation intelligence safely.

Actions:
- Add tests before changing recommendation selection.
- Cover:
  - efficient high-surplus user
  - high-income paycheck-to-paycheck user
  - deficit user
  - sparse-input high-score user
  - debt-heavy user
  - subscription-heavy user

Acceptance:
- Tests assert practical recommendation shape, not just numbers.
- Tests preserve max 2-3 actions.
- Tests keep annual math equal to monthly x 12.

### 5. Improve Input Validation UX

Goal: Reduce silent confusion without refactoring the form.

Actions:
- Show clearer inline feedback for invalid category rows.
- Preserve current payload filtering.
- Keep existing category UI and dark theme.

Acceptance:
- User knows when an item was ignored because name or amount is missing.
- No backend contract change required.

### 6. Decide What To Do With Credit Score Range

Goal: Remove or clarify a potentially misleading input.

Actions:
- Audit current use one more time before editing.
- Choose one approved path:
  - keep but label as future context,
  - wire into advisory wording only,
  - remove from payload/UI later.

Acceptance:
- No user-facing input appears meaningful if it is not used meaningfully.

## Medium

### 7. Add Tracker Weekly Summary

Goal: Make the existing tracker more useful without backend expansion.

Actions:
- Use current local `expenses`.
- Show current-month total and this-week total.
- Keep it lightweight.

Acceptance:
- No backend sync.
- No OCR.
- No charts unless separately approved.

### 8. Add On-Track / Over / Under Indicators

Goal: Give immediate tracker feedback.

Actions:
- Compare current-month actual category totals against planned category totals.
- Reuse `CATEGORY_NAMES`.

Acceptance:
- Category comparison uses the same category names as analysis.
- No second analysis engine is introduced.

### 9. Polish Clean vs Optimization Mode Hierarchy

Goal: Improve readability without redesigning.

Actions:
- Tighten labels, spacing, and section hierarchy around current outputs.
- Do not add a landing page or change brand direction.

Acceptance:
- Current dark UI remains recognizable.
- No architecture or data model changes.

## Future

- ZIP code cost-of-living context.
- What-if simulator.
- Goal-based planning.
- Receipt OCR.
- Bank integration.
- Credit optimization system.
- Wealth dashboard.

## Recommended First Sprint Sequence

1. Docs sync.
2. Score thesis UI using existing backend fields.
3. Recommendation target reasoning metadata/copy.
4. Scenario tests around recommendation realism.
5. Small validation UX improvement.

## Stop Point Before Implementation

This plan is ready for review. Implementation should wait for explicit approval and should start with the Critical items only.

