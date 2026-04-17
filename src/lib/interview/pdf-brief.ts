import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export interface BriefDossier {
  productOneLiner?: string;
  stage?: string;
  industry?: string;
  narrative?: string;
  recentNews?: string[];
  cultureSignals?: string[];
}

export interface BriefInput {
  title: string;
  companyName: string;
  prepMarkdown: string;
  dossier: BriefDossier | null;
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 50;
const MARGIN_TOP = 50;
const MARGIN_BOTTOM = 50;
const LINE_HEIGHT = 14;
const PARA_FONT_SIZE = 11;
const H1_FONT_SIZE = 18;
const H2_FONT_SIZE = 14;
const WRAP_CHARS = 90;

function wrapLine(text: string, width: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > width) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = cur ? `${cur} ${w}` : w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length > 0 ? lines : [""];
}

interface Cursor {
  page: PDFPage;
  y: number;
}

function ensureSpace(doc: PDFDocument, cur: Cursor, needed: number): Cursor {
  if (cur.y - needed < MARGIN_BOTTOM) {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    return { page, y: PAGE_HEIGHT - MARGIN_TOP };
  }
  return cur;
}

function drawParagraph(
  doc: PDFDocument,
  cur: Cursor,
  text: string,
  font: PDFFont,
  size: number,
): Cursor {
  let c = cur;
  for (const line of wrapLine(text, WRAP_CHARS)) {
    c = ensureSpace(doc, c, LINE_HEIGHT);
    c.page.drawText(line, { x: MARGIN_X, y: c.y, size, font, color: rgb(0, 0, 0) });
    c = { page: c.page, y: c.y - LINE_HEIGHT };
  }
  return c;
}

function drawHeading(
  doc: PDFDocument,
  cur: Cursor,
  text: string,
  font: PDFFont,
  size: number,
): Cursor {
  let c = ensureSpace(doc, cur, size + 8);
  c = { page: c.page, y: c.y - 6 };
  c.page.drawText(text, { x: MARGIN_X, y: c.y, size, font, color: rgb(0, 0, 0) });
  return { page: c.page, y: c.y - (size + 4) };
}

function renderMarkdown(
  doc: PDFDocument,
  cur: Cursor,
  md: string,
  regular: PDFFont,
  bold: PDFFont,
): Cursor {
  let c = cur;
  const lines = md.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      c = { page: c.page, y: c.y - 6 };
      continue;
    }
    if (line.startsWith("## ")) {
      c = drawHeading(doc, c, line.slice(3), bold, H2_FONT_SIZE);
      continue;
    }
    if (line.startsWith("# ")) {
      c = drawHeading(doc, c, line.slice(2), bold, H2_FONT_SIZE);
      continue;
    }
    if (/^[-*]\s/.test(line)) {
      c = drawParagraph(doc, c, `\u2022 ${line.replace(/^[-*]\s+/, "")}`, regular, PARA_FONT_SIZE);
      continue;
    }
    c = drawParagraph(doc, c, line, regular, PARA_FONT_SIZE);
  }
  return c;
}

export async function buildInterviewBriefPdf(input: BriefInput): Promise<Uint8Array> {
  const { title, companyName, prepMarkdown, dossier } = input;
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let cur: Cursor = { page: doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]), y: PAGE_HEIGHT - MARGIN_TOP };

  // Title
  cur.page.drawText(`Interview brief: ${title}`, {
    x: MARGIN_X,
    y: cur.y,
    size: H1_FONT_SIZE,
    font: bold,
    color: rgb(0, 0, 0),
  });
  cur = { page: cur.page, y: cur.y - 22 };
  cur.page.drawText(companyName, {
    x: MARGIN_X,
    y: cur.y,
    size: H2_FONT_SIZE,
    font: regular,
    color: rgb(0.3, 0.3, 0.3),
  });
  cur = { page: cur.page, y: cur.y - 24 };

  // Section 1: Company dossier
  cur = drawHeading(doc, cur, "Company dossier", bold, H2_FONT_SIZE);
  if (dossier) {
    if (dossier.productOneLiner) {
      cur = drawParagraph(doc, cur, `What they do: ${dossier.productOneLiner}`, regular, PARA_FONT_SIZE);
    }
    if (dossier.stage) {
      cur = drawParagraph(doc, cur, `Stage: ${dossier.stage}`, regular, PARA_FONT_SIZE);
    }
    if (dossier.industry) {
      cur = drawParagraph(doc, cur, `Industry: ${dossier.industry}`, regular, PARA_FONT_SIZE);
    }
    if (dossier.narrative) {
      cur = { page: cur.page, y: cur.y - 6 };
      cur = drawParagraph(doc, cur, dossier.narrative, regular, PARA_FONT_SIZE);
    }
    if (dossier.recentNews && dossier.recentNews.length > 0) {
      cur = drawHeading(doc, cur, "Recent news", bold, PARA_FONT_SIZE + 1);
      for (const n of dossier.recentNews) {
        cur = drawParagraph(doc, cur, `\u2022 ${n}`, regular, PARA_FONT_SIZE);
      }
    }
    if (dossier.cultureSignals && dossier.cultureSignals.length > 0) {
      cur = drawHeading(doc, cur, "Culture signals", bold, PARA_FONT_SIZE + 1);
      for (const s of dossier.cultureSignals) {
        cur = drawParagraph(doc, cur, `\u2022 ${s}`, regular, PARA_FONT_SIZE);
      }
    }
  } else {
    cur = drawParagraph(doc, cur, "Company research not available.", regular, PARA_FONT_SIZE);
  }

  cur = { page: cur.page, y: cur.y - 12 };

  // Section 2: Interview prep
  cur = drawHeading(doc, cur, "Interview prep", bold, H2_FONT_SIZE);
  if (prepMarkdown && prepMarkdown.trim().length > 0) {
    cur = renderMarkdown(doc, cur, prepMarkdown, regular, bold);
  } else {
    cur = drawParagraph(
      doc,
      cur,
      "Interview prep document not yet generated.",
      regular,
      PARA_FONT_SIZE,
    );
  }

  return await doc.save();
}
