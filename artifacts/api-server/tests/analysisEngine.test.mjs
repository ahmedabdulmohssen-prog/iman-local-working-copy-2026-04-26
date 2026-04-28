import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");
const tempDir = await mkdtemp(path.join(os.tmpdir(), "iman-analysis-engine-"));
const bundledEngine = path.join(tempDir, "analysisEngine.mjs");

await build({
  entryPoints: [path.join(apiRoot, "src", "lib", "analysisEngine.ts")],
  outfile: bundledEngine,
  bundle: true,
  platform: "node",
  format: "esm",
  logLevel: "silent",
});

const { computeTotals } = await import(pathToFileURL(bundledEngine).href);

const CATEGORIES = [
  "Housing",
  "Utilities",
  "Food",
  "Transportation",
  "Services",
  "Subscriptions",
  "Debt",
  "Personal",
  "Misc",
];

function item(name, amount) {
  return { name, amount };
}

function payload(income, categories, investPct = 70) {
  return {
    income,
    investPct,
    categories: Object.fromEntries(
      CATEGORIES.map((category) => [category, categories[category] ?? []]),
    ),
  };
}

function scorePart(result, name) {
  const part = result.scoreBreakdown.find((entry) => entry.name === name);
  assert.ok(part, `Missing score part: ${name}`);
  return part;
}

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

test("healthy surplus scores strong and preserves yearly math", () => {
  const result = computeTotals(
    payload(10000, {
      Housing: [item("Rent", 2500)],
      Utilities: [item("Electricity", 160), item("Internet", 90)],
      Food: [item("Groceries", 700), item("Eating Out", 250)],
      Transportation: [item("Fuel", 300)],
      Subscriptions: [item("Music", 15), item("Cloud", 15)],
      Personal: [item("Clothing", 200)],
    }),
  );

  assert.equal(result.isDeficit, false);
  assert.ok(result.netCashFlow > 0);
  assert.ok(result.financialScore >= 85);
  assert.equal(result.analysisConfidence, "High");
  assert.equal(result.annualWaste, result.monthlySavings * 12);
  assert.ok(result.scoreBreakdown.every((entry) => entry.points <= entry.max));
});

test("paycheck to paycheck high income leakage produces low trust score and targeted actions", () => {
  const result = computeTotals(
    payload(12000, {
      Housing: [item("Rent", 3000)],
      Utilities: [item("Electricity", 300), item("Phone", 180), item("Internet", 120)],
      Food: [item("Groceries", 800), item("Eating Out", 2400)],
      Transportation: [item("Car Payment", 650), item("Fuel", 250)],
      Services: [item("Cleaning", 700), item("Laundry", 500)],
      Subscriptions: [
        item("Video", 90),
        item("Music", 60),
        item("Fitness", 80),
        item("Cloud", 70),
        item("News", 50),
        item("Apps", 150),
      ],
      Debt: [item("Loan", 600)],
      Personal: [item("Clothing", 500), item("Grooming", 400)],
      Misc: [item("Amazon extras", 900)],
    }),
  );

  assert.equal(result.isDeficit, false);
  assert.ok(result.netCashFlow > 0 && result.ratios.savingsRate < 0.05);
  assert.ok(result.financialScore < 60);
  assert.ok(result.wasteSignals.length >= 3);
  assert.ok(result.monthlySavings > 1000);
  assert.ok(result.shortTermPriorities.length <= 3);
});

test("deficit mode pauses investing and marks severe deficit", () => {
  const result = computeTotals(
    payload(5500, {
      Housing: [item("Rent", 2200)],
      Utilities: [item("Electricity", 250), item("Phone", 120), item("Internet", 130)],
      Food: [item("Groceries", 800), item("Eating Out", 1100)],
      Transportation: [item("Car Payment", 500), item("Fuel", 200)],
      Services: [item("Cleaning", 300)],
      Subscriptions: [item("Video", 80), item("Fitness", 80)],
      Debt: [item("Credit Cards", 900)],
      Misc: [item("Misc", 300)],
    }),
  );

  assert.equal(result.isDeficit, true);
  assert.equal(result.severeDeficit, true);
  assert.equal(result.investAmount, 0);
  assert.equal(result.fv5, 0);
  assert.ok(result.projectedNetCashFlow > result.netCashFlow);
  assert.ok(result.financialScore < 45);
});

test("subscription bloat triggers cancellation recommendation", () => {
  const result = computeTotals(
    payload(8000, {
      Housing: [item("Rent", 2200)],
      Utilities: [item("Utilities", 300)],
      Food: [item("Groceries", 700), item("Eating Out", 250)],
      Transportation: [item("Fuel", 400)],
      Subscriptions: [
        item("Video", 20),
        item("Music", 25),
        item("Fitness", 30),
        item("Cloud", 45),
        item("News", 50),
        item("Apps", 60),
      ],
    }),
  );

  assert.ok(result.wasteSignals.some((signal) => signal.key === "subscription_bloat"));
  assert.ok(result.shortTermPriorities.some((move) => /Cancel \d+ subscription/.test(move.text)));
  assert.ok(scorePart(result, "Subscription Bloat").points < 10);
});

test("debt pressure is scored separately and creates long-term debt action", () => {
  const result = computeTotals(
    payload(7000, {
      Housing: [item("Rent", 1800)],
      Utilities: [item("Utilities", 300)],
      Food: [item("Groceries", 900)],
      Transportation: [item("Fuel", 400)],
      Debt: [item("Credit Cards", 900), item("Loan", 700)],
    }),
  );

  assert.ok(result.ratios.debtRatio > 0.2);
  assert.ok(scorePart(result, "Debt Burden").points <= 3);
  assert.ok(
    result.longTermOpportunities.some((move) =>
      /Consolidate|Refinance/.test(move.text),
    ),
  );
});

test("normal expensive housing is only a low-weight warning without ZIP context", () => {
  const result = computeTotals(
    payload(10000, {
      Housing: [item("Rent", 3800)],
      Utilities: [item("Utilities", 400)],
      Food: [item("Groceries", 900)],
      Transportation: [item("Fuel", 450)],
    }),
  );

  const housing = scorePart(result, "Housing Pressure");
  assert.equal(housing.max, 5);
  assert.ok(housing.points <= 3);
  assert.ok(result.financialScore >= 85);
  assert.equal(result.wasteSignals.length, 0);
});

test("high score can have low confidence when inputs are sparse", () => {
  const result = computeTotals(
    payload(10000, {
      Housing: [item("Rent", 1200)],
      Food: [item("Groceries", 400)],
    }),
  );

  assert.equal(result.inputCompleteness.sparse, true);
  assert.equal(result.inputCompleteness.confidence, "Low");
  assert.equal(result.analysisConfidence, "Low");
  assert.ok(result.inputCompleteness.missingKeyCategories.includes("Utilities"));
  assert.ok(result.inputCompleteness.missingKeyCategories.includes("Transportation"));
  assert.ok(result.financialScore >= 85);
  assert.equal(result.scoreAdjustedForCompleteness, false);
  assert.equal(result.inputCompleteness.scoreAdjusted, false);
  assert.ok(/more accurate analysis/i.test(result.inputCompletenessPrompt));
});

test("low score can also have low confidence when sparse entries show risk", () => {
  const result = computeTotals(
    payload(5000, {
      Debt: [item("Debt payments", 6000)],
    }),
  );

  assert.equal(result.analysisConfidence, "Low");
  assert.equal(result.isDeficit, true);
  assert.ok(result.financialScore < 45);
  assert.equal(result.scoreAdjustedForCompleteness, false);
});

test("high score and high confidence stay independent", () => {
  const result = computeTotals(
    payload(10000, {
      Housing: [item("Rent", 2200)],
      Utilities: [item("Electricity", 160), item("Internet", 90)],
      Food: [item("Groceries", 700), item("Eating Out", 250)],
      Transportation: [item("Fuel", 300)],
      Subscriptions: [item("Music", 15), item("Cloud", 15)],
    }),
  );

  assert.equal(result.analysisConfidence, "High");
  assert.ok(result.financialScore >= 85);
  assert.equal(result.scoreAdjustedForCompleteness, false);
});

test("score changes when housing changes even with low confidence", () => {
  const highHousing = computeTotals(
    payload(5000, {
      Housing: [item("Rent", 2000)],
    }),
  );
  const lowHousing = computeTotals(
    payload(5000, {
      Housing: [item("Rent", 200)],
    }),
  );

  assert.equal(highHousing.analysisConfidence, "Low");
  assert.equal(lowHousing.analysisConfidence, "Low");
  assert.equal(highHousing.categoryTotals.Housing, 2000);
  assert.equal(lowHousing.categoryTotals.Housing, 200);
  assert.notEqual(highHousing.financialScore, lowHousing.financialScore);
  assert.ok(lowHousing.netCashFlow > highHousing.netCashFlow);
  assert.ok(
    scorePart(lowHousing, "Housing Pressure").points >
      scorePart(highHousing, "Housing Pressure").points,
  );
});

test("plausibility note triggers for unrealistic sparse life", () => {
  const result = computeTotals(
    payload(5000, {
      Housing: [item("Rent", 200)],
    }),
  );

  assert.ok(result.financialScore >= 85);
  assert.equal(result.analysisConfidence, "Low");
  assert.equal(result.plausibilityCheck.triggered, true);
  assert.ok(result.plausibilityCheck.reasons.includes("very_low_housing"));
  assert.ok(result.plausibilityCheck.reasons.includes("missing_adult_basics"));
  assert.match(result.plausibilityNote, /housing is truly \$200/i);
});

test("plausibility note stays quiet for realistic working adult", () => {
  const result = computeTotals(
    payload(5000, {
      Housing: [item("Rent", 1800)],
      Utilities: [item("Utilities", 220)],
      Food: [item("Food", 650)],
      Transportation: [item("Transportation", 450)],
      Subscriptions: [item("Streaming", 60)],
      Debt: [item("Debt", 300)],
      Personal: [item("Personal", 150)],
    }),
  );

  assert.equal(result.plausibilityCheck.triggered, false);
  assert.equal(result.plausibilityNote, null);
  assert.ok(["Medium", "High"].includes(result.analysisConfidence));
  assert.ok(result.financialScore > 0);
});

test("plausibility note stays quiet for high earner leakage profile", () => {
  const result = computeTotals(
    payload(9000, {
      Housing: [item("Rent", 2400)],
      Food: [item("Food", 1300)],
      Transportation: [item("Transportation", 900)],
      Subscriptions: [item("Subscriptions", 250)],
      Services: [item("Services", 600)],
      Debt: [item("Debt", 500)],
      Misc: [item("Misc", 700)],
    }),
  );

  assert.equal(result.plausibilityCheck.triggered, false);
  assert.equal(result.plausibilityNote, null);
  assert.notEqual(result.analysisConfidence, "Low");
  assert.ok(result.wasteSignals.length > 0);
  assert.ok(result.shortTermPriorities.length > 0);
});

test("plausibility note stays quiet for deficit scenario", () => {
  const result = computeTotals(
    payload(4200, {
      Housing: [item("Rent", 2200)],
      Food: [item("Food", 700)],
      Transportation: [item("Transportation", 650)],
      Debt: [item("Debt", 600)],
      Utilities: [item("Utilities", 300)],
    }),
  );

  assert.equal(result.isDeficit, true);
  assert.ok(result.financialScore < 60);
  assert.equal(result.plausibilityCheck.triggered, false);
  assert.equal(result.plausibilityNote, null);
});

let failures = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`not ok - ${name}`);
    console.error(err);
  }
}

await rm(tempDir, { recursive: true, force: true });

if (failures > 0) {
  process.exit(1);
}

console.log(`analysis engine tests passed (${tests.length})`);
