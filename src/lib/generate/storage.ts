import { put, del } from "@vercel/blob";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";

export async function storeArtifact(params: {
  applicationId: string;
  artifactType: string;
  html: string;
  tokenCostEur: number;
  tier: number | null;
}): Promise<{ id: string; htmlUrl: string; publicSlug: string; version: number }> {
  const existing = await db
    .select({ version: schema.documents.version })
    .from(schema.documents)
    .where(and(
      eq(schema.documents.applicationId, params.applicationId),
      eq(schema.documents.kind, "artifact"),
      eq(schema.documents.artifactType, params.artifactType),
    ));
  const nextVersion = existing.length === 0 ? 1 : Math.max(...existing.map((r) => r.version)) + 1;
  const slug = `${params.artifactType}-${params.applicationId.slice(0, 8)}-v${nextVersion}-${Date.now().toString(36)}`;

  const blob = await put(
    `artifacts/${slug}.html`,
    params.html,
    { access: "public", contentType: "text/html; charset=utf-8", addRandomSuffix: false },
  );

  const [row] = await db
    .insert(schema.documents)
    .values({
      applicationId: params.applicationId,
      kind: "artifact",
      artifactType: params.artifactType,
      version: nextVersion,
      // blobUrlDocx is kept for backward compat; storageUrl holds the canonical URL
      blobUrlDocx: blob.url,
      blobUrlPdf: null,
      storageUrl: blob.url,
      format: "html",
      mimeType: "text/html",
      renderKind: "viewer",
      publicSlug: slug,
      generatedByTier: params.tier,
      tokenCost: String(params.tokenCostEur),
    })
    .returning({ id: schema.documents.id });
  return { id: row.id, htmlUrl: blob.url, publicSlug: slug, version: nextVersion };
}

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
  // PDF rendering deferred for v1 — blobUrlPdf stays null
  const [row] = await db
    .insert(schema.documents)
    .values({
      applicationId: params.applicationId,
      kind: "cv",
      version: nextVersion,
      blobUrlDocx: docxBlob.url,   // @deprecated — use storageUrl
      blobUrlPdf: null,
      storageUrl: docxBlob.url,
      format: "docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      renderKind: "download",
      publicSlug: slug,
      generatedByTier: params.tier,
      tokenCost: String(params.tokenCostEur),
    })
    .returning({ id: schema.documents.id });

  return {
    id: row.id,
    docxUrl: docxBlob.url,
    pdfUrl: null,
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
      blobUrlPdf: null, // PDF rendering not yet implemented
      blobUrlDocx: blob.url, // blobUrlDocx kept for backward compat; storageUrl holds the canonical URL
      storageUrl: blob.url,
      format: "markdown",
      mimeType: "text/markdown",
      renderKind: "copy",
      publicSlug: slug,
      generatedByTier: params.tier,
      tokenCost: String(params.tokenCostEur),
    })
    .returning({ id: schema.documents.id });

  return { id: row.id, blobUrl: blob.url, publicSlug: slug, version: nextVersion };
}

/**
 * Persist a generated screening Q&A pack. Uploads markdown to Vercel Blob,
 * writes a `documents` row with kind="screening".
 */
export async function storeScreeningQA(params: {
  applicationId: string;
  markdown: string;
  tokenCostEur: number;
  tier: number | null;
}): Promise<{ id: string; blobUrl: string; publicSlug: string; version: number }> {
  const existing = await db
    .select({ version: schema.documents.version })
    .from(schema.documents)
    .where(
      and(
        eq(schema.documents.applicationId, params.applicationId),
        eq(schema.documents.kind, "screening"),
      ),
    );
  const nextVersion = existing.length === 0 ? 1 : Math.max(...existing.map((r) => r.version)) + 1;
  const slug = `screening-qa-${params.applicationId.slice(0, 8)}-v${nextVersion}-${Date.now().toString(36)}`;

  const blob = await put(
    `screening-qa/${slug}.md`,
    params.markdown,
    {
      access: "public",
      contentType: "text/markdown; charset=utf-8",
      addRandomSuffix: false,
    },
  );

  const [row] = await db
    .insert(schema.documents)
    .values({
      applicationId: params.applicationId,
      kind: "screening",
      version: nextVersion,
      blobUrlPdf: null,
      // blobUrlDocx kept for backward compat; storageUrl holds the canonical URL
      blobUrlDocx: blob.url,
      storageUrl: blob.url,
      format: "markdown",
      mimeType: "text/markdown",
      renderKind: "copy",
      publicSlug: slug,
      generatedByTier: params.tier,
      tokenCost: String(params.tokenCostEur),
    })
    .returning({ id: schema.documents.id });

  return { id: row.id, blobUrl: blob.url, publicSlug: slug, version: nextVersion };
}

/**
 * Persist a generated interview prep doc. Uploads markdown to Vercel Blob,
 * writes a `documents` row with kind="interview-prep".
 */
export async function storeInterviewPrep(params: {
  applicationId: string;
  markdown: string;
  tokenCostEur: number;
  tier: number | null;
}): Promise<{ id: string; blobUrl: string; publicSlug: string; version: number }> {
  const existing = await db
    .select({ version: schema.documents.version })
    .from(schema.documents)
    .where(
      and(
        eq(schema.documents.applicationId, params.applicationId),
        eq(schema.documents.kind, "interview-prep"),
      ),
    );
  const nextVersion = existing.length === 0 ? 1 : Math.max(...existing.map((r) => r.version)) + 1;
  const slug = `interview-prep-${params.applicationId.slice(0, 8)}-v${nextVersion}-${Date.now().toString(36)}`;

  const blob = await put(
    `interview-prep/${slug}.md`,
    params.markdown,
    {
      access: "public",
      contentType: "text/markdown; charset=utf-8",
      addRandomSuffix: false,
    },
  );

  const [row] = await db
    .insert(schema.documents)
    .values({
      applicationId: params.applicationId,
      kind: "interview-prep",
      version: nextVersion,
      blobUrlPdf: null,
      // blobUrlDocx kept for backward compat; storageUrl holds the canonical URL
      blobUrlDocx: blob.url,
      storageUrl: blob.url,
      format: "markdown",
      mimeType: "text/markdown",
      renderKind: "copy",
      publicSlug: slug,
      generatedByTier: params.tier,
      tokenCost: String(params.tokenCostEur),
    })
    .returning({ id: schema.documents.id });

  return { id: row.id, blobUrl: blob.url, publicSlug: slug, version: nextVersion };
}

/**
 * Delete all interview-prep documents for an application (blob + DB rows).
 * Used by the regenerate flow to start clean before creating a fresh doc.
 */
export async function deleteInterviewPrep(applicationId: string): Promise<void> {
  const rows = await db
    .select({ id: schema.documents.id, storageUrl: schema.documents.storageUrl, blobUrlDocx: schema.documents.blobUrlDocx })
    .from(schema.documents)
    .where(
      and(
        eq(schema.documents.applicationId, applicationId),
        eq(schema.documents.kind, "interview-prep"),
      ),
    );

  for (const row of rows) {
    const urlToDelete = row.storageUrl ?? row.blobUrlDocx;
    if (urlToDelete) {
      try {
        await del(urlToDelete);
      } catch (err) {
        console.warn("[deleteInterviewPrep] blob delete failed, continuing:", err);
      }
    }
  }

  if (rows.length > 0) {
    await db
      .delete(schema.documents)
      .where(
        and(
          eq(schema.documents.applicationId, applicationId),
          eq(schema.documents.kind, "interview-prep"),
        ),
      );
  }
}
