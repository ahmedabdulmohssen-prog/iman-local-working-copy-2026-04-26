import {
  useState,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
} from "react";
import {
  ArrowRight,
  Banknote,
  Building,
  Car,
  CheckCircle,
  ChevronRight,
  CreditCard,
  Home,
  KeyRound,
  LineChart,
  MapPin,
  MoreHorizontal,
  PiggyBank,
  Plus,
  Repeat,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  User,
  Utensils,
  Wallet,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import imanWordmark from "./Assets/iman-wordmark.png";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3001";

type Item = { name: string; amount: string };
type Expense = {
  id: string;
  amount: number;
  category: CategoryName;
  subcategory?: string;
  note?: string;
  date: string;
};

type RecommendedAction = { text: string; savings: number | null };
type Difficulty = "Easy" | "Medium" | "Hard";
type Priority = {
  text: string;
  monthlyImpact: number | null;
  difficulty: Difficulty;
  targetReason?: string;
  insight?: string;
  key?: string;
};
type AnalysisConfidence = "High" | "Medium" | "Low";
type InputCompleteness = {
  confidence: AnalysisConfidence;
  enteredCategoryCount: number;
  keyCategoryCount: number;
  keyCategoriesExpected: string[];
  missingKeyCategories: string[];
  totalLineItems: number;
  expenseCoverageRatio: number;
  sparse: boolean;
  scoreCap: number;
  scoreAdjusted: boolean;
  prompt: string;
};

type PlausibilityCheck = {
  triggered: boolean;
  note: string | null;
  reasons: string[];
};

type ScoreBreakdownItem = {
  name: string;
  points: number;
  max: number;
  explanation: string;
};

type AnalyzeResponse = {
  netCashFlow: number;
  weeklySafeSpend: number;
  totalExpenses: number;
  categoryTotals?: Record<string, number>;
  subscriptionsTotal: number;
  foodTotal: number;
  servicesTotal: number;
  otherTotal: number;
  financialScore: number;
  scoreLabel?: string;
  scoreInterpretation: string;
  scoreAdjustedForCompleteness?: boolean;
  analysisConfidence?: AnalysisConfidence;
  inputCompleteness?: InputCompleteness;
  inputCompletenessPrompt?: string;
  plausibilityCheck?: PlausibilityCheck;
  plausibilityNote?: string | null;
  scoreBreakdown?: ScoreBreakdownItem[];
  weakestCategory?: ScoreBreakdownItem;
  isDeficit?: boolean;
  annualWaste: number;
  monthlySavings: number;
  projectedNetCashFlow: number;
  investPct: number;
  investAmount: number;
  fv5: number;
  fv10: number;
  fv20: number;
  optimizationOpportunities: string[];
  recommendedActions: RecommendedAction[];
  shortTermPriorities?: Priority[];
  longTermOpportunities?: Priority[];
  severeDeficit?: boolean;
  advisorNote: string;
  insightsLoading?: boolean;
};

const blank = (name = ""): Item => ({ name, amount: "" });

const CATEGORY_NAMES = [
  "Housing",
  "Food",
  "Utilities",
  "Transportation",
  "Services",
  "Subscriptions",
  "Debt",
  "Personal",
  "Misc",
] as const;
type CategoryName = (typeof CATEGORY_NAMES)[number];

const CATEGORY_DEFAULTS: Record<CategoryName, string[]> = {
  Housing: ["Rent/Mortgage", "Insurance", "Maintenance"],
  Utilities: ["Electricity", "Water", "Internet", "Phone"],
  Food: ["Groceries", "Eating Out"],
  Transportation: ["Car Payment", "Fuel", "Insurance"],
  Services: ["House Cleaning", "Laundry", "Lawn"],
  Subscriptions: [],
  Debt: ["Credit Cards", "Loans"],
  Personal: ["Clothing", "Grooming"],
  Misc: [],
};

const CATEGORY_ICONS: Record<CategoryName, LucideIcon> = {
  Housing: Home,
  Food: Utensils,
  Utilities: Zap,
  Transportation: Car,
  Services: Sparkles,
  Subscriptions: Repeat,
  Debt: CreditCard,
  Personal: User,
  Misc: MoreHorizontal,
};

const ONBOARDING_COMPLETED_KEY = "iman.onboardingCompleted";
const ONBOARDING_PROFILE_KEY = "iman.onboardingProfile";

type CharacterMood =
  | "neutral"
  | "thinking"
  | "explaining"
  | "warning"
  | "celebration"
  | "mobile"
  | "empty";

const CHARACTER_ASSETS: Record<CharacterMood, string> = {
  neutral: "iman-neutral.png",
  thinking: "iman-thinking.png",
  explaining: "iman-explaining.png",
  warning: "iman-warning.png",
  celebration: "iman-celebration.png",
  mobile: "iman-mobile-companion.png",
  empty: "iman-empty-state.png",
};

const INCOME_ONBOARDING_INSIGHTS = [
  "Income stability affects long term flexibility.",
  "Small monthly changes compound over time.",
  "Your income shapes recommendation accuracy.",
];

type OnboardingProfile = {
  incomeCadence: "monthly" | "annual";
  incomeAmount: string;
  zipCode: string;
  housingStatus: "rent" | "own" | "";
  goal: string;
  completedAt?: string;
};

const emptyOnboardingProfile: OnboardingProfile = {
  incomeCadence: "monthly",
  incomeAmount: "",
  zipCode: "",
  housingStatus: "",
  goal: "",
};

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
  cleaning: "House Cleaning",
};

function normalizeName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return TYPO_MAP[trimmed.toLowerCase()] ?? trimmed;
}

const PRIORITY_CATEGORIES: ReadonlySet<CategoryName> = new Set([
  "Housing",
  "Food",
]);
const LOW_PRIORITY_CATEGORIES: ReadonlySet<CategoryName> = new Set([
  "Subscriptions",
  "Misc",
]);
const EXPENSE_STORAGE_KEY = "iman.monthlyTracker.expenses.v1";

function buildDefaultCategories(): Record<CategoryName, Item[]> {
  // Start every category with NO rows. Defaults appear as suggestion chips
  // inside each card so we never show empty pre-populated inputs.
  const out = {} as Record<CategoryName, Item[]>;
  for (const name of CATEGORY_NAMES) {
    out[name] = [];
  }
  return out;
}

function isCategoryName(value: unknown): value is CategoryName {
  return (
    typeof value === "string" && CATEGORY_NAMES.includes(value as CategoryName)
  );
}

function loadStoredExpenses(): Expense[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(EXPENSE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((expense) => {
        const amount = Number(expense?.amount);
        return (
          typeof expense?.id === "string" &&
          Number.isFinite(amount) &&
          amount > 0 &&
          isCategoryName(expense?.category) &&
          typeof expense?.date === "string"
        );
      })
      .map((expense) => ({
        id: expense.id,
        amount: Number(expense.amount),
        category: expense.category,
        subcategory:
          typeof expense.subcategory === "string"
            ? normalizeName(expense.subcategory)
            : "",
        note: typeof expense.note === "string" ? expense.note : "",
        date: expense.date,
      }));
  } catch {
    return [];
  }
}

function loadStoredOnboardingProfile(): OnboardingProfile {
  if (typeof window === "undefined") return emptyOnboardingProfile;
  try {
    const raw = window.localStorage.getItem(ONBOARDING_PROFILE_KEY);
    if (!raw) return emptyOnboardingProfile;
    const parsed = JSON.parse(raw);
    return {
      incomeCadence: parsed?.incomeCadence === "annual" ? "annual" : "monthly",
      incomeAmount:
        typeof parsed?.incomeAmount === "string" ? parsed.incomeAmount : "",
      zipCode: typeof parsed?.zipCode === "string" ? parsed.zipCode : "",
      housingStatus:
        parsed?.housingStatus === "rent" || parsed?.housingStatus === "own"
          ? parsed.housingStatus
          : "",
      goal: typeof parsed?.goal === "string" ? parsed.goal : "",
      completedAt:
        typeof parsed?.completedAt === "string" ? parsed.completedAt : "",
    };
  } catch {
    return emptyOnboardingProfile;
  }
}

function getOnboardingCompleted() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(ONBOARDING_COMPLETED_KEY) === "true";
}

function getSliderStyle(
  value: number,
  min: number,
  max: number,
): CSSProperties {
  const progress = ((value - min) / (max - min)) * 100;
  return {
    "--slider-progress": `${Math.max(0, Math.min(100, progress))}%`,
  } as CSSProperties;
}

function getCharacterSrc(mood: CharacterMood) {
  return `${import.meta.env.BASE_URL}characters/${CHARACTER_ASSETS[mood]}`;
}

function CharacterMascot({
  mood,
  alt,
  className = "",
}: {
  mood: CharacterMood;
  alt: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center bg-transparent ${className}`}
      style={{ backgroundColor: "transparent" }}
    >
      <img
        src={getCharacterSrc(mood)}
        alt={alt}
        className="iman-character-image block h-full w-full object-contain bg-transparent"
        style={{ backgroundColor: "transparent" }}
        loading="lazy"
        decoding="async"
      />
    </span>
  );
}

function isCurrentMonthExpense(expense: Expense) {
  const date = new Date(expense.date);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

function buildCategoriesFromExpenses(expenses: Expense[]) {
  const next = buildDefaultCategories();
  for (const expense of expenses) {
    next[expense.category] = [
      ...next[expense.category],
      {
        name: normalizeName(
          expense.subcategory || expense.note || expense.category,
        ),
        amount: String(expense.amount),
      },
    ];
  }
  return next;
}

function App() {
  const [income, setIncome] = useState("");
  const [onboardingCompleted, setOnboardingCompleted] = useState(
    getOnboardingCompleted,
  );
  const [onboardingProfile, setOnboardingProfile] = useState<OnboardingProfile>(
    loadStoredOnboardingProfile,
  );
  const [creditScoreRange, setCreditScoreRange] = useState("740–799");
  const [categories, setCategories] = useState<Record<CategoryName, Item[]>>(
    buildDefaultCategories(),
  );
  const [expanded, setExpanded] = useState<Set<CategoryName>>(
    () => new Set<CategoryName>(["Housing", "Food"]),
  );
  const [investPct, setInvestPct] = useState(70);

  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>(loadStoredExpenses);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [lastExpenseCategory, setLastExpenseCategory] =
    useState<CategoryName>("Food");

  useEffect(() => {
    window.localStorage.setItem(EXPENSE_STORAGE_KEY, JSON.stringify(expenses));
  }, [expenses]);

  const completeOnboarding = (profile: OnboardingProfile) => {
    const completedProfile = {
      ...profile,
      completedAt: new Date().toISOString(),
    };
    setOnboardingProfile(completedProfile);
    setOnboardingCompleted(true);
    window.localStorage.setItem(ONBOARDING_COMPLETED_KEY, "true");
    window.localStorage.setItem(
      ONBOARDING_PROFILE_KEY,
      JSON.stringify(completedProfile),
    );

    const enteredIncome = Number(profile.incomeAmount);
    if (Number.isFinite(enteredIncome) && enteredIncome > 0) {
      const monthlyIncome =
        profile.incomeCadence === "annual"
          ? Math.round(enteredIncome / 12)
          : enteredIncome;
      setIncome(String(monthlyIncome));
    }
  };

  const currentMonthExpenses = useMemo(
    () => expenses.filter(isCurrentMonthExpense),
    [expenses],
  );

  const setCategoryItems = (name: CategoryName, items: Item[]) =>
    setCategories((prev) => ({ ...prev, [name]: items }));

  const toggleExpanded = (name: CategoryName) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const categoriesFilled = CATEGORY_NAMES.filter((name) =>
    categories[name].some((it) => Number(it.amount) > 0),
  ).length;

  const toPayloadItems = (items: Item[]) =>
    items
      .map((it) => ({
        name: normalizeName(it.name),
        amount: Number(it.amount) || 0,
      }))
      .filter((it) => it.name !== "" && it.amount > 0); // drop empty/zero entries

  const runAnalysis = async (
    categorySource: Record<CategoryName, Item[]> = categories,
  ) => {
    setError(null);
    setResult(null);

    const incomeNum = Number(income);
    if (!Number.isFinite(incomeNum) || incomeNum <= 0) {
      setError("Enter your Monthly Income before analyzing.");
      return;
    }

    const payloadCategories = {} as Record<
      CategoryName,
      { name: string; amount: number }[]
    >;
    let anyExpense = false;
    for (const name of CATEGORY_NAMES) {
      const cleaned = toPayloadItems(categorySource[name]);
      payloadCategories[name] = cleaned;
      if (cleaned.length > 0) anyExpense = true;
    }
    if (!anyExpense) {
      setError("Add at least one expense item with an amount greater than $0.");
      return;
    }

    const payload = {
      income: incomeNum,
      creditScoreRange,
      categories: payloadCategories,
      investPct: Number(investPct) || 0,
    };

    const t0 = performance.now();
    setLoading(true);

    const post = (path: string) =>
      fetch(`${API_BASE}/api/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      });

    const calcP = post("calculate");
    const insightsP = post("insights");

    try {
      const calc = await calcP;
      const tCalc = Math.round(performance.now() - t0);
      console.log(`calculate ${tCalc}ms`, calc);
      setResult({
        ...(calc as AnalyzeResponse),
        optimizationOpportunities: [],
        advisorNote: "",
        insightsLoading: true,
      });
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      setLoading(false);
      return;
    }

    try {
      const ins = await insightsP;
      const tIns = Math.round(performance.now() - t0);
      console.log(`insights ${tIns}ms (source=${ins.insightsSource})`, ins);
      setResult((prev) =>
        prev
          ? {
              ...prev,
              optimizationOpportunities: ins.optimizationOpportunities ?? [],
              advisorNote: ins.advisorNote ?? "",
              insightsLoading: false,
            }
          : prev,
      );
    } catch (err) {
      console.warn("insights failed", err);
      setResult((prev) => (prev ? { ...prev, insightsLoading: false } : prev));
    }
  };

  const onAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    await runAnalysis();
  };

  const analyzeWithActualSpending = async () => {
    const actualCategories = buildCategoriesFromExpenses(currentMonthExpenses);
    await runAnalysis(actualCategories);
  };

  const addExpense = (expense: Omit<Expense, "id" | "date">) => {
    setLastExpenseCategory(expense.category);
    setExpenses((prev) => [
      {
        ...expense,
        date: new Date().toISOString(),
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      },
      ...prev,
    ]);
    setIsAddingExpense(false);
  };

  if (!onboardingCompleted) {
    return (
      <OnboardingFlow
        initialProfile={onboardingProfile}
        onComplete={completeOnboarding}
      />
    );
  }

  return (
    <div
      className="relative isolate min-h-screen w-full overflow-x-hidden text-zinc-100 antialiased selection:bg-blue-500/30"
      style={{
        background: "radial-gradient(circle at top, #0b0f1a, #000000)",
      }}
    >
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(42rem 42rem at 8% 4%, rgba(0,120,255,0.08), transparent 62%), radial-gradient(38rem 38rem at 96% 2%, rgba(0,120,255,0.06), transparent 64%), radial-gradient(34rem 34rem at 92% 94%, rgba(0,120,255,0.05), transparent 66%)",
        }}
      />
      <svg
        className="pointer-events-none fixed inset-0 -z-10 h-full w-full opacity-[0.06] blur-[1.5px]"
        viewBox="0 0 1440 1000"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <g fill="none" stroke="rgba(125, 180, 255, 0.72)" strokeWidth="1.5">
          <path d="M80 760 C260 700 320 560 500 590 S780 690 920 540 1170 360 1360 410" />
          <path d="M120 860 C310 815 460 760 640 800 S960 910 1280 740" />
        </g>
        <g fill="rgba(125, 180, 255, 0.42)">
          <circle cx="1180" cy="180" r="72" />
          <circle cx="1290" cy="300" r="34" />
          <circle cx="150" cy="250" r="48" />
          <circle cx="250" cy="150" r="22" />
        </g>
      </svg>

      <div className="relative z-10 max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-6 pb-24 sm:py-8 sm:pb-28 lg:py-12">
        <header className="flex items-center justify-between mb-6 sm:mb-10 gap-3">
          <div className="flex items-center min-w-0">
            <img
              src={imanWordmark}
              alt="IMAN"
              className="h-10 sm:h-12 w-auto object-contain"
            />
          </div>

          <div className="hidden sm:flex shrink-0 items-center gap-2 text-sm sm:text-[11px] text-zinc-500">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Live model
          </div>
        </header>

        <div className="flex flex-col lg:grid lg:grid-cols-[360px_minmax(0,1fr)] gap-5 sm:gap-6 lg:gap-8 lg:items-start min-w-0">
          <aside className="min-w-0 lg:sticky lg:top-8">
            <form
              onSubmit={onAnalyze}
              className="space-y-4 sm:space-y-5 bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-xl shadow-black/20"
            >
              <div className="pb-3 border-b border-zinc-800/80">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500 mb-1">
                  Inputs
                </div>
                <div className="text-sm text-zinc-300">
                  Itemize your monthly money.
                </div>
                <div className="text-sm sm:text-[11px] text-zinc-500 mt-1.5 leading-snug">
                  Start with Housing and Food. Add more categories as needed.
                </div>
              </div>

              <SingleField
                label="Monthly Income"
                value={income}
                onChange={setIncome}
                placeholder="9500"
              />

              <div>
                <label className="block text-sm sm:text-[11px] uppercase tracking-wider text-zinc-500 mb-2">
                  Credit Score Range
                </label>

                {(() => {
                  const ranges = [
                    "300–579",
                    "580–669",
                    "670–739",
                    "740–799",
                    "800–850",
                  ];
                  const labels = [
                    "Poor",
                    "Fair",
                    "Good",
                    "Very Good",
                    "Excellent",
                  ];
                  const currentIndex = ranges.indexOf(creditScoreRange);

                  return (
                    <div className="space-y-3">
                      <input
                        type="range"
                        min="1"
                        max="5"
                        step="1"
                        value={currentIndex + 1}
                        style={getSliderStyle(currentIndex + 1, 1, 5)}
                        onChange={(e) => {
                          const idx = Number(e.target.value) - 1;
                          setCreditScoreRange(ranges[idx]);
                        }}
                        className="iman-slider"
                      />
                      <div className="text-center">
                        <div className="text-sm sm:text-[12px] font-semibold text-zinc-100">
                          {labels[currentIndex]} ({creditScoreRange})
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm sm:text-[11px] uppercase tracking-wider text-zinc-500">
                  Categories
                </span>
                <span className="text-[13px] sm:text-[10px] text-zinc-600 tabular-nums">
                  {categoriesFilled} of {CATEGORY_NAMES.length} filled
                </span>
              </div>

              <div className="space-y-2">
                {CATEGORY_NAMES.map((name) => (
                  <CategoryCard
                    key={name}
                    name={name}
                    items={categories[name]}
                    setItems={(items) => setCategoryItems(name, items)}
                    isExpanded={expanded.has(name)}
                    onToggle={() => toggleExpanded(name)}
                    priority={
                      PRIORITY_CATEGORIES.has(name)
                        ? "high"
                        : LOW_PRIORITY_CATEGORIES.has(name)
                          ? "low"
                          : "normal"
                    }
                  />
                ))}
              </div>

              <div className="pt-2">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-sm sm:text-[11px] uppercase tracking-wider text-zinc-500">
                    Invest of savings
                  </span>
                  <span className="text-xs font-semibold text-blue-500 tabular-nums">
                    {investPct}%
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={25}
                    max={100}
                    step={5}
                    value={investPct}
                    style={getSliderStyle(investPct, 25, 100)}
                    onChange={(e) => setInvestPct(Number(e.target.value))}
                    className="iman-slider flex-1"
                  />
                  <input
                    type="number"
                    min={25}
                    max={100}
                    step={5}
                    value={investPct}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isFinite(n))
                        setInvestPct(Math.min(100, Math.max(25, n)));
                    }}
                    className="w-16 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-sm text-zinc-100 tabular-nums focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-500 hover:bg-blue-400 active:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed text-zinc-950 font-bold py-3.5 rounded-xl transition shadow-lg shadow-blue-500/20"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3 h-3 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
                    Analyzing…
                  </span>
                ) : (
                  "Run analysis"
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsAddingExpense(true)}
                className="w-full inline-flex items-center justify-center gap-2 border border-blue-500/18 bg-blue-500/8 hover:bg-blue-500/12 text-blue-100 font-semibold py-3 rounded-xl transition"
              >
                <Plus size={16} />
                Add Expense
              </button>

              <button
                type="button"
                onClick={analyzeWithActualSpending}
                disabled={loading || currentMonthExpenses.length === 0}
                className="w-full text-sm border border-zinc-800/80 bg-transparent hover:bg-zinc-900/70 disabled:opacity-45 disabled:cursor-not-allowed text-zinc-400 hover:text-zinc-200 font-semibold py-2.5 rounded-xl transition"
              >
                {loading ? "Analyzing..." : "Analyze with actual spending"}
              </button>
            </form>
          </aside>

          <main className="min-w-0">
            {error && (
              <div className="mb-6 bg-rose-950/40 border border-rose-900/60 text-rose-300 rounded-xl p-4 text-sm">
                {error}
              </div>
            )}

            {!result && !loading && !error && <EmptyState />}
            {!result && loading && <LoadingState />}
            {result && <Results data={result} />}
          </main>
        </div>

        {isAddingExpense && (
          <AddExpenseSheet
            defaultCategory={lastExpenseCategory}
            plannedCategories={categories}
            onClose={() => setIsAddingExpense(false)}
            onAdd={addExpense}
          />
        )}
      </div>
    </div>
  );
}

function OnboardingFlow({
  initialProfile,
  onComplete,
}: {
  initialProfile: OnboardingProfile;
  onComplete: (profile: OnboardingProfile) => void;
}) {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<OnboardingProfile>(initialProfile);
  const totalSteps = 6;
  const progress = ((step + 1) / totalSteps) * 100;
  const isWelcomeStep = step === 0;
  const balancedStep = step === 2 || step === 3 || step === 4;
  const [incomeInsightIndex, setIncomeInsightIndex] = useState(0);
  const [incomeInsightVisible, setIncomeInsightVisible] = useState(true);
  const goals = [
    "Find monthly savings",
    "Pay down debt",
    "Build emergency cash",
    "Invest more consistently",
  ];

  const updateProfile = (patch: Partial<OnboardingProfile>) =>
    setProfile((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    if (step !== 1) {
      setIncomeInsightVisible(true);
      return;
    }

    let swapTimer: number | undefined;
    let fadeInTimer: number | undefined;
    const rotationTimer = window.setInterval(() => {
      setIncomeInsightVisible(false);
      swapTimer = window.setTimeout(() => {
        setIncomeInsightIndex(
          (current) => (current + 1) % INCOME_ONBOARDING_INSIGHTS.length,
        );
        fadeInTimer = window.setTimeout(() => {
          setIncomeInsightVisible(true);
        }, 350);
      }, 2600);
    }, 11000);

    return () => {
      window.clearInterval(rotationTimer);
      if (swapTimer !== undefined) window.clearTimeout(swapTimer);
      if (fadeInTimer !== undefined) window.clearTimeout(fadeInTimer);
    };
  }, [step]);

  const canContinue =
    step === 0 ||
    step === 5 ||
    (step === 1 && Number(profile.incomeAmount) > 0) ||
    (step === 2 && /^\d{5}$/.test(profile.zipCode.trim())) ||
    (step === 3 && profile.housingStatus !== "") ||
    (step === 4 && profile.goal !== "");

  const next = () => {
    if (!canContinue) return;
    if (step === totalSteps - 1) {
      onComplete(profile);
      return;
    }
    setStep((current) => Math.min(totalSteps - 1, current + 1));
  };

  const back = () => setStep((current) => Math.max(0, current - 1));

  const stepLabel =
    step === 0
      ? "Welcome"
      : step === 1
        ? "Income"
        : step === 2
          ? "Location"
          : step === 3
            ? "Home"
            : step === 4
              ? "Goal"
              : "Walkthrough";

  return (
    <div
      className="relative isolate min-h-screen w-full overflow-x-hidden text-zinc-100 antialiased selection:bg-blue-500/30"
      style={{
        background:
          "radial-gradient(circle at top, rgba(15,23,42,0.96), #020617 58%, #000000)",
      }}
    >
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(34rem_34rem_at_50%_0%,rgba(37,99,235,0.16),transparent_62%)]" />
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col px-4 py-4 sm:px-6 sm:py-6">
        <header className="mb-4 flex items-center justify-between">
          <img
            src={imanWordmark}
            alt="IMAN"
            className="h-9 w-auto object-contain"
          />
          <div className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-200">
            {step + 1}/{totalSteps}
          </div>
        </header>

        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-zinc-900">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-300 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <section className="relative flex flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/72 p-4 shadow-2xl shadow-black/40 sm:p-5">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-[radial-gradient(24rem_10rem_at_50%_100%,rgba(37,99,235,0.16),transparent_70%)]" />
          {step === 1 && (
            <div className="iman-onboarding-income-blend pointer-events-none absolute inset-x-0 bottom-0 h-72" />
          )}
          <svg
            className={`pointer-events-none absolute inset-x-0 bottom-16 h-28 w-full text-blue-300/20 ${
              step === 1 ? "iman-onboarding-wave" : ""
            }`}
            viewBox="0 0 420 120"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M0 86 C52 72 82 88 126 66 S207 18 260 42 335 94 420 52"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <path
              d="M0 108 C66 96 107 102 153 84 S233 58 286 75 353 99 420 78"
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.45"
              strokeWidth="1"
            />
          </svg>

          <div
            className={`relative z-10 flex flex-1 flex-col ${
              isWelcomeStep
                ? "justify-center py-1"
                : balancedStep
                  ? "justify-center pb-6"
                  : "justify-start pt-1"
            }`}
          >
            <div
              className={
                isWelcomeStep ? "flex flex-col items-center text-center" : ""
              }
            >
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-300/80">
                {stepLabel}
              </div>
              {step === 0 && (
                <>
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-200">
                    <ShieldCheck size={22} />
                  </div>
                  <h1 className="max-w-[18rem] bg-transparent text-3xl font-bold leading-tight text-zinc-50 sm:max-w-sm sm:text-[2rem]">
                    Turn spending into insight.
                  </h1>
                  <p className="mt-3 max-w-[21rem] bg-transparent text-sm leading-relaxed text-zinc-400 sm:text-[15px]">
                    Built to uncover financial patterns, optimization
                    opportunities, and long term financial impact.
                  </p>
                  <div className="iman-onboarding-hero-mascot relative mt-2 flex w-full justify-center bg-transparent sm:mt-3">
                    <CharacterMascot
                      mood="neutral"
                      alt="IMAN assistant"
                      className="relative z-10 h-56 w-56 translate-y-3 sm:h-64 sm:w-64 sm:translate-y-4"
                    />
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <h1 className="text-2xl font-bold leading-tight text-zinc-50">
                    Tell me about your income
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                    Enter your income information to personalize your financial
                    analysis and monthly recommendations.
                  </p>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    {(["monthly", "annual"] as const).map((cadence) => (
                      <button
                        key={cadence}
                        type="button"
                        onClick={() =>
                          updateProfile({ incomeCadence: cadence })
                        }
                        className={`rounded-xl border px-3 py-3 text-sm font-semibold capitalize transition ${
                          profile.incomeCadence === cadence
                            ? "border-blue-400/50 bg-blue-500/15 text-blue-100"
                            : "border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700"
                        }`}
                      >
                        {cadence}
                      </button>
                    ))}
                  </div>
                  <label className="mt-4 block">
                    <span className="mb-1.5 block text-[11px] uppercase tracking-wider text-zinc-500">
                      {profile.incomeCadence === "annual"
                        ? "Annual income"
                        : "Monthly income"}
                    </span>
                    <div className="relative">
                      <Banknote
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
                        size={16}
                      />
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        value={profile.incomeAmount}
                        onChange={(event) =>
                          updateProfile({ incomeAmount: event.target.value })
                        }
                        placeholder={
                          profile.incomeCadence === "annual" ? "114000" : "9500"
                        }
                        className="w-full rounded-xl border border-zinc-800 bg-black py-3 pl-10 pr-3 text-lg font-semibold text-zinc-100 tabular-nums placeholder-zinc-700 outline-none transition focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </label>
                  <div className="mt-7 flex flex-col items-center text-center">
                    <div className="iman-income-insight-rotation relative h-10 w-full max-w-[20rem] text-xs leading-relaxed text-zinc-400/85 sm:text-[13px]">
                      <p
                        className={`iman-income-insight-text ${
                          incomeInsightVisible
                            ? "is-visible"
                            : "is-transitioning"
                        }`}
                      >
                        {INCOME_ONBOARDING_INSIGHTS[incomeInsightIndex]}
                      </p>
                    </div>
                    <div className="iman-onboarding-income-companion relative mt-6 flex w-full justify-center bg-transparent">
                      <CharacterMascot
                        mood="explaining"
                        alt="IMAN assistant explaining income context"
                        className="relative z-10 h-52 w-52 translate-y-10 sm:h-56 sm:w-56 sm:translate-y-10"
                      />
                    </div>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <h1 className="text-2xl font-bold leading-tight text-zinc-50">
                    What ZIP code should IMAN use?
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                    This is saved locally for context only.
                  </p>
                  <label className="mt-5 block">
                    <span className="mb-1.5 block text-[11px] uppercase tracking-wider text-zinc-500">
                      ZIP code
                    </span>
                    <div className="relative">
                      <MapPin
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
                        size={16}
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={5}
                        value={profile.zipCode}
                        onChange={(event) =>
                          updateProfile({
                            zipCode: event.target.value.replace(/\D/g, ""),
                          })
                        }
                        placeholder="30309"
                        className="w-full rounded-xl border border-zinc-800 bg-black py-3 pl-10 pr-3 text-lg font-semibold text-zinc-100 tabular-nums placeholder-zinc-700 outline-none transition focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </label>
                </>
              )}

              {step === 3 && (
                <>
                  <h1 className="text-2xl font-bold leading-tight text-zinc-50">
                    Do you rent or own?
                  </h1>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    {[
                      { value: "rent", label: "Rent", icon: KeyRound },
                      { value: "own", label: "Own", icon: Building },
                    ].map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          updateProfile({
                            housingStatus:
                              value as OnboardingProfile["housingStatus"],
                          })
                        }
                        className={`flex min-h-28 flex-col items-center justify-center gap-3 rounded-2xl border p-4 text-sm font-semibold transition ${
                          profile.housingStatus === value
                            ? "border-blue-400/50 bg-blue-500/15 text-blue-100"
                            : "border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700"
                        }`}
                      >
                        <Icon size={24} />
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 4 && (
                <>
                  <h1 className="text-2xl font-bold leading-tight text-zinc-50">
                    What should IMAN optimize for first?
                  </h1>
                  <div className="mt-5 space-y-2">
                    {goals.map((goal) => (
                      <button
                        key={goal}
                        type="button"
                        onClick={() => updateProfile({ goal })}
                        className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left text-sm font-semibold transition ${
                          profile.goal === goal
                            ? "border-blue-400/50 bg-blue-500/15 text-blue-100"
                            : "border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700"
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <Target size={17} />
                          {goal}
                        </span>
                        {profile.goal === goal && <CheckCircle size={16} />}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 5 && (
                <>
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-200">
                    <CheckCircle size={22} />
                  </div>
                  <h1 className="text-2xl font-bold leading-tight text-zinc-50">
                    Your dashboard is ready.
                  </h1>
                  <div className="mt-5 space-y-3">
                    {[
                      {
                        icon: Wallet,
                        text: "Enter the monthly expenses you know first.",
                      },
                      {
                        icon: LineChart,
                        text: "Run Analysis to see score, savings, and cash flow.",
                      },
                      {
                        icon: PiggyBank,
                        text: "Use Add Expense for quick real-world tracking.",
                      },
                    ].map(({ icon: Icon, text }) => (
                      <div
                        key={text}
                        className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-sm text-zinc-300"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-200">
                          <Icon size={17} />
                        </span>
                        {text}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div
            className={`relative z-10 flex items-center gap-3 border-t border-zinc-800/70 pt-4 ${
              isWelcomeStep ? "mt-4" : "mt-6"
            }`}
          >
            {step > 0 && (
              <button
                type="button"
                onClick={back}
                className="h-11 rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 text-sm font-semibold text-zinc-300 transition hover:border-zinc-700"
              >
                Back
              </button>
            )}
            {step === 0 && (
              <button
                type="button"
                onClick={() => onComplete(profile)}
                className="h-11 rounded-xl px-2 text-sm font-semibold text-zinc-500 transition hover:text-zinc-300"
              >
                Skip setup
              </button>
            )}
            <button
              type="button"
              disabled={!canContinue}
              onClick={next}
              className="ml-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-500 px-5 text-sm font-bold text-zinc-950 shadow-lg shadow-blue-500/20 transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {step === totalSteps - 1 ? "Start" : "Continue"}
              <ArrowRight size={16} />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

function AddExpenseSheet({
  defaultCategory,
  plannedCategories,
  onClose,
  onAdd,
}: {
  defaultCategory: CategoryName;
  plannedCategories: Record<CategoryName, Item[]>;
  onClose: () => void;
  onAdd: (expense: Omit<Expense, "id" | "date">) => void;
}) {
  const amountRef = useRef<HTMLInputElement | null>(null);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<CategoryName>(defaultCategory);
  const [subcategory, setSubcategory] = useState("");
  const [note, setNote] = useState("");
  const subcategoryOptions = useMemo(() => {
    const seen = new Set<string>();
    return [
      ...CATEGORY_DEFAULTS[category],
      ...plannedCategories[category].map((item) => item.name),
    ]
      .map((name) => normalizeName(name))
      .filter((name) => {
        if (!name || seen.has(name)) return false;
        seen.add(name);
        return true;
      });
  }, [category, plannedCategories]);

  useEffect(() => {
    amountRef.current?.focus({ preventScroll: true });
  }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return;
    onAdd({
      amount: parsedAmount,
      category,
      subcategory: normalizeName(subcategory),
      note: note.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/60 px-3 pb-3 backdrop-blur-sm sm:items-center sm:justify-center">
      <button
        type="button"
        aria-label="Close add expense"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <form
        onSubmit={submit}
        className="relative w-full max-w-md rounded-2xl border border-zinc-700/80 bg-zinc-950 p-4 shadow-2xl shadow-black/50"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-zinc-100">
              Add Expense
            </div>
            <div className="text-xs text-zinc-500">Today · quick entry</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-100"
          >
            <X size={17} />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-[11px] uppercase tracking-wider text-zinc-500">
              Amount
            </span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 text-sm">
                $
              </span>
              <input
                ref={amountRef}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="24"
                className="w-full rounded-xl border border-zinc-800 bg-black pl-7 pr-3 py-3 text-lg font-semibold tabular-nums text-zinc-100 placeholder-zinc-700 transition focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] uppercase tracking-wider text-zinc-500">
              Category
            </span>
            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as CategoryName)
              }
              className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-3 text-sm text-zinc-100 transition focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {CATEGORY_NAMES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] uppercase tracking-wider text-zinc-500">
              Subcategory
            </span>
            <input
              type="text"
              value={subcategory}
              onChange={(event) => setSubcategory(event.target.value)}
              list="expense-subcategory-options"
              placeholder="Optional"
              className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-3 text-sm text-zinc-100 placeholder-zinc-700 transition focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <datalist id="expense-subcategory-options">
              {subcategoryOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] uppercase tracking-wider text-zinc-500">
              Note
            </span>
            <input
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional"
              className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-3 text-sm text-zinc-100 placeholder-zinc-700 transition focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </label>
        </div>

        <button
          type="submit"
          className="mt-4 w-full rounded-xl bg-blue-500 py-3 text-sm font-bold text-zinc-950 shadow-lg shadow-blue-500/15 transition hover:bg-blue-400"
        >
          Add Expense
        </button>
      </form>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-blue-500/14 bg-gradient-to-br from-zinc-900/90 via-zinc-950/70 to-blue-950/20 p-4 shadow-2xl shadow-black/30 sm:p-6">
      <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="relative">
        <div className="mb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-500/16 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-200">
                <Sparkles size={13} />
                Preview
              </div>
              <h2 className="text-xl font-bold leading-tight text-zinc-50 sm:text-2xl">
                Your first analysis will surface the money hiding in plain
                sight.
              </h2>
            </div>
            <CharacterMascot
              mood="empty"
              alt="IMAN assistant reviewing empty data"
              className="h-24 w-24 sm:h-28 sm:w-28"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-800/80 bg-black/35 p-3">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-300">
              <PiggyBank size={17} />
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Yearly savings
            </div>
            <div className="mt-1 text-2xl font-bold text-emerald-300 tabular-nums">
              $4,860
            </div>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              Example recoverable cash from subscriptions and food drift.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-black/35 p-3">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-200">
              <Target size={17} />
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Opportunity
            </div>
            <div className="mt-1 text-sm font-semibold leading-snug text-zinc-100">
              Trim $185/mo from discretionary spend.
            </div>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              IMAN turns categories into specific next moves.
            </p>
          </div>

          <div className="rounded-xl border border-blue-500/18 bg-blue-500/[0.06] p-3">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-200">
              <TrendingUp size={17} />
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Growth preview
            </div>
            <div className="mt-1 text-2xl font-bold text-blue-200 tabular-nums">
              $42k
            </div>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              Example 10-year value when surplus is invested consistently.
            </p>
          </div>
        </div>
      </div>
      <p className="relative mt-4 text-sm leading-relaxed text-zinc-400">
        Add income plus one or two real expense categories, then run analysis.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="bg-zinc-900/45 border border-zinc-800 rounded-2xl p-8 text-center sm:p-10">
      <CharacterMascot
        mood="thinking"
        alt="IMAN assistant thinking"
        className="mx-auto mb-4 h-28 w-28"
      />
      <div className="w-10 h-10 mx-auto mb-4 border-2 border-zinc-800 border-t-blue-400 rounded-full animate-spin" />
      <div className="text-zinc-300 font-medium">Crunching the numbers…</div>
      <div className="text-sm text-zinc-500 mt-1">
        Modeling savings, investments, and 20-year projection.
      </div>
    </div>
  );
}

function Results({ data }: { data: AnalyzeResponse }) {
  const num = (v: number | undefined | null) =>
    typeof v === "number" && Number.isFinite(v) ? v : 0;
  const score = num(data.financialScore);
  const netCashFlow = num(data.netCashFlow);
  const weeklySafeSpend = num(data.weeklySafeSpend);
  const annualWaste = num(data.annualWaste);
  const monthlySavings = num(data.monthlySavings);
  const projectedNetCashFlow = num(data.projectedNetCashFlow);
  const initialInvestPct = Math.min(100, Math.max(0, num(data.investPct)));
  const [investPct, setInvestPct] = useState(initialInvestPct);
  const opportunities = Array.isArray(data.optimizationOpportunities)
    ? data.optimizationOpportunities
    : [];
  const scoreBreakdown = Array.isArray(data.scoreBreakdown)
    ? data.scoreBreakdown
    : [];
  const shortTerm: Priority[] = Array.isArray(data.shortTermPriorities)
    ? data.shortTermPriorities
    : [];
  const longTerm: Priority[] = Array.isArray(data.longTermOpportunities)
    ? data.longTermOpportunities
    : [];
  const advisorNote = data.advisorNote ?? "";
  const interpretation = data.scoreLabel ?? data.scoreInterpretation ?? "";
  const weakestCategory = data.weakestCategory;
  const isDeficit = data.isDeficit === true || netCashFlow < 0;
  const insightsLoading = data.insightsLoading === true;
  const inputCompleteness = data.inputCompleteness;
  const minimalSavingsThreshold = 100;
  const validationPriority = shortTerm.find(
    (move) =>
      move.monthlyImpact == null &&
      /strong position|spending is balanced|surplus/i.test(move.text),
  );
  const allocationMode =
    !isDeficit &&
    monthlySavings < minimalSavingsThreshold &&
    netCashFlow >= 1000 &&
    validationPriority != null;
  const meaningfulSavings = monthlySavings >= minimalSavingsThreshold;
  const displayedShortTerm = allocationMode
    ? validationPriority
      ? [validationPriority]
      : []
    : shortTerm;
  const showOptimizationSections = !allocationMode && meaningfulSavings;
  const investmentProjection = useMemo(() => {
    const monthlyContribution = isDeficit
      ? 0
      : Math.round(Math.max(0, netCashFlow) * (investPct / 100));
    const futureValue = (years: number) => {
      const r = 0.07 / 12;
      const months = years * 12;
      return monthlyContribution > 0
        ? Math.round((monthlyContribution * (Math.pow(1 + r, months) - 1)) / r)
        : 0;
    };
    return {
      monthlyContribution,
      fv5: futureValue(5),
      fv10: futureValue(10),
      fv20: futureValue(20),
    };
  }, [investPct, isDeficit, netCashFlow]);
  const fv5 = investmentProjection.fv5;
  const fv10 = investmentProjection.fv10;
  const fv20 = investmentProjection.fv20;
  const plausibilityNote =
    data.plausibilityCheck?.triggered === true
      ? (data.plausibilityNote ?? data.plausibilityCheck.note ?? "")
      : "";
  const allocationNote = allocationMode
    ? "You're generating strong monthly surplus. Focus on allocating it efficiently rather than cutting expenses."
    : "";
  const trustedAdvisorNote = [plausibilityNote, allocationNote, advisorNote]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    setInvestPct(initialInvestPct);
  }, [initialInvestPct]);

  return (
    <section className="space-y-5 sm:space-y-6">
      {isDeficit && <DeficitBanner />}

      <ScoreCard
        score={score}
        label={interpretation}
        weakest={weakestCategory}
        completeness={inputCompleteness}
      />

      {scoreBreakdown.length > 0 && (
        <ScoreExplanationCard
          breakdown={scoreBreakdown}
          priorities={shortTerm}
          monthlySavings={monthlySavings}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Net Cash Flow"
          value={netCashFlow}
          tone={netCashFlow >= 0 ? "positive" : "negative"}
          hint="income − expenses"
        />
        <StatCard
          label="Weekly Safe Spend"
          value={weeklySafeSpend}
          tone={weeklySafeSpend >= 0 ? "positive" : "negative"}
          suffix="/wk"
          hint="net ÷ 4"
        />
        {allocationMode ? (
          <StatCard
            label="Monthly Surplus"
            value={netCashFlow}
            tone="positive"
            hint="available cash flow to allocate"
          />
        ) : (
          <StatCard
            label="Potential Savings Opportunity"
            value={annualWaste}
            tone="positive"
            hint="Estimated annualized amount you can recover by closing your spending gap"
          />
        )}
      </div>

      {showOptimizationSections &&
        (insightsLoading ||
          opportunities.length > 0 ||
          displayedShortTerm.length > 0 ||
          longTerm.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {(insightsLoading || opportunities.length > 0) && (
              <Card title="Optimization Opportunities" eyebrow="Insights">
                {insightsLoading && opportunities.length === 0 ? (
                  <InsightSkeleton lines={3} />
                ) : (
                  <ul className="space-y-3.5 text-sm text-zinc-200">
                    {opportunities.map((line, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="mt-2 shrink-0 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.45)]" />
                        <span className="leading-relaxed">{line}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}

            <div className="space-y-4 sm:space-y-5">
              {displayedShortTerm.length > 0 && (
                <Card title="Short Term Priorities" eyebrow="0–90 days">
                  <PriorityList items={displayedShortTerm} />
                </Card>
              )}

              {longTerm.length > 0 && (
                <Card title="Long Term Opportunities" eyebrow="3–12 months">
                  <PriorityList items={longTerm} />
                </Card>
              )}
            </div>
          </div>
        )}

      {allocationMode && displayedShortTerm.length > 0 && (
        <Card title="Short Term Priorities" eyebrow="Allocation">
          <PriorityList items={displayedShortTerm} />
        </Card>
      )}

      {showOptimizationSections && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          <Card title="Savings Impact" eyebrow="Cash">
            <div className="grid grid-cols-2 gap-3">
              <Subtile
                label="Monthly"
                value={`$${monthlySavings.toLocaleString()}`}
                accent="green"
              />
              <Subtile
                label="Yearly"
                value={`$${annualWaste.toLocaleString()}`}
                accent="green"
              />
            </div>
          </Card>

          <AfterOptimizationCard
            before={netCashFlow}
            after={projectedNetCashFlow}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:gap-5">
        <Card title="Investment Plan" eyebrow="Allocation">
          {isDeficit ? (
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5 w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 9v4" />
                  <path d="M12 17h.01" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-zinc-100 mb-1">
                  Investing is paused
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  Focus on eliminating your deficit before investing.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-end justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="text-sm sm:text-[11px] uppercase tracking-wider text-zinc-500 mb-1">
                    Available to invest
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-emerald-400 tabular-nums break-words">
                    ${investmentProjection.monthlyContribution.toLocaleString()}
                    <span className="text-sm text-zinc-500 font-normal">
                      /mo
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm sm:text-[11px] uppercase tracking-wider text-zinc-500 mb-1">
                    Of surplus
                  </div>
                  <div className="text-base sm:text-lg font-semibold text-zinc-200 tabular-nums">
                    {investPct}%
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={investPct}
                  style={getSliderStyle(investPct, 0, 100)}
                  onChange={(e) => setInvestPct(Number(e.target.value))}
                  className="iman-slider w-full"
                  aria-label="Investment allocation percentage"
                />
              </div>
              <div className="text-sm sm:text-[11px] text-zinc-500 mt-2">
                Assumes 7% annual return.
              </div>
            </>
          )}
        </Card>
      </div>

      {!isDeficit && (
        <Card title="Investment Growth Projection" eyebrow="Long-term">
          <div className="grid grid-cols-3 gap-3">
            <ProjectionTile years="5y" value={fv5} />
            <ProjectionTile years="10y" value={fv10} />
            <ProjectionTile years="20y" value={fv20} highlight />
          </div>
        </Card>
      )}

      {trustedAdvisorNote ? (
        <AdvisorCard note={trustedAdvisorNote} />
      ) : insightsLoading ? (
        <div className="rounded-2xl border border-blue-500/12 bg-blue-500/5 p-5">
          <InsightSkeleton lines={2} />
        </div>
      ) : null}
    </section>
  );
}

function DifficultyPill({ level }: { level: Difficulty }) {
  const tone =
    level === "Easy"
      ? "bg-blue-500/10 text-blue-300 border-blue-500/15"
      : level === "Medium"
        ? "bg-amber-500/10 text-amber-300 border-amber-500/25"
        : "bg-rose-500/10 text-rose-300 border-rose-500/25";
  return (
    <span
      className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border whitespace-nowrap ${tone}`}
    >
      {level}
    </span>
  );
}

function PriorityList({ items }: { items: Priority[] }) {
  return (
    <ol className="space-y-2.5">
      {items.map((m, i) => (
        <li
          key={i}
          className="group flex items-start gap-3 bg-zinc-950/50 hover:bg-zinc-950/80 transition border border-zinc-800/60 rounded-xl p-3"
        >
          <span className="shrink-0 w-6 h-6 rounded-lg bg-blue-500/15 text-blue-500 text-xs font-bold flex items-center justify-center tabular-nums">
            {i + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-zinc-200 leading-relaxed break-words">
              {m.text}
            </div>
            {m.targetReason && (
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                {m.targetReason}
              </p>
            )}
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              {typeof m.monthlyImpact === "number" && m.monthlyImpact > 0 && (
                <span className="text-[11px] font-semibold text-blue-300 bg-blue-500/10 border border-blue-500/12 px-2 py-0.5 rounded-md tabular-nums whitespace-nowrap">
                  +${m.monthlyImpact.toLocaleString()}/mo
                </span>
              )}
              <DifficultyPill level={m.difficulty} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function InsightSkeleton({
  lines = 3,
  block = false,
}: {
  lines?: number;
  block?: boolean;
}) {
  return (
    <div className={`space-y-3 ${block ? "" : ""}`}>
      <div className="flex items-center gap-2 text-sm sm:text-[11px] text-zinc-500">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
        Generating insights…
      </div>
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`h-3 rounded-md bg-zinc-800/70 animate-pulse ${
              block ? "h-9 rounded-xl" : ""
            }`}
            style={{ width: `${85 - i * 12}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function AfterOptimizationCard({
  before,
  after,
}: {
  before: number;
  after: number;
}) {
  const beforePos = before >= 0;
  const afterPos = after >= 0;
  const fmt = (n: number) =>
    `${n >= 0 ? "+" : "−"}$${Math.abs(n).toLocaleString()}`;
  const beforeColor = beforePos ? "text-blue-500" : "text-rose-400";
  const afterColor = afterPos ? "text-blue-500" : "text-rose-400";
  const nearBreakeven = !beforePos && afterPos && after < 100;
  const interpretation = nearBreakeven
    ? "These changes bring you close to breakeven, but leave little margin. Further adjustments are recommended."
    : !beforePos && afterPos
      ? "These changes move you from a deficit to a surplus."
      : !beforePos && !afterPos
        ? "These changes reduce your deficit, but further adjustments are needed."
        : afterPos && beforePos
          ? "These changes grow your existing surplus."
          : "";

  return (
    <Card title="After Optimization" eyebrow="Projection">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-4">
        <div className="min-w-0 bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-3.5 sm:p-4 text-center">
          <div className="text-[13px] sm:text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
            Before
          </div>
          <div
            className={`text-xl sm:text-2xl font-bold tabular-nums break-words ${beforeColor}`}
          >
            {fmt(before)}
          </div>
        </div>
        <div
          className={`shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full border flex items-center justify-center ${
            afterPos
              ? "bg-blue-500/10 border-blue-500/18 text-blue-500"
              : "bg-rose-500/10 border-rose-500/30 text-rose-400"
          }`}
          aria-label="transitions to"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14" />
            <path d="m13 6 6 6-6 6" />
          </svg>
        </div>
        <div
          className={`min-w-0 bg-zinc-950/60 border rounded-xl p-3.5 sm:p-4 text-center ${
            afterPos
              ? "border-blue-500/18 shadow-lg shadow-blue-500/3"
              : "border-rose-500/30 shadow-lg shadow-rose-500/5"
          }`}
        >
          <div className="text-[13px] sm:text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
            After
          </div>
          <div
            className={`text-xl sm:text-2xl font-bold tabular-nums break-words ${afterColor}`}
          >
            {fmt(after)}
          </div>
        </div>
      </div>
      {interpretation && (
        <p
          className={`mt-3 text-xs sm:text-[13px] leading-relaxed ${
            !beforePos && afterPos
              ? "text-blue-300"
              : !beforePos
                ? "text-zinc-300"
                : "text-zinc-400"
          }`}
        >
          {interpretation}
        </p>
      )}
    </Card>
  );
}

function AdvisorCard({ note }: { note: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-blue-500/15 bg-gradient-to-br from-blue-500/8 via-blue-500/[0.02] to-zinc-900/40 p-5 sm:p-6 shadow-xl shadow-blue-500/3">
      <div className="absolute -left-16 -top-16 w-56 h-56 rounded-full bg-blue-500/5 blur-3xl pointer-events-none" />
      <div className="relative flex items-start gap-3 sm:gap-4">
        <CharacterMascot
          mood="explaining"
          alt="IMAN assistant explaining recommendations"
          className="h-20 w-20 sm:h-24 sm:w-24"
        />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] sm:text-[10px] uppercase tracking-[0.18em] text-blue-300/80 font-semibold mb-1.5">
            From your trusted advisor
          </div>
          <p className="text-sm sm:text-[15px] text-zinc-100 leading-relaxed">
            {note}
          </p>
        </div>
      </div>
    </div>
  );
}

function DeficitBanner() {
  return (
    <div className="relative overflow-hidden bg-rose-950/40 border border-rose-900/60 rounded-2xl p-4 sm:p-5 flex items-start gap-3 sm:gap-4">
      <CharacterMascot
        mood="warning"
        alt="IMAN assistant warning about financial risk"
        className="h-20 w-20 sm:h-24 sm:w-24"
      />
      <div className="min-w-0">
        <div className="text-[13px] sm:text-[10px] uppercase tracking-[0.18em] text-rose-400 mb-1 font-semibold">
          Deficit detected
        </div>
        <div className="text-sm sm:text-base font-semibold text-rose-100 leading-snug">
          You are currently running a monthly deficit. Priority is to eliminate
          this gap.
        </div>
      </div>
    </div>
  );
}

function ScoreCard({
  score,
  label,
  weakest,
  completeness,
}: {
  score: number;
  label: string;
  weakest?: ScoreBreakdownItem;
  completeness?: InputCompleteness;
}) {
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    const startTime = performance.now();
    const duration = 1100; // 1.1 seconds
    const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutQuad(progress);
      setDisplayScore(Math.round(eased * score));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [score]);

  // Tone aligned with new label buckets: Critical (<45), Risk Zone (45-59),
  // Stable but Leaking (60-74), Strong (75-87), Elite (88+).
  const tone =
    score < 45
      ? {
          text: "text-rose-400",
          bar: "from-rose-500 via-rose-400 to-rose-300",
          chip: "bg-rose-500/15 text-rose-300 border-rose-500/30",
          glow: "bg-rose-500/10",
        }
      : score < 60
        ? {
            text: "text-orange-400",
            bar: "from-orange-500 via-orange-400 to-amber-300",
            chip: "bg-orange-500/15 text-orange-300 border-orange-500/30",
            glow: "bg-orange-500/10",
          }
        : score < 75
          ? {
              text: "text-amber-400",
              bar: "from-amber-500 via-yellow-400 to-amber-300",
              chip: "bg-amber-500/15 text-amber-300 border-amber-500/30",
              glow: "bg-amber-500/10",
            }
          : score < 88
            ? {
                text: "text-blue-500",
                bar: "from-blue-500 via-blue-400 to-blue-300",
                chip: "bg-blue-500/15 text-blue-300 border-blue-500/18",
                glow: "bg-blue-500/10",
              }
            : {
                text: "text-blue-300",
                bar: "from-blue-400 via-teal-300 to-blue-200",
                chip: "bg-blue-400/15 text-blue-200 border-blue-400/24",
                glow: "bg-blue-400/15",
              };

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-900/60 border border-zinc-800 rounded-2xl p-6 sm:p-8 lg:p-10 shadow-2xl shadow-black/40">
      <div
        className={`absolute -right-24 -top-24 w-72 h-72 rounded-full ${tone.glow} blur-3xl pointer-events-none`}
      />
      {score >= 88 && (
        <CharacterMascot
          mood="celebration"
          alt="IMAN assistant celebrating a strong financial score"
          className="pointer-events-none absolute right-3 top-3 h-20 w-20 sm:right-5 sm:top-5 sm:h-24 sm:w-24"
        />
      )}
      <div className="absolute inset-x-0 -bottom-24 h-48 bg-gradient-to-t from-zinc-950/40 to-transparent pointer-events-none" />
      <div className="relative flex flex-col items-center text-center">
        <div className="text-[13px] sm:text-[11px] uppercase tracking-[0.28em] text-zinc-500 mb-3">
          Financial Score
        </div>
        <div
          className={`text-7xl sm:text-8xl lg:text-9xl font-black leading-none tabular-nums tracking-tight ${tone.text}`}
        >
          {displayScore}
          <span className="text-2xl sm:text-3xl text-zinc-700 font-bold align-top ml-1">
            /100
          </span>
        </div>
        <div className="mt-4">
          <span
            className={`text-xs sm:text-[13px] font-semibold uppercase tracking-[0.14em] px-3 py-1 rounded-full border ${tone.chip}`}
          >
            {label}
          </span>
        </div>
        {completeness && (
          <AnalysisConfidencePanel completeness={completeness} />
        )}
        <div className="w-full max-w-xl mt-6">
          <div className="h-1.5 bg-zinc-800/80 rounded-full overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${tone.bar} rounded-full transition-all duration-700`}
              style={{ width: `${Math.max(2, Math.min(100, displayScore))}%` }}
            />
          </div>
          <div className="flex justify-between text-[13px] sm:text-[10px] text-zinc-600 mt-2 tabular-nums">
            <span>0</span>
            <span>45</span>
            <span>60</span>
            <span>75</span>
            <span>88</span>
            <span>100</span>
          </div>
        </div>
        {weakest && weakest.points < weakest.max && (
          <div className="w-full max-w-xl mt-6 pt-5 border-t border-zinc-800/80">
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 mb-1.5">
              Weakest area · {weakest.name}{" "}
              <span className="text-zinc-600 normal-case tracking-normal tabular-nums">
                ({weakest.points}/{weakest.max})
              </span>
            </div>
            <div className="text-sm text-zinc-300 leading-relaxed">
              {weakest.explanation}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function scoreRatio(item: ScoreBreakdownItem) {
  return item.max > 0 ? item.points / item.max : 0;
}

function componentLevel(
  item: ScoreBreakdownItem | undefined,
  mode: "strength" | "pressure",
) {
  if (!item) return "Low";
  const ratio = scoreRatio(item);
  if (mode === "strength") {
    if (ratio >= 0.8) return "High";
    if (ratio >= 0.5) return "Medium";
    return "Low";
  }
  if (ratio >= 0.8) return "Low";
  if (ratio >= 0.5) return "Medium";
  return "High";
}

function componentTone(level: string, mode: "strength" | "pressure") {
  const good =
    (mode === "strength" && level === "High") ||
    (mode === "pressure" && level === "Low");
  const rough =
    (mode === "strength" && level === "Low") ||
    (mode === "pressure" && level === "High");
  if (good) return "border-blue-500/18 bg-blue-500/10 text-blue-200";
  if (rough) return "border-amber-500/25 bg-amber-500/10 text-amber-200";
  return "border-zinc-700/80 bg-zinc-900/70 text-zinc-200";
}

function recommendationScoreArea(text: string) {
  if (/takeout|food|misc|service|personal|utility|subscription/i.test(text)) {
    return "Controllable Waste";
  }
  if (/debt|consolidation|refinance|payment relief/i.test(text)) {
    return "Debt Burden";
  }
  if (/surplus|savings|invest/i.test(text)) {
    return "Cash Retention";
  }
  return "Cash Retention";
}

function buildScoreMoves(
  priorities: Priority[],
  breakdown: ScoreBreakdownItem[],
  monthlySavings: number,
) {
  const byName = new Map(breakdown.map((item) => [item.name, item]));
  const seen = new Set<string>();
  const moves = priorities
    .filter(
      (priority) =>
        priority.monthlyImpact == null || priority.monthlyImpact > 0,
    )
    .map((priority) => {
      const areaName = recommendationScoreArea(priority.text);
      const area = byName.get(areaName);
      const gap = area ? Math.max(0, area.max - area.points) : 0;
      const impact =
        typeof priority.monthlyImpact === "number"
          ? priority.monthlyImpact
          : monthlySavings;
      const estimate = Math.max(
        1,
        Math.min(8, Math.ceil(gap * 0.45 || impact / 250)),
      );
      const cleaned = priority.text
        .split(" Why it matters:")[0]
        .replace(/\.$/, "");
      return {
        areaName,
        text: cleaned,
        estimate,
      };
    })
    .filter((move) => {
      if (seen.has(move.areaName)) return false;
      seen.add(move.areaName);
      return move.estimate > 0;
    })
    .slice(0, 3);

  if (moves.length > 0) return moves;

  return [...breakdown]
    .filter((item) => item.points < item.max)
    .sort((a, b) => b.max - b.points - (a.max - a.points))
    .slice(0, 2)
    .map((item) => ({
      areaName: item.name,
      text: `Improve ${item.name.toLowerCase()}`,
      estimate: Math.max(
        1,
        Math.min(6, Math.ceil((item.max - item.points) * 0.4)),
      ),
    }));
}

function ScoreExplanationCard({
  breakdown,
  priorities,
  monthlySavings,
}: {
  breakdown: ScoreBreakdownItem[];
  priorities: Priority[];
  monthlySavings: number;
}) {
  const findPart = (name: string) =>
    breakdown.find((item) => item.name.toLowerCase() === name.toLowerCase());
  const positives = breakdown
    .filter((item) => scoreRatio(item) >= 0.85)
    .sort((a, b) => b.points - a.points);
  const negatives = breakdown
    .filter((item) => scoreRatio(item) < 0.85)
    .sort((a, b) => b.max - b.points - (a.max - a.points));
  const topDrivers = [
    ...negatives.slice(0, 2),
    ...positives.slice(0, Math.max(0, 3 - Math.min(2, negatives.length))),
  ].slice(0, 3);
  const componentParts = [
    {
      label: "Cash retention",
      item: findPart("Cash Retention"),
      mode: "strength" as const,
    },
    {
      label: "Waste ratio",
      item: findPart("Controllable Waste"),
      mode: "pressure" as const,
    },
    {
      label: "Debt burden",
      item: findPart("Debt Burden"),
      mode: "pressure" as const,
    },
    {
      label: "Subscriptions",
      item: findPart("Subscription Bloat"),
      mode: "pressure" as const,
    },
  ];
  const moves = buildScoreMoves(priorities, breakdown, monthlySavings);

  return (
    <Card title="Why This Score?" eyebrow="Score logic">
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-5">
        <div className="space-y-5">
          <div>
            <div className="text-sm sm:text-[11px] uppercase tracking-wider text-zinc-500 mb-3">
              Top Drivers
            </div>
            <ul className="space-y-2.5">
              {topDrivers.map((item) => {
                const positive = scoreRatio(item) >= 0.85;
                return (
                  <li
                    key={item.name}
                    className="rounded-xl border border-zinc-800/70 bg-zinc-950/45 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-zinc-100">
                        {item.name}
                      </div>
                      <span
                        className={`shrink-0 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                          positive
                            ? "border-blue-500/18 bg-blue-500/10 text-blue-200"
                            : "border-amber-500/25 bg-amber-500/10 text-amber-200"
                        }`}
                      >
                        {positive ? "Positive" : "Drag"}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-zinc-500 tabular-nums">
                      {item.points}/{item.max} pts
                    </div>
                    <p className="mt-2 text-sm text-zinc-300 leading-relaxed">
                      {item.explanation}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>

          {moves.length > 0 && (
            <div>
              <div className="text-sm sm:text-[11px] uppercase tracking-wider text-zinc-500 mb-3">
                What Moves Your Score
              </div>
              <ul className="space-y-2.5">
                {moves.map((move, index) => (
                  <li
                    key={`${move.areaName}-${index}`}
                    className="flex items-start justify-between gap-3 rounded-xl border border-zinc-800/70 bg-zinc-950/45 p-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm text-zinc-200 leading-relaxed">
                        {move.text}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        Affects {move.areaName}
                      </div>
                    </div>
                    <span className="shrink-0 text-[11px] font-semibold text-blue-200 bg-blue-500/10 border border-blue-500/18 px-2 py-0.5 rounded-md tabular-nums whitespace-nowrap">
                      up to +{move.estimate}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div>
          <div className="text-sm sm:text-[11px] uppercase tracking-wider text-zinc-500 mb-3">
            Component Breakdown
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
            {componentParts.map(({ label, item, mode }) => {
              const level = componentLevel(item, mode);
              return (
                <div
                  key={label}
                  className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800/70 bg-zinc-950/45 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-200">
                      {label}
                    </div>
                    {item && (
                      <div className="text-xs text-zinc-500 tabular-nums">
                        {item.points}/{item.max} pts
                      </div>
                    )}
                  </div>
                  <span
                    className={`shrink-0 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border ${componentTone(level, mode)}`}
                  >
                    {level}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}

function formatCategoryList(categories: string[]) {
  if (categories.length === 0) return "";
  if (categories.length === 1) return categories[0];
  return `${categories.slice(0, -1).join(", ")} and ${categories[categories.length - 1]}`;
}

function AnalysisConfidencePanel({
  completeness,
}: {
  completeness: InputCompleteness;
}) {
  const missing = completeness.missingKeyCategories.slice(0, 2);
  const missingText = formatCategoryList(missing);
  const confidenceTone =
    completeness.confidence === "Low"
      ? {
          label: "text-amber-200",
          chip: "bg-amber-500/15 text-amber-200 border-amber-500/30",
          panel: "border-amber-500/20 bg-amber-500/[0.06]",
        }
      : completeness.confidence === "Medium"
        ? {
            label: "text-blue-200",
            chip: "bg-blue-500/15 text-blue-200 border-blue-500/24",
            panel: "border-blue-500/18 bg-blue-500/[0.05]",
          }
        : {
            label: "text-emerald-200",
            chip: "bg-emerald-500/12 text-emerald-200 border-emerald-500/22",
            panel: "border-zinc-800/80 bg-zinc-950/45",
          };

  const guidance =
    completeness.confidence === "Low" && missingText
      ? `Add ${missingText} for sharper insights.`
      : completeness.confidence === "Medium" && missingText
        ? `Add ${missingText} to tighten this analysis.`
        : "";
  const confidenceNote =
    completeness.confidence === "Low"
      ? "Score is based on current entries only and may change with more complete data."
      : "";

  return (
    <div
      className={`w-full max-w-xl mt-5 rounded-xl border ${confidenceTone.panel} p-3.5 sm:p-4 text-left`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="shrink-0">
          <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 mb-1">
            Analysis Confidence
          </div>
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${confidenceTone.chip}`}
          >
            {completeness.confidence}
          </span>
        </div>
        <div className="min-w-0 text-sm leading-relaxed">
          <p className="text-zinc-300">
            Results improve as more monthly expenses are entered.
          </p>
          {guidance && (
            <p className={`mt-1 font-medium ${confidenceTone.label}`}>
              {guidance}
            </p>
          )}
          {confidenceNote && (
            <p className="mt-1 text-zinc-400">{confidenceNote}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  suffix = "",
  hint,
}: {
  label: string;
  value: number;
  tone: "positive" | "negative" | "warning" | "neutral";
  suffix?: string;
  hint?: string;
}) {
  const valueColor =
    tone === "neutral"
      ? "text-zinc-200"
      : tone === "warning"
        ? "text-orange-400"
        : tone === "positive"
          ? "text-emerald-400"
          : "text-rose-400";
  const arrowColor =
    tone === "neutral"
      ? "text-zinc-500"
      : tone === "warning"
        ? "text-orange-400"
        : tone === "positive"
          ? "text-emerald-400"
          : "text-rose-400";
  const arrow =
    tone === "neutral"
      ? "→"
      : tone === "warning"
        ? "+"
        : tone === "positive"
          ? "↑"
          : "↓";
  return (
    <div className="min-w-0 bg-zinc-900/75 border border-zinc-700/70 rounded-2xl p-4 shadow-lg shadow-black/20 hover:border-zinc-600 hover:shadow-black/30 transition">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="text-[13px] sm:text-[10px] uppercase tracking-[0.18em] text-zinc-400 truncate font-medium">
          {label}
        </div>
        <span className={`shrink-0 text-sm font-bold ${arrowColor}`}>
          {arrow}
        </span>
      </div>
      <div
        className={`text-3xl font-black tabular-nums break-words ${valueColor}`}
      >
        ${value.toLocaleString()}
        {suffix && (
          <span className="text-xs text-zinc-500 font-normal ml-0.5">
            {suffix}
          </span>
        )}
      </div>
      {hint && (
        <div className="text-xs text-zinc-500 mt-1.5 truncate">{hint}</div>
      )}
    </div>
  );
}

function Card({
  title,
  eyebrow,
  children,
  accent,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`min-w-0 bg-zinc-900/75 border ${accent ? "border-blue-500/18" : "border-zinc-700/70"} rounded-2xl p-4 sm:p-5 shadow-lg shadow-black/20 hover:border-zinc-600 hover:shadow-black/30 transition`}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-[15px] font-bold text-zinc-100">{title}</div>
        {eyebrow && (
          <div className="text-[13px] sm:text-[10px] uppercase tracking-wider text-zinc-500">
            {eyebrow}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function Subtile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "blue" | "green" | "red";
}) {
  const valueColor =
    accent === "green"
      ? "text-emerald-400"
      : accent === "red"
        ? "text-rose-400"
        : accent === "blue"
          ? "text-blue-500"
          : "text-zinc-100";
  return (
    <div className="min-w-0 bg-zinc-950/70 border border-zinc-700/70 rounded-xl p-3.5 sm:p-4">
      <div className="text-[13px] sm:text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
        {label}
      </div>
      <div
        className={`text-xl sm:text-2xl font-bold tabular-nums break-words text-right sm:text-left ${valueColor}`}
      >
        {value}
      </div>
    </div>
  );
}

function ProjectionTile({
  years,
  value,
  highlight,
}: {
  years: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`min-w-0 relative bg-zinc-950/60 border rounded-xl p-3 sm:p-4 text-center ${
        highlight
          ? "border-blue-500/24 shadow-lg shadow-blue-500/5"
          : "border-zinc-800/80"
      }`}
    >
      <div className="text-[13px] sm:text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
        {years}
      </div>
      <div
        className={`text-base sm:text-lg lg:text-xl font-bold tabular-nums break-words ${
          highlight ? "text-blue-500" : "text-zinc-100"
        }`}
      >
        ${value.toLocaleString()}
      </div>
    </div>
  );
}

function SingleField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm sm:text-[11px] uppercase tracking-wider text-zinc-500 mb-1.5">
        {label}
      </span>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 text-sm">
          $
        </span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full min-w-0 bg-zinc-950 border border-zinc-800 rounded-lg pl-7 pr-3 py-2.5 text-zinc-100 placeholder-zinc-700 tabular-nums focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition"
        />
      </div>
    </label>
  );
}

function CategoryCard({
  name,
  items,
  setItems,
  isExpanded,
  onToggle,
  priority,
}: {
  name: CategoryName;
  items: Item[];
  setItems: (items: Item[]) => void;
  isExpanded: boolean;
  onToggle: () => void;
  priority: "high" | "low" | "normal";
}) {
  const nameInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const amountInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const pendingFocus = useRef<{ idx: number; field: keyof Item } | null>(null);
  const update = (idx: number, field: keyof Item, value: string) =>
    setItems(
      items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)),
    );
  const remove = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const addBlank = () => {
    pendingFocus.current = { idx: items.length, field: "name" };
    setItems([...items, blank()]);
  };
  const addNamed = (n: string) => {
    pendingFocus.current = { idx: items.length, field: "amount" };
    setItems([...items, { name: n, amount: "" }]);
  };

  useEffect(() => {
    const focusTarget = pendingFocus.current;
    if (!focusTarget) return;
    const refs = focusTarget.field === "name" ? nameInputRefs : amountInputRefs;
    const input = refs.current[focusTarget.idx];
    if (!input) return;
    pendingFocus.current = null;
    input.focus({ preventScroll: true });
    input.select();
  }, [items.length]);

  const onNameBlur = (idx: number, value: string) => {
    const fixed = normalizeName(value);
    if (fixed !== value) update(idx, "name", fixed);
  };

  const total = items.reduce((s, it) => {
    const n = Number(it.amount);
    return Number.isFinite(n) && n > 0 ? s + n : s;
  }, 0);

  // Defaults that haven't been added yet (case-insensitive name match).
  const usedNames = new Set(items.map((it) => it.name.trim().toLowerCase()));
  const availableSuggestions = CATEGORY_DEFAULTS[name].filter(
    (s) => !usedNames.has(s.toLowerCase()),
  );
  const Icon = CATEGORY_ICONS[name];

  const headerTitleClass =
    priority === "high" ? "text-zinc-100" : "text-zinc-300";
  const cardBorderClass = isExpanded
    ? "border-blue-500/24"
    : priority === "high"
      ? "border-blue-500/16"
      : priority === "low"
        ? "border-zinc-800/55"
        : "border-zinc-800/75";
  const cardBgClass = isExpanded
    ? "bg-blue-500/[0.045] shadow-lg shadow-blue-500/3"
    : priority === "low"
      ? "bg-zinc-950/35"
      : "bg-zinc-950/55";

  return (
    <div
      className={`${cardBgClass} border ${cardBorderClass} rounded-xl transition-all duration-200`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left rounded-xl transition hover:bg-zinc-900/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition ${
              isExpanded
                ? "border-blue-500/22 bg-blue-500/12 text-blue-200"
                : "border-zinc-800 bg-zinc-900/70 text-zinc-500"
            }`}
            aria-hidden
          >
            <Icon size={16} />
          </span>
          <span
            className={`text-[12px] uppercase tracking-[0.14em] font-semibold ${headerTitleClass}`}
          >
            {name}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {total > 0 && (
            <span className="rounded-full border border-zinc-800 bg-black/25 px-2 py-1 text-[11px] font-semibold text-zinc-200 tabular-nums">
              ${total.toLocaleString()}
            </span>
          )}
          <ChevronRight
            size={17}
            className={`text-zinc-500 transition-transform duration-200 ${
              isExpanded ? "rotate-90 text-blue-300" : ""
            }`}
          />
        </span>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 pt-1">
          {items.length > 0 && (
            <div className="space-y-2 mb-2">
              {items.map((it, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    ref={(el) => {
                      nameInputRefs.current[idx] = el;
                    }}
                    type="text"
                    value={it.name}
                    onChange={(e) => update(idx, "name", e.target.value)}
                    onBlur={(e) => onNameBlur(idx, e.target.value)}
                    placeholder="Item name"
                    className="flex-1 min-w-0 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition"
                  />
                  <div className="relative w-20 sm:w-24 shrink-0 min-w-0">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600 text-sm">
                      $
                    </span>
                    <input
                      ref={(el) => {
                        amountInputRefs.current[idx] = el;
                      }}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      value={it.amount}
                      onChange={(e) => update(idx, "amount", e.target.value)}
                      placeholder="0"
                      className="w-full min-w-0 bg-zinc-950 border border-zinc-800 rounded-lg pl-6 pr-2 py-2 text-sm text-zinc-100 placeholder-zinc-700 tabular-nums focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(idx)}
                    aria-label="Remove item"
                    className="flex h-9 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-rose-500/10 hover:text-rose-400"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {availableSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {availableSuggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addNamed(s)}
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-blue-300 hover:border-blue-500/40 transition"
                >
                  <Plus size={12} />
                  {s}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={addBlank}
            className="inline-flex items-center gap-1.5 text-sm sm:text-[11px] font-semibold text-blue-300 hover:text-blue-200 transition"
          >
            <Plus size={14} />
            Add item
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
