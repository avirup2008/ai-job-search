import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { sql } from "drizzle-orm";
import { extractPdfText } from "@/lib/linkedin/extract";
import { optimizeLinkedinProfile } from "@/lib/linkedin/optimize";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("pdf");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ ok: false, error: "No PDF file provided" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ ok: false, error: "File must be a PDF" }, { status: 400 });
    }

    // Extract text
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let rawText: string;
    try {
      rawText = await extractPdfText(buffer);
    } catch {
      return NextResponse.json(
        { ok: false, error: "Could not read PDF — try re-exporting from LinkedIn" },
        { status: 422 }
      );
    }

    if (rawText.length < 500) {
      return NextResponse.json(
        { ok: false, error: "PDF appears empty or too short" },
        { status: 422 }
      );
    }

    // Call Sonnet — single call, cost captured from usage in the response
    let rewrites;
    let tokenCost: number;
    try {
      const result = await optimizeLinkedinProfile(rawText);
      rewrites = result.rewrites;
      tokenCost = result.tokenCost;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Generation failed — try again" },
        { status: 500 }
      );
    }

    // Upsert: DELETE existing + INSERT new (single-user app, one optimization stored)
    // Explicit WHERE TRUE avoids Drizzle's "missing where clause" guard on unconditional deletes
    await db.delete(schema.linkedinOptimizations).where(sql`TRUE`);
    const [inserted] = await db
      .insert(schema.linkedinOptimizations)
      .values({
        rawText,
        rewrites,
        tokenCost: String(tokenCost),
        model: "claude-sonnet-4-5",
      })
      .returning();

    return NextResponse.json({ ok: true, id: inserted.id, rewrites });
  } catch (err) {
    console.error("[linkedin/optimize] unexpected error", err);
    return NextResponse.json({ ok: false, error: "Unexpected server error" }, { status: 500 });
  }
}
