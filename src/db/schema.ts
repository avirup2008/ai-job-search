import {
  pgTable, uuid, text, timestamp, jsonb, integer, numeric,
  boolean, smallint, bigint, char, vector, uniqueIndex,
} from "drizzle-orm/pg-core";

export const profile = pgTable("profile", {
  id: uuid("id").primaryKey().defaultRandom(),
  fullName: text("full_name"),
  headline: text("headline"),
  contactEmail: text("contact_email"),
  phone: text("phone"),
  roles: jsonb("roles").$type<unknown>().notNull().default([]),
  achievements: jsonb("achievements").$type<unknown>().notNull().default([]),
  toolStack: jsonb("tool_stack").$type<unknown>().notNull().default({}),
  industries: jsonb("industries").$type<unknown>().notNull().default([]),
  stories: jsonb("stories").$type<unknown>().notNull().default([]),
  constraints: jsonb("constraints").$type<unknown>().notNull().default({}),
  preferences: jsonb("preferences").$type<unknown>().notNull().default({}),
  portfolioUrl: text("portfolio_url"),
  linkedinUrl: text("linkedin_url"),
  masterCvDocxUrl: text("master_cv_docx_url"),
  masterCvPdfUrl: text("master_cv_pdf_url"),
  profileEmbedding: vector("profile_embedding", { dimensions: 512 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text("updated_by").notNull().default("admin"),
});

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  domain: text("domain").unique(),
  name: text("name").notNull(),
  researchJson: jsonb("research_json").$type<unknown>(),
  refreshedAt: timestamp("refreshed_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    source: text("source").notNull(),
    sourceUrl: text("source_url").notNull(),
    sourceExternalId: text("source_external_id"),
    title: text("title").notNull(),
    jdText: text("jd_text").notNull(),
    jdEmbedding: vector("jd_embedding", { dimensions: 512 }),
    location: text("location"),
    dutchRequired: boolean("dutch_required").notNull().default(false),
    seniority: text("seniority"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }).defaultNow().notNull(),
    dedupeHash: text("dedupe_hash").notNull(),
    canonicalJobId: uuid("canonical_job_id"),
    fitScore: numeric("fit_score", { precision: 4, scale: 1 }),
    fitBreakdown: jsonb("fit_breakdown").$type<unknown>(),
    gapAnalysis: jsonb("gap_analysis").$type<unknown>(),
    tier: smallint("tier"),
    previousTier: smallint("previous_tier"),
    hardFilterReason: text("hard_filter_reason"),
  },
  (table) => ({
    uniqSource: uniqueIndex("jobs_source_external_id_unique").on(table.source, table.sourceExternalId),
  }),
);

export const applications = pgTable("applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }).notNull(),
  status: text("status").notNull().default("new"),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  lastEventAt: timestamp("last_event_at", { withTimezone: true }).defaultNow().notNull(),
  notes: text("notes"),
});

export const experiments = pgTable("experiments", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  hypothesis: text("hypothesis").notNull(),
  dimension: text("dimension").notNull(),
  stratum: jsonb("stratum").$type<unknown>(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  status: text("status").notNull().default("running"),
  winner: text("winner"),
  decisionAt: timestamp("decision_at", { withTimezone: true }),
});

export const variants = pgTable("variants", {
  id: uuid("id").primaryKey().defaultRandom(),
  experimentId: uuid("experiment_id").references(() => experiments.id, { onDelete: "cascade" }).notNull(),
  label: text("label").notNull(),
  spec: jsonb("spec").$type<unknown>().notNull(),
});

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "cascade" }).notNull(),
  kind: text("kind").notNull(),
  artifactType: text("artifact_type"),
  version: integer("version").notNull().default(1),
  /** @deprecated Use storageUrl + format instead. Kept for backward compat. Remove in next schema migration. */
  blobUrlDocx: text("blob_url_docx"),
  blobUrlPdf: text("blob_url_pdf"),
  storageUrl: text("storage_url"),
  format: text("format"),      // "docx" | "pdf" | "markdown" | "html"
  mimeType: text("mime_type"),
  renderKind: text("render_kind"), // "download" | "viewer" | "copy"
  publicSlug: text("public_slug").unique(),
  generatedByTier: smallint("generated_by_tier"),
  tokenCost: numeric("token_cost", { precision: 10, scale: 4 }),
  experimentId: uuid("experiment_id").references(() => experiments.id, { onDelete: "set null" }),
  variantId: uuid("variant_id").references(() => variants.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "cascade" }).notNull(),
  kind: text("kind").notNull(),
  payload: jsonb("payload").$type<unknown>(),
  at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
});

export const screeningAnswers = pgTable("screening_answers", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "cascade" }).notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  confidence: numeric("confidence", { precision: 3, scale: 2 }),
});

export const researchCache = pgTable("research_cache", {
  id: uuid("id").primaryKey().defaultRandom(),
  scopeKey: text("scope_key").unique().notNull(),
  content: jsonb("content").$type<unknown>().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const runs = pgTable("runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  status: text("status").notNull().default("running"),
  stageMetrics: jsonb("stage_metrics").$type<unknown>(),
  errorJson: jsonb("error_json").$type<unknown>(),
});

export const llmBudget = pgTable("llm_budget", {
  period: char("period", { length: 7 }).primaryKey(),
  eurSpent: numeric("eur_spent", { precision: 8, scale: 4 }).notNull().default("0"),
  tokensIn: bigint("tokens_in", { mode: "number" }).notNull().default(0),
  tokensOut: bigint("tokens_out", { mode: "number" }).notNull().default(0),
  requests: integer("requests").notNull().default(0),
  capEur: numeric("cap_eur", { precision: 6, scale: 2 }).notNull().default("20"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
