"use client";

import { useState, useTransition } from "react";
import { updateHero } from "@/app/(app)/profile/actions";

type Props = {
  fullName: string | null;
  headline: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  profileStrength: number;
  initial: string;
};

export function EditableHero({ fullName, headline, linkedinUrl, portfolioUrl, profileStrength, initial }: Props) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(fullName ?? "");
  const [hl, setHl] = useState(headline ?? "");
  const [li, setLi] = useState(linkedinUrl ?? "");
  const [portfolio, setPortfolio] = useState(portfolioUrl ?? "");

  function save() {
    startTransition(async () => {
      await updateHero({ fullName: name, headline: hl, linkedinUrl: li, portfolioUrl: portfolio });
      setEditing(false);
    });
  }

  function cancel() {
    setName(fullName ?? "");
    setHl(headline ?? "");
    setLi(linkedinUrl ?? "");
    setPortfolio(portfolioUrl ?? "");
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="profile-hero profile-hero--editing">
        <div className="profile-hero-avatar" aria-hidden="true">{initial}</div>
        <div className="profile-hero-body" style={{ flex: 1 }}>
          <div className="profile-hero-edit-grid">
            <label className="profile-hero-field-label">Name</label>
            <input
              className="profile-hero-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Full name"
              disabled={isPending}
            />
            <label className="profile-hero-field-label">Headline</label>
            <input
              className="profile-hero-input"
              value={hl}
              onChange={e => setHl(e.target.value)}
              placeholder="e.g. Digital Marketing Lead | Growth & Demand Gen"
              disabled={isPending}
            />
            <label className="profile-hero-field-label">LinkedIn URL</label>
            <input
              className="profile-hero-input"
              value={li}
              onChange={e => setLi(e.target.value)}
              placeholder="https://linkedin.com/in/…"
              disabled={isPending}
            />
            <label className="profile-hero-field-label">Portfolio URL</label>
            <input
              className="profile-hero-input"
              value={portfolio}
              onChange={e => setPortfolio(e.target.value)}
              placeholder="https://…"
              disabled={isPending}
            />
          </div>
          <div className="profile-hero-edit-actions">
            <button type="button" className="btn btn-ghost" onClick={cancel} disabled={isPending}>Cancel</button>
            <button type="button" className="btn" onClick={save} disabled={isPending}>{isPending ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-hero">
      <div className="profile-hero-avatar" aria-hidden="true">{initial}</div>
      <div className="profile-hero-body">
        <div className="profile-hero-name">{fullName ?? "Unnamed"}</div>
        {headline && <div className="profile-hero-title">{headline}</div>}
        {(linkedinUrl || portfolioUrl) && (
          <div className="profile-hero-meta">
            {linkedinUrl && (
              <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" className="profile-hero-meta-link">
                LinkedIn ↗
              </a>
            )}
            {portfolioUrl && (
              <a href={portfolioUrl} target="_blank" rel="noopener noreferrer" className="profile-hero-meta-link">
                Portfolio ↗
              </a>
            )}
          </div>
        )}
      </div>
      <div className="profile-hero-right">
        <div className="profile-hero-score">{profileStrength}%</div>
        <div className="profile-hero-score-label">Profile strength</div>
        <button type="button" className="profile-hero-edit" onClick={() => setEditing(true)}>
          Edit profile
        </button>
      </div>
    </div>
  );
}
