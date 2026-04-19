import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { getFeedbackInsights } from "@/lib/pipeline/feedback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const insights = await getFeedbackInsights();
  return NextResponse.json(insights);
}
