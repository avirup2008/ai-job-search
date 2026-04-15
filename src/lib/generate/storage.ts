import { put } from "@vercel/blob";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";

/**
 * Persist a generated CV. Uploads DOCX to Vercel Blob,
 * writes a `documents` row. PDF deferred to a later phase.
 */
export async function storeCv(params: {
  applicationId: string;
  docxBuffer: Buffer;
  tokenCostEur: number;
  tier: number | null;
}): Promise<{ id: string; docxUrl: string; pdfUrl: string | null; publicSlug: string; version: number }> {
  const existing = await db
    .select({ version: schema.documents.version })
    .from(schema.documents)
    .where(
      and(
        eq(schema.documents.applicationId, params.applicationId),
        eq(schema.documents.kind, "cv"),
      ),
    );
  const nextVersion = existing.length === 0 ? 1 : Math.max(...existing.map((r) => r.version)) + 1;
  const slug = `cv-${params.applicationId.slice(0, 8)}-v${nextVersion}-${Date.now().toString(36)}`;

  const docxBlob = await put(
    `cvs/${slug}.docx`,
    params.docxBuffer,
    {
      access: "public",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      addRandomSuffix: false,
    },
  );
  const pdfBlob: { url: string } | null = null;

  // Insert documents row with both URLs
  const [row] = await db
    .insert(schema.documents)
    .values({
      applicationId: params.applicationId,
      kind: "cv",
      version: nextVersion,
      blobUrlDocx: docxBlob.url,
      blobUrlPdf: pdfBlob?.url ?? null,
      publicSlug: slug,
      generatedByTier: params.tier,
      tokenCost: String(params.tokenCostEur),
    })
    .returning({ id: schema.documents.id });

  return {
    id: row.id,
    docxUrl: docxBlob.url,
    pdfUrl: pdfBlob?.url ?? null,
    publicSlug: slug,
    version: nextVersion,
  };
}

/**
 * Persist a generated cover letter. Uploads markdown to Vercel Blob,
 * writes a `documents` row. Returns the new document record.
 */
export async function storeCoverLetter(params: {
  applicationId: string;
  markdown: string;
  tokenCostEur: number;
  tier: number | null;
}): Promise<{ id: string; blobUrl: string; publicSlug: string; version: number }> {
  // Determine next version for this application+kind
  const existing = await db
    .select({ version: schema.documents.version })
    .from(schema.documents)
    .where(
      and(
        eq(schema.documents.applicationId, params.applicationId),
        eq(schema.documents.kind, "cover"),
      ),
    );
  const nextVersion = existing.length === 0 ? 1 : Math.max(...existing.map((r) => r.version)) + 1;
  const slug = `cover-${params.applicationId.slice(0, 8)}-v${nextVersion}-${Date.now().toString(36)}`;

  // Upload markdown to Blob
  const blob = await put(
    `covers/${slug}.md`,
    params.markdown,
    {
      access: "public",
      contentType: "text/markdown; charset=utf-8",
      addRandomSuffix: false,
    },
  );

  // Insert documents row
  const [row] = await db
    .insert(schema.documents)
    .values({
      applicationId: params.applicationId,
      kind: "cover",
      version: nextVersion,
      blobUrlPdf: null, // PDF comes in Plan 8.2
      blobUrlDocx: blob.url, // repurposing this column to hold the markdown URL until we have formal DOCX/PDF
      publicSlug: slug,
      generatedByTier: params.tier,
      tokenCost: String(params.tokenCostEur),
    })
    .returning({ id: schema.documents.id });

  return { id: row.id, blobUrl: blob.url, publicSlug: slug, version: nextVersion };
}
