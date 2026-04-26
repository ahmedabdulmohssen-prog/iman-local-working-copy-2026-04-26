import { pgTable, text, serial, timestamp, doublePrecision, index } from "drizzle-orm/pg-core";

export const optimizationsTable = pgTable("optimizations", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  rationale: text("rationale").notNull(),
  monthlyImpact: doublePrecision("monthly_impact").notNull(),
  annualImpact: doublePrecision("annual_impact").notNull(),
  tenYearImpact: doublePrecision("ten_year_impact").notNull(),
  confidence: doublePrecision("confidence").notNull().default(0.7),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("optimizations_user_idx").on(t.userId),
}));

export type Optimization = typeof optimizationsTable.$inferSelect;
