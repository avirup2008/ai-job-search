"use client";

import { useState, useTransition } from "react";
import { RescoreNotice } from "./RescoreNotice";

type DisplayAchievement = { description: string; metric?: string; context?: string };

interface EditableAchievementsProps {
  items: DisplayAchievement[];
  onAdd: (description: string, metric: string) => Promise<void>;
  onRemove: (index: number) => Promise<void>;
}

export function EditableAchievements({ items, onAdd, onRemove }: EditableAchievementsProps) {
  const [adding, setAdding] = useState(false);
  const [desc, setDesc] = useState("");
  const [metric, setMetric] = useState("");
  const [isPending, startTransition] = useTransition();
  const [showNotice, setShowNotice] = useState(false);

  function submit() {
    const d = desc.trim();
    if (!d) return;
    startTransition(async () => {
      await onAdd(d, metric.trim());
      setDesc("");
      setMetric("");
      setAdding(false);
      setShowNotice(true);
    });
  }

  function remove(i: number) {
    startTransition(async () => {
      await onRemove(i);
      setShowNotice(true);
    });
  }

  return (
    <>
      <div className="profile-achievements">
        {items.length === 0 && !adding && (
          <p className="profile-explainer" style={{ fontStyle: "italic" }}>
            No achievements yet. Add a few — they power every match score.
          </p>
        )}
        {/* Metric achievements — 2-column scorecard grid */}
        {items.some((a) => a.metric) && (
          <div className="profile-metric-grid">
            {items.map((a, i) =>
              a.metric ? (
                <div key={i} className="profile-metric-card">
                  <button
                    type="button"
                    className="profile-achievement-remove profile-metric-remove"
                    aria-label="Remove achievement"
                    disabled={isPending}
                    onClick={() => remove(i)}
                  >
                    &times;
                  </button>
                  <div className="profile-metric-value">{a.metric}</div>
                  <div className="profile-metric-body">
                    <div className="profile-metric-title">{a.description}</div>
                    {a.context && <div className="profile-metric-context">{a.context}</div>}
                  </div>
                </div>
              ) : null
            )}
          </div>
        )}

        {/* Plain achievements without a metric */}
        {items.map((a, i) =>
          !a.metric ? (
            <div key={i} className="profile-achievement">
              <span className="profile-achievement-desc">{a.description}</span>
              <button
                type="button"
                className="profile-achievement-remove"
                aria-label="Remove achievement"
                disabled={isPending}
                onClick={() => remove(i)}
              >
                &times;
              </button>
            </div>
          ) : null
        )}

        {adding ? (
          <div className="profile-achievement-form">
            <textarea
              className="profile-achievement-input"
              placeholder="What did you accomplish? (e.g. Cut onboarding time in half by redesigning…)"
              value={desc}
              disabled={isPending}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
              autoFocus
            />
            <input
              type="text"
              className="profile-achievement-metric-input"
              placeholder="Metric (optional, e.g. 2x, €40k, 95%)"
              value={metric}
              disabled={isPending}
              onChange={(e) => setMetric(e.target.value)}
            />
            <div className="profile-achievement-form-actions">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={isPending}
                onClick={() => {
                  setDesc("");
                  setMetric("");
                  setAdding(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                disabled={isPending || !desc.trim()}
                onClick={submit}
              >
                {isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="profile-achievement-add profile-achievement-add-active"
            disabled={isPending}
            onClick={() => setAdding(true)}
          >
            + Add an achievement
          </button>
        )}
      </div>
      {showNotice && <RescoreNotice onDismiss={() => setShowNotice(false)} />}
    </>
  );
}
