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
  const hiddenRoles = roles.slice(ALWAYS_VISIBLE);

  const hiddenLabel =
    hiddenRoles.length > 0
      ? hiddenRoles
          .map((r) => {
            const years = r.dates.match(/\d{4}/g);
            const span =
              years && years.length >= 2
                ? `${years[0]}–${years[years.length - 1]}`
                : r.dates;
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

      {hiddenRoles.length > 0 && (
        <button
          className="profile-timeline-more"
          onClick={() => setShowAll((prev) => !prev)}
          type="button"
        >
          {showAll
            ? "↑ Hide earlier roles"
            : `↓ Show ${hiddenRoles.length} earlier role${hiddenRoles.length !== 1 ? "s" : ""} — ${hiddenLabel}`}
        </button>
      )}
    </div>
  );
}
