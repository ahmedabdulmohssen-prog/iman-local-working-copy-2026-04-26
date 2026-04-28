import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  computeTotals,
  fallbackAdvisor,
  fallbackOpportunities,
} from "../lib/analysisEngine";

const router: IRouter = Router();

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
    scoreAdjustedForCompleteness: t.scoreAdjustedForCompleteness,
    analysisConfidence: t.analysisConfidence,
    inputCompleteness: t.inputCompleteness,
    inputCompletenessPrompt: t.inputCompletenessPrompt,
    plausibilityCheck: t.plausibilityCheck,
    plausibilityNote: t.plausibilityNote,
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
    ? "direct but supportive - deficit closes first; no investing talk"
    : t.financialScore >= 75
      ? "supportive, optimizing"
      : "advisory, improvement-focused";

  const shortForContext = t.shortTermPriorities
    .map((m, i) => `${i + 1}. ${m.text}`)
    .join("\n");
  const longForContext = t.longTermOpportunities
    .map((m, i) => `${i + 1}. ${m.text}`)
    .join("\n");

  const prompt = `CONTEXT (already computed by the system - do NOT recompute or alter):
Income $${t.income} | Net $${t.netCashFlow} | Subs $${t.subscriptionsTotal} (${t.subscriptions.length}) | Food groceries $${t.groceries}, eating out $${t.eatingOut} | Services $${t.servicesTotal} | Other $${t.otherTotal}

Short term priorities (0-90 days, already chosen by the system):
${shortForContext || "(none)"}

Long term opportunities (3-12 months, already chosen by the system):
${longForContext || "(none)"}

YOUR JOB:
Write short qualitative text only. Do NOT propose numbers, dollar amounts, percentages, reductions, or new actions. Describe patterns in plain English.

Tone: ${tone}.

Output EXACTLY this format, no extras, no numbers:

Opportunities:
- [single sentence: "[Observation]; [consequence or fix]." - qualitative only, no $ or %]
- [single sentence in same pattern]

Advisor: [2 sentences max, qualitative only${
    t.isDeficit
      ? '; END with the exact sentence: "Aim to bring your net cash flow back to positive within 60-90 days."'
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
      .map((l) => l.replace(/^[-*]\s*/, "").trim())
      .filter(Boolean);

    const advisorNoteRaw = grab("Advisor").replace(/^\[|\]$/g, "").trim();
    let advisorNote = advisorNoteRaw || fallbackAdvisor(t);
    if (
      t.isDeficit &&
      !/positive within 60-90 days\.?$/i.test(advisorNote.trim())
    ) {
      advisorNote = `${advisorNote.replace(/\s*$/, "")} Aim to bring your net cash flow back to positive within 60-90 days.`;
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
