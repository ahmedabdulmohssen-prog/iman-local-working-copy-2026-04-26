import { pgTable, text, serial, timestamp, doublePrecision, index } from "drizzle-orm/pg-core";

export const weeklyPlansTable = pgTable("weekly_plans", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  weekStart: timestamp("week_start", { withTimezone: true }).notNull(),
  safeSpendingLimit: doublePrecision("safe_spending_limit").notNull(),
  suggestedSavings: doublePrecision("suggested_savings").notNull(),
  suggestedCuts: text("suggested_cuts").array().notNull().default([]),
  summary: text("summary").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("weekly_plans_user_idx").on(t.userId),
}));

export type WeeklyPlan = typeof weeklyPlansTable.$inferSelect;
