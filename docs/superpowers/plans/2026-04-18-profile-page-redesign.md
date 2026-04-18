# Profile Page Visual Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the `/profile` page with a dark-green hero card, two-column editorial layout, collapsible experience timeline, achievement metric cards, and a live pipeline sidebar.

**Architecture:** Three files change. `ExperienceTimeline.tsx` is a new `"use client"` component (toggle state only — no data fetching). `profile.css` gets new classes appended. `page.tsx` gets restructured JSX plus one new DB query for pipeline counts. No schema changes, no new server actions, no new API routes.

**Tech Stack:** Next.js 15 App Router, React 19, Drizzle ORM + Neon, CSS custom properties (`var(--accent)`, `var(--surface)`, etc.)

---

### Task 1: Add new CSS classes to profile.css

**Files:**
- Modify: `src/components/profile/profile.css` (append at end of file)

Context: The existing file is ~825 lines. Append all new classes after the last line. Do not modify existing classes — only add.

- [ ] **Step 1: Append all new CSS at the end of profile.css**

Open `src/components/profile/profile.css` and append exactly this block at the very end:

```css

/* ── Hero card ─────────────────────────────────────────────── */
.profile-hero {
  background: #1D4A35;
  border-radius: var(--r-xl);
  padding: 28px 32px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 20px;
  align-items: center;
  margin-bottom: var(--s-8);
}
.profile-hero-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
  border: 2px solid rgba(255, 255, 255, 0.2);
  display: grid;
  place-items: center;
  color: #fff;
  font-family: var(--font-display);
  font-style: italic;
  font-size: 26px;
  letter-spacing: -0.02em;
  flex-shrink: 0;
}
.profile-hero-body {
  min-width: 0;
}
.profile-hero-name {
  font-weight: 700;
  font-size: 20px;
  color: #fff;
  letter-spacing: -0.4px;
  margin-bottom: 3px;
}
.profile-hero-title {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.65);
  margin-bottom: 10px;
}
.profile-hero-meta {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  align-items: center;
}
.profile-hero-meta-item {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}
.profile-hero-meta-link {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 500;
  text-decoration: none;
}
.profile-hero-meta-link:hover { color: #fff; }
.profile-hero-right {
  text-align: right;
  flex-shrink: 0;
}
.profile-hero-score {
  font-size: 32px;
  font-weight: 700;
  color: #fff;
  line-height: 1;
}
.profile-hero-score-label {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.45);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-top: 3px;
}
.profile-hero-edit {
  display: inline-block;
  margin-top: 12px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  font-size: 11px;
  font-weight: 500;
  padding: 6px 14px;
  border-radius: var(--r-md);
  cursor: pointer;
  font-family: var(--font-body);
  transition: background var(--dur-150) var(--ease-io);
}
.profile-hero-edit:hover { background: rgba(255, 255, 255, 0.2); }
@media (max-width: 900px) {
  .profile-hero {
    grid-template-columns: auto 1fr;
    gap: 14px;
    padding: 20px 22px;
  }
  .profile-hero-right { display: none; }
  .profile-hero-name { font-size: 17px; }
  .profile-hero-avatar { width: 48px; height: 48px; font-size: 20px; }
}

/* ── Timeline — current-role dot + show-more button ─────────── */
.profile-timeline-dot--current {
  background: var(--accent) !important;
}
.profile-timeline-more {
  background: none;
  border: none;
  padding: 8px 0 0 0;
  font-size: 12px;
  color: var(--accent);
  font-weight: 500;
  cursor: pointer;
  font-family: var(--font-body);
  display: block;
  margin-left: 0;
}
.profile-timeline-more:hover { text-decoration: underline; }

/* ── Achievement metric cards ────────────────────────────────── */
.profile-metric-grid {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
  margin-bottom: var(--s-4);
}
.profile-metric-card {
  background: var(--accent-wash);
  border: 1px solid var(--accent-a15);
  border-radius: var(--r-md);
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 16px;
}
.profile-metric-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--accent);
  min-width: 58px;
  flex-shrink: 0;
  line-height: 1;
}
.profile-metric-body {
  min-width: 0;
}
.profile-metric-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
  margin-bottom: 2px;
}
.profile-metric-context {
  font-size: 11px;
  color: var(--text-2);
}

/* ── Education + certifications card ─────────────────────────── */
.profile-education-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 16px 20px;
  margin-bottom: var(--s-8);
}
.profile-education-divider {
  height: 1px;
  background: var(--border);
  margin: 12px 0;
}
.profile-edu-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 8px;
}
.profile-edu-degree {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}
.profile-edu-institution {
  font-size: 11px;
  color: var(--text-2);
  margin-top: 1px;
}
.profile-edu-year {
  font-size: 11px;
  color: var(--text-3);
  flex-shrink: 0;
}
.profile-cert-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

/* ── Sidebar — skill tags ────────────────────────────────────── */
.profile-skill-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* ── Sidebar — pipeline snapshot ─────────────────────────────── */
.profile-pipeline-rows {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.profile-pipeline-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}
.profile-pipeline-stage {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-2);
}
.profile-pipeline-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  flex-shrink: 0;
}
.profile-pipeline-count {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}
.profile-pipeline-divider {
  height: 1px;
  background: var(--border);
  margin: 8px 0;
}
.profile-pipeline-avg {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-2);
  padding-top: 2px;
}
.profile-pipeline-avg-value {
  font-weight: 600;
  color: var(--accent);
}

/* ── Sidebar — next action nudge ─────────────────────────────── */
.profile-next-action {
  background: var(--accent-wash);
  border: 1px solid var(--accent-a15);
  border-radius: var(--r-lg);
  padding: 14px 18px;
}
.profile-next-action-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 5px;
}
.profile-next-action-text {
  font-size: 12px;
  color: #3D6B55;
  line-height: 1.5;
}
```

- [ ] **Step 2: Verify file saved, no syntax errors — run TypeScript check**

```bash
cd /Users/avi/Downloads/Claude/Code/AI\ Job\ Search && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors (CSS isn't type-checked, but this confirms the TS pipeline is still clean).

- [ ] **Step 3: Commit**

```bash
cd /Users/avi/Downloads/Claude/Code/AI\ Job\ Search
git add src/components/profile/profile.css
git commit -m "style(profile): add hero, metric-card, pipeline, education, next-action CSS classes

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Create ExperienceTimeline client component

**Files:**
- Create: `src/components/profile/ExperienceTimeline.tsx`

Context: The existing page renders the timeline as raw JSX. This new client component wraps that in a toggle to show/hide older roles. The `Role` type matches what `page.tsx` already uses. Existing CSS classes are reused — `.profile-timeline`, `.profile-timeline-item`, `.profile-timeline-dot`, `.profile-timeline-connector`, `.profile-timeline-company`, `.profile-timeline-role`, `.profile-timeline-period`, `.profile-timeline-highlights`. New classes from Task 1: `.profile-timeline-dot--current`, `.profile-timeline-more`.

- [ ] **Step 1: Create the component file**

Create `src/components/profile/ExperienceTimeline.tsx` with this content:

```tsx
"use client";

import { useState } from "react";

type Role = {
  company: string;
  title: string;
  dates: string;
  achievements: string[];
};

const ALWAYS_VISIBLE = 2;

export function ExperienceTimeline({ roles }: { roles: Role[] }) {
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? roles : roles.slice(0, ALWAYS_VISIBLE);
  const hiddenCount = Math.max(0, roles.length - ALWAYS_VISIBLE);
  const hiddenRoles = roles.slice(ALWAYS_VISIBLE);

  // Build label like "British Council India (2015–2021)"
  const hiddenLabel =
    hiddenCount > 0
      ? hiddenRoles
          .map((r) => {
            const years = r.dates.match(/\d{4}/g);
            const span = years && years.length >= 2 ? `${years[0]}–${years[years.length - 1]}` : r.dates;
            return `${r.company} ${span}`;
          })
          .join(", ")
      : "";

  return (
    <div className="profile-timeline">
      {visible.map((r, i) => (
        <div key={i} className="profile-timeline-item">
          <div className="profile-timeline-line">
            <span
              className={`profile-timeline-dot${i === 0 ? " profile-timeline-dot--current" : ""}`}
            />
            <span className="profile-timeline-connector" />
          </div>
          <div className="profile-timeline-content">
            <div className="profile-timeline-company">{r.company}</div>
            <div className="profile-timeline-role">{r.title}</div>
            <div className="profile-timeline-period">{r.dates}</div>
            {r.achievements?.length > 0 && (
              <ul className="profile-timeline-highlights">
                {r.achievements.map((a, j) => (
                  <li key={j}>{a}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ))}

      {hiddenCount > 0 && (
        <button
          className="profile-timeline-more"
          onClick={() => setShowAll((prev) => !prev)}
          type="button"
        >
          {showAll
            ? "↑ Hide earlier roles"
            : `↓ Show ${hiddenCount} earlier role${hiddenCount !== 1 ? "s" : ""} — ${hiddenLabel}`}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd /Users/avi/Downloads/Claude/Code/AI\ Job\ Search && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/avi/Downloads/Claude/Code/AI\ Job\ Search
git add src/components/profile/ExperienceTimeline.tsx
git commit -m "feat(profile): ExperienceTimeline client component with show/hide toggle

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Restructure page.tsx

**Files:**
- Modify: `src/app/(app)/profile/page.tsx`

Context: Full replacement of the returned JSX for the profile tab. The LinkedIn tab branch and the no-profile branch are untouched. Key changes:
1. Add import for `ExperienceTimeline`, `count`, and `eq` from drizzle
2. Add pipeline counts DB query
3. Compute `profileStrength` percentage
4. Replace `.profile-identity` div with `.profile-hero`
5. Reorder left column: Experience (ExperienceTimeline) → Metric cards → Education
6. Replace aside with: Skills (EditableChipList) → Pipeline → Next action → Search prefs (trimmed)

- [ ] **Step 1: Replace the full page.tsx with the restructured version**

Replace the entire content of `src/app/(app)/profile/page.tsx` with:

```tsx
import { db, schema } from "@/db";
import "@/components/profile/profile.css";
import { count, eq } from "drizzle-orm";
import { EditableChipList } from "@/components/profile/EditableChipList";
import { EditableAchievements } from "@/components/profile/EditableAchievements";
import { ExperienceTimeline } from "@/components/profile/ExperienceTimeline";
import { addTool, removeTool, addAchievement, removeAchievement } from "./actions";
import LinkedinPage from "./linkedin/page";

export const dynamic = "force-dynamic";

type Role = {
  company: string;
  title: string;
  dates: string;
  achievements: string[];
};

type Achievement = {
  description: string;
  metric?: string;
  context?: string;
};

async function loadProfile() {
  const [row] = await db.select().from(schema.profile).limit(1);
  return row ?? null;
}

async function loadPipeline() {
  const rows = await db
    .select({ status: schema.applications.status, n: count() })
    .from(schema.applications)
    .groupBy(schema.applications.status);

  const pipeline = { applied: 0, screening: 0, interview: 0 };
  for (const r of rows) {
    if (r.status === "applied") pipeline.applied = Number(r.n);
    if (r.status === "screening") pipeline.screening = Number(r.n);
    if (r.status === "interview") pipeline.interview = Number(r.n);
  }
  return pipeline;
}

function initial(name: string | null): string {
  if (!name) return "?";
  return name.trim().charAt(0).toUpperCase();
}

function yearsFromRoles(roles: Role[]): number {
  if (!roles.length) return 0;
  let total = 0;
  for (const r of roles) {
    const m = r.dates?.match(/(\d{4})/g);
    if (m && m.length >= 2) {
      total += Number(m[m.length - 1]) - Number(m[0]);
    } else if (m && m.length === 1) {
      total += new Date().getFullYear() - Number(m[0]);
    }
  }
  return Math.max(total, 0);
}

function computeStrength(opts: {
  toolCount: number;
  achievementCount: number;
  experienceYears: number;
  hasLinkedin: boolean;
}): number {
  const score =
    (opts.toolCount > 0 ? 25 : 0) +
    (opts.achievementCount > 0 ? 25 : 0) +
    (opts.experienceYears > 0 ? 25 : 0) +
    (opts.hasLinkedin ? 25 : 0);
  return score;
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const activeTab = params.tab === "linkedin" ? "linkedin" : "profile";

  if (activeTab === "linkedin") {
    return (
      <div className="profile-page">
        <header className="profile-header">
          <h1>Your profile</h1>
          <nav className="profile-tabs" aria-label="Profile sections">
            <a href="/profile" className="profile-tab">
              Your profile
            </a>
            <a href="/profile?tab=linkedin" className="profile-tab profile-tab--active">
              LinkedIn
            </a>
          </nav>
        </header>
        <LinkedinPage />
      </div>
    );
  }

  const [row, pipeline] = await Promise.all([loadProfile(), loadPipeline()]);

  if (!row) {
    return (
      <div className="profile-page">
        <header className="profile-header">
          <h1>Your profile</h1>
          <nav className="profile-tabs" aria-label="Profile sections">
            <a href="/profile" className="profile-tab profile-tab--active">
              Your profile
            </a>
            <a href="/profile?tab=linkedin" className="profile-tab">
              LinkedIn
            </a>
          </nav>
          <p className="profile-header-meta">No profile found. Run the seed script to get started.</p>
        </header>
      </div>
    );
  }

  const roles = (row.roles ?? []) as Role[];
  const achievements = (row.achievements ?? []) as Achievement[];
  const toolStack = (row.toolStack ?? {}) as Record<string, string>;
  const constraints = (row.constraints ?? {}) as Record<string, unknown>;
  const preferences = (row.preferences ?? {}) as Record<string, unknown>;
  const toolNames = Object.keys(toolStack);

  const experienceYears = yearsFromRoles(roles);
  const toolCount = toolNames.length;
  const achievementCount = achievements.length;
  const dutchLevel = preferences.dutchLevel ? String(preferences.dutchLevel) : null;

  const profileStrength = computeStrength({
    toolCount,
    achievementCount,
    experienceYears,
    hasLinkedin: Boolean(row.linkedinUrl),
  });

  // Metric achievements — those with a `metric` field
  const metricAchievements = achievements.filter((a) => a.metric);

  // Search prefs — trimmed to 5 rows
  const prefRows: Array<{ label: string; value: string }> = [];
  if (constraints.location) prefRows.push({ label: "Location", value: String(constraints.location) });
  if (constraints.workMode) prefRows.push({ label: "Work mode", value: String(constraints.workMode) });
  if (constraints.salaryFloor) prefRows.push({ label: "Salary", value: String(constraints.salaryFloor) });
  if (constraints.availability) prefRows.push({ label: "Available", value: String(constraints.availability) });
  if (preferences.dutchLevel) prefRows.push({ label: "Dutch", value: String(preferences.dutchLevel) });

  // Next action text
  const nextActionText =
    pipeline.interview > 0
      ? `Prepare for your ${pipeline.interview} upcoming interview${pipeline.interview !== 1 ? "s" : ""} — review your weak-points card in the job detail.`
      : "No interviews scheduled yet — keep applying.";

  return (
    <>
      <header className="profile-header">
        <h1>Your profile</h1>
        <nav className="profile-tabs" aria-label="Profile sections">
          <a href="/profile" className="profile-tab profile-tab--active">
            Your profile
          </a>
          <a href="/profile?tab=linkedin" className="profile-tab">
            LinkedIn
          </a>
        </nav>
        <p className="profile-header-meta">
          This is what Disha knows about you. It powers every match score and generated document.
        </p>
      </header>

      {/* Hero card */}
      <div className="profile-hero">
        <div className="profile-hero-avatar" aria-hidden="true">
          {initial(row.fullName)}
        </div>
        <div className="profile-hero-body">
          <div className="profile-hero-name">{row.fullName ?? "Unnamed"}</div>
          {row.headline && <div className="profile-hero-title">{row.headline}</div>}
          <div className="profile-hero-meta">
            {constraints.location && (
              <span className="profile-hero-meta-item">📍 {String(constraints.location)}</span>
            )}
            {dutchLevel && (
              <span className="profile-hero-meta-item">🇳🇱 {dutchLevel}</span>
            )}
            {row.linkedinUrl && (
              <a
                href={row.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="profile-hero-meta-link"
              >
                🔗 LinkedIn ↗
              </a>
            )}
            {row.portfolioUrl && (
              <a
                href={row.portfolioUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="profile-hero-meta-link"
              >
                🌐 Portfolio ↗
              </a>
            )}
          </div>
        </div>
        <div className="profile-hero-right">
          <div className="profile-hero-score">{profileStrength}%</div>
          <div className="profile-hero-score-label">Profile strength</div>
          <button className="profile-hero-edit" disabled>
            Edit profile
          </button>
        </div>
      </div>

      <div className="profile-layout">
        {/* Left column */}
        <div>
          {/* Experience */}
          <section className="profile-section">
            <h2 className="profile-section-title">Experience</h2>
            <ExperienceTimeline roles={roles} />
          </section>

          {/* Achievement metric cards */}
          {metricAchievements.length > 0 && (
            <section className="profile-section">
              <h2 className="profile-section-title">Key achievements</h2>
              <div className="profile-metric-grid">
                {metricAchievements.map((a, i) => (
                  <div key={i} className="profile-metric-card">
                    <div className="profile-metric-value">{a.metric}</div>
                    <div className="profile-metric-body">
                      <div className="profile-metric-title">{a.description}</div>
                      {a.context && (
                        <div className="profile-metric-context">{a.context}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <EditableAchievements
                items={achievements.map((a) =>
                  typeof a === "string"
                    ? { description: a }
                    : { description: a.description, metric: a.metric },
                )}
                onAdd={addAchievement}
                onRemove={removeAchievement}
              />
            </section>
          )}

          {metricAchievements.length === 0 && (
            <section className="profile-section">
              <h2 className="profile-section-title">Key achievements</h2>
              <EditableAchievements
                items={achievements.map((a) =>
                  typeof a === "string"
                    ? { description: a }
                    : { description: a.description, metric: a.metric },
                )}
                onAdd={addAchievement}
                onRemove={removeAchievement}
              />
            </section>
          )}

          {/* Education + certifications */}
          <div className="profile-education-card">
            <h2 className="profile-section-title" style={{ marginBottom: "12px" }}>Education</h2>
            <div className="profile-edu-row">
              <div>
                <div className="profile-edu-degree">MA Political Science</div>
                <div className="profile-edu-institution">University of Delhi</div>
              </div>
              <div className="profile-edu-year">2012</div>
            </div>
            <div className="profile-edu-row">
              <div>
                <div className="profile-edu-degree">BA Political Science (Hons)</div>
                <div className="profile-edu-institution">University of Delhi</div>
              </div>
              <div className="profile-edu-year">2010</div>
            </div>
            <div className="profile-education-divider" />
            <h2 className="profile-section-title" style={{ marginBottom: "10px" }}>Certifications</h2>
            <div className="profile-cert-chips">
              <span className="profile-chip">HubSpot Marketing Hub</span>
              <span className="profile-chip">Google Ads — in progress</span>
              <span className="profile-chip">Meta Blueprint</span>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <aside className="profile-aside">
          {/* Skills */}
          <div className="profile-aside-card">
            <h3 className="profile-section-title">Skills</h3>
            <div className="profile-skill-tags">
              <EditableChipList
                items={toolNames}
                primaryCount={3}
                addLabel="Add skill"
                placeholder="e.g. Figma"
                onAdd={addTool}
                onRemove={removeTool}
              />
            </div>
          </div>

          {/* Pipeline snapshot */}
          <div className="profile-aside-card">
            <h3 className="profile-section-title">Active pipeline</h3>
            <div className="profile-pipeline-rows">
              <div className="profile-pipeline-row">
                <div className="profile-pipeline-stage">
                  <span className="profile-pipeline-dot" style={{ background: "var(--text-3)" }} />
                  Applied
                </div>
                <span className="profile-pipeline-count">{pipeline.applied}</span>
              </div>
              <div className="profile-pipeline-row">
                <div className="profile-pipeline-stage">
                  <span className="profile-pipeline-dot" style={{ background: "#D4A84B" }} />
                  Screening
                </div>
                <span className="profile-pipeline-count">{pipeline.screening}</span>
              </div>
              <div className="profile-pipeline-row">
                <div className="profile-pipeline-stage">
                  <span className="profile-pipeline-dot" style={{ background: "var(--accent)" }} />
                  Interview
                </div>
                <span className="profile-pipeline-count">{pipeline.interview}</span>
              </div>
            </div>
            <div className="profile-pipeline-divider" />
            <div className="profile-pipeline-avg">
              <span>Avg. fit score</span>
              <span className="profile-pipeline-avg-value">—</span>
            </div>
          </div>

          {/* Next action */}
          <div className="profile-next-action">
            <div className="profile-next-action-label">Next action</div>
            <div className="profile-next-action-text">{nextActionText}</div>
          </div>

          {/* Search preferences (trimmed) */}
          {prefRows.length > 0 && (
            <div className="profile-aside-card">
              <h3 className="profile-section-title">Search preferences</h3>
              <div className="profile-prefs">
                {prefRows.map((p) => (
                  <div key={p.label} className="profile-pref-row">
                    <span className="profile-pref-label">{p.label}</span>
                    <span>
                      <span className="profile-pref-value">{p.value}</span>
                      <span className="profile-pref-edit">edit</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd /Users/avi/Downloads/Claude/Code/AI\ Job\ Search && npx tsc --noEmit 2>&1
```

Expected: No errors. If there are errors, they will be type mismatches in the new code — fix them before committing.

- [ ] **Step 3: Start the dev server and verify the profile page renders**

```bash
cd /Users/avi/Downloads/Claude/Code/AI\ Job\ Search && npm run dev
```

Navigate to `http://localhost:3000/profile` and verify:
- Hero card shows with dark green background, white name/title/meta
- Two-column layout (experience left, sidebar right)
- Timeline shows top 2 roles; "Show N earlier roles" button appears if there are more
- Achievement metric cards appear below experience (green `€1.29`, `43→90`, etc.)
- Education card appears below achievements
- Sidebar shows skills chips, pipeline counts, next-action nudge, and search prefs
- No JS console errors

- [ ] **Step 4: Commit**

```bash
cd /Users/avi/Downloads/Claude/Code/AI\ Job\ Search
git add src/app/\(app\)/profile/page.tsx
git commit -m "feat(profile): visual overhaul — dark hero, two-column, collapsible timeline, pipeline sidebar

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

- [ ] **Step 5: Push to origin**

```bash
cd /Users/avi/Downloads/Claude/Code/AI\ Job\ Search && git push origin main
```

Expected: Push succeeds. Vercel auto-deploys.

---

## Post-Execution Checklist

After all tasks complete, verify on the live page:

- [ ] Hero: dark green fill, white text, profile strength %, edit button visible
- [ ] Experience: top 2 roles visible, toggle button shows if >2 roles exist, hidden roles appear on click
- [ ] Metric cards: show only achievements with a `metric` field; editable list below them
- [ ] Education: static card with two degree rows + 3 cert chips
- [ ] Sidebar skills: chip list with green primary chips + muted secondary chips
- [ ] Pipeline: correct counts from DB (applied / screening / interview)
- [ ] Next action: interview-aware message
- [ ] Search prefs: max 5 rows, no commute or explainer card
- [ ] LinkedIn tab still works (`/profile?tab=linkedin`)
- [ ] Responsive: at 900px width, sidebar stacks below main column
