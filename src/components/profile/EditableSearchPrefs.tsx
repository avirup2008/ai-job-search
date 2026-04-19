"use client";

import { useState, useTransition } from "react";
import { updateSearchPrefs } from "@/app/(app)/profile/actions";

type Props = {
  location: string;
  workMode: string;
  salaryFloor: string;
  availability: string;
  dutchLevel: string;
};

const WORK_MODE_OPTIONS = ["Remote", "Hybrid", "On-site", "Flexible"];
const DUTCH_LEVEL_OPTIONS = ["None", "A1", "A2", "B1", "B2", "C1", "C2", "Native"];

export function EditableSearchPrefs(props: Props) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [location, setLocation] = useState(props.location);
  const [workMode, setWorkMode] = useState(props.workMode);
  const [salaryFloor, setSalaryFloor] = useState(props.salaryFloor);
  const [availability, setAvailability] = useState(props.availability);
  const [dutchLevel, setDutchLevel] = useState(props.dutchLevel);

  function save() {
    startTransition(async () => {
      await updateSearchPrefs({ location, workMode, salaryFloor, availability, dutchLevel });
      setEditing(false);
    });
  }

  function cancel() {
    setLocation(props.location);
    setWorkMode(props.workMode);
    setSalaryFloor(props.salaryFloor);
    setAvailability(props.availability);
    setDutchLevel(props.dutchLevel);
    setEditing(false);
  }

  const hasAny = location || workMode || salaryFloor || availability || dutchLevel;

  if (editing) {
    return (
      <div className="profile-aside-card">
        <div className="profile-section-header">
          <h3 className="profile-section-title">Search preferences</h3>
        </div>
        <div className="profile-prefs-edit">
          <label className="profile-pref-edit-label">Location</label>
          <input className="profile-pref-input" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Amsterdam" disabled={isPending} />

          <label className="profile-pref-edit-label">Work mode</label>
          <select className="profile-pref-input" value={workMode} onChange={e => setWorkMode(e.target.value)} disabled={isPending}>
            <option value="">— not set —</option>
            {WORK_MODE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>

          <label className="profile-pref-edit-label">Salary floor</label>
          <input className="profile-pref-input" value={salaryFloor} onChange={e => setSalaryFloor(e.target.value)} placeholder="e.g. €60,000" disabled={isPending} />

          <label className="profile-pref-edit-label">Available from</label>
          <input className="profile-pref-input" value={availability} onChange={e => setAvailability(e.target.value)} placeholder="e.g. Immediately" disabled={isPending} />

          <label className="profile-pref-edit-label">Dutch level</label>
          <select className="profile-pref-input" value={dutchLevel} onChange={e => setDutchLevel(e.target.value)} disabled={isPending}>
            <option value="">— not set —</option>
            {DUTCH_LEVEL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="profile-pref-actions">
          <button type="button" className="btn btn-ghost" onClick={cancel} disabled={isPending}>Cancel</button>
          <button type="button" className="btn" onClick={save} disabled={isPending}>{isPending ? "Saving…" : "Save"}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-aside-card">
      <div className="profile-section-header">
        <h3 className="profile-section-title">Search preferences</h3>
        <button type="button" className="profile-pref-edit-btn" onClick={() => setEditing(true)}>Edit</button>
      </div>
      {hasAny ? (
        <div className="profile-prefs">
          {location && <div className="profile-pref-row"><span className="profile-pref-label">Location</span><span className="profile-pref-value">{location}</span></div>}
          {workMode && <div className="profile-pref-row"><span className="profile-pref-label">Work mode</span><span className="profile-pref-value">{workMode}</span></div>}
          {salaryFloor && <div className="profile-pref-row"><span className="profile-pref-label">Salary</span><span className="profile-pref-value">{salaryFloor}</span></div>}
          {availability && <div className="profile-pref-row"><span className="profile-pref-label">Available</span><span className="profile-pref-value">{availability}</span></div>}
          {dutchLevel && <div className="profile-pref-row"><span className="profile-pref-label">Dutch</span><span className="profile-pref-value">{dutchLevel}</span></div>}
        </div>
      ) : (
        <p className="profile-explainer" style={{ fontStyle: "italic" }}>No preferences set yet.</p>
      )}
    </div>
  );
}
