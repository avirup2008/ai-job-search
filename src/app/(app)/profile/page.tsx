import { db, schema } from "@/db";
import "@/components/profile/profile.css";
import { EditableChipList } from "@/components/profile/EditableChipList";
import { EditableAchievements } from "@/components/profile/EditableAchievements";
import { addTool, removeTool, addAchievement, removeAchievement } from "./actions";

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
};

async function loadProfile() {
  const [row] = await db.select().from(schema.profile).limit(1);
  return row ?? null;
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

export default async function ProfilePage() {

  const row = await loadProfile();

  if (!row) {
    return (
      <>
        <header className="profile-header">
          <h1>Your profile</h1>
          <p className="profile-header-meta">No profile found. Run the seed script to get started.</p>
        </header>
      </>
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

  const prefRows: Array<{ label: string; value: string }> = [];
  if (constraints.location) prefRows.push({ label: "Location", value: String(constraints.location) });
  if (constraints.maxCommute) prefRows.push({ label: "Commute", value: String(constraints.maxCommute) });
  if (constraints.workMode) prefRows.push({ label: "Work mode", value: String(constraints.workMode) });
  if (constraints.salaryFloor) prefRows.push({ label: "Salary floor", value: String(constraints.salaryFloor) });
  if (constraints.visa) prefRows.push({ label: "Visa", value: String(constraints.visa) });
  if (constraints.availability) prefRows.push({ label: "Availability", value: String(constraints.availability) });
  if (preferences.dutchLevel) prefRows.push({ label: "Dutch level", value: String(preferences.dutchLevel) });
  if (preferences.industries) prefRows.push({ label: "Industries", value: Array.isArray(preferences.industries) ? (preferences.industries as string[]).join(", ") : String(preferences.industries) });
  if (preferences.companyStage) prefRows.push({ label: "Company stage", value: Array.isArray(preferences.companyStage) ? (preferences.companyStage as string[]).join(", ") : String(preferences.companyStage) });

  const dutchLevel = preferences.dutchLevel ? String(preferences.dutchLevel) : null;

  return (
    <>
      <header className="profile-header">
        <h1>Your profile</h1>
        <p className="profile-header-meta">
          This is what Disha knows about you. It powers every match score and generated document.
        </p>
      </header>

      {/* Identity card */}
      <div className="profile-identity">
        <div className="profile-avatar" aria-hidden="true">
          {initial(row.fullName)}
        </div>
        <div className="profile-identity-info">
          <div className="profile-identity-name">{row.fullName ?? "Unnamed"}</div>
          {row.headline && <div className="profile-identity-headline">{row.headline}</div>}
          <div className="profile-contact-links">
            {constraints.location ? <span>{String(constraints.location)}</span> : null}
            {row.linkedinUrl && (
              <a href={row.linkedinUrl} target="_blank" rel="noopener noreferrer">
                LinkedIn &#8599;
              </a>
            )}
            {row.portfolioUrl && (
              <a href={row.portfolioUrl} target="_blank" rel="noopener noreferrer">
                Portfolio &#8599;
              </a>
            )}
            {dutchLevel && <span>Dutch: {dutchLevel}</span>}
          </div>
        </div>
        <div className="profile-identity-edit">
          <button className="btn btn-ghost" disabled>Edit</button>
        </div>
      </div>

      <div className="profile-layout">
        {/* Main column */}
        <div>
          {/* Tools & Skills */}
          <section className="profile-section">
            <h2 className="profile-section-title">Tools &amp; skills</h2>
            <EditableChipList
              items={toolNames}
              primaryCount={3}
              addLabel="Add skill"
              placeholder="e.g. Figma"
              onAdd={addTool}
              onRemove={removeTool}
            />
          </section>

          {/* Key Achievements */}
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

          {/* Experience */}
          <section className="profile-section">
            <h2 className="profile-section-title">Experience</h2>
            <div className="profile-timeline">
              {roles.map((r, i) => (
                <div key={i} className="profile-timeline-item">
                  <div className="profile-timeline-line">
                    <span className="profile-timeline-dot" />
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
            </div>
          </section>
        </div>

        {/* Aside column */}
        <aside className="profile-aside">
          {/* Profile strength */}
          <div className="profile-aside-card">
            <h3>Profile strength</h3>
            <div className="profile-strength-rows">
              <div className="profile-strength-row">
                <span className="profile-strength-label">
                  <span className={`profile-strength-dot ${toolCount > 0 ? "profile-strength-dot-filled" : "profile-strength-dot-empty"}`} />
                  Tools
                </span>
                <span className="profile-strength-value">{toolCount}</span>
              </div>
              <div className="profile-strength-row">
                <span className="profile-strength-label">
                  <span className={`profile-strength-dot ${achievementCount > 0 ? "profile-strength-dot-filled" : "profile-strength-dot-empty"}`} />
                  Achievements
                </span>
                <span className="profile-strength-value">{achievementCount}</span>
              </div>
              <div className="profile-strength-row">
                <span className="profile-strength-label">
                  <span className={`profile-strength-dot ${experienceYears > 0 ? "profile-strength-dot-filled" : "profile-strength-dot-empty"}`} />
                  Experience
                </span>
                <span className="profile-strength-value">{experienceYears} yr{experienceYears !== 1 ? "s" : ""}</span>
              </div>
              <div className="profile-strength-row">
                <span className="profile-strength-label">
                  <span className="profile-strength-dot profile-strength-dot-empty" />
                  STAR stories
                </span>
                <span className="profile-strength-value">0</span>
              </div>
            </div>
            <div className="profile-tip">
              Adding 2-3 STAR stories would improve your screening Q&amp;A.
            </div>
          </div>

          {/* Search preferences */}
          <div className="profile-aside-card">
            <h3>Search preferences</h3>
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
              {prefRows.length === 0 && (
                <p className="profile-explainer" style={{ fontStyle: "italic" }}>No preferences set yet.</p>
              )}
            </div>
          </div>

          {/* Explainer */}
          <div className="profile-aside-card">
            <h3>How this affects matches</h3>
            <p className="profile-explainer">
              Your tools, experience, and preferences feed the match algorithm. Each role is scored against
              your profile on skills overlap, seniority alignment, industry fit, and constraint compatibility.
              The stronger your profile, the more accurate every match score and generated document becomes.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
