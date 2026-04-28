export type LineItem = { name: string; amount: number };
export type Action = { text: string; savings: number | null };
export type Difficulty = "Easy" | "Medium" | "Hard";
export type Priority = {
  text: string;
  monthlyImpact: number | null;
  difficulty: Difficulty;
};

export const CATEGORY_NAMES = [
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

export type CategoryName = (typeof CATEGORY_NAMES)[number];
export type CategoryMap = Record<CategoryName, LineItem[]>;
export type CategoryTotals = Record<CategoryName, number>;

export type Ratios = {
  savingsRate: number;
  spendingRate: number;
  housingRatio: number;
  debtRatio: number;
  subscriptionRatio: number;
  controllableSpendRatio: number;
  leakageRatio: number;
  deficitRatio: number;
};

export type WasteSignal = {
  key: string;
  label: string;
  amount: number;
  excess: number;
  severity: number;
  triggered: boolean;
  explanation: string;
};

export type AnalysisConfidence = "High" | "Medium" | "Low";

export type InputCompleteness = {
  confidence: AnalysisConfidence;
  enteredCategoryCount: number;
  keyCategoryCount: number;
  keyCategoriesExpected: CategoryName[];
  missingKeyCategories: CategoryName[];
  totalLineItems: number;
  expenseCoverageRatio: number;
  sparse: boolean;
  scoreCap: number;
  scoreAdjusted: boolean;
  prompt: string;
};

export type PlausibilityCheck = {
  triggered: boolean;
  note: string | null;
  reasons: string[];
};

export type RecommendationInputs = {
  income: number;
  categories: CategoryMap;
  categoryTotals: CategoryTotals;
  housing: LineItem[];
  utilities: LineItem[];
  food: LineItem[];
  transportation: LineItem[];
  services: LineItem[];
  subscriptions: LineItem[];
  debt: LineItem[];
  personal: LineItem[];
  other: LineItem[];
  housingTotal: number;
  utilitiesTotal: number;
  foodTotal: number;
  transportationTotal: number;
  servicesTotal: number;
  subscriptionsTotal: number;
  debtTotal: number;
  personalTotal: number;
  otherTotal: number;
  totalExpenses: number;
  netCashFlow: number;
  groceries: number;
  eatingOut: number;
  ratios: Ratios;
  isDeficit: boolean;
  severeDeficit: boolean;
};

export type ScoreBreakdownItem = {
  name: string;
  points: number;
  max: number;
  explanation: string;
};

export type FinancialScoreResult = {
  financialScore: number;
  scoreLabel: string;
  scoreInterpretation: string;
  scoreBreakdown: ScoreBreakdownItem[];
  weakestCategory: ScoreBreakdownItem;
  scoreAdjustedForCompleteness: boolean;
  analysisConfidence: AnalysisConfidence;
};

export type SavingsOpportunities = {
  shortTermPriorities: Priority[];
  longTermOpportunities: Priority[];
  recommendedActions: Action[];
  monthlySavings: number;
  annualWaste: number;
  projectedNetCashFlow: number;
};

export type InvestmentProjections = {
  investPct: number;
  investAmount: number;
  fv5: number;
  fv10: number;
  fv20: number;
};

export type AnalysisTotals = RecommendationInputs &
  FinancialScoreResult &
  SavingsOpportunities &
  InvestmentProjections & {
    rent: number;
    weeklySafeSpend: number;
    wasteSignals: WasteSignal[];
    inputCompleteness: InputCompleteness;
    analysisConfidence: AnalysisConfidence;
    inputCompletenessPrompt: string;
    plausibilityCheck: PlausibilityCheck;
    plausibilityNote: string | null;
  };

const KEY_CATEGORIES: CategoryName[] = [
  "Housing",
  "Food",
  "Utilities",
  "Transportation",
];

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

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object"
    ? (input as Record<string, unknown>)
    : {};
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function ratio(amount: number, income: number): number {
  if (income > 0) return amount / income;
  return amount > 0 ? 1 : 0;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function fmt(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

export function normalizeName(raw: string): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  return TYPO_MAP[lower] ?? trimmed;
}

export function normalizeItems(input: unknown): LineItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((it) => {
      const raw = asRecord(it);
      return {
        name: normalizeName(String(raw["name"] ?? "")),
        amount: Number(raw["amount"]) || 0,
      };
    })
    .filter((it) => it.name !== "" && it.amount > 0);
}

export function normalizeCategories(input: unknown): CategoryMap {
  const out = {} as CategoryMap;
  const raw = asRecord(input);
  for (const name of CATEGORY_NAMES) {
    out[name] = normalizeItems(raw[name]);
  }
  return out;
}

export function sum(items: LineItem[]): number {
  return items.reduce((s, it) => s + it.amount, 0);
}

export function computeRatios(opts: {
  income: number;
  totalExpenses: number;
  netCashFlow: number;
  categoryTotals: CategoryTotals;
}): Ratios {
  const { income, totalExpenses, netCashFlow, categoryTotals } = opts;
  const controllableSpend =
    categoryTotals.Food +
    categoryTotals.Services +
    categoryTotals.Subscriptions +
    categoryTotals.Personal +
    categoryTotals.Misc;
  const leakageSpend =
    categoryTotals.Food +
    categoryTotals.Services +
    categoryTotals.Subscriptions +
    categoryTotals.Misc;

  return {
    savingsRate: ratio(netCashFlow, income),
    spendingRate: ratio(totalExpenses, income),
    housingRatio: ratio(categoryTotals.Housing, income),
    debtRatio: ratio(categoryTotals.Debt, income),
    subscriptionRatio: ratio(categoryTotals.Subscriptions, income),
    controllableSpendRatio: ratio(controllableSpend, income),
    leakageRatio: ratio(leakageSpend, income),
    deficitRatio: netCashFlow < 0 ? ratio(Math.abs(netCashFlow), income) : 0,
  };
}

export function buildRecommendationInputs(opts: {
  income: number;
  categories: CategoryMap;
  categoryTotals: CategoryTotals;
  totalExpenses: number;
  netCashFlow: number;
  ratios: Ratios;
}): RecommendationInputs {
  const { income, categories, categoryTotals, totalExpenses, netCashFlow, ratios } =
    opts;
  const food = categories.Food;
  const groceries = food
    .filter((it) => /grocer/i.test(it.name))
    .reduce((s, it) => s + it.amount, 0);
  const eatingOut = Math.max(0, categoryTotals.Food - groceries);
  const isDeficit = netCashFlow < 0;
  const severeDeficit =
    netCashFlow < 0 &&
    (netCashFlow < -500 || (income > 0 && netCashFlow < -0.1 * income));

  return {
    income,
    categories,
    categoryTotals,
    housing: categories.Housing,
    utilities: categories.Utilities,
    food,
    transportation: categories.Transportation,
    services: categories.Services,
    subscriptions: categories.Subscriptions,
    debt: categories.Debt,
    personal: categories.Personal,
    other: categories.Misc,
    housingTotal: categoryTotals.Housing,
    utilitiesTotal: categoryTotals.Utilities,
    foodTotal: categoryTotals.Food,
    transportationTotal: categoryTotals.Transportation,
    servicesTotal: categoryTotals.Services,
    subscriptionsTotal: categoryTotals.Subscriptions,
    debtTotal: categoryTotals.Debt,
    personalTotal: categoryTotals.Personal,
    otherTotal: categoryTotals.Misc,
    totalExpenses,
    netCashFlow,
    groceries,
    eatingOut,
    ratios,
    isDeficit,
    severeDeficit,
  };
}

function wasteSignal(opts: {
  key: string;
  label: string;
  amount: number;
  excess: number;
  income: number;
  explanation: string;
}): WasteSignal {
  const excess = Math.max(0, Math.round(opts.excess));
  const severityBase = Math.max(150, opts.income * 0.05);
  return {
    key: opts.key,
    label: opts.label,
    amount: Math.round(opts.amount),
    excess,
    severity: excess > 0 ? clamp(excess / severityBase, 0.1, 1) : 0,
    triggered: excess > 0,
    explanation: opts.explanation,
  };
}

export function computeWasteSignals(inputs: RecommendationInputs): WasteSignal[] {
  const {
    income,
    eatingOut,
    groceries,
    subscriptions,
    subscriptionsTotal,
    servicesTotal,
    personalTotal,
    otherTotal,
    utilitiesTotal,
  } = inputs;

  const sortedSubscriptions = [...subscriptions].sort((a, b) => b.amount - a.amount);
  const topTwoSubscriptionTotal =
    sortedSubscriptions.length >= 2
      ? sortedSubscriptions[0].amount + sortedSubscriptions[1].amount
      : subscriptionsTotal;

  const signals = [
    wasteSignal({
      key: "eating_out",
      label: "Eating Out",
      amount: eatingOut,
      excess:
        eatingOut > groceries && eatingOut > Math.max(0.04 * income, 200)
          ? eatingOut - Math.max(groceries, 0.04 * income, 200)
          : 0,
      income,
      explanation: "Eating out is materially higher than groceries.",
    }),
    wasteSignal({
      key: "subscription_bloat",
      label: "Subscription Bloat",
      amount: subscriptionsTotal,
      excess:
        subscriptions.length > 2 && subscriptionsTotal > Math.max(0.02 * income, 75)
          ? subscriptionsTotal - topTwoSubscriptionTotal
          : 0,
      income,
      explanation: "Recurring subscriptions exceed the lean baseline.",
    }),
    wasteSignal({
      key: "services",
      label: "Services",
      amount: servicesTotal,
      excess:
        servicesTotal > Math.max(0.08 * income, 250)
          ? servicesTotal - Math.max(0.08 * income, 250)
          : 0,
      income,
      explanation: "Paid service frequency is high relative to income.",
    }),
    wasteSignal({
      key: "personal",
      label: "Personal",
      amount: personalTotal,
      excess:
        personalTotal > Math.max(0.08 * income, 300)
          ? personalTotal - Math.max(0.08 * income, 300)
          : 0,
      income,
      explanation: "Personal spending is above the expected controllable range.",
    }),
    wasteSignal({
      key: "misc",
      label: "Misc",
      amount: otherTotal,
      excess:
        otherTotal > Math.max(0.03 * income, 150)
          ? otherTotal - Math.max(0.03 * income, 150)
          : 0,
      income,
      explanation: "Miscellaneous spend is large enough to hide leakage.",
    }),
    wasteSignal({
      key: "utilities",
      label: "Utilities",
      amount: utilitiesTotal,
      excess:
        utilitiesTotal > Math.max(0.05 * income, 200)
          ? utilitiesTotal - Math.max(0.05 * income, 200)
          : 0,
      income,
      explanation: "Utility plans may be worth auditing.",
    }),
  ];

  return signals.filter((signal) => signal.triggered);
}

export function computeInputCompleteness(opts: {
  income: number;
  categories: CategoryMap;
  categoryTotals: CategoryTotals;
  totalExpenses: number;
}): InputCompleteness {
  const { income, categories, categoryTotals, totalExpenses } = opts;
  const enteredCategories = CATEGORY_NAMES.filter(
    (category) => categoryTotals[category] > 0,
  );
  const missingKeyCategories = KEY_CATEGORIES.filter(
    (category) => categoryTotals[category] <= 0,
  );
  const totalLineItems = CATEGORY_NAMES.reduce(
    (count, category) => count + categories[category].length,
    0,
  );
  const keyCategoryCount = KEY_CATEGORIES.length - missingKeyCategories.length;
  const expenseCoverageRatio = ratio(totalExpenses, income);

  let confidence: AnalysisConfidence = "High";
  const scoreCap = totalExpenses > 0 ? 99 : 100;

  if (
    totalExpenses <= 0 ||
    enteredCategories.length <= 2 ||
    keyCategoryCount <= 1 ||
    totalLineItems <= 2
  ) {
    confidence = "Low";
  } else if (
    enteredCategories.length < 4 ||
    keyCategoryCount < KEY_CATEGORIES.length ||
    totalLineItems < 4
  ) {
    confidence = "Medium";
  }

  const sparse = confidence !== "High";
  const missingText =
    missingKeyCategories.length > 0
      ? missingKeyCategories.join(", ")
      : "more recurring or discretionary line items";
  const prompt = sparse
    ? `Add ${missingText} for a more accurate analysis.`
    : "Input coverage looks strong enough for a high-confidence analysis.";

  return {
    confidence,
    enteredCategoryCount: enteredCategories.length,
    keyCategoryCount,
    keyCategoriesExpected: KEY_CATEGORIES,
    missingKeyCategories,
    totalLineItems,
    expenseCoverageRatio,
    sparse,
    scoreCap,
    scoreAdjusted: false,
    prompt,
  };
}

export function computePlausibilityCheck(opts: {
  inputs: RecommendationInputs;
  inputCompleteness: InputCompleteness;
}): PlausibilityCheck {
  const { inputs, inputCompleteness } = opts;
  const {
    income,
    housingTotal,
    foodTotal,
    utilitiesTotal,
    transportationTotal,
    debtTotal,
    totalExpenses,
    isDeficit,
    ratios,
  } = inputs;

  const substantialIncome = income >= 4000;
  const veryLowHousing =
    substantialIncome && housingTotal > 0 && ratios.housingRatio <= 0.08;
  const missingAdultBasics =
    foodTotal <= 0 &&
    utilitiesTotal <= 0 &&
    transportationTotal <= 0 &&
    debtTotal <= 0;
  const verySparseExpenses =
    inputCompleteness.enteredCategoryCount <= 2 ||
    inputCompleteness.totalLineItems <= 2;
  const highRetentionSparse =
    ratios.savingsRate >= 0.75 && inputCompleteness.sparse;
  const thinExpenseCoverage =
    substantialIncome &&
    totalExpenses > 0 &&
    ratios.spendingRate < 0.2 &&
    inputCompleteness.sparse;

  const reasons: string[] = [];
  if (veryLowHousing) reasons.push("very_low_housing");
  if (missingAdultBasics) reasons.push("missing_adult_basics");
  if (verySparseExpenses) reasons.push("very_sparse_expenses");
  if (highRetentionSparse) reasons.push("high_retained_cash_sparse_profile");
  if (thinExpenseCoverage) reasons.push("thin_expense_coverage");

  const triggered =
    substantialIncome &&
    !isDeficit &&
    ((veryLowHousing &&
      (missingAdultBasics || verySparseExpenses || highRetentionSparse)) ||
      (missingAdultBasics && (verySparseExpenses || highRetentionSparse)) ||
      (thinExpenseCoverage && (verySparseExpenses || missingAdultBasics)));

  if (!triggered) {
    return {
      triggered: false,
      note: null,
      reasons: [],
    };
  }

  const note = veryLowHousing
    ? `If housing is truly ${fmt(housingTotal)}, life is treating you well. More likely, a few monthly costs are missing.`
    : "Strong score based on current entries. Add more real-world expenses for a sharper picture.";

  return {
    triggered: true,
    note,
    reasons,
  };
}

function buildShortTerm(opts: RecommendationInputs): Priority[] {
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

  if (subscriptions.length > 2 && subscriptionsTotal > 0) {
    const sorted = [...subscriptions].sort((a, b) => b.amount - a.amount);
    const top2Total = sorted[0].amount + sorted[1].amount;
    const dropped = subscriptions.length - 2;
    const save = subscriptionsTotal - top2Total;
    if (save > 0) {
      moves.push({
        text: `Cancel ${dropped} subscription${dropped === 1 ? "" : "s"} - keep your top 2 (${fmt(top2Total)}/mo).`,
        monthlyImpact: save,
        difficulty: "Easy",
      });
    }
  }

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

  if (otherTotal > 50) {
    const reductionPct = isDeficit ? 0.4 : 0.3;
    const newOther = Math.round(otherTotal * (1 - reductionPct));
    const save = otherTotal - newOther;
    if (save > 0) {
      moves.push({
        text: `Pause nonessentials - cap miscellaneous at ${fmt(newOther)}/mo.`,
        monthlyImpact: save,
        difficulty: "Easy",
      });
    }
  }

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

  const insuranceLines = [...housing, ...transportation].filter((it) =>
    /insur/i.test(it.name),
  );
  const insuranceTotal = insuranceLines.reduce((s, it) => s + it.amount, 0);
  if (insuranceTotal >= 80) {
    const save = Math.round(insuranceTotal * 0.12);
    if (save >= 5) {
      moves.push({
        text: `Re-shop insurance quotes (${fmt(insuranceTotal)}/mo) - switching providers commonly saves about 10-15%.`,
        monthlyImpact: save,
        difficulty: "Medium",
      });
    }
  }

  const utilThreshold = Math.max(0.05 * income, 200);
  if (utilitiesTotal > utilThreshold) {
    const save = Math.round(utilitiesTotal * 0.1);
    if (save >= 5) {
      moves.push({
        text: `Audit utility plans (${fmt(utilitiesTotal)}/mo) - switching providers often shaves about 10%.`,
        monthlyImpact: save,
        difficulty: "Easy",
      });
    }
  }

  if (debtTotal > 0) {
    moves.push({
      text: `Call card and loan issuers (${fmt(debtTotal)}/mo) to request a lower APR or hardship plan.`,
      monthlyImpact: null,
      difficulty: "Medium",
    });
  }

  if (isDeficit) {
    moves.push({
      text: "Add a short-term side income stream (freelance, gig, contract) to bridge the deficit faster.",
      monthlyImpact: null,
      difficulty: "Hard",
    });
  }

  const withImpact = moves
    .filter((m) => typeof m.monthlyImpact === "number")
    .sort((a, b) => (b.monthlyImpact ?? 0) - (a.monthlyImpact ?? 0));
  const noImpact = moves.filter((m) => m.monthlyImpact === null);
  return [...withImpact, ...noImpact].slice(0, 3);
}

function buildLongTerm(opts: RecommendationInputs): Priority[] {
  const {
    income,
    housingTotal,
    transportationTotal,
    foodTotal,
    subscriptionsTotal,
    otherTotal,
    debt,
    debtTotal,
    ratios,
    isDeficit,
    severeDeficit,
  } = opts;

  const moves: Priority[] = [];
  const savingsRate = ratios.savingsRate;
  const leakageTotal = foodTotal + subscriptionsTotal + otherTotal;

  if (income > 0 && (savingsRate < 0.1 || isDeficit)) {
    const target = Math.round(income * 0.1);
    moves.push({
      text: `Pursue a raise, promotion, or higher-paying role - even a 10% bump (${fmt(target)}/mo) reshapes your runway.`,
      monthlyImpact: target,
      difficulty: "Hard",
    });
  }

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

  const leakageRatio = income > 0 ? leakageTotal / income : 0;
  if (leakageRatio > 0.25 && leakageTotal > 0) {
    const save = Math.round(leakageTotal * 0.2);
    moves.push({
      text: `Downsize discretionary lifestyle (food, subs, misc total ${fmt(leakageTotal)}/mo) over the next 6 months.`,
      monthlyImpact: save,
      difficulty: "Medium",
    });
  }

  if (income > 0 && housingTotal / income > 0.35) {
    const newHousing = Math.round(income * 0.3);
    const save = housingTotal - newHousing;
    if (save > 0) {
      moves.push({
        text: `Plan a move to housing under ${fmt(newHousing)}/mo (about 30% of income) at next lease end.`,
        monthlyImpact: save,
        difficulty: "Hard",
      });
    }
  }

  if (
    income > 0 &&
    transportationTotal / income > 0.15 &&
    transportationTotal > 500
  ) {
    const newTransport = Math.round(transportationTotal * 0.6);
    const save = transportationTotal - newTransport;
    if (save > 0) {
      moves.push({
        text: `Replace your vehicle with a cheaper-to-own option (target about ${fmt(newTransport)}/mo all-in).`,
        monthlyImpact: save,
        difficulty: "Hard",
      });
    }
  }

  if (severeDeficit && income > 0) {
    const save = Math.round(income * 0.05);
    moves.push({
      text: "Consider relocating to a lower cost-of-living area to reset fixed costs.",
      monthlyImpact: save > 0 ? save : null,
      difficulty: "Hard",
    });
  }

  const isHeavy = (m: Priority) =>
    /\bmove\b|\brelocat\w*|\bvehicle\b|\bsell\b/i.test(m.text);
  const heavy = moves
    .filter(isHeavy)
    .sort((a, b) => (b.monthlyImpact ?? 0) - (a.monthlyImpact ?? 0));
  const rest = moves
    .filter((m) => !isHeavy(m))
    .sort((a, b) => (b.monthlyImpact ?? 0) - (a.monthlyImpact ?? 0));

  if (!severeDeficit && heavy.length > 0 && rest.length === 0 && income > 0) {
    const target = Math.round(income * 0.1);
    rest.push({
      text: `Pursue a raise, promotion, or higher-paying role - even a 10% bump (${fmt(target)}/mo) reshapes your runway.`,
      monthlyImpact: target,
      difficulty: "Hard",
    });
  }

  const ordered = severeDeficit ? [...heavy, ...rest] : [...rest, ...heavy];
  return ordered.slice(0, 3);
}

export function computeSavingsOpportunities(
  inputs: RecommendationInputs,
): SavingsOpportunities {
  const shortTermPriorities = buildShortTerm(inputs);
  const longTermOpportunities = buildLongTerm(inputs);
  const monthlySavings = shortTermPriorities.reduce(
    (s, m) => s + (typeof m.monthlyImpact === "number" ? m.monthlyImpact : 0),
    0,
  );

  return {
    shortTermPriorities,
    longTermOpportunities,
    recommendedActions: shortTermPriorities.map((m) => ({
      text: m.text,
      savings: m.monthlyImpact,
    })),
    monthlySavings,
    annualWaste: monthlySavings * 12,
    projectedNetCashFlow: inputs.netCashFlow + monthlySavings,
  };
}

export function computeInvestmentProjections(opts: {
  monthlySavings: number;
  investPct: unknown;
  isDeficit: boolean;
}): InvestmentProjections {
  const investPctRaw = Number(opts.investPct);
  const investPct = Number.isFinite(investPctRaw)
    ? clamp(Math.round(investPctRaw), 25, 100)
    : 70;
  const investAmount = opts.isDeficit
    ? 0
    : Math.round(opts.monthlySavings * (investPct / 100));
  const r = 0.07 / 12;
  const fv = (months: number) =>
    investAmount > 0
      ? Math.round((investAmount * (Math.pow(1 + r, months) - 1)) / r)
      : 0;

  return {
    investPct,
    investAmount,
    fv5: fv(60),
    fv10: fv(120),
    fv20: fv(240),
  };
}

function cashRetentionPoints(savingsRate: number): number {
  if (savingsRate >= 0.3) return 30;
  if (savingsRate >= 0.2) return 25;
  if (savingsRate >= 0.1) return 18;
  if (savingsRate >= 0.05) return 10;
  if (savingsRate >= 0.01) return 5;
  if (savingsRate >= 0) return 2;
  return 0;
}

function debtBurdenPoints(debtRatio: number): number {
  if (debtRatio === 0) return 15;
  if (debtRatio < 0.05) return 13;
  if (debtRatio < 0.1) return 10;
  if (debtRatio < 0.15) return 6;
  if (debtRatio < 0.2) return 3;
  return 0;
}

function subscriptionBloatPoints(opts: {
  subscriptionRatio: number;
  subscriptionCount: number;
  subscriptionsTotal: number;
}): number {
  const { subscriptionRatio, subscriptionCount, subscriptionsTotal } = opts;
  if (subscriptionsTotal === 0 || (subscriptionCount <= 2 && subscriptionRatio <= 0.02)) {
    return 10;
  }
  if (subscriptionCount <= 3 && subscriptionRatio <= 0.035) return 7;
  if (subscriptionCount <= 5 && subscriptionRatio <= 0.05) return 4;
  return 0;
}

function deficitRiskPoints(opts: {
  savingsRate: number;
  isDeficit: boolean;
  severeDeficit: boolean;
}): number {
  if (opts.severeDeficit) return 0;
  if (opts.isDeficit) return 4;
  if (opts.savingsRate >= 0.1) return 15;
  if (opts.savingsRate >= 0.05) return 12;
  if (opts.savingsRate >= 0.01) return 9;
  return 6;
}

function housingPressurePoints(housingRatio: number, housingTotal: number): number {
  if (housingTotal <= 0) return 5;
  if (housingRatio <= 0.35) return 5;
  if (housingRatio <= 0.45) return 3;
  if (housingRatio <= 0.55) return 1;
  return 0;
}

export function computeFinancialScore(opts: {
  totalExpenses: number;
  ratios: Ratios;
  wasteSignals: WasteSignal[];
  subscriptions: LineItem[];
  subscriptionsTotal: number;
  housingTotal: number;
  debtTotal: number;
  isDeficit: boolean;
  severeDeficit: boolean;
  inputCompleteness: InputCompleteness;
}): FinancialScoreResult {
  const {
    totalExpenses,
    ratios,
    wasteSignals,
    subscriptions,
    subscriptionsTotal,
    housingTotal,
    isDeficit,
    severeDeficit,
    inputCompleteness,
  } = opts;

  const savingsRatePts = cashRetentionPoints(ratios.savingsRate);
  const wasteLoad = clamp(
    wasteSignals.reduce((s, signal) => s + signal.severity, 0) / 2.5,
    0,
    1,
  );
  const wastePts = Math.round(25 * (1 - wasteLoad));
  const debtPts = debtBurdenPoints(ratios.debtRatio);
  const subscriptionPts = subscriptionBloatPoints({
    subscriptionRatio: ratios.subscriptionRatio,
    subscriptionCount: subscriptions.length,
    subscriptionsTotal,
  });
  const deficitPts = deficitRiskPoints({
    savingsRate: ratios.savingsRate,
    isDeficit,
    severeDeficit,
  });
  const housingPts = housingPressurePoints(ratios.housingRatio, housingTotal);

  const scoreBreakdown: ScoreBreakdownItem[] = [
    {
      name: "Cash Retention",
      points: savingsRatePts,
      max: 30,
      explanation:
        ratios.savingsRate < 0
          ? "Net cash flow is negative; cash retention needs to come first."
          : `Monthly retained cash is ${pct(ratios.savingsRate)} of income; 20%+ is the target for strong momentum.`,
    },
    {
      name: "Controllable Waste",
      points: wastePts,
      max: 25,
      explanation:
        wasteSignals.length === 0
          ? "No major controllable waste signals are triggering from the visible inputs."
          : `${wasteSignals.length} controllable waste signal${wasteSignals.length === 1 ? "" : "s"} triggered across food, services, personal, utilities, or misc spend.`,
    },
    {
      name: "Debt Burden",
      points: debtPts,
      max: 15,
      explanation:
        opts.debtTotal <= 0
          ? "No debt payment burden is reducing flexibility."
          : `Debt payments are ${pct(ratios.debtRatio)} of income; under 10% keeps more room to maneuver.`,
    },
    {
      name: "Subscription Bloat",
      points: subscriptionPts,
      max: 10,
      explanation:
        subscriptionsTotal <= 0
          ? "No recurring subscription bloat detected."
          : `${subscriptions.length} subscription${subscriptions.length === 1 ? "" : "s"} total ${fmt(subscriptionsTotal)}/mo; keep recurring commitments intentionally small.`,
    },
    {
      name: "Deficit Risk",
      points: deficitPts,
      max: 15,
      explanation: isDeficit
        ? "Current expenses exceed income; optimization should close the deficit before investing."
        : "Current inputs are not running a deficit.",
    },
    {
      name: "Housing Pressure",
      points: housingPts,
      max: 5,
      explanation:
        housingTotal <= 0
          ? "Housing was not entered; this warning stays low weight until ZIP context is added."
          : `Housing is ${pct(ratios.housingRatio)} of income. This is a low-weight warning until ZIP context is added.`,
    },
  ];

  const rawScore = scoreBreakdown.reduce((s, item) => s + item.points, 0);
  const financialScore = clamp(
    Math.round(rawScore),
    0,
    totalExpenses > 0 ? 99 : 100,
  );
  const scoreLabel =
    financialScore >= 88
      ? "Elite"
      : financialScore >= 75
        ? "Strong"
        : financialScore >= 60
          ? "Stable but Leaking"
          : financialScore >= 45
            ? "Risk Zone"
            : "Critical";

  const weakestCategory = [...scoreBreakdown].sort((a, b) => {
    const ra = a.points / a.max;
    const rb = b.points / b.max;
    if (ra !== rb) return ra - rb;
    return b.max - a.max;
  })[0];

  return {
    financialScore,
    scoreLabel,
    scoreInterpretation: scoreLabel,
    scoreBreakdown,
    weakestCategory,
    scoreAdjustedForCompleteness: false,
    analysisConfidence: inputCompleteness.confidence,
  };
}

export function computeTotals(body: unknown): AnalysisTotals {
  const raw = asRecord(body);
  const income = Number(raw["income"]) || 0;
  const categories = normalizeCategories(raw["categories"]);

  const categoryTotals: CategoryTotals = {
    Housing: sum(categories.Housing),
    Utilities: sum(categories.Utilities),
    Food: sum(categories.Food),
    Transportation: sum(categories.Transportation),
    Services: sum(categories.Services),
    Subscriptions: sum(categories.Subscriptions),
    Debt: sum(categories.Debt),
    Personal: sum(categories.Personal),
    Misc: sum(categories.Misc),
  };

  const totalExpenses = CATEGORY_NAMES.reduce(
    (s, name) => s + categoryTotals[name],
    0,
  );
  const netCashFlow = income - totalExpenses;
  const ratios = computeRatios({
    income,
    totalExpenses,
    netCashFlow,
    categoryTotals,
  });
  const recommendationInputs = buildRecommendationInputs({
    income,
    categories,
    categoryTotals,
    totalExpenses,
    netCashFlow,
    ratios,
  });
  const wasteSignals = computeWasteSignals(recommendationInputs);
  const inputCompletenessBase = computeInputCompleteness({
    income,
    categories,
    categoryTotals,
    totalExpenses,
  });
  const savings = computeSavingsOpportunities(recommendationInputs);
  const projections = computeInvestmentProjections({
    monthlySavings: savings.monthlySavings,
    investPct: raw["investPct"],
    isDeficit: recommendationInputs.isDeficit,
  });
  const score = computeFinancialScore({
    totalExpenses,
    ratios,
    wasteSignals,
    subscriptions: recommendationInputs.subscriptions,
    subscriptionsTotal: recommendationInputs.subscriptionsTotal,
    housingTotal: recommendationInputs.housingTotal,
    debtTotal: recommendationInputs.debtTotal,
    isDeficit: recommendationInputs.isDeficit,
    severeDeficit: recommendationInputs.severeDeficit,
    inputCompleteness: inputCompletenessBase,
  });
  const inputCompleteness = {
    ...inputCompletenessBase,
    scoreAdjusted: score.scoreAdjustedForCompleteness,
  };
  const plausibilityCheck = computePlausibilityCheck({
    inputs: recommendationInputs,
    inputCompleteness,
  });

  return {
    ...recommendationInputs,
    ...savings,
    ...projections,
    ...score,
    rent: recommendationInputs.housingTotal,
    weeklySafeSpend: Math.round(netCashFlow / 4),
    wasteSignals,
    inputCompleteness,
    analysisConfidence: inputCompleteness.confidence,
    inputCompletenessPrompt: inputCompleteness.prompt,
    plausibilityCheck,
    plausibilityNote: plausibilityCheck.note,
  };
}

export function fallbackOpportunities(t: AnalysisTotals): string[] {
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

export function fallbackAdvisor(t: AnalysisTotals): string {
  if (t.isDeficit) {
    return "You're currently running a deficit. The actions above are designed to close that gap. Aim to bring your net cash flow back to positive within 60-90 days.";
  }
  if (t.financialScore >= 75) {
    return "You're in a strong position. Your spending is efficient, so focus on protecting your surplus from lifestyle drift.";
  }
  if (t.financialScore >= 60) {
    return "You're stable but leaking value. Apply the highest-impact action first and let smaller cuts follow over the next few weeks.";
  }
  return "There's meaningful inefficiency to clean up. Start with the largest action above and reassess after one month.";
}
