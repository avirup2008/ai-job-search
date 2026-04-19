"use client";

import { useState, useTransition } from "react";
import { updateEducation } from "@/app/(app)/profile/actions";

type Degree = { degree: string; institution: string; year: string };
type Certification = { name: string; status?: string };
type EducationData = { degrees: Degree[]; certifications: Certification[] };

export function EditableEducation({ data }: { data: EducationData }) {
  const [editing, setEditing] = useState(false);
  const [degrees, setDegrees] = useState<Degree[]>(data.degrees);
  const [certs, setCerts] = useState<Certification[]>(data.certifications);
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await updateEducation({ degrees, certifications: certs });
      setEditing(false);
    });
  }

  function cancel() {
    setDegrees(data.degrees);
    setCerts(data.certifications);
    setEditing(false);
  }

  function updateDegree(i: number, field: keyof Degree, val: string) {
    setDegrees((prev) => prev.map((d, idx) => idx === i ? { ...d, [field]: val } : d));
  }

  function addDegree() {
    setDegrees((prev) => [...prev, { degree: "", institution: "", year: "" }]);
  }

  function removeDegree(i: number) {
    setDegrees((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateCert(i: number, field: keyof Certification, val: string) {
    setCerts((prev) => prev.map((c, idx) => idx === i ? { ...c, [field]: val || undefined } : c));
  }

  function addCert() {
    setCerts((prev) => [...prev, { name: "" }]);
  }

  function removeCert(i: number) {
    setCerts((prev) => prev.filter((_, idx) => idx !== i));
  }

  if (!editing) {
    return (
      <div className="profile-education-card">
        <div className="profile-section-header">
          <h2 className="profile-section-title">Education</h2>
          <button type="button" className="profile-edit-inline-btn" onClick={() => setEditing(true)}>Edit</button>
        </div>
        {degrees.map((d, i) => (
          <div key={i} className="profile-edu-row">
            <div>
              <div className="profile-edu-degree">{d.degree}</div>
              <div className="profile-edu-institution">{d.institution}</div>
            </div>
            <div className="profile-edu-year">{d.year}</div>
          </div>
        ))}
        <div className="profile-education-divider" />
        <div className="profile-section-header" style={{ marginBottom: "10px" }}>
          <h2 className="profile-section-title">Certifications</h2>
        </div>
        <div className="profile-cert-chips">
          {certs.map((c, i) => (
            <span key={i} className="profile-chip">
              {c.name}{c.status ? ` — ${c.status}` : ""}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="profile-education-card">
      <div className="profile-section-header" style={{ marginBottom: "16px" }}>
        <h2 className="profile-section-title">Education</h2>
      </div>

      <div className="profile-edu-edit-list">
        {degrees.map((d, i) => (
          <div key={i} className="profile-edu-edit-row">
            <input
              className="profile-field-input"
              placeholder="Degree"
              value={d.degree}
              onChange={(e) => updateDegree(i, "degree", e.target.value)}
            />
            <input
              className="profile-field-input"
              placeholder="Institution"
              value={d.institution}
              onChange={(e) => updateDegree(i, "institution", e.target.value)}
            />
            <input
              className="profile-field-input profile-edu-year-input"
              placeholder="Year"
              value={d.year}
              onChange={(e) => updateDegree(i, "year", e.target.value)}
            />
            <button type="button" className="profile-edu-remove-btn" onClick={() => removeDegree(i)} aria-label="Remove">×</button>
          </div>
        ))}
        <button type="button" className="profile-edu-add-btn" onClick={addDegree}>+ Add degree</button>
      </div>

      <div className="profile-education-divider" />

      <div className="profile-section-header" style={{ marginBottom: "12px" }}>
        <h2 className="profile-section-title">Certifications</h2>
      </div>

      <div className="profile-edu-edit-list">
        {certs.map((c, i) => (
          <div key={i} className="profile-edu-edit-row">
            <input
              className="profile-field-input"
              placeholder="Certification name"
              value={c.name}
              onChange={(e) => updateCert(i, "name", e.target.value)}
            />
            <input
              className="profile-field-input"
              placeholder="Status (optional, e.g. in progress)"
              value={c.status ?? ""}
              onChange={(e) => updateCert(i, "status", e.target.value)}
            />
            <button type="button" className="profile-edu-remove-btn" onClick={() => removeCert(i)} aria-label="Remove">×</button>
          </div>
        ))}
        <button type="button" className="profile-edu-add-btn" onClick={addCert}>+ Add certification</button>
      </div>

      <div className="profile-edit-actions" style={{ marginTop: "16px" }}>
        <button type="button" className="profile-save-btn" onClick={save} disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </button>
        <button type="button" className="profile-cancel-btn" onClick={cancel} disabled={isPending}>Cancel</button>
      </div>
    </div>
  );
}
