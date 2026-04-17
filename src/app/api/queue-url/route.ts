import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { computeDedupeHash } from "@/lib/pipeline/dedupe";

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

/** Best-effort extraction of title / company from fetched JD text. */
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

function normaliseUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    // Lower-case host, strip hash, strip trailing slash, keep querystring as-is
    u.hash = "";
    return `${u.protocol}//${u.host.toLowerCase()}${u.pathname.replace(/\/$/, "")}${u.search}`;
  } catch {
    return raw.trim();
  }
}

function isBlockedHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return true;
    if (host.endsWith(".local") || host.endsWith(".internal")) return true;
    if (/^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return true;
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) return true;
    return false;
  } catch { return true; }
}

// ---------------------------------------------------------------------------
// POST /api/queue-url
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  // 1. Parse & validate body
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const rawUrl = (body.url ?? "").trim();
  if (!rawUrl) {
    return NextResponse.json({ ok: false, error: "Missing required field: url" }, { status: 400 });
  }

  if (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
    return NextResponse.json(
      { ok: false, error: "URL must start with http:// or https://" },
      { status: 400 },
    );
  }

  if (rawUrl.includes("linkedin.com")) {
    return NextResponse.json(
      { ok: false, error: "LinkedIn requires login to view job listings. Please copy and paste the job description text directly instead of the URL." },
      { status: 400 },
    );
  }

  if (isBlockedHost(rawUrl)) {
    return NextResponse.json({ ok: false, error: "URL host is not allowed" }, { status: 400 });
  }

  try {
    // 2. Compute normalised URL and sourceExternalId
    const normalised = normaliseUrl(rawUrl);
    const sourceExternalId = `url:${normalised}`;

    // 3. Dedup: check if URL already exists
    const [existing] = await db
      .select({ id: schema.jobs.id })
      .from(schema.jobs)
      .where(
        and(
          eq(schema.jobs.source, "url_paste"),
          eq(schema.jobs.sourceExternalId, sourceExternalId),
        ),
      )
      .limit(1);

    if (existing) {
      return NextResponse.json({ ok: true, queued: true, jobId: existing.id, alreadyQueued: true });
    }

    // 4. Fetch the URL
    let jdText: string;
    try {
      jdText = await fetchUrlText(rawUrl);
    } catch {
      return NextResponse.json(
        { ok: false, error: "Could not fetch that URL. Try pasting the job description text directly instead." },
        { status: 400 },
      );
    }

    // 5. Truncate and validate
    jdText = jdText.slice(0, 10_000);
    if (!jdText.trim()) {
      return NextResponse.json(
        { ok: false, error: "Fetched page contained no text" },
        { status: 400 },
      );
    }

    // 6. Extract meta
    const { title, company: companyName } = extractMeta(jdText);

    // 7. Upsert company
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

    // 8. Compute dedupe hash
    const dedupeHash = computeDedupeHash({
      companyName,
      title,
      location: null,
      postedAt: null,
    });

    // 9. Insert queued job row (no scoring, no LLM)
    try {
      const [job] = await db
        .insert(schema.jobs)
        .values({
          companyId,
          source: "url_paste",
          sourceUrl: rawUrl,
          sourceExternalId,
          title,
          jdText,
          location: null,
          discoveredAt: new Date(),
          dedupeHash,
          hardFilterReason: "queued",
          tier: null,
          fitScore: null,
        })
        .returning({ id: schema.jobs.id });

      return NextResponse.json({ ok: true, queued: true, jobId: job.id, alreadyQueued: false });
    } catch (insertErr) {
      // Handle unique-constraint violation (race condition on sourceExternalId)
      const errMsg = insertErr instanceof Error ? insertErr.message : String(insertErr);
      if (errMsg.includes("unique") || errMsg.includes("duplicate") || errMsg.includes("23505")) {
        const [raceExisting] = await db
          .select({ id: schema.jobs.id })
          .from(schema.jobs)
          .where(
            and(
              eq(schema.jobs.source, "url_paste"),
              eq(schema.jobs.sourceExternalId, sourceExternalId),
            ),
          )
          .limit(1);
        if (raceExisting) {
          return NextResponse.json({ ok: true, queued: true, jobId: raceExisting.id, alreadyQueued: true });
        }
      }
      throw insertErr;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
