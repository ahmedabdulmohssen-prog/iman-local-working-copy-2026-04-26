import { pgTable, text, serial, timestamp, doublePrecision, index } from "drizzle-orm/pg-core";

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: timestamp("date", { withTimezone: true }).notNull(),
  description: text("description").notNull(),
  amount: doublePrecision("amount").notNull(),
  category: text("category").notNull().default("Uncategorized"),
  source: text("source").notNull().default("manual"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("transactions_user_idx").on(t.userId),
}));

export type Transaction = typeof transactionsTable.$inferSelect;
