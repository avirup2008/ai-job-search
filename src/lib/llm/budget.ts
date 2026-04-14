import { db, schema } from "@/db";
import { eq, sql } from "drizzle-orm";

export interface BudgetState {
  period: string;          // YYYY-MM
  eurSpent: number;
  capEur: number;
  utilization: number;     // 0..1
}

export function currentPeriod(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getBudget(capEur: number): Promise<BudgetState> {
  const period = currentPeriod();
  const rows = await db
    .select()
    .from(schema.llmBudget)
    .where(eq(schema.llmBudget.period, period));
  const row = rows[0];
  if (!row) {
    await db
      .insert(schema.llmBudget)
      .values({ period, capEur: String(capEur) })
      .onConflictDoNothing();
    return { period, eurSpent: 0, capEur, utilization: 0 };
  }
  const eurSpent = Number(row.eurSpent);
  const cap = Number(row.capEur);
  return { period, eurSpent, capEur: cap, utilization: cap > 0 ? eurSpent / cap : 1 };
}

export async function recordSpend(params: {
  costEur: number; tokensIn: number; tokensOut: number; capEur: number;
}): Promise<void> {
  const period = currentPeriod();
  await db
    .insert(schema.llmBudget)
    .values({
      period,
      eurSpent: String(params.costEur),
      tokensIn: params.tokensIn,
      tokensOut: params.tokensOut,
      requests: 1,
      capEur: String(params.capEur),
    })
    .onConflictDoUpdate({
      target: schema.llmBudget.period,
      set: {
        eurSpent: sql`${schema.llmBudget.eurSpent} + ${String(params.costEur)}::numeric`,
        tokensIn: sql`${schema.llmBudget.tokensIn} + ${params.tokensIn}`,
        tokensOut: sql`${schema.llmBudget.tokensOut} + ${params.tokensOut}`,
        requests: sql`${schema.llmBudget.requests} + 1`,
        updatedAt: sql`now()`,
      },
    });
}
