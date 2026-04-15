import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  WidthType,
  TableRow,
  TableCell,
  Table,
} from "docx";
import type { CvStruct } from "./cv-types";

const FONT = "Calibri";
// Margins in twentieths of a point (twips): 720 twips = 0.5 inch
const MARGIN = 720;

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    text: text.toUpperCase(),
    style: "Normal",
    spacing: { before: 160, after: 60 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: "333333", space: 4 },
    },
    run: {
      bold: true,
      font: FONT,
      size: 22,
      color: "1a1a1a",
    },
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    text,
    bullet: { level: 0 },
    spacing: { before: 40, after: 40 },
    style: "Normal",
    run: { font: FONT, size: 20 },
  });
}

function body(text: string, options: { bold?: boolean; size?: number; color?: string; italic?: boolean } = {}): Paragraph {
  return new Paragraph({
    style: "Normal",
    spacing: { before: 40, after: 40 },
    children: [
      new TextRun({
        text,
        font: FONT,
        size: options.size ?? 20,
        bold: options.bold ?? false,
        color: options.color ?? "1a1a1a",
        italics: options.italic ?? false,
      }),
    ],
  });
}

function contactLine(cv: CvStruct): string {
  const parts: string[] = [];
  if (cv.contact.email) parts.push(cv.contact.email);
  if (cv.contact.phone) parts.push(cv.contact.phone);
  if (cv.contact.linkedin) parts.push(cv.contact.linkedin);
  if (cv.contact.portfolio) parts.push(cv.contact.portfolio);
  const loc = cv.location ? `${cv.location}` : "";
  if (loc) parts.unshift(loc);
  return parts.join("  |  ");
}

export async function renderCvDocx(cv: CvStruct): Promise<Buffer> {
  const children: Paragraph[] = [];

  // --- Header ---
  children.push(
    new Paragraph({
      style: "Normal",
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({ text: cv.name, font: FONT, size: 40, bold: true, color: "1a1a1a" }),
      ],
    }),
    new Paragraph({
      style: "Normal",
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({ text: cv.headline, font: FONT, size: 22, color: "444444" }),
      ],
    }),
    new Paragraph({
      style: "Normal",
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({ text: contactLine(cv), font: FONT, size: 18, color: "555555" }),
      ],
    }),
  );

  // --- Summary ---
  children.push(sectionHeading("Summary"));
  children.push(body(cv.summary));

  // --- Skills ---
  children.push(sectionHeading("Skills"));
  for (const group of cv.skillsGrouped) {
    children.push(
      new Paragraph({
        style: "Normal",
        spacing: { before: 60, after: 30 },
        children: [
          new TextRun({ text: `${group.group}: `, font: FONT, size: 20, bold: true }),
          new TextRun({ text: group.items.join(", "), font: FONT, size: 20 }),
        ],
      }),
    );
  }

  // --- Experience ---
  children.push(sectionHeading("Experience"));
  for (const role of cv.experience) {
    // Role title + company line
    children.push(
      new Paragraph({
        style: "Normal",
        spacing: { before: 100, after: 20 },
        children: [
          new TextRun({ text: role.title, font: FONT, size: 22, bold: true }),
          new TextRun({ text: `  |  ${role.company}`, font: FONT, size: 22, color: "444444" }),
        ],
      }),
    );
    // Dates + location
    const dateLoc = [role.dates, role.location].filter(Boolean).join("  |  ");
    children.push(
      new Paragraph({
        style: "Normal",
        spacing: { after: 40 },
        children: [
          new TextRun({ text: dateLoc, font: FONT, size: 18, italics: true, color: "666666" }),
        ],
      }),
    );
    // Context (optional)
    if (role.context) {
      children.push(body(role.context, { color: "444444", italic: true }));
    }
    // Highlights
    for (const h of role.highlights) {
      children.push(bullet(h));
    }
  }

  // --- Education ---
  children.push(sectionHeading("Education"));
  for (const edu of cv.education) {
    const line = [edu.degree, edu.school, edu.year].filter(Boolean).join("  |  ");
    children.push(body(line));
  }

  // --- Certifications ---
  if (cv.certifications.length > 0) {
    children.push(sectionHeading("Certifications"));
    for (const cert of cv.certifications) {
      children.push(bullet(cert));
    }
  }

  // --- Languages ---
  if (cv.languages.length > 0) {
    children.push(sectionHeading("Languages"));
    children.push(body(cv.languages.join("  |  ")));
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 20 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: MARGIN,
              right: MARGIN,
              bottom: MARGIN,
              left: MARGIN,
            },
          },
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
