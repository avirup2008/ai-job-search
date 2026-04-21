import { NextResponse } from "next/server";
import JSZip from "jszip";
import { db, schema } from "@/db";
import { eq, desc } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "untitled";
}

interface DocRow {
  id: string;
  kind: string;
  artifactType: string | null;
  version: number;
  blobUrlDocx: string | null;
  blobUrlPdf: string | null;
  createdAt: Date;
}

function docKey(d: DocRow): string {
  if (d.kind === "artifact" && d.artifactType) return `artifact-${d.artifactType}`;
  return d.kind;
}

interface PackFile {
  filename: string;
  description: string;
  binary: boolean;
  url: string;
}

function filenameFor(d: DocRow): PackFile | null {
  const url = d.blobUrlDocx ?? d.blobUrlPdf;
  if (!url) return null;
  switch (d.kind) {
    case "cover":
      return { filename: "cover-letter.md", description: "cover-letter.md — tailored cover letter", binary: false, url };
    case "cv":
      return { filename: "cv.docx", description: "cv.docx — tailored CV", binary: true, url };
    case "screening":
      return { filename: "screening-qa.md", description: "screening-qa.md — screening Q&A responses", binary: false, url };
    case "interview-prep":
      return { filename: "interview-prep.md", description: "interview-prep.md — interview prep (phone screen, HM, case, culture-fit)", binary: false, url };
    case "artifact": {
      const type = d.artifactType ?? "artifact";
      const safe = slugify(type);
      return {
        filename: `${safe}.html`,
        description: `${safe}.html — ${type.replace(/[-_]/g, " ")}`,
        binary: false,
        url,
      };
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export async function GET(_req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;

  // Load job
  const [job] = await db
    .select()
    .from(schema.jobs)
    .where(eq(schema.jobs.id, jobId))
    .limit(1);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  // Load company
  const [company] = job.companyId
    ? await db
        .select()
        .from(schema.companies)
        .where(eq(schema.companies.id, job.companyId))
        .limit(1)
    : [];

  // Load application
  const [application] = await db
    .select()
    .from(schema.applications)
    .where(eq(schema.applications.jobId, jobId))
    .limit(1);

  if (!application) {
    return NextResponse.json({ error: "No application/documents for this job" }, { status: 404 });
  }

  // Load all documents, ordered newest version first
  const documents: DocRow[] = await db
    .select({
      id: schema.documents.id,
      kind: schema.documents.kind,
      artifactType: schema.documents.artifactType,
      version: schema.documents.version,
      blobUrlDocx: schema.documents.blobUrlDocx,
      blobUrlPdf: schema.documents.blobUrlPdf,
      createdAt: schema.documents.createdAt,
    })
    .from(schema.documents)
    .where(eq(schema.documents.applicationId, application.id))
    .orderBy(desc(schema.documents.version));

  // Keep latest version per doc key
  const latestByKey = new Map<string, DocRow>();
  for (const d of documents) {
    const key = docKey(d);
    if (!latestByKey.has(key)) latestByKey.set(key, d);
  }

  const packFiles: PackFile[] = [];
  for (const d of latestByKey.values()) {
    const f = filenameFor(d);
    if (f) packFiles.push(f);
  }

  if (packFiles.length === 0) {
    return NextResponse.json({ error: "No documents available to pack" }, { status: 404 });
  }

  // Build ZIP
  const zip = new JSZip();
  const companyName = company?.name ?? "Unknown company";
  const fitScore = job.fitScore == null ? null : Math.round(Number(job.fitScore));

  // Fetch all blobs in parallel
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  const fetched = await Promise.all(
    packFiles.map(async (f) => {
      try {
        const res = await fetch(f.url, blobToken ? {
          headers: { Authorization: `Bearer ${blobToken}` },
        } : undefined);
        if (!res.ok) return null;
        if (f.binary) {
          const buf = Buffer.from(await res.arrayBuffer());
          return { file: f, data: buf as Buffer | string };
        }
        const text = await res.text();
        return { file: f, data: text as Buffer | string };
      } catch {
        return null;
      }
    }),
  );

  const included: PackFile[] = [];
  for (const entry of fetched) {
    if (!entry) continue;
    zip.file(entry.file.filename, entry.data);
    included.push(entry.file);
  }

  if (included.length === 0) {
    return NextResponse.json({ error: "Failed to fetch any document contents" }, { status: 502 });
  }

  // README.txt
  const generatedDate = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const readme = [
    "Disha application pack",
    "",
    `Company: ${companyName}`,
    `Role: ${job.title}`,
    `Match: ${fitScore == null ? "Not scored" : `${fitScore}%`}`,
    `Generated: ${generatedDate}`,
    "",
    "Files in this pack:",
    ...included.map((f) => `- ${f.description}`),
    "",
    "Open the .md files in any text editor. Open .docx in Microsoft Word or Google Docs. Open .html in your browser.",
    "",
  ].join("\n");
  zip.file("README.txt", readme);

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

  const filename = `disha-${slugify(companyName)}-${slugify(job.title)}.zip`;

  return new NextResponse(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(zipBuffer.length),
      "Cache-Control": "no-store",
    },
  });
}
