export type LineItem = { name: string; amount: number };
export type Action = { text: string; savings: number | null };
export type Difficulty = "Easy" | "Medium" | "Hard";
export type Priority = {
  text: string;
  monthlyImpact: number | null;
  difficulty: Difficulty;
  insight?: string;
  key?: string;
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

function roundMoneyForRecommendation(n: number): number {
  return Math.round(n / 5) * 5;
}

function fmtRecommendation(n: number): string {
  return fmt(roundMoneyForRecommendation(n));
}

function impactText(monthlyImpact: number): string {
  const monthly = roundMoneyForRecommendation(monthlyImpact);
  return `Impact: ${fmt(monthly)}/mo, ${fmt(monthly * 12)}/yr.`;
}

function secondaryImpactText(monthlyImpact: number): string {
  const monthly = roundMoneyForRecommendation(monthlyImpact);
  return `Estimated impact: ${fmt(monthly)}/mo, ${fmt(monthly * 12)}/yr.`;
}

function confidenceReduction(
  baseReduction: number,
  confidence: AnalysisConfidence,
): number {
  if (confidence === "Low") return baseReduction * 0.65;
  if (confidence === "Medium") return baseReduction * 0.85;
  return baseReduction;
}

function splitRecommendationText(text: string): { action: string; insight: string } {
  const [actionPart, rest = ""] = text.split(" Why it matters:");
  const [whyPart = "", impactPart = ""] = rest.split(" Impact:");
  const action = actionPart.trim();
  const why = whyPart.trim();
  const impact = impactPart.trim();
  const insight = [
    why ? `Why it matters: ${why}` : "",
    impact ? `Impact: ${impact}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return { action, insight: insight || action };
}

type RecommendationCandidate = Priority & {
  insight: string;
  key: string;
  priorityScore: number;
};

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

function buildShortTerm(
  opts: RecommendationInputs,
  confidence: AnalysisConfidence,
): Priority[] {
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

  const moves: RecommendationCandidate[] = [];
  const cutLead = confidence === "Low" ? "Try cutting" : "Cut";
  const pauseLead = confidence === "Low" ? "Try pausing" : "Pause";
  const capLead = confidence === "Low" ? "Try setting" : "Set";
  const runLead = confidence === "Low" ? "Try running" : "Run";
  const requestLead = confidence === "Low" ? "Try requesting" : "Request";

  if (subscriptions.length > 2 && subscriptionsTotal > 0) {
    const sorted = [...subscriptions].sort((a, b) => b.amount - a.amount);
    const top2Total = sorted[0].amount + sorted[1].amount;
    const dropped = subscriptions.length - 2;
    const save = roundMoneyForRecommendation(subscriptionsTotal - top2Total);
    if (save > 0) {
      const text = `${pauseLead} ${dropped} lower-use subscription${dropped === 1 ? "" : "s"} this week and keep only the recurring services used weekly. ${secondaryImpactText(save)} Why it matters: subscriptions turn forgotten choices into automatic monthly withdrawals, so usage has to earn the renewal. ${impactText(save)}`;
      const parts = splitRecommendationText(text);
      moves.push({
        key: "subscriptions",
        text: parts.action,
        insight: parts.insight,
        monthlyImpact: save,
        difficulty: "Easy",
        priorityScore: save + 75,
      });
    }
  }

  if (eatingOut > 0) {
    const reductionPct = confidenceReduction(isDeficit ? 0.5 : 0.4, confidence);
    const save = roundMoneyForRecommendation(eatingOut * reductionPct);
    if (save > 0) {
      const why =
        eatingOut > groceries
          ? `Why it matters: takeout is ${fmtRecommendation(eatingOut)}/mo versus ${fmtRecommendation(groceries)}/mo in groceries, so convenience is outrunning the actual meal plan.`
          : "Why it matters: this is flexible food spend, so fewer takeout runs protects lifestyle better than cutting fixed bills.";
      const text = `${cutLead} 1-2 takeout meals this week. ${secondaryImpactText(save)} ${why} ${impactText(save)}`;
      const parts = splitRecommendationText(text);
      moves.push({
        key: "eating_out",
        text: parts.action,
        insight: parts.insight,
        monthlyImpact: save,
        difficulty: eatingOut > 400 ? "Medium" : "Easy",
        priorityScore: save + (eatingOut > groceries ? 250 : 0),
      });
    }
  }

  if (servicesTotal > 0) {
    const reductionPct = confidenceReduction(isDeficit ? 0.5 : 0.3, confidence);
    const newServices = roundMoneyForRecommendation(
      servicesTotal * (1 - reductionPct),
    );
    const save = roundMoneyForRecommendation(servicesTotal - newServices);
    if (save > 0) {
      const text = `${confidence === "Low" ? "Try spacing" : "Space"} out one paid-service appointment or rotate the lowest-value service off this month. ${secondaryImpactText(save)} Why it matters: the useful help stays, but convenience stops behaving like a fixed bill. ${impactText(save)}`;
      const parts = splitRecommendationText(text);
      moves.push({
        key: "services",
        text: parts.action,
        insight: parts.insight,
        monthlyImpact: save,
        difficulty: "Easy",
        priorityScore: save + 100,
      });
    }
  }

  if (otherTotal > 50) {
    const reductionPct = confidenceReduction(isDeficit ? 0.4 : 0.3, confidence);
    const newOther = roundMoneyForRecommendation(otherTotal * (1 - reductionPct));
    const save = roundMoneyForRecommendation(otherTotal - newOther);
    if (save > 0) {
      const text = `${capLead} one weekly misc cap before buying extras. ${secondaryImpactText(save)} Why it matters: small unplanned purchases accumulate because each one feels harmless alone; batching them into one weekly decision stops the slow pile-up. ${impactText(save)}`;
      const parts = splitRecommendationText(text);
      moves.push({
        key: "misc",
        text: parts.action,
        insight: parts.insight,
        monthlyImpact: save,
        difficulty: "Easy",
        priorityScore: save + 125,
      });
    }
  }

  const personalThreshold = Math.max(0.08 * income, 300);
  if (personalTotal > personalThreshold) {
    const reductionPct = confidenceReduction(isDeficit ? 0.25 : 0.2, confidence);
    const newPersonal = roundMoneyForRecommendation(
      personalTotal * (1 - reductionPct),
    );
    const save = roundMoneyForRecommendation(personalTotal - newPersonal);
    if (save > 0) {
      const text = `${confidence === "Low" ? "Try using" : "Use"} a 48-hour pause before nonessential buys this week. ${secondaryImpactText(save)} Why it matters: the pause keeps the purchases you actually want and blocks small upgrades from absorbing the surplus. ${impactText(save)}`;
      const parts = splitRecommendationText(text);
      moves.push({
        key: "personal",
        text: parts.action,
        insight: parts.insight,
        monthlyImpact: save,
        difficulty: "Easy",
        priorityScore: save + 50,
      });
    }
  }

  const insuranceLines = [...housing, ...transportation].filter((it) =>
    /insur/i.test(it.name),
  );
  const insuranceTotal = insuranceLines.reduce((s, it) => s + it.amount, 0);
  if (insuranceTotal >= 80) {
    const save = roundMoneyForRecommendation(insuranceTotal * 0.12);
    if (save >= 5) {
      const text = `${runLead} one insurance quote check this week. ${secondaryImpactText(save)} Why it matters: this is a paperwork lever, not a lifestyle cut. ${impactText(save)}`;
      const parts = splitRecommendationText(text);
      moves.push({
        key: "insurance",
        text: parts.action,
        insight: parts.insight,
        monthlyImpact: save,
        difficulty: "Medium",
        priorityScore: save + 25,
      });
    }
  }

  const utilThreshold = Math.max(0.05 * income, 200);
  if (utilitiesTotal > utilThreshold) {
    const save = roundMoneyForRecommendation(utilitiesTotal * 0.1);
    if (save >= 5) {
      const text = `${runLead} one utility-plan audit this week. ${secondaryImpactText(save)} Why it matters: old plans often stay expensive after usage changes; a re-shop keeps the service and trims the drag. ${impactText(save)}`;
      const parts = splitRecommendationText(text);
      moves.push({
        key: "utilities",
        text: parts.action,
        insight: parts.insight,
        monthlyImpact: save,
        difficulty: "Easy",
        priorityScore: save,
      });
    }
  }

  if (debtTotal > 0) {
    const save = roundMoneyForRecommendation(debtTotal * 0.08);
    if (save >= 25) {
      const text = `${requestLead} one lower-rate debt review for the highest-rate balance. ${secondaryImpactText(save)} Why it matters: less payment pressure improves monthly oxygen while you keep paying the balance down. ${impactText(save)}`;
      const parts = splitRecommendationText(text);
      moves.push({
        key: "debt",
        text: parts.action,
        insight: parts.insight,
        monthlyImpact: save,
        difficulty: "Medium",
        priorityScore: save + 25,
      });
    }
  }

  const withImpact = moves
    .filter((m) => typeof m.monthlyImpact === "number")
    .sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
      return (b.monthlyImpact ?? 0) - (a.monthlyImpact ?? 0);
    });
  return withImpact.slice(0, 3).map(({ text, insight, key, monthlyImpact, difficulty }) => ({
    text,
    insight,
    key,
    monthlyImpact,
    difficulty,
  }));
}

function hasEfficientUserPattern(
  opts: RecommendationInputs,
  confidence: AnalysisConfidence,
): boolean {
  const {
    income,
    netCashFlow,
    housingTotal,
    utilitiesTotal,
    foodTotal,
    transportationTotal,
    servicesTotal,
    otherTotal,
    personalTotal,
    eatingOut,
    groceries,
    ratios,
  } = opts;

  if (income <= 0 || confidence === "Low") return false;

  const hasBalancedBasics =
    housingTotal > 0 &&
    utilitiesTotal > 0 &&
    foodTotal > 0 &&
    transportationTotal > 0;
  const strongSurplus = netCashFlow >= 500 && ratios.savingsRate >= 0.25;
  const balancedFixedCosts =
    ratios.housingRatio <= 0.32 &&
    ratios.debtRatio <= 0.1 &&
    ratios.subscriptionRatio <= 0.03;
  const lowFlexibleLeakage =
    ratios.leakageRatio <= 0.18 &&
    servicesTotal <= income * 0.04 &&
    otherTotal <= Math.max(250, income * 0.04) &&
    personalTotal <= Math.max(500, income * 0.1);
  const balancedFood =
    eatingOut <= Math.max(groceries, income * 0.05) && foodTotal <= income * 0.14;

  return (
    hasBalancedBasics &&
    strongSurplus &&
    balancedFixedCosts &&
    lowFlexibleLeakage &&
    balancedFood
  );
}

function optionalEfficientOptimization(
  opts: RecommendationInputs,
  confidence: AnalysisConfidence,
): Priority | null {
  const {
    income,
    eatingOut,
    groceries,
    subscriptions,
    subscriptionsTotal,
    otherTotal,
    servicesTotal,
  } = opts;

  const softLead = confidence === "Medium" ? "If you want one light tune-up" : "Optional tune-up";
  const minorLimit = Math.max(75, income * 0.015);
  const candidates: RecommendationCandidate[] = [];

  if (subscriptions.length > 2 && subscriptionsTotal > 0) {
    const sorted = [...subscriptions].sort((a, b) => b.amount - a.amount);
    const top2Total = sorted[0].amount + sorted[1].amount;
    const dropped = subscriptions.length - 2;
    const save = roundMoneyForRecommendation(subscriptionsTotal - top2Total);
    if (save >= 25 && save <= minorLimit) {
      const text = `${softLead}: pause ${dropped} lower-use subscription${dropped === 1 ? "" : "s"} this week. ${secondaryImpactText(save)} Why it matters: this is small maintenance, not a lifestyle correction. ${impactText(save)}`;
      const parts = splitRecommendationText(text);
      candidates.push({
        key: "subscriptions",
        text: parts.action,
        insight: parts.insight,
        monthlyImpact: save,
        difficulty: "Easy",
        priorityScore: save + 40,
      });
    }
  }

  if (eatingOut > 0) {
    const save = roundMoneyForRecommendation(eatingOut * 0.15);
    if (save >= 25 && save <= minorLimit) {
      const behavior =
        eatingOut > groceries
          ? `takeout is ${fmtRecommendation(eatingOut)}/mo versus ${fmtRecommendation(groceries)}/mo in groceries`
          : `takeout is ${fmtRecommendation(eatingOut)}/mo and still flexible`;
      const text = `${softLead}: skip one takeout meal this week. ${secondaryImpactText(save)} Why it matters: ${behavior}, so a small frequency change is enough; this is not a major cut. ${impactText(save)}`;
      const parts = splitRecommendationText(text);
      candidates.push({
        key: "eating_out",
        text: parts.action,
        insight: parts.insight,
        monthlyImpact: save,
        difficulty: "Easy",
        priorityScore: save + (eatingOut > groceries ? 30 : 10),
      });
    }
  }

  if (otherTotal > Math.max(150, income * 0.02)) {
    const save = roundMoneyForRecommendation(otherTotal * 0.15);
    if (save >= 25 && save <= minorLimit) {
      const text = `${softLead}: set one weekly misc cap before extra purchases. ${secondaryImpactText(save)} Why it matters: small unplanned buys stack quietly, so one cap keeps them visible without making the budget feel tight. ${impactText(save)}`;
      const parts = splitRecommendationText(text);
      candidates.push({
        key: "misc",
        text: parts.action,
        insight: parts.insight,
        monthlyImpact: save,
        difficulty: "Easy",
        priorityScore: save + 20,
      });
    }
  }

  if (servicesTotal > Math.max(150, income * 0.02)) {
    const save = roundMoneyForRecommendation(servicesTotal * 0.15);
    if (save >= 25 && save <= minorLimit) {
      const text = `${softLead}: space out one paid service this month. ${secondaryImpactText(save)} Why it matters: the service can stay, but a slightly slower cadence keeps convenience from becoming automatic. ${impactText(save)}`;
      const parts = splitRecommendationText(text);
      candidates.push({
        key: "services",
        text: parts.action,
        insight: parts.insight,
        monthlyImpact: save,
        difficulty: "Easy",
        priorityScore: save,
      });
    }
  }

  const best = candidates.sort((a, b) => b.priorityScore - a.priorityScore)[0];
  if (!best) return null;
  return {
    text: best.text,
    insight: best.insight,
    key: best.key,
    monthlyImpact: best.monthlyImpact,
    difficulty: best.difficulty,
  };
}

function buildEfficientUserOpportunities(
  opts: RecommendationInputs,
  confidence: AnalysisConfidence,
): SavingsOpportunities {
  const surplus = roundMoneyForRecommendation(opts.netCashFlow);
  const guidance: Priority = {
    key: "allocation",
    text: `Direct the ${fmt(surplus)}/mo surplus toward savings or investments first.`,
    insight: `You're in a strong position: spending is balanced and current surplus is ${fmt(surplus)}/mo, or ${fmt(surplus * 12)}/yr. Why it matters: with low leakage, compounding surplus will do more than chasing a handful of small cuts.`,
    monthlyImpact: null,
    difficulty: "Easy",
  };
  const optional = optionalEfficientOptimization(opts, confidence);
  const shortTermPriorities = optional ? [guidance, optional] : [guidance];
  const monthlySavings =
    typeof optional?.monthlyImpact === "number" ? optional.monthlyImpact : 0;

  return {
    shortTermPriorities,
    longTermOpportunities: [],
    recommendedActions: shortTermPriorities.map((m) => ({
      text: m.text,
      savings: m.monthlyImpact,
    })),
    monthlySavings,
    annualWaste: monthlySavings * 12,
    projectedNetCashFlow: opts.netCashFlow + monthlySavings,
  };
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
  const leakageTotal = foodTotal + subscriptionsTotal + otherTotal;

  if (debt.length >= 2 || (income > 0 && debtTotal > 0.1 * income)) {
    const save = roundMoneyForRecommendation(Math.max(40, debtTotal * 0.15));
    moves.push({
      key: "debt_restructure",
      text:
        debt.length >= 2
          ? `Compare consolidation options for ${debt.length} debt balances and look for about ${fmtRecommendation(save)}/mo of payment relief. Why it matters: scattered payments reduce flexibility; one lower-rate structure can return cash flow without pretending the debt disappeared. ${impactText(save)}`
          : `Compare refinance options on ${fmtRecommendation(debtTotal)}/mo of debt payments and look for about ${fmtRecommendation(save)}/mo of relief. Why it matters: less payment pressure improves monthly oxygen while you keep paying the balance down. ${impactText(save)}`,
      monthlyImpact: save,
      difficulty: "Medium",
    });
  }

  const leakageRatio = income > 0 ? leakageTotal / income : 0;
  if (leakageRatio > 0.25 && leakageTotal > 0) {
    const save = roundMoneyForRecommendation(leakageTotal * 0.2);
    moves.push({
      key: "recurring_costs",
      text: `Simplify food, subscriptions, and misc by about ${fmtRecommendation(save)}/mo over 6 months. Why it matters: the combined bundle is ${fmtRecommendation(leakageTotal)}/mo, so small leaks across several categories are acting like one large bill. ${impactText(save)}`,
      monthlyImpact: save,
      difficulty: "Medium",
    });
  }

  if (income > 0 && housingTotal / income > 0.35) {
    const newHousing = roundMoneyForRecommendation(income * 0.3);
    const save = roundMoneyForRecommendation(housingTotal - newHousing);
    if (save > 0) {
      moves.push({
        key: "housing",
        text: `At lease renewal, compare housing options in the ${fmtRecommendation(newHousing)}/mo range and look for about ${fmtRecommendation(save)}/mo of relief. Why it matters: housing is a fixed-cost anchor, so improving it changes every future month. ${impactText(save)}`,
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
    const newTransport = roundMoneyForRecommendation(transportationTotal * 0.6);
    const save = roundMoneyForRecommendation(transportationTotal - newTransport);
    if (save > 0) {
      moves.push({
        key: "transportation",
        text: `At the next vehicle decision, choose a payment, insurance, and fuel setup around ${fmtRecommendation(newTransport)}/mo and free about ${fmtRecommendation(save)}/mo. Why it matters: vehicle costs behave like fixed costs, and lowering them frees cash without touching daily essentials. ${impactText(save)}`,
        monthlyImpact: save,
        difficulty: "Hard",
      });
    }
  }

  const isHeavy = (m: Priority) =>
    /\bmove\b|\brelocat\w*|\bvehicle\b|\bsell\b/i.test(m.text);
  const heavy = moves
    .filter(isHeavy)
    .sort((a, b) => (b.monthlyImpact ?? 0) - (a.monthlyImpact ?? 0));
  const rest = moves
    .filter((m) => !isHeavy(m))
    .sort((a, b) => (b.monthlyImpact ?? 0) - (a.monthlyImpact ?? 0));

  const ordered = severeDeficit ? [...heavy, ...rest] : [...rest, ...heavy];
  return ordered.slice(0, 3);
}

export function computeSavingsOpportunities(
  inputs: RecommendationInputs,
  confidence: AnalysisConfidence,
): SavingsOpportunities {
  if (hasEfficientUserPattern(inputs, confidence)) {
    return buildEfficientUserOpportunities(inputs, confidence);
  }

  const shortTermPriorities = buildShortTerm(inputs, confidence);
  const usedConcepts = new Set(
    shortTermPriorities
      .map((m) => m.key)
      .filter((key): key is string => typeof key === "string"),
  );
  const longTermOpportunities = buildLongTerm(inputs)
    .filter((m) => !m.key || !usedConcepts.has(m.key))
    .slice(0, Math.max(0, 3 - shortTermPriorities.length));
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
  const savings = computeSavingsOpportunities(
    recommendationInputs,
    inputCompletenessBase.confidence,
  );
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
  return t.shortTermPriorities
    .filter((move) => move.insight || typeof move.monthlyImpact === "number")
    .sort((a, b) => (b.monthlyImpact ?? 0) - (a.monthlyImpact ?? 0))
    .slice(0, 3)
    .map((move) => move.insight ?? move.text);
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
