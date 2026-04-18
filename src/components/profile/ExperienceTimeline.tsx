"use client";

import { useState } from "react";

type Role = {
  company: string;
  title: string;
  dates: string;
  achievements: string[];
};

const VISIBLE_ROLES = 2;
const VISIBLE_BULLETS = 3;

function RoleItem({ role, isCurrent }: { role: Role; isCurrent: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const bullets = role.achievements ?? [];
  const shown = expanded ? bullets : bullets.slice(0, VISIBLE_BULLETS);
  const hidden = bullets.length - VISIBLE_BULLETS;

  return (
    <div className="profile-timeline-content">
      <div className="profile-timeline-company">{role.company}</div>
      <div className="profile-timeline-role">{role.title}</div>
      <div className="profile-timeline-period">{role.dates}</div>
      {bullets.length > 0 && (
        <>
          <ul className="profile-timeline-highlights">
            {shown.map((a, j) => <li key={j}>{a}</li>)}
          </ul>
          {hidden > 0 && (
            <button
              className="profile-timeline-more"
              type="button"
              onClick={() => setExpanded((p) => !p)}
            >
              {expanded ? "↑ Show less" : `↓ ${hidden} more bullet${hidden !== 1 ? "s" : ""}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function ExperienceTimeline({ roles }: { roles: Role[] }) {
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? roles : roles.slice(0, VISIBLE_ROLES);
  const hiddenRoles = roles.slice(VISIBLE_ROLES);
  const hiddenLabel = hiddenRoles
    .map((r) => {
      const years = r.dates.match(/\d{4}/g);
      const span = years && years.length >= 2 ? `${years[0]}–${years[years.length - 1]}` : r.dates;
      return `${r.company} ${span}`;
    })
    .join(", ");

  return (
    <div className="profile-timeline">
      {visible.map((r, i) => (
        <div key={i} className="profile-timeline-item">
          <div className="profile-timeline-line">
            <span className={`profile-timeline-dot${i === 0 ? " profile-timeline-dot--current" : ""}`} />
            <span className="profile-timeline-connector" />
          </div>
          <RoleItem role={r} isCurrent={i === 0} />
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
