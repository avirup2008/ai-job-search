"use client";

import { useState, useTransition } from "react";
import { updateRoles } from "@/app/(app)/profile/actions";

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

function RoleEditItem({
  role,
  onChange,
  onRemove,
}: {
  role: Role;
  onChange: (updated: Role) => void;
  onRemove: () => void;
}) {
  return (
    <div className="profile-role-edit-block">
      <div className="profile-role-edit-row">
        <input
          className="profile-field-input"
          placeholder="Company"
          value={role.company}
          onChange={(e) => onChange({ ...role, company: e.target.value })}
        />
        <input
          className="profile-field-input profile-role-dates-input"
          placeholder="Dates (e.g. 2020–2024)"
          value={role.dates}
          onChange={(e) => onChange({ ...role, dates: e.target.value })}
        />
        <button
          type="button"
          className="profile-edu-remove-btn"
          onClick={onRemove}
          aria-label="Remove role"
        >
          ×
        </button>
      </div>
      <input
        className="profile-field-input"
        placeholder="Title / Role"
        value={role.title}
        onChange={(e) => onChange({ ...role, title: e.target.value })}
      />
    </div>
  );
}

export function ExperienceTimeline({ roles }: { roles: Role[] }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Role[]>(roles);
  const [showAll, setShowAll] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await updateRoles(draft);
      setEditing(false);
    });
  }

  function cancel() {
    setDraft(roles);
    setEditing(false);
  }

  function updateRole(i: number, updated: Role) {
    setDraft((prev) => prev.map((r, idx) => (idx === i ? updated : r)));
  }

  function removeRole(i: number) {
    setDraft((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addRole() {
    setDraft((prev) => [...prev, { company: "", title: "", dates: "", achievements: [] }]);
  }

  if (editing) {
    return (
      <div className="profile-timeline">
        <div className="profile-role-edit-list">
          {draft.map((r, i) => (
            <RoleEditItem
              key={i}
              role={r}
              onChange={(updated) => updateRole(i, updated)}
              onRemove={() => removeRole(i)}
            />
          ))}
          <button type="button" className="profile-edu-add-btn" onClick={addRole}>
            + Add role
          </button>
        </div>
        <div className="profile-edit-actions" style={{ marginTop: "16px" }}>
          <button type="button" className="profile-save-btn" onClick={save} disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </button>
          <button type="button" className="profile-cancel-btn" onClick={cancel} disabled={isPending}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

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

      <button
        type="button"
        className="profile-edit-inline-btn"
        style={{ marginTop: "12px" }}
        onClick={() => { setDraft(roles); setEditing(true); }}
      >
        Edit experience
      </button>
    </div>
  );
}
