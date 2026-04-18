"use client";

import { useState, useRef } from "react";
import { CopyButton } from "./CopyButton";
import type { LinkedinRewrites } from "@/db/schema";

interface OptimizerPanelProps {
  initial: {
    rewrites: LinkedinRewrites;
    createdAt: string;
  } | null;
}

function timeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  return `${diffDays} days ago`;
}

type SectionId = "headline" | "about" | `exp-${number}` | "skills";

function buildSections(rewrites: LinkedinRewrites): Array<{ id: SectionId; label: string; sublabel?: string }> {
  const sections: Array<{ id: SectionId; label: string; sublabel?: string }> = [
    { id: "headline", label: "Headline" },
    { id: "about", label: "About" },
    ...rewrites.experience.map((exp, i) => ({
      id: `exp-${i}` as SectionId,
      label: exp.company,
      sublabel: exp.role,
    })),
    { id: "skills", label: "Skills" },
  ];
  return sections;
}

export function OptimizerPanel({ initial }: OptimizerPanelProps) {
  const [rewrites, setRewrites] = useState<LinkedinRewrites | null>(initial?.rewrites ?? null);
  const [createdAt, setCreatedAt] = useState<string | null>(initial?.createdAt ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<SectionId>("headline");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      return;
    }
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("pdf", file);

    try {
      const res = await fetch("/api/linkedin/optimize", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Something went wrong.");
      } else {
        setRewrites(data.rewrites);
        setCreatedAt(new Date().toISOString());
        setActiveId("headline");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = "";
  }

  // Upload / loading state
  if (!rewrites || loading) {
    return (
      <div className="li-empty-wrap">
        {loading ? (
          <div className="li-loading-card">
            <div className="li-spinner" aria-hidden="true" />
            <p className="li-loading-title">Disha is reading your LinkedIn profile…</p>
            <p className="li-loading-sub">Usually takes 15–25 seconds.</p>
          </div>
        ) : (
          <div className="li-upload-card">
            <div className="li-upload-icon" aria-hidden="true">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <h3 className="li-upload-title">Optimise your LinkedIn profile</h3>
            <p className="li-upload-body">
              Upload your LinkedIn PDF export. Disha will rewrite your headline, about section,
              top roles, and skills list to improve recruiter discoverability in the NL market.
            </p>
            <label className="li-upload-btn">
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
              Upload PDF export
            </label>
            {error && <p className="li-error">{error}</p>}
          </div>
        )}
      </div>
    );
  }

  const sections = buildSections(rewrites);

  function renderContent() {
    if (activeId === "headline") {
      return (
        <div className="li-content-pane">
          <div className="li-content-eyebrow">Headline</div>
          <p className="li-content-headline">{rewrites!.headline.text}</p>
          <div className="li-content-actions">
            <CopyButton text={rewrites!.headline.text} />
          </div>
          <div className="li-reasoning-block">
            <span className="li-reasoning-label">Why this works</span>
            <p className="li-reasoning-text">{rewrites!.headline.reasoning}</p>
          </div>
        </div>
      );
    }

    if (activeId === "about") {
      return (
        <div className="li-content-pane">
          <div className="li-content-eyebrow">About</div>
          <p className="li-content-body">{rewrites!.about.text}</p>
          <div className="li-content-actions">
            <CopyButton text={rewrites!.about.text} />
          </div>
          <div className="li-reasoning-block">
            <span className="li-reasoning-label">Why this works</span>
            <p className="li-reasoning-text">{rewrites!.about.reasoning}</p>
          </div>
        </div>
      );
    }

    if (activeId === "skills") {
      return (
        <div className="li-content-pane">
          <div className="li-content-eyebrow">Skills</div>
          <p className="li-content-body">{rewrites!.skills.text}</p>
          <div className="li-content-actions">
            <CopyButton text={rewrites!.skills.text} />
          </div>
          <div className="li-reasoning-block">
            <span className="li-reasoning-label">Why this works</span>
            <p className="li-reasoning-text">{rewrites!.skills.reasoning}</p>
          </div>
        </div>
      );
    }

    if (activeId.startsWith("exp-")) {
      const idx = parseInt(activeId.replace("exp-", ""), 10);
      const exp = rewrites!.experience[idx];
      if (!exp) return null;
      return (
        <div className="li-content-pane">
          <div className="li-content-eyebrow">Experience</div>
          <div className="li-exp-header">
            <p className="li-exp-company">{exp.company}</p>
            <p className="li-exp-role">{exp.role}</p>
          </div>
          <ul className="li-bullets">
            {exp.bullets.map((bullet, j) => (
              <li key={j} className="li-bullet-row">
                <span className="li-bullet-dot" />
                <span className="li-bullet-text">{bullet}</span>
                <CopyButton text={bullet} />
              </li>
            ))}
          </ul>
          <div className="li-reasoning-block">
            <span className="li-reasoning-label">Why this works</span>
            <p className="li-reasoning-text">{exp.reasoning}</p>
          </div>
        </div>
      );
    }

    return null;
  }

  return (
    <div className="li-panel">
      {/* Left nav */}
      <nav className="li-nav" aria-label="LinkedIn sections">
        <div className="li-nav-meta">
          <span className="li-nav-timestamp">
            Optimised {createdAt ? timeAgo(createdAt) : "—"}
          </span>
          <button
            type="button"
            className="li-nav-reupload"
            onClick={() => fileInputRef.current?.click()}
          >
            Re-upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
        </div>

        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`li-nav-item${activeId === s.id ? " li-nav-item--active" : ""}`}
            onClick={() => setActiveId(s.id)}
          >
            <span className="li-nav-label">{s.label}</span>
            {s.sublabel && <span className="li-nav-sublabel">{s.sublabel}</span>}
          </button>
        ))}
      </nav>

      {/* Right content */}
      <main className="li-main">
        {error && <p className="li-error">{error}</p>}
        {renderContent()}
      </main>
    </div>
  );
}
