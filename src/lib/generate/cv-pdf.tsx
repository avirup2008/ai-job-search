import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
  Font,
} from "@react-pdf/renderer";
import type { CvStruct } from "./cv-types";

// Register standard PDF font (no external font file needed)
// Helvetica is built-in to PDF spec — no registration required

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingTop: 40,
    paddingRight: 40,
    paddingBottom: 40,
    paddingLeft: 40,
    color: "#1a1a1a",
  },
  // Header
  name: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 4,
  },
  headline: {
    fontSize: 11,
    textAlign: "center",
    color: "#444444",
    marginBottom: 3,
  },
  contact: {
    fontSize: 8.5,
    textAlign: "center",
    color: "#555555",
    marginBottom: 14,
  },
  // Section heading
  sectionHeading: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
    textTransform: "uppercase",
    borderBottomWidth: 0.75,
    borderBottomColor: "#333333",
    borderBottomStyle: "solid",
    paddingBottom: 2,
    marginTop: 10,
    marginBottom: 5,
    letterSpacing: 0.5,
  },
  // Body text
  body: {
    fontSize: 10,
    lineHeight: 1.4,
    marginBottom: 3,
  },
  // Skills row
  skillRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  skillGroup: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginRight: 4,
  },
  skillItems: {
    fontSize: 10,
    flex: 1,
  },
  // Experience
  roleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 7,
    marginBottom: 1,
  },
  roleTitleCompany: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
  },
  roleCompanySep: {
    fontSize: 10.5,
    color: "#555555",
    fontFamily: "Helvetica",
  },
  roleDates: {
    fontSize: 9,
    color: "#666666",
    fontFamily: "Helvetica-Oblique",
    marginBottom: 2,
  },
  roleContext: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Oblique",
    color: "#444444",
    marginBottom: 2,
  },
  bullet: {
    flexDirection: "row",
    marginBottom: 2,
    paddingLeft: 4,
  },
  bulletDot: {
    width: 10,
    fontSize: 10,
    color: "#555555",
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.35,
  },
  // Education
  eduLine: {
    fontSize: 10,
    marginBottom: 2,
  },
  // Cert / Language
  certLine: {
    fontSize: 10,
    marginBottom: 2,
  },
});

function contactLine(cv: CvStruct): string {
  const parts: string[] = [];
  if (cv.location) parts.push(cv.location);
  if (cv.contact.email) parts.push(cv.contact.email);
  if (cv.contact.phone) parts.push(cv.contact.phone);
  if (cv.contact.linkedin) parts.push(cv.contact.linkedin);
  if (cv.contact.portfolio) parts.push(cv.contact.portfolio);
  return parts.join("  |  ");
}

function SectionHeading({ children }: { children: string }) {
  return <Text style={styles.sectionHeading}>{children.toUpperCase()}</Text>;
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bullet}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

function CvDocument({ cv }: { cv: CvStruct }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <Text style={styles.name}>{cv.name}</Text>
        <Text style={styles.headline}>{cv.headline}</Text>
        <Text style={styles.contact}>{contactLine(cv)}</Text>

        {/* Summary */}
        <SectionHeading>Summary</SectionHeading>
        <Text style={styles.body}>{cv.summary}</Text>

        {/* Skills */}
        <SectionHeading>Skills</SectionHeading>
        {cv.skillsGrouped.map((g, i) => (
          <View key={i} style={styles.skillRow}>
            <Text style={styles.skillGroup}>{g.group}:</Text>
            <Text style={styles.skillItems}>{g.items.join(", ")}</Text>
          </View>
        ))}

        {/* Experience */}
        <SectionHeading>Experience</SectionHeading>
        {cv.experience.map((role, i) => (
          <View key={i}>
            <View style={styles.roleHeader}>
              <Text style={styles.roleTitleCompany}>
                {role.title}
                <Text style={styles.roleCompanySep}>  |  {role.company}</Text>
              </Text>
            </View>
            <Text style={styles.roleDates}>
              {[role.dates, role.location].filter(Boolean).join("  |  ")}
            </Text>
            {role.context ? (
              <Text style={styles.roleContext}>{role.context}</Text>
            ) : null}
            {role.highlights.map((h, j) => (
              <Bullet key={j} text={h} />
            ))}
          </View>
        ))}

        {/* Education */}
        <SectionHeading>Education</SectionHeading>
        {cv.education.map((edu, i) => (
          <Text key={i} style={styles.eduLine}>
            {[edu.degree, edu.school, edu.year].filter(Boolean).join("  |  ")}
          </Text>
        ))}

        {/* Certifications */}
        {cv.certifications.length > 0 && (
          <>
            <SectionHeading>Certifications</SectionHeading>
            {cv.certifications.map((cert, i) => (
              <Text key={i} style={styles.certLine}>• {cert}</Text>
            ))}
          </>
        )}

        {/* Languages */}
        {cv.languages.length > 0 && (
          <>
            <SectionHeading>Languages</SectionHeading>
            <Text style={styles.certLine}>{cv.languages.join("  |  ")}</Text>
          </>
        )}
      </Page>
    </Document>
  );
}

export async function renderCvPdf(cv: CvStruct): Promise<Buffer> {
  const buffer = await renderToBuffer(<CvDocument cv={cv} />);
  return Buffer.from(buffer);
}
