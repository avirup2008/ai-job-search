import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { assessJob } from "@/lib/pipeline/rank";
import { assignTier } from "@/lib/pipeline/tier";
import { computeDedupeHash } from "@/lib/pipeline/dedupe";
import type { Profile } from "@/lib/profile/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function htmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Best-effort extraction of title / company from pasted JD text. */
function extractMeta(jdText: string): { title: string; company: string } {
  const lines = jdText.split("\n").map((l) => l.trim()).filter(Boolean);
  const title = lines[0]?.slice(0, 120) ?? "Unknown";

  // Look for common "Company: X" / "About X" patterns
  let company = "Unknown";
  for (const line of lines.slice(0, 15)) {
    const m =
      line.match(/^company\s*[:—–-]\s*(.+)/i) ??
      line.match(/^about\s+(.+)/i) ??
      line.match(/^(.+?)\s+is\s+(?:looking|hiring|seeking)/i);
    if (m) {
      company = m[1].trim().slice(0, 120);
      break;
    }
  }
  return { title, company };
}

async function fetchUrlText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "JobSearchBot/1.0" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    return htmlToText(html);
  } finally {
    clearTimeout(timeout);
  }
}

function buildProfileFromRow(row: typeof schema.profile.$inferSelect): Profile {
  return {
    fullName: row.fullName ?? "",
    headline: row.headline ?? undefined,
    roles: row.roles as Profile["roles"],
    achievements: row.achievements as Profile["achievements"],
    toolStack: row.toolStack as Profile["toolStack"],
    industries: row.industries as Profile["industries"],
    stories: row.stories as Profile["stories"],
    constraints: row.constraints as Profile["constraints"],
    preferences: row.preferences as Profile["preferences"],
    portfolioUrl: row.portfolioUrl ?? undefined,
    linkedinUrl: row.linkedinUrl,
    contactEmail: row.contactEmail ?? undefined,
    phone: row.phone ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// POST /api/paste-role
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  // 1. Parse & validate body
  let body: { text?: string; companyName?: string; roleTitle?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const rawText = (body.text ?? "").trim();
  if (!rawText) {
    return NextResponse.json({ ok: false, error: "Missing required field: text" }, { status: 400 });
  }

  try {
    // 2. Resolve JD text (URL fetch vs raw)
    const isUrl = rawText.startsWith("http");
    let jdText: string;

    if (isUrl) {
      try {
        jdText = await fetchUrlText(rawText);
      } catch {
        return NextResponse.json(
          { ok: false, error: "Could not fetch URL" },
          { status: 400 },
        );
      }
    } else {
      jdText = rawText;
    }

    // Truncate to 10 000 chars
    jdText = jdText.slice(0, 10_000);

    // 3. Determine company name & role title
    const extracted = extractMeta(jdText);
    const companyName = body.companyName?.trim() || extracted.company;
    const roleTitle = body.roleTitle?.trim() || extracted.title;

    // 4. Upsert company
    let companyId: string;
    const [existingCo] = await db
      .select({ id: schema.companies.id })
      .from(schema.companies)
      .where(eq(schema.companies.name, companyName))
      .limit(1);

    if (existingCo) {
      companyId = existingCo.id;
    } else {
      const [created] = await db
        .insert(schema.companies)
        .values({ name: companyName })
        .returning({ id: schema.companies.id });
      companyId = created.id;
    }

    // 5. Create job row
    const dedupeHash = computeDedupeHash({
      companyName,
      title: roleTitle,
      location: null,
      postedAt: null,
    });

    const [job] = await db
      .insert(schema.jobs)
      .values({
        companyId,
        source: "manual",
        sourceUrl: isUrl ? rawText : "",
        sourceExternalId: `manual-${Date.now()}`,
        title: roleTitle,
        jdText,
        location: null,
        discoveredAt: new Date(),
        dedupeHash,
      })
      .returning({ id: schema.jobs.id });

    // 6. Run ranking pipeline
    const [profileRow] = await db.select().from(schema.profile).limit(1);
    if (!profileRow) {
      return NextResponse.json(
        { ok: false, error: "No profile found — seed profile first" },
        { status: 500 },
      );
    }
    const profile = buildProfileFromRow(profileRow);

    const rank = await assessJob({ jdText, jobTitle: roleTitle, profile });
    const tier = assignTier(rank.fitScore);

    // 7. Update job with fit data
    await db
      .update(schema.jobs)
      .set({
        fitScore: String(rank.fitScore),
        fitBreakdown: rank.components,
        gapAnalysis: {
          strengths: rank.assessment.strengths,
          gaps: rank.assessment.gaps,
          recommendation: rank.assessment.recommendation,
          recommendationReason: rank.assessment.recommendationReason,
        },
        tier,
        seniority: rank.assessment.seniorityLevel,
      })
      .where(eq(schema.jobs.id, job.id));

    // 8. Create application row (user pasted it, so go straight to "saved")
    await db.insert(schema.applications).values({
      jobId: job.id,
      status: "saved",
    });

    // 9. Return result
    return NextResponse.json({
      ok: true,
      jobId: job.id,
      title: roleTitle,
      companyName,
      fitScore: rank.fitScore,
      strengths: rank.assessment.strengths,
      gaps: rank.assessment.gaps,
      recommendation: rank.assessment.recommendation,
      costEur: 0.005,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
