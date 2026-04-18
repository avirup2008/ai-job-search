import { db, schema } from "@/db";
import "@/components/profile/profile.css";
import { count } from "drizzle-orm";
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
  return (
    (opts.toolCount > 0 ? 25 : 0) +
    (opts.achievementCount > 0 ? 25 : 0) +
    (opts.experienceYears > 0 ? 25 : 0) +
    (opts.hasLinkedin ? 25 : 0)
  );
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

  const metricAchievements = achievements.filter((a) => a.metric);

  const prefRows: Array<{ label: string; value: string }> = [];
  if (constraints.location) prefRows.push({ label: "Location", value: String(constraints.location) });
  if (constraints.workMode) prefRows.push({ label: "Work mode", value: String(constraints.workMode) });
  if (constraints.salaryFloor) prefRows.push({ label: "Salary", value: String(constraints.salaryFloor) });
  if (constraints.availability) prefRows.push({ label: "Available", value: String(constraints.availability) });
  if (preferences.dutchLevel) prefRows.push({ label: "Dutch", value: String(preferences.dutchLevel) });

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
            {Boolean(constraints.location) && (
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

          {/* Achievement metric cards + editable list */}
          <section className="profile-section">
            <h2 className="profile-section-title">Key achievements</h2>
            {metricAchievements.length > 0 && (
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
            )}
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

          {/* Search preferences */}
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
