import { pgTable, text, serial, timestamp, doublePrecision, index } from "drizzle-orm/pg-core";

export const insightsTable = pgTable("insights", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  kind: text("kind").notNull().default("observation"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  amount: doublePrecision("amount"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("insights_user_idx").on(t.userId),
}));

export type Insight = typeof insightsTable.$inferSelect;
