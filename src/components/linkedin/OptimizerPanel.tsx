"use client";

import { useState, useRef } from "react";
import { CopyButton } from "./CopyButton";
import type { LinkedinRewrites } from "@/db/schema";

interface OptimizerPanelProps {
  initial: {
    rewrites: LinkedinRewrites;
    createdAt: string; // ISO string
  } | null;
}

function timeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  return `${diffDays} days ago`;
}

export function OptimizerPanel({ initial }: OptimizerPanelProps) {
  const [rewrites, setRewrites] = useState<LinkedinRewrites | null>(initial?.rewrites ?? null);
  const [createdAt, setCreatedAt] = useState<string | null>(initial?.createdAt ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    // Reset input so re-uploading same file triggers onChange
    e.target.value = "";
  }

  // Loaded state
  if (rewrites && !loading) {
    return (
      <div className="linkedin-panel">
        <div className="linkedin-panel-meta">
          <span className="linkedin-last-optimised">
            Last optimised {createdAt ? timeAgo(createdAt) : "—"}
          </span>
          <button
            type="button"
            className="linkedin-reupload-btn"
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

        {error && <p className="linkedin-error">{error}</p>}

        {/* Headline */}
        <section className="linkedin-section">
          <div className="linkedin-section-header">
            <h3 className="linkedin-section-title">Headline</h3>
          </div>
          <div className="linkedin-rewrite-row">
            <p className="linkedin-rewrite-text">{rewrites.headline.text}</p>
            <CopyButton text={rewrites.headline.text} />
          </div>
          <p className="linkedin-reasoning">{rewrites.headline.reasoning}</p>
        </section>

        {/* About */}
        <section className="linkedin-section">
          <div className="linkedin-section-header">
            <h3 className="linkedin-section-title">About</h3>
          </div>
          <div className="linkedin-rewrite-row linkedin-rewrite-row--block">
            <p className="linkedin-rewrite-text">{rewrites.about.text}</p>
            <CopyButton text={rewrites.about.text} />
          </div>
          <p className="linkedin-reasoning">{rewrites.about.reasoning}</p>
        </section>

        {/* Experience */}
        {rewrites.experience.map((exp, i) => (
          <section key={i} className="linkedin-section">
            <div className="linkedin-section-header">
              <h3 className="linkedin-section-title">Experience</h3>
              <p className="linkedin-company-label">{exp.company}</p>
              <p className="linkedin-role-label">{exp.role}</p>
            </div>
            <ul className="linkedin-bullets">
              {exp.bullets.map((bullet, j) => (
                <li key={j} className="linkedin-bullet-row">
                  <span className="linkedin-bullet-text">{bullet}</span>
                  <CopyButton text={bullet} />
                </li>
              ))}
            </ul>
            <p className="linkedin-reasoning">{exp.reasoning}</p>
          </section>
        ))}

        {/* Skills */}
        <section className="linkedin-section">
          <div className="linkedin-section-header">
            <h3 className="linkedin-section-title">Skills</h3>
          </div>
          <div className="linkedin-rewrite-row linkedin-rewrite-row--block">
            <p className="linkedin-rewrite-text">{rewrites.skills.text}</p>
            <CopyButton text={rewrites.skills.text} />
          </div>
          <p className="linkedin-reasoning">{rewrites.skills.reasoning}</p>
        </section>
      </div>
    );
  }

  // Upload state (no rewrites, or loading)
  return (
    <div className="linkedin-panel linkedin-panel--upload">
      {loading ? (
        <div className="linkedin-loading">
          <div className="linkedin-spinner" aria-hidden="true" />
          <p className="linkedin-loading-text">Disha is reading your profile…</p>
          <p className="linkedin-loading-sub">Usually takes 15–25 seconds.</p>
        </div>
      ) : (
        <>
          <p className="linkedin-upload-prompt">
            Upload your LinkedIn PDF export to get Disha&apos;s suggestions.
          </p>
          <label className="linkedin-upload-label">
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              className="linkedin-upload-input"
              disabled={loading}
            />
            <span className="linkedin-upload-btn">Upload PDF</span>
          </label>
          <p className="linkedin-upload-hint">
            Disha will rewrite your headline, about section, top 3 roles,
            and skills list for recruiter discoverability in the NL market.
          </p>
          {error && <p className="linkedin-error">{error}</p>}
        </>
      )}
    </div>
  );
}
