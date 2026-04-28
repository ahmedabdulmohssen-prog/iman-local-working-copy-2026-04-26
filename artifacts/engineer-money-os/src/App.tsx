import { useState, useEffect } from "react";
import imanWordmark from "./Assets/iman-wordmark.png";

const API_BASE = "http://localhost:3001";

type Item = { name: string; amount: string };

type RecommendedAction = { text: string; savings: number | null };
type Difficulty = "Easy" | "Medium" | "Hard";
type Priority = {
  text: string;
  monthlyImpact: number | null;
  difficulty: Difficulty;
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
  scoreBreakdown?: {
    name: string;
    points: number;
    max: number;
    explanation: string;
  }[];
  weakestCategory?: {
    name: string;
    points: number;
    max: number;
    explanation: string;
  };
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
  Services: ["Cleaning", "Laundry", "Lawn"],
  Subscriptions: [],
  Debt: ["Credit Cards", "Loans"],
  Personal: ["Clothing", "Grooming"],
  Misc: [],
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

function buildDefaultCategories(): Record<CategoryName, Item[]> {
  // Start every category with NO rows. Defaults appear as suggestion chips
  // inside each card so we never show empty pre-populated inputs.
  const out = {} as Record<CategoryName, Item[]>;
  for (const name of CATEGORY_NAMES) {
    out[name] = [];
  }
  return out;
}

function App() {
  const [income, setIncome] = useState("");
  const [savingsBalance, setSavingsBalance] = useState("");
  const [monthlyInvesting, setMonthlyInvesting] = useState("");
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

  const onAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    const incomeNum = Number(income);
    if (!Number.isFinite(incomeNum) || incomeNum <= 0) {
      setError("Enter your Monthly Income before analyzing.");
      return;
    }

    const payloadCategories = {} as Record<CategoryName, { name: string; amount: number }[]>;
    let anyExpense = false;
    for (const name of CATEGORY_NAMES) {
      const cleaned = toPayloadItems(categories[name]);
      payloadCategories[name] = cleaned;
      if (cleaned.length > 0) anyExpense = true;
    }
    if (!anyExpense) {
      setError("Add at least one expense item with an amount greater than $0.");
      return;
    }

    const payload = {
      income: incomeNum,
      savingsBalance: Math.max(0, Number(savingsBalance) || 0),
      monthlyInvesting: Math.max(0, Number(monthlyInvesting) || 0),
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
      setResult((prev) =>
        prev ? { ...prev, insightsLoading: false } : prev,
      );
    }
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#0a0a0b] text-zinc-100 antialiased selection:bg-blue-500/30">
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60rem 60rem at 80% -20%, rgba(59,130,246,0.06), transparent 60%), radial-gradient(50rem 50rem at -10% 10%, rgba(59,130,246,0.04), transparent 60%)",
        }}
      />

<div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
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
                  const ranges = ["300–579", "580–669", "670–739", "740–799", "800–850"];
                  const labels = ["Poor", "Fair", "Good", "Very Good", "Excellent"];
                  const currentIndex = ranges.indexOf(creditScoreRange);
                  
                  return (
                    <div className="space-y-3">
                      <style>{`
                        .credit-score-slider {
                          appearance: none;
                          -webkit-appearance: none;
                          width: 100%;
                          height: 6px;
                          border-radius: 9999px;
                          background: rgb(63, 63, 70);
                          outline: none;
                          cursor: pointer;
                        }
                        .credit-score-slider::-webkit-slider-thumb {
                          appearance: none;
                          -webkit-appearance: none;
                          width: 16px;
                          height: 16px;
                          border-radius: 50%;
                          background: rgb(59, 130, 246);
                          cursor: pointer;
                          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
                        }
                        .credit-score-slider::-moz-range-track {
                          background: transparent;
                          border: none;
                        }
                        .credit-score-slider::-moz-range-progress {
                          background: rgb(59, 130, 246);
                          height: 6px;
                          border-radius: 9999px;
                        }
                        .credit-score-slider::-moz-range-thumb {
                          width: 16px;
                          height: 16px;
                          border-radius: 50%;
                          background: rgb(59, 130, 246);
                          cursor: pointer;
                          border: none;
                          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
                        }
                      `}</style>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        step="1"
                        value={currentIndex + 1}
                        onChange={(e) => {
                          const idx = Number(e.target.value) - 1;
                          setCreditScoreRange(ranges[idx]);
                        }}
                        className="credit-score-slider"
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

              <div className="grid grid-cols-2 gap-3">
                <SingleField
                  label="Savings Balance"
                  value={savingsBalance}
                  onChange={setSavingsBalance}
                  placeholder="optional"
                />
                <SingleField
                  label="Monthly Investing"
                  value={monthlyInvesting}
                  onChange={setMonthlyInvesting}
                  placeholder="optional"
                />
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
                    onChange={(e) => setInvestPct(Number(e.target.value))}
                    className="flex-1 credit-score-slider"
                  />
                  <input
                    type="number"
                    min={25}
                    max={100}
                    step={5}
                    value={investPct}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isFinite(n)) setInvestPct(Math.min(100, Math.max(25, n)));
                    }}
                    className="w-16 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-sm text-zinc-100 tabular-nums focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-zinc-950 font-semibold py-3 rounded-xl transition shadow-lg shadow-blue-600/15"
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
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-zinc-900/30 border border-dashed border-zinc-800 rounded-2xl p-12 text-center">
      <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-5"/></svg>
      </div>
      <div className="text-zinc-200 font-medium mb-1">Ready when you are</div>
      <div className="text-sm text-zinc-500">
        Fill in your monthly numbers on the left and run the analysis.
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-12 text-center">
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
  const investAmount = num(data.investAmount);
  const investPct = num(data.investPct);
  const fv5 = num(data.fv5);
  const fv10 = num(data.fv10);
  const fv20 = num(data.fv20);
  const opportunities = Array.isArray(data.optimizationOpportunities)
    ? data.optimizationOpportunities
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

  return (
    <section className="space-y-5">
      {isDeficit && <DeficitBanner />}

      <ScoreCard score={score} label={interpretation} weakest={weakestCategory} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
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
        <StatCard
          label="Potential Savings Opportunity"
          value={annualWaste}
          tone="warning"
          hint="Estimated annualized amount you can recover by closing your spending gap"
        />
      </div>

      {(insightsLoading ||
        opportunities.length > 0 ||
        shortTerm.length > 0 ||
        longTerm.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          <Card title="Optimization Opportunities" eyebrow="Insights">
            {insightsLoading && opportunities.length === 0 ? (
              <InsightSkeleton lines={3} />
            ) : (
              <ul className="space-y-3.5 text-sm text-zinc-200">
                {opportunities.map((line, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-2 shrink-0 w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                    <span className="leading-relaxed">{line}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="space-y-4 sm:space-y-5">
            <Card title="Short Term Priorities" eyebrow="0–90 days">
              {shortTerm.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No immediate moves needed — your near-term spending looks lean.
                </p>
              ) : (
                <PriorityList items={shortTerm} />
              )}
            </Card>

            <Card title="Long Term Opportunities" eyebrow="3–12 months">
              {longTerm.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No major strategic shifts needed — your fixed costs are in range.
                </p>
              ) : (
                <PriorityList items={longTerm} />
              )}
            </Card>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        <Card title="Savings Impact" eyebrow="Cash">
          <div className="grid grid-cols-2 gap-3">
            <Subtile
              label="Monthly"
              value={`$${monthlySavings.toLocaleString()}`}
              accent="blue"
            />
            <Subtile
              label="Yearly"
              value={`$${annualWaste.toLocaleString()}`}
              accent="blue"
            />
          </div>
        </Card>

        <AfterOptimizationCard
          before={netCashFlow}
          after={projectedNetCashFlow}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-5">
        <Card title="Investment Plan" eyebrow="Allocation">
          {isDeficit ? (
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5 w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg>
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
                    Monthly contribution
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-blue-500 tabular-nums break-words">
                    ${investAmount.toLocaleString()}
                    <span className="text-sm text-zinc-500 font-normal">/mo</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm sm:text-[11px] uppercase tracking-wider text-zinc-500 mb-1">
                    Of savings
                  </div>
                  <div className="text-base sm:text-lg font-semibold text-zinc-200 tabular-nums">
                    {investPct}%
                  </div>
                </div>
              </div>
              <div className="mt-3 h-1.5 bg-zinc-800/80 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-300"
                  style={{ width: `${Math.min(100, Math.max(0, investPct))}%` }}
                />
              </div>
              <div className="text-sm sm:text-[11px] text-zinc-500 mt-2">Assumes 7% annual return.</div>
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

      {advisorNote ? (
        <AdvisorCard note={advisorNote} />
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
        <div className="shrink-0 w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/18 flex items-center justify-center text-blue-300 shadow-lg shadow-blue-500/5">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] sm:text-[10px] uppercase tracking-[0.18em] text-blue-300/80 font-semibold mb-1.5">
            From your trusted advisor
          </div>
          <p className="text-sm sm:text-[15px] text-zinc-100 leading-relaxed">{note}</p>
        </div>
      </div>
    </div>
  );
}

function DeficitBanner() {
  return (
    <div className="relative overflow-hidden bg-rose-950/40 border border-rose-900/60 rounded-2xl p-4 sm:p-5 flex items-start gap-3 sm:gap-4">
      <div className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-300">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      </div>
      <div className="min-w-0">
        <div className="text-[13px] sm:text-[10px] uppercase tracking-[0.18em] text-rose-400 mb-1 font-semibold">
          Deficit detected
        </div>
        <div className="text-sm sm:text-base font-semibold text-rose-100 leading-snug">
          You are currently running a monthly deficit. Priority is to eliminate this gap.
        </div>
      </div>
    </div>
  );
}

function ScoreCard({
  score,
  label,
  weakest,
}: {
  score: number;
  label: string;
  weakest?: { name: string; points: number; max: number; explanation: string };
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
      ? { text: "text-rose-400", bar: "from-rose-500 via-rose-400 to-rose-300", chip: "bg-rose-500/15 text-rose-300 border-rose-500/30", glow: "bg-rose-500/10" }
      : score < 60
        ? { text: "text-orange-400", bar: "from-orange-500 via-orange-400 to-amber-300", chip: "bg-orange-500/15 text-orange-300 border-orange-500/30", glow: "bg-orange-500/10" }
        : score < 75
          ? { text: "text-amber-400", bar: "from-amber-500 via-yellow-400 to-amber-300", chip: "bg-amber-500/15 text-amber-300 border-amber-500/30", glow: "bg-amber-500/10" }
          : score < 88
            ? { text: "text-blue-500", bar: "from-blue-500 via-blue-400 to-blue-300", chip: "bg-blue-500/15 text-blue-300 border-blue-500/18", glow: "bg-blue-500/10" }
            : { text: "text-blue-300", bar: "from-blue-400 via-teal-300 to-blue-200", chip: "bg-blue-400/15 text-blue-200 border-blue-400/24", glow: "bg-blue-400/15" };

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-900/60 border border-zinc-800 rounded-2xl p-6 sm:p-8 lg:p-10 shadow-2xl shadow-black/40">
      <div className={`absolute -right-24 -top-24 w-72 h-72 rounded-full ${tone.glow} blur-3xl pointer-events-none`} />
      <div className="absolute inset-x-0 -bottom-24 h-48 bg-gradient-to-t from-zinc-950/40 to-transparent pointer-events-none" />
      <div className="relative flex flex-col items-center text-center">
        <div className="text-[13px] sm:text-[11px] uppercase tracking-[0.28em] text-zinc-500 mb-3">
          Financial Score
        </div>
        <div className={`text-7xl sm:text-8xl lg:text-9xl font-black leading-none tabular-nums tracking-tight ${tone.text}`}>
          {displayScore}
          <span className="text-2xl sm:text-3xl text-zinc-700 font-bold align-top ml-1">/100</span>
        </div>
        <div className="mt-4">
          <span className={`text-xs sm:text-[13px] font-semibold uppercase tracking-[0.14em] px-3 py-1 rounded-full border ${tone.chip}`}>
            {label}
          </span>
        </div>
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
          ? "text-blue-400"
          : "text-rose-400";
  const arrowColor =
    tone === "neutral"
      ? "text-zinc-500"
      : tone === "warning"
        ? "text-orange-400"
        : tone === "positive"
          ? "text-blue-400"
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
    <div className="min-w-0 bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-lg shadow-black/20 hover:border-zinc-700 hover:shadow-black/30 transition">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="text-[13px] sm:text-[10px] uppercase tracking-[0.18em] text-zinc-400 truncate font-medium">{label}</div>
        <span className={`shrink-0 text-sm font-bold ${arrowColor}`}>{arrow}</span>
      </div>
      <div className={`text-2xl sm:text-3xl font-bold tabular-nums break-words ${valueColor}`}>
        ${value.toLocaleString()}
        {suffix && <span className="text-xs text-zinc-500 font-normal ml-0.5">{suffix}</span>}
      </div>
      {hint && <div className="text-sm sm:text-[11px] text-zinc-500 mt-1.5 truncate">{hint}</div>}
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
      className={`min-w-0 bg-zinc-900/70 border ${accent ? "border-blue-500/18" : "border-zinc-800"} rounded-2xl p-4 sm:p-5 shadow-lg shadow-black/20 hover:border-zinc-700 hover:shadow-black/30 transition`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold text-zinc-100">{title}</div>
        {eyebrow && (
          <div className="text-[13px] sm:text-[10px] uppercase tracking-wider text-zinc-500">{eyebrow}</div>
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
  accent?: "blue";
}) {
  const valueColor = accent === "blue" ? "text-blue-500" : "text-zinc-100";
  return (
    <div className="min-w-0 bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-3.5 sm:p-4">
      <div className="text-[13px] sm:text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">{label}</div>
      <div className={`text-xl sm:text-2xl font-bold tabular-nums break-words ${valueColor}`}>{value}</div>
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
      <div className="text-[13px] sm:text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">{years}</div>
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
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 text-sm">$</span>
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
  const update = (idx: number, field: keyof Item, value: string) =>
    setItems(items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  const remove = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const addBlank = () => setItems([...items, blank()]);
  const addNamed = (n: string) => setItems([...items, { name: n, amount: "" }]);

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

  const headerTitleClass =
    priority === "high"
      ? "text-zinc-100 text-[12px]"
      : "text-zinc-300 text-sm sm:text-[11px]";
  const cardBorderClass =
    priority === "high"
      ? "border-blue-500/20"
      : priority === "low"
        ? "border-zinc-800/60"
        : "border-zinc-800/80";
  const cardBgClass = priority === "low" ? "bg-zinc-950/40" : "bg-zinc-950/60";

  return (
    <div className={`${cardBgClass} border ${cardBorderClass} rounded-xl`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-zinc-900/40 rounded-xl transition"
      >
        <span className="flex items-center gap-2 min-w-0">
          <span
            className={`inline-block transition-transform text-zinc-600 text-[13px] sm:text-[10px] ${
              isExpanded ? "rotate-90" : ""
            }`}
            aria-hidden
          >
            ▶
          </span>
          {priority === "high" && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0"
              aria-hidden
            />
          )}
          <span
            className={`uppercase tracking-[0.14em] font-semibold ${headerTitleClass}`}
          >
            {name}
          </span>
        </span>
        {total > 0 && (
          <span className="text-sm sm:text-[11px] text-zinc-400 tabular-nums shrink-0">
            <span className="text-zinc-200 font-semibold">
              ${total.toLocaleString()}
            </span>
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 pt-1">
          {items.length > 0 && (
            <div className="space-y-2 mb-2">
              {items.map((it, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
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
                    className="shrink-0 w-8 text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                  >
                    ×
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
                  className="text-sm sm:text-[11px] px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-blue-300 hover:border-blue-500/40 transition"
                >
                  + {s}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={addBlank}
            className="text-sm sm:text-[11px] font-medium text-blue-400 hover:text-blue-300 transition"
          >
            + Add item
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
