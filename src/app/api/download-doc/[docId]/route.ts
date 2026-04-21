import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ docId: string }> },
) {
  const { docId } = await ctx.params;

  const [doc] = await db
    .select({
      id: schema.documents.id,
      kind: schema.documents.kind,
      artifactType: schema.documents.artifactType,
      blobUrlDocx: schema.documents.blobUrlDocx,
      blobUrlPdf: schema.documents.blobUrlPdf,
      storageUrl: schema.documents.storageUrl,
      mimeType: schema.documents.mimeType,
      format: schema.documents.format,
    })
    .from(schema.documents)
    .where(eq(schema.documents.id, docId))
    .limit(1);

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const blobUrl = doc.storageUrl ?? doc.blobUrlDocx ?? doc.blobUrlPdf;
  if (!blobUrl) {
    return NextResponse.json({ error: "No blob URL for this document" }, { status: 404 });
  }

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  const res = await fetch(blobUrl, blobToken
    ? { headers: { Authorization: `Bearer ${blobToken}` } }
    : undefined,
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: `Blob fetch failed: ${res.status}` },
      { status: 502 },
    );
  }

  // Derive filename for Content-Disposition
  const ext = doc.format === "docx" ? ".docx"
    : doc.format === "html" ? ".html"
    : doc.format === "markdown" ? ".md"
    : "";
  const baseName = doc.artifactType
    ? doc.artifactType.replace(/[-_]/g, "-")
    : doc.kind;
  const filename = `${baseName}${ext}`;

  const mimeType = doc.mimeType ?? "application/octet-stream";
  const body = await res.arrayBuffer();

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
