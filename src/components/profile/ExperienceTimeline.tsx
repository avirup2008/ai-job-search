"use client";

import { useState } from "react";

type Role = {
  company: string;
  title: string;
  dates: string;
  achievements: string[];
};

const VISIBLE_ROLES = 2;

function RoleItem({ role }: { role: Role }) {
  return (
    <div className="profile-timeline-content">
      <div className="profile-timeline-company">{role.company}</div>
      <div className="profile-timeline-role">{role.title}</div>
      <div className="profile-timeline-period">{role.dates}</div>
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
          <RoleItem role={r} />
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
