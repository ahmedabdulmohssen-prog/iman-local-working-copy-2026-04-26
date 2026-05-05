PROJECT: IMAN

Version: 2.0

========================
PURPOSE
========================

IMAN is a financial decision engine for people who earn solid income but still live paycheck to paycheck.

The system helps users:

- Understand where money is leaking
- Improve monthly cash retention
- Reduce waste without destroying lifestyle
- Make smarter decisions fast
- Build long term wealth

IMAN is NOT a budgeting tracker.

IMAN is an optimization system.

========================
TARGET USER
========================

Primary Users:

- Good income earners with low retained cash
- Professionals
- Engineers
- Analytical users
- Users frustrated by “where did my money go?”

Common User Problem:

“I make enough money. Why am I still broke?”

========================
CORE SYSTEM MODULES
========================

1. Expense Analyzer
2. Waste Detection Engine
3. Financial Score Engine
4. Recommendation Engine
5. Monthly Tracker
6. Investment Projection Engine
7. Cost of Living Context Engine
8. Analysis Confidence System
9. Plausibility Check Layer

========================
INPUT SYSTEM
========================

Required Inputs:

- Monthly income
- ZIP code
- Monthly expenses

Fixed Categories:

1. Housing
2. Food
3. Utilities
4. Transportation
5. Services
6. Subscriptions
7. Debt
8. Personal
9. Misc

Each Category Supports:

- Multiple line items
- Name
- Monthly value

Validation Rules:

- No blank names
- No zero or negative values
- Typo normalization
- Debt field note:
  Enter monthly payment, not full loan balance

========================
MONTHLY TRACKER
========================

Users can log spending by:

- Manual entry
- Receipt scan (future)

Track daily spending across month.

End of month report shows:

- Total spend
- Category breakdown
- Leak areas
- Month over month changes
- Advice to improve next month

========================
DETERMINISTIC ENGINE
========================

Rules:

Same input must always produce same result.

AI does NOT calculate numbers.

Backend handles:

- Totals
- Ratios
- Scores
- Analysis confidence
- Plausibility checks
- Savings values
- Projections

AI handles:

- Explanation
- Wording
- Advisory summaries

========================
CORE CALCULATIONS
========================

Net Cash Flow:

Income minus total expenses

Potential Savings:

Sum of realistic recommended reductions

After Optimization:

Net Cash Flow plus Potential Savings

Yearly Savings:

Monthly Savings × 12

Weekly Safe Spend:

Remaining discretionary cash / 4

========================
FINANCIAL SCORE ENGINE
========================

Score Range:

0 to 100

Purpose:

Measure financial efficiency from entered data only, not punishment for necessary living costs.

Score Inputs:

1. Cash Retention
2. Controllable Waste
3. Debt Burden
4. Subscription Bloat
5. Deficit Risk
6. Housing Pressure

Rules:

- Uses only the income and expenses the user entered
- Does not estimate missing expenses
- Does not adjust for input completeness
- Does not use plausibility warnings to change score
- Analysis Confidence is shown separately

High Score Means:

- Strong retained cash
- Low waste
- Manageable debt
- Efficient spending

Low Score Means:

- High leakage
- Weak retention
- Debt pressure
- Poor allocation

========================
ANALYSIS CONFIDENCE SYSTEM
========================

Purpose:

Show how complete the entered expense profile appears.

Confidence Levels:

- High
- Medium
- Low

Rules:

- Based on input completeness only
- Looks at entered categories, key categories, line item count, and expense coverage
- Does not change Financial Score
- Does not judge whether the lifestyle is realistic
- Gives the user a prompt to add missing categories or line items when needed

========================
PLAUSIBILITY CHECK LAYER
========================

Purpose:

Detect unrealistic or incomplete lifestyle data that may make a strong score misleading.

Examples:

- Very low housing for substantial income
- Missing adult basics like food, utilities, transportation, or debt
- Very sparse expense entries
- Very high retained cash with incomplete data

Rules:

- Does not affect Financial Score
- Does not affect Analysis Confidence
- Does not invent missing expenses
- Adds advisory messaging only
- Appears through the Trusted Advisor summary when triggered

========================
WASTE DETECTION LOGIC
========================

Waste = controllable inefficient spend.

Examples:

- Excess eating out
- Duplicate subscriptions
- Overpriced services
- Excess misc spending
- Lifestyle creep

Necessary spending is NOT waste.

Examples:

- Reasonable rent
- Utilities
- Groceries
- Insurance
- Minimum debt payments

========================
ZIP CODE CONTEXT ENGINE
========================

Purpose:

Prevent false judgment of housing costs.

Use ZIP code to estimate:

- Local rent norms
- Local cost pressure
- Regional affordability

Example:

$2,500 rent in one city may be normal.
$2,500 elsewhere may be high.

========================
RECOMMENDATION ENGINE
========================

Rules:

- Max 2 to 3 core actions
- High impact first
- Realistic
- Preserve lifestyle where possible
- No fake filler advice
- No contradictions

Examples:

Good:
- Reduce eating out by $250 monthly
- Remove one duplicate subscription
- Requote insurance and phone plans

Bad:
- Stop all fun spending
- Move immediately
- Cancel everything

========================
DEFICIT MODE
========================

If Net Cash Flow < 0

System should:

- Trigger warning
- Pause investing assumptions
- Increase optimization urgency
- Prioritize biggest leaks first

========================
OUTPUT STRUCTURE
========================

1. Financial Score
2. Analysis Confidence
3. Plausibility Advisory, when triggered
4. Net Cash Flow
5. Weekly Safe Spend
6. Waste Detected
7. Potential Savings
8. Recommended Actions
9. Before vs After Optimization
10. Investment Growth Projection
11. Monthly Tracker Summary
12. Trusted Advisor Summary

========================
CURRENT BUILD PRIORITIES
========================

1. Waste based score redesign
2. Recommendation realism
3. Live slider updates
4. ZIP code integration
5. Debt helper text
6. Monthly tracker MVP

========================
BACKLOG
========================

- OCR receipt scanning
- Credit optimization
- Couple mode
- Wealth dashboard
- What If simulator
- Retirement planner
- Salary leak detector

========================
NON NEGOTIABLE RULES
========================

- Backend numbers are truth
- AI cannot invent math
- Same input = same output
- Financial Score uses entered data only
- Analysis Confidence is based on input completeness only
- Plausibility checks add advisory messaging only
- Monthly × 12 must always match yearly
- Product must feel useful in first session
- No feature bloat before trust is built

========================
MISSION
========================

Help users keep more of the money they already earn.
