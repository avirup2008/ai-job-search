"use client";

import { useState, useTransition } from "react";
import { generateStarStories } from "@/app/(app)/profile/actions";

type StarStory = {
  headline: string;
  situation: string;
  task: string;
  action: string;
  result: string;
};

export function StarStoriesPanel({ stories }: { stories: StarStory[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      await generateStarStories();
    });
  }

  return (
    <section className="profile-section">
      <div className="profile-section-header">
        <h2 className="profile-section-title">Interview stories</h2>
        <button
          type="button"
          className="profile-star-generate"
          onClick={generate}
          disabled={isPending}
        >
          {isPending ? "Generating…" : stories.length > 0 ? "Regenerate" : "Generate with AI"}
        </button>
      </div>

      {stories.length === 0 && !isPending && (
        <p className="profile-explainer" style={{ fontStyle: "italic" }}>
          Generate STAR stories from your experience to prepare for interviews.
        </p>
      )}

      {isPending && (
        <div className="profile-star-loading">
          <span className="profile-star-loading-dot" />
          Generating your interview stories…
        </div>
      )}

      {!isPending && stories.length > 0 && (
        <div className="profile-star-list">
          {stories.map((s, i) => (
            <div
              key={i}
              className={`profile-star-card${expanded === i ? " profile-star-card--open" : ""}`}
            >
              <button
                type="button"
                className="profile-star-headline"
                onClick={() => setExpanded(expanded === i ? null : i)}
              >
                <span className="profile-star-index">{i + 1}</span>
                <span>{s.headline}</span>
                <span className="profile-star-chevron">{expanded === i ? "↑" : "↓"}</span>
              </button>
              {expanded === i && (
                <div className="profile-star-body">
                  {(["situation", "task", "action", "result"] as const).map((key) => (
                    <div key={key} className="profile-star-row">
                      <span className="profile-star-label">
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                      </span>
                      <span className="profile-star-text">{s[key]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
