import { pgTable, text, timestamp, boolean, doublePrecision } from "drizzle-orm/pg-core";

export const profilesTable = pgTable("profiles", {
  userId: text("user_id").primaryKey(),
  incomeRange: text("income_range"),
  monthlyIncome: doublePrecision("monthly_income"),
  monthlyExpensesEstimate: doublePrecision("monthly_expenses_estimate"),
  financialGoals: text("financial_goals"),
  onboarded: boolean("onboarded").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Profile = typeof profilesTable.$inferSelect;
