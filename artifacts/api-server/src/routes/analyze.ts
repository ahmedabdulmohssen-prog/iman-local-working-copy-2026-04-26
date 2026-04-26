import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

type LineItem = { name: string; amount: number };
type Action = { text: string; savings: number | null };
type Difficulty = "Easy" | "Medium" | "Hard";
type Priority = {
  text: string;
  monthlyImpact: number | null;
  difficulty: Difficulty;
};

const CATEGORY_NAMES = [
  "Housing",
  "Utilities",
  "Food",
  "Transportation",
  "Services",
  "Subscriptions",
  "Debt",
  "Personal",
  "Misc",
] as const;
type CategoryName = (typeof CATEGORY_NAMES)[number];

const TYPO_MAP: Record<string, string> = {
  laundary: "Laundry",
  groceris: "Groceries",
  grocerys: "Groceries",
  grocey: "Groceries",
  electicity: "Electricity",
  electic: "Electricity",
  electrcity: "Electricity",
  internat: "Internet",
  internt: "Internet",
  phon: "Phone",
  mortage: "Mortgage",
  morgage: "Mortgage",
  insurence: "Insurance",
  insurnace: "Insurance",
  maintainance: "Maintenance",
  maintenence: "Maintenance",
  subscribtion: "Subscription",
  groomming: "Grooming",
  cloths: "Clothing",
  clothings: "Clothing",
};

function normalizeName(raw: string): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  return TYPO_MAP[lower] ?? trimmed;
}

function normalizeItems(input: unknown): LineItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((it: any) => ({
      name: normalizeName(it?.name),
      amount: Number(it?.amount) || 0,
    }))
    .filter((it) => it.name !== "" && it.amount > 0);
}

function normalizeCategories(input: unknown): Record<CategoryName, LineItem[]> {
  const out = {} as Record<CategoryName, LineItem[]>;
  const raw = (input ?? {}) as Record<string, unknown>;
  for (const name of CATEGORY_NAMES) {
    out[name] = normalizeItems(raw[name]);
  }
  return out;
}

function sum(items: LineItem[]): number {
  return items.reduce((s, it) => s + it.amount, 0);
}

function fmt(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

// ============================================================
// Recommendation engine — Short Term Priorities (0–90 days)
// Low-friction, immediate moves. Each item carries an estimated
// monthly $ impact (when computable) and a difficulty pill.
// ============================================================
function buildShortTerm(opts: {
  income: number;
  eatingOut: number;
  groceries: number;
  subscriptions: LineItem[];
  subscriptionsTotal: number;
  servicesTotal: number;
  otherTotal: number;
  personalTotal: number;
  utilitiesTotal: number;
  housing: LineItem[];
  transportation: LineItem[];
  debtTotal: number;
  isDeficit: boolean;
}): Priority[] {
  const {
    income,
    eatingOut,
    groceries,
    subscriptions,
    subscriptionsTotal,
    servicesTotal,
    otherTotal,
    personalTotal,
    utilitiesTotal,
    housing,
    transportation,
    debtTotal,
    isDeficit,
  } = opts;

  const moves: Priority[] = [];

  // 1) Cut subscriptions — keep top 2, drop the rest.
  if (subscriptions.length > 2 && subscriptionsTotal > 0) {
    const sorted = [...subscriptions].sort((a, b) => b.amount - a.amount);
    const top2Total = sorted[0].amount + sorted[1].amount;
    const dropped = subscriptions.length - 2;
    const save = subscriptionsTotal - top2Total;
    if (save > 0) {
      moves.push({
        text: `Cancel ${dropped} subscription${dropped === 1 ? "" : "s"} — keep your top 2 (${fmt(top2Total)}/mo).`,
        monthlyImpact: save,
        difficulty: "Easy",
      });
    }
  }

  // 2) Reduce takeout — rebalance eating out vs groceries.
  if (eatingOut > 0) {
    const reductionPct = isDeficit ? 0.5 : 0.4;
    const newEatingOut = Math.round(eatingOut * (1 - reductionPct));
    const groceriesBump = eatingOut > groceries ? 50 : 0;
    const save = eatingOut - newEatingOut - groceriesBump;
    if (save > 0) {
      const text =
        groceriesBump > 0
          ? `Cut takeout to ${fmt(newEatingOut)}/mo and add ${fmt(groceriesBump)} to groceries.`
          : `Reduce takeout from ${fmt(eatingOut)} to ${fmt(newEatingOut)}/mo.`;
      moves.push({
        text,
        monthlyImpact: save,
        difficulty: eatingOut > 400 ? "Medium" : "Easy",
      });
    }
  }

  // 3) Reduce service frequency.
  if (servicesTotal > 0) {
    const reductionPct = isDeficit ? 0.5 : 0.3;
    const newServices = Math.round(servicesTotal * (1 - reductionPct));
    const save = servicesTotal - newServices;
    if (save > 0) {
      moves.push({
        text: `Cut paid service frequency from ${fmt(servicesTotal)} to ${fmt(newServices)}/mo.`,
        monthlyImpact: save,
        difficulty: "Easy",
      });
    }
  }

  // 4) Pause nonessential / Misc spending.
  if (otherTotal > 50) {
    const reductionPct = isDeficit ? 0.4 : 0.3;
    const newOther = Math.round(otherTotal * (1 - reductionPct));
    const save = otherTotal - newOther;
    if (save > 0) {
      moves.push({
        text: `Pause nonessentials — cap miscellaneous at ${fmt(newOther)}/mo.`,
        monthlyImpact: save,
        difficulty: "Easy",
      });
    }
  }

  // 5) Trim personal if high (>8% income or >$300).
  const personalThreshold = Math.max(0.08 * income, 300);
  if (personalTotal > personalThreshold) {
    const reductionPct = isDeficit ? 0.25 : 0.2;
    const newPersonal = Math.round(personalTotal * (1 - reductionPct));
    const save = personalTotal - newPersonal;
    if (save > 0) {
      moves.push({
        text: `Trim personal spending from ${fmt(personalTotal)} to ${fmt(newPersonal)}/mo.`,
        monthlyImpact: save,
        difficulty: "Easy",
      });
    }
  }

  // 6) Negotiate insurance — re-quote any insurance line you have.
  const insuranceLines = [...housing, ...transportation].filter((it) =>
    /insur/i.test(it.name),
  );
  const insuranceTotal = insuranceLines.reduce((s, it) => s + it.amount, 0);
  if (insuranceTotal >= 80) {
    const save = Math.round(insuranceTotal * 0.12);
    if (save >= 5) {
      moves.push({
        text: `Re-shop insurance quotes (${fmt(insuranceTotal)}/mo) — switching providers commonly saves ~10–15%.`,
        monthlyImpact: save,
        difficulty: "Medium",
      });
    }
  }

  // 7) Utility savings — audit plans if utilities are >5% income or >$200.
  const utilThreshold = Math.max(0.05 * income, 200);
  if (utilitiesTotal > utilThreshold) {
    const save = Math.round(utilitiesTotal * 0.1);
    if (save >= 5) {
      moves.push({
        text: `Audit utility plans (${fmt(utilitiesTotal)}/mo) — switching providers often shaves ~10%.`,
        monthlyImpact: save,
        difficulty: "Easy",
      });
    }
  }

  // 8) Refinance / restructure debt — call issuers for lower APR or hardship plan.
  if (debtTotal > 0) {
    moves.push({
      text: `Call card and loan issuers (${fmt(debtTotal)}/mo) to request a lower APR or hardship plan.`,
      monthlyImpact: null,
      difficulty: "Medium",
    });
  }

  // 9) Increase side income — only when running a deficit.
  if (isDeficit) {
    moves.push({
      text: `Add a short-term side income stream (freelance, gig, contract) to bridge the deficit faster.`,
      monthlyImpact: null,
      difficulty: "Hard",
    });
  }

  // Order: items with measurable $ impact first (largest first), then advisory items.
  const withImpact = moves
    .filter((m) => typeof m.monthlyImpact === "number")
    .sort((a, b) => (b.monthlyImpact ?? 0) - (a.monthlyImpact ?? 0));
  const noImpact = moves.filter((m) => m.monthlyImpact === null);
  return [...withImpact, ...noImpact].slice(0, 3);
}

// ============================================================
// Recommendation engine — Long Term Opportunities (3–12 months)
// Higher-friction, strategic moves.
// Heavy moves (move home, sell vehicle, relocate) only lead the
// list when severe negative cash flow is present.
// ============================================================
function buildLongTerm(opts: {
  income: number;
  housingTotal: number;
  transportationTotal: number;
  leakageTotal: number;
  debt: LineItem[];
  debtTotal: number;
  savingsRate: number;
  isDeficit: boolean;
  severeDeficit: boolean;
}): Priority[] {
  const {
    income,
    housingTotal,
    transportationTotal,
    leakageTotal,
    debt,
    debtTotal,
    savingsRate,
    isDeficit,
    severeDeficit,
  } = opts;

  const moves: Priority[] = [];

  // Career income increase — broad lever when savings rate is weak.
  if (income > 0 && (savingsRate < 0.1 || isDeficit)) {
    const target = Math.round(income * 0.1);
    moves.push({
      text: `Pursue a raise, promotion, or higher-paying role — even a 10% bump (${fmt(target)}/mo) reshapes your runway.`,
      monthlyImpact: target,
      difficulty: "Hard",
    });
  }

  // Debt consolidation — if multiple debts or debt is heavy relative to income.
  if (debt.length >= 2 || (income > 0 && debtTotal > 0.1 * income)) {
    const save = Math.max(40, Math.round(debtTotal * 0.15));
    moves.push({
      text:
        debt.length >= 2
          ? `Consolidate ${debt.length} debt balances into one lower-rate loan to free monthly cash.`
          : `Refinance ${fmt(debtTotal)}/mo of debt into a lower-rate loan to ease monthly pressure.`,
      monthlyImpact: save,
      difficulty: "Medium",
    });
  }

  // Lifestyle downsizing — when food + subs + misc consumes >25% of income.
  const leakageRatio = income > 0 ? leakageTotal / income : 0;
  if (leakageRatio > 0.25 && leakageTotal > 0) {
    const save = Math.round(leakageTotal * 0.2);
    moves.push({
      text: `Downsize discretionary lifestyle (food, subs, misc total ${fmt(leakageTotal)}/mo) over the next 6 months.`,
      monthlyImpact: save,
      difficulty: "Medium",
    });
  }

  // Move to lower-rent housing — only if housing >35% of income.
  if (income > 0 && housingTotal / income > 0.35) {
    const newHousing = Math.round(income * 0.3);
    const save = housingTotal - newHousing;
    if (save > 0) {
      moves.push({
        text: `Plan a move to housing under ${fmt(newHousing)}/mo (~30% of income) at next lease end.`,
        monthlyImpact: save,
        difficulty: "Hard",
      });
    }
  }

  // Replace expensive vehicle — only if transport >15% income and >$500/mo.
  if (
    income > 0 &&
    transportationTotal / income > 0.15 &&
    transportationTotal > 500
  ) {
    const newTransport = Math.round(transportationTotal * 0.6);
    const save = transportationTotal - newTransport;
    if (save > 0) {
      moves.push({
        text: `Replace your vehicle with a cheaper-to-own option (target ~${fmt(newTransport)}/mo all-in).`,
        monthlyImpact: save,
        difficulty: "Hard",
      });
    }
  }

  // Relocation — only proposed under severe deficit.
  if (severeDeficit && income > 0) {
    const save = Math.round(income * 0.05);
    moves.push({
      text: `Consider relocating to a lower cost-of-living area to reset fixed costs.`,
      monthlyImpact: save > 0 ? save : null,
      difficulty: "Hard",
    });
  }

  // Heavy moves: move home / sell vehicle / relocate. By rule these never
  // lead the list unless the user is in severe negative cash flow.
  const isHeavy = (m: Priority) =>
    /\bmove\b|\brelocat\w*|\bvehicle\b|\bsell\b/i.test(m.text);
  const heavy = moves.filter(isHeavy).sort(
    (a, b) => (b.monthlyImpact ?? 0) - (a.monthlyImpact ?? 0),
  );
  const rest = moves.filter((m) => !isHeavy(m)).sort(
    (a, b) => (b.monthlyImpact ?? 0) - (a.monthlyImpact ?? 0),
  );

  // Guard: in non-severe mode, never let a heavy move take the first slot.
  // If the only candidates are heavy moves, surface career-growth as the
  // gentler lead-in so the user gets a realistic non-displacement option.
  if (!severeDeficit && heavy.length > 0 && rest.length === 0 && income > 0) {
    const target = Math.round(income * 0.1);
    rest.push({
      text: `Pursue a raise, promotion, or higher-paying role — even a 10% bump (${fmt(target)}/mo) reshapes your runway.`,
      monthlyImpact: target,
      difficulty: "Hard",
    });
  }

  const ordered = severeDeficit ? [...heavy, ...rest] : [...rest, ...heavy];
  return ordered.slice(0, 3);
}

function computeTotals(body: any) {
  const income = Number(body?.income) || 0;
  const savingsBalance = Math.max(0, Number(body?.savingsBalance) || 0);
  const monthlyInvesting = Math.max(0, Number(body?.monthlyInvesting) || 0);
  const categories = normalizeCategories(body?.categories);

  // Map structured categories to the (unchanged) analysis variables.
  const housing = categories.Housing;
  const utilities = categories.Utilities;
  const food = categories.Food;
  const transportation = categories.Transportation;
  const services = categories.Services;
  const subscriptions = categories.Subscriptions;
  const debt = categories.Debt;
  const personal = categories.Personal;
  const misc = categories.Misc;
  const other = misc; // Misc maps to legacy "other" for action generation.

  const investPctRaw = Number(body?.investPct);
  const investPct = Number.isFinite(investPctRaw)
    ? Math.min(100, Math.max(25, Math.round(investPctRaw)))
    : 70;

  const housingTotal = sum(housing);
  const utilitiesTotal = sum(utilities);
  const foodTotal = sum(food);
  const transportationTotal = sum(transportation);
  const servicesTotal = sum(services);
  const subscriptionsTotal = sum(subscriptions);
  const debtTotal = sum(debt);
  const personalTotal = sum(personal);
  const otherTotal = sum(other);

  // Legacy alias kept so downstream interpretation/scoring is unchanged.
  const rent = housingTotal;

  const categoryTotals: Record<CategoryName, number> = {
    Housing: housingTotal,
    Utilities: utilitiesTotal,
    Food: foodTotal,
    Transportation: transportationTotal,
    Services: servicesTotal,
    Subscriptions: subscriptionsTotal,
    Debt: debtTotal,
    Personal: personalTotal,
    Misc: otherTotal,
  };

  const totalExpenses =
    housingTotal +
    utilitiesTotal +
    foodTotal +
    transportationTotal +
    servicesTotal +
    subscriptionsTotal +
    debtTotal +
    personalTotal +
    otherTotal;
  const netCashFlow = income - totalExpenses;
  const weeklySafeSpend = Math.round(netCashFlow / 4);

  const groceries = food
    .filter((it) => /grocer/i.test(it.name))
    .reduce((s, it) => s + it.amount, 0);
  const eatingOut = Math.max(0, foodTotal - groceries);

  const isDeficit = netCashFlow < 0;
  // "Severe" deficit unlocks heavy long-term moves (move home / sell vehicle /
  // relocate) at the top of the list. Threshold: shortfall worse than 10% of
  // income or below -$500 absolute.
  const severeDeficit =
    netCashFlow < 0 &&
    (netCashFlow < -500 || (income > 0 && netCashFlow < -0.1 * income));

  // ===== Deterministic recommendation engine =====
  const shortTermPriorities = buildShortTerm({
    income,
    eatingOut,
    groceries,
    subscriptions,
    subscriptionsTotal,
    servicesTotal,
    otherTotal,
    personalTotal,
    utilitiesTotal,
    housing,
    transportation,
    debtTotal,
    isDeficit,
  });

  // Pre-compute savingsRate for long-term lever decisions.
  const savingsRateForRec = income > 0 ? netCashFlow / income : 0;
  const leakageTotalForRec = foodTotal + subscriptionsTotal + otherTotal;

  const longTermOpportunities = buildLongTerm({
    income,
    housingTotal,
    transportationTotal,
    leakageTotal: leakageTotalForRec,
    debt,
    debtTotal,
    savingsRate: savingsRateForRec,
    isDeficit,
    severeDeficit,
  });

  // monthlySavings comes ONLY from the short-term priorities — those are the
  // actions a user can realistically take in the next 0–90 days.
  const monthlySavings = shortTermPriorities.reduce(
    (s, m) => s + (typeof m.monthlyImpact === "number" ? m.monthlyImpact : 0),
    0,
  );

  // Backwards-compatible alias for any downstream consumer expecting the old
  // recommendedActions shape ({ text, savings }). Same data, same order.
  const recommendedActions: Action[] = shortTermPriorities.map((m) => ({
    text: m.text,
    savings: m.monthlyImpact,
  }));

  const annualWaste = monthlySavings * 12;
  const projectedNetCashFlow = netCashFlow + monthlySavings;
  const investAmount = isDeficit
    ? 0
    : Math.round(monthlySavings * (investPct / 100));

  // ===== Weighted Financial Health Score (0–100) =====

  // 1) Savings Rate (30 pts)
  const savingsRate = income > 0 ? netCashFlow / income : 0;
  let savingsRatePts = 0;
  if (savingsRate >= 0.3) savingsRatePts = 30;
  else if (savingsRate >= 0.2) savingsRatePts = 22;
  else if (savingsRate >= 0.1) savingsRatePts = 12;
  else if (savingsRate >= 0.01) savingsRatePts = 5;

  // 2) Housing Cost Ratio (20 pts)
  const housingRatio = income > 0 ? housingTotal / income : 1;
  let housingPts = 0;
  if (housingRatio < 0.25) housingPts = 20;
  else if (housingRatio < 0.35) housingPts = 14;
  else if (housingRatio < 0.45) housingPts = 8;

  // 3) Lifestyle Leakage (20 pts) — Food + Subscriptions + Misc
  const leakageTotal = foodTotal + subscriptionsTotal + otherTotal;
  const leakageRatio = income > 0 ? leakageTotal / income : 1;
  let leakagePts = 0;
  if (leakageRatio < 0.15) leakagePts = 20;
  else if (leakageRatio <= 0.25) leakagePts = 10;

  // 4) Emergency Buffer (15 pts) — savingsBalance / monthly expenses
  const monthsCovered =
    totalExpenses > 0 ? savingsBalance / totalExpenses : 0;
  let bufferPts = 0;
  if (monthsCovered >= 6) bufferPts = 15;
  else if (monthsCovered >= 3) bufferPts = 10;
  else if (monthsCovered >= 1) bufferPts = 5;

  // 5) Wealth Building (15 pts) — monthlyInvesting / income
  const investingRatio = income > 0 ? monthlyInvesting / income : 0;
  let wealthPts = 0;
  if (investingRatio >= 0.1) wealthPts = 15;
  else if (investingRatio >= 0.05) wealthPts = 8;
  else if (investingRatio >= 0.01) wealthPts = 4;

  const score = Math.max(
    0,
    Math.min(100, savingsRatePts + housingPts + leakagePts + bufferPts + wealthPts),
  );

  const scoreLabel =
    score >= 85
      ? "Elite"
      : score >= 70
        ? "Strong"
        : score >= 55
          ? "Stable but Leaking"
          : score >= 40
            ? "Risk Zone"
            : "Critical";

  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const explainSavings = () =>
    income <= 0
      ? "Add your monthly income to score this."
      : savingsRate <= 0
        ? `You're spending all you earn — net leftover is ${pct(savingsRate)}. Free up at least 10% to start building.`
        : `Your monthly leftover is ${pct(savingsRate)} of income — aim for 20%+ to gain real momentum.`;
  const explainHousing = () =>
    income <= 0 || housingTotal <= 0
      ? "Add your housing cost to score this."
      : `Housing takes ${pct(housingRatio)} of your income — under 25% gives you the most flexibility.`;
  const explainLeakage = () =>
    income <= 0
      ? "Add your monthly income to score this."
      : `Food, subscriptions and misc make up ${pct(leakageRatio)} of income — under 15% frees real cash for goals.`;
  const explainBuffer = () =>
    savingsBalance <= 0
      ? "Add your savings balance to score this — aim for 3+ months of expenses as a starting buffer."
      : `Your savings cover ${monthsCovered.toFixed(1)} months of expenses — target 3+ months to weather surprises, 6+ for full security.`;
  const explainWealth = () =>
    monthlyInvesting <= 0
      ? "Add your monthly investing amount to score this — aim for 5%+ of income to build long-term wealth."
      : `You're investing ${pct(investingRatio)} of income — push toward 10%+ to compound meaningful wealth.`;

  const scoreBreakdown = [
    { name: "Savings Rate", points: savingsRatePts, max: 30, explanation: explainSavings() },
    { name: "Housing Cost Ratio", points: housingPts, max: 20, explanation: explainHousing() },
    { name: "Lifestyle Leakage", points: leakagePts, max: 20, explanation: explainLeakage() },
    { name: "Emergency Buffer", points: bufferPts, max: 15, explanation: explainBuffer() },
    { name: "Wealth Building", points: wealthPts, max: 15, explanation: explainWealth() },
  ];

  // Weakest = lowest points-per-max ratio. Tiebreak: largest max wins (bigger lever).
  const weakest = [...scoreBreakdown].sort((a, b) => {
    const ra = a.points / a.max;
    const rb = b.points / b.max;
    if (ra !== rb) return ra - rb;
    return b.max - a.max;
  })[0];

  // Backwards-compat label kept on response so older clients don't break.
  const interpretation = scoreLabel;

  // ===== Future value (only meaningful when not deficit) =====
  const r = 0.07 / 12;
  const fv = (months: number) =>
    Math.round((investAmount * (Math.pow(1 + r, months) - 1)) / r);

  return {
    income,
    rent,
    food,
    subscriptions,
    services,
    other,
    categories,
    categoryTotals,
    investPct,
    subscriptionsTotal,
    foodTotal,
    servicesTotal,
    otherTotal,
    housingTotal,
    utilitiesTotal,
    transportationTotal,
    debtTotal,
    personalTotal,
    totalExpenses,
    netCashFlow,
    weeklySafeSpend,
    groceries,
    eatingOut,
    monthlySavings,
    investAmount,
    annualWaste,
    projectedNetCashFlow,
    isDeficit,
    financialScore: score,
    scoreLabel,
    scoreBreakdown,
    weakestCategory: weakest,
    scoreInterpretation: interpretation,
    fv5: fv(60),
    fv10: fv(120),
    fv20: fv(240),
    recommendedActions,
    shortTermPriorities,
    longTermOpportunities,
    severeDeficit,
  };
}

function fallbackOpportunities(t: ReturnType<typeof computeTotals>): string[] {
  const out: string[] = [];
  if (t.eatingOut > t.groceries && t.eatingOut > 0) {
    out.push(
      "Eating out significantly exceeds groceries; shifting this will close most of the gap.",
    );
  }
  if (t.subscriptions.length > 2) {
    out.push("Multiple overlapping subscriptions increase recurring cost.");
  }
  if (t.servicesTotal > 0.1 * t.income && t.income > 0) {
    out.push(
      "Service spending is a large share of income; reducing frequency will free cash.",
    );
  }
  if (out.length === 0) {
    out.push(
      "Spending is broadly balanced; small consolidation in subscriptions still helps.",
    );
  }
  return out;
}

function fallbackAdvisor(t: ReturnType<typeof computeTotals>): string {
  if (t.isDeficit) {
    return "You're currently running a deficit. The actions above are designed to close that gap. Aim to bring your net cash flow back to positive within 60–90 days.";
  }
  if (t.financialScore >= 70) {
    return "You're in a strong position — your spending is efficient. Focus on optimizing investment allocation and protecting your surplus from lifestyle drift.";
  }
  if (t.financialScore >= 55) {
    return "You're stable but leaking value. Apply the highest-impact action first and let smaller cuts follow over the next few weeks.";
  }
  return "There's meaningful inefficiency to clean up. Start with the largest action above and reassess after one month.";
}

router.post("/calculate", (req, res) => {
  const start = Date.now();
  const t = computeTotals(req.body);
  const ms = Date.now() - start;
  console.log(
    `[calculate] ${ms}ms net=${t.netCashFlow} savings=${t.monthlySavings} actions=${t.recommendedActions.length}`,
  );
  res.json({
    netCashFlow: t.netCashFlow,
    weeklySafeSpend: t.weeklySafeSpend,
    totalExpenses: t.totalExpenses,
    categoryTotals: t.categoryTotals,
    subscriptionsTotal: t.subscriptionsTotal,
    foodTotal: t.foodTotal,
    servicesTotal: t.servicesTotal,
    otherTotal: t.otherTotal,
    financialScore: t.financialScore,
    scoreLabel: t.scoreLabel,
    scoreBreakdown: t.scoreBreakdown,
    weakestCategory: t.weakestCategory,
    scoreInterpretation: t.scoreInterpretation,
    isDeficit: t.isDeficit,
    annualWaste: t.annualWaste,
    monthlySavings: t.monthlySavings,
    projectedNetCashFlow: t.projectedNetCashFlow,
    investPct: t.investPct,
    investAmount: t.investAmount,
    fv5: t.fv5,
    fv10: t.fv10,
    fv20: t.fv20,
    recommendedActions: t.recommendedActions,
    shortTermPriorities: t.shortTermPriorities,
    longTermOpportunities: t.longTermOpportunities,
    severeDeficit: t.severeDeficit,
  });
});

router.post("/insights", async (req, res) => {
  const start = Date.now();
  const t = computeTotals(req.body);

  const tone = t.isDeficit
    ? "direct but supportive — deficit closes first; no investing talk"
    : t.financialScore >= 70
      ? "supportive, optimizing"
      : "advisory, improvement-focused";

  // The system has already computed all numbers and recommended actions.
  // The AI's job is to DESCRIBE patterns in plain English. It must NOT
  // invent dollar amounts, percentages, savings figures, or reductions.
  const shortForContext = t.shortTermPriorities
    .map((m, i) => `${i + 1}. ${m.text}`)
    .join("\n");
  const longForContext = t.longTermOpportunities
    .map((m, i) => `${i + 1}. ${m.text}`)
    .join("\n");

  const prompt = `CONTEXT (already computed by the system — do NOT recompute or alter):
Income $${t.income} | Net $${t.netCashFlow} | Subs $${t.subscriptionsTotal} (${t.subscriptions.length}) | Food groceries $${t.groceries}, eating out $${t.eatingOut} | Services $${t.servicesTotal} | Other $${t.otherTotal}

Short term priorities (0–90 days, already chosen by the system):
${shortForContext || "(none)"}

Long term opportunities (3–12 months, already chosen by the system):
${longForContext || "(none)"}

YOUR JOB:
Write short qualitative text only. Do NOT propose numbers, dollar amounts, percentages, reductions, or new actions. Describe patterns in plain English.

Tone: ${tone}.

Output EXACTLY this format, no extras, no numbers:

Opportunities:
- [single sentence: "[Observation]; [consequence or fix]." — qualitative only, no $ or %]
- [single sentence in same pattern]

Advisor: [2 sentences max, qualitative only${
    t.isDeficit
      ? '; END with the exact sentence: "Aim to bring your net cash flow back to positive within 60–90 days."'
      : ""
  }]`;

  const TIMEOUT_MS = 10_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const completion = await openai.chat.completions.create(
      {
        model: "gpt-5",
        messages: [{ role: "user", content: prompt }],
      },
      { signal: controller.signal },
    );
    clearTimeout(timeout);

    const aiBody = (completion.choices[0]?.message?.content ?? "").trim();

    const grab = (label: string): string => {
      const re = new RegExp(
        `${label}\\s*:?\\s*\\n?([\\s\\S]*?)(?=\\n\\s*(?:Opportunities|Advisor)\\s*:|$)`,
        "i",
      );
      const m = aiBody.match(re);
      return m ? m[1].trim() : "";
    };

    const optimizationOpportunities = grab("Opportunities")
      .split(/\n+/)
      .map((l) => l.replace(/^[-•]\s*/, "").trim())
      .filter(Boolean);

    const advisorNoteRaw = grab("Advisor").replace(/^\[|\]$/g, "").trim();
    let advisorNote = advisorNoteRaw || fallbackAdvisor(t);
    // Enforce required closing sentence in deficit mode.
    if (
      t.isDeficit &&
      !/positive within 60[–-]90 days\.?$/i.test(advisorNote.trim())
    ) {
      advisorNote = `${advisorNote.replace(/\s*$/, "")} Aim to bring your net cash flow back to positive within 60–90 days.`;
    }

    const ms = Date.now() - start;
    console.log(
      `[insights] ${ms}ms ai=ok opps=${optimizationOpportunities.length}`,
    );

    res.json({
      optimizationOpportunities:
        optimizationOpportunities.length > 0
          ? optimizationOpportunities
          : fallbackOpportunities(t),
      advisorNote,
      insightsSource: "ai" as const,
    });
  } catch (err: any) {
    clearTimeout(timeout);
    const ms = Date.now() - start;
    const reason = err?.name === "AbortError" ? "timeout" : "error";
    console.log(`[insights] ${ms}ms ai=${reason} -> fallback`);
    req.log.warn({ err: String(err?.message ?? err), reason }, "insights fallback");
    res.json({
      optimizationOpportunities: fallbackOpportunities(t),
      advisorNote: fallbackAdvisor(t),
      insightsSource: "fallback" as const,
    });
  }
});

export default router;
