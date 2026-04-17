import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, and, desc } from "drizzle-orm";
import { buildInterviewBriefPdf } from "@/lib/interview/pdf-brief";

export const runtime = "nodejs";
export const maxDuration = 30;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "untitled";
}

export async function GET(_req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;

  // 1. Load job
  const [job] = await db
    .select()
    .from(schema.jobs)
    .where(eq(schema.jobs.id, jobId))
    .limit(1);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  // 2. Load company
  const [company] = job.companyId
    ? await db
        .select()
        .from(schema.companies)
        .where(eq(schema.companies.id, job.companyId))
        .limit(1)
    : [];
  const companyName = company?.name ?? "Unknown company";

  // 3. Load application
  const [application] = await db
    .select()
    .from(schema.applications)
    .where(eq(schema.applications.jobId, jobId))
    .limit(1);

  if (!application) {
    return NextResponse.json({ error: "No application for this job" }, { status: 404 });
  }

  // 4. Find latest interview-prep document
  const [prepDoc] = await db
    .select({ blobUrlDocx: schema.documents.blobUrlDocx, version: schema.documents.version })
    .from(schema.documents)
    .where(
      and(
        eq(schema.documents.applicationId, application.id),
        eq(schema.documents.kind, "interview-prep"),
      ),
    )
    .orderBy(desc(schema.documents.version))
    .limit(1);

  if (!prepDoc || !prepDoc.blobUrlDocx) {
    return NextResponse.json(
      {
        error:
          "Interview prep document not yet generated. Set status to 'interview' to auto-generate.",
      },
      { status: 404 },
    );
  }

  // 5. Fetch interview-prep markdown
  let prepMarkdown = "";
  try {
    const res = await fetch(prepDoc.blobUrlDocx);
    if (res.ok) prepMarkdown = await res.text();
  } catch {
    // leave empty — PDF builder will insert placeholder
  }

  // 6. Dossier (may be null)
  const dossier = (company?.researchJson ?? null) as {
    productOneLiner?: string;
    stage?: string;
    industry?: string;
    narrative?: string;
    recentNews?: string[];
    cultureSignals?: string[];
  } | null;

  // 7. Build PDF
  const pdfBytes = await buildInterviewBriefPdf({
    title: job.title,
    companyName,
    prepMarkdown,
    dossier,
  });

  const filename = `disha-interview-brief-${slugify(companyName)}-${slugify(job.title)}.pdf`;

  return new NextResponse(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBytes.length),
      "Cache-Control": "no-store",
    },
  });
}
