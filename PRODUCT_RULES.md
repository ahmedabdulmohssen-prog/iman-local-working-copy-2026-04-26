# IMAN Product Rules

## Core Identity
- IMAN is a financial decision engine, not a generic budgeting app
- Focus on users with strong income but weak cash retention
- Product must feel smart, useful, and honest

## Calculation Rules
- Backend calculations are source of truth
- AI never invents numbers
- AI explains numbers and gives recommendations only
- Necessary living costs should not be punished like waste spending
- Score should reward retention, efficiency, and healthy behavior
- Financial Score is based only on entered income and expense data
- Financial Score must not estimate missing expenses
- Analysis Confidence is based on input completeness only
- Analysis Confidence must not change Financial Score
- Plausibility Check detects unrealistic or incomplete lifestyle data
- Plausibility Check must not change Financial Score or Analysis Confidence
- Plausibility Check may add advisory messaging only

## UX Rules
- Fast onboarding
- Clear language
- Immediate value after first use
- Low friction data entry
- Mobile first mindset
- Keep interface clean and premium

## Character System Rules
- Use the IMAN character system as the official assistant mascot and visual guide
- Use only the provided PNG assets from `artifacts/engineer-money-os/public/characters/`
- Never redesign, restyle, redraw, crop, filter, or alter the character
- Maintain identical facial features, hair, glasses, skin tone, outfit, and proportions
- Keep the clean semi-flat illustrated style consistent across the UI
- `iman-master-sheet.png` is reference-only for character design consistency and must never be imported, rendered, animated, rotated, or used in runtime UI state logic
- Map character emotions by state:
  - `iman-neutral.png`: default dashboard and assistant greeting
  - `iman-thinking.png`: analysis, loading, and reasoning states
  - `iman-explaining.png`: recommendations, coaching, and tutorials
  - `iman-warning.png`: overspending alerts, debt risk, and negative trends
  - `iman-celebration.png`: savings wins, score improvements, and milestones
  - `iman-mobile-companion.png`: AI chat assistant or mobile widgets
  - `iman-empty-state.png`: no transactions or no data states

## Recommendation Rules
- Max 2 to 3 actions per report
- Preserve lifestyle where possible
- Prioritize controllable waste
- Do not tell users obvious things only
- Do not name which subscription to cancel unless user chooses preference

## Build Rules
- Do not rebuild app while current local copy works
- Local repo is primary source
- GitHub backup regularly
- Ship MVP before feature bloat
- TASKLIST controls execution
- BACKLOG stores future ideas
