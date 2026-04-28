"use client";

import { useState, useTransition } from "react";
import { patchJobJd } from "@/app/(app)/pipeline/actions";

type Props = {
  jobId: string;
  /** Current jdText — pre-fills the textarea if already has content. */
  jdText: string;
};

/**
 * Inline panel for pasting a job description when the scraped JD was
 * missing or too thin. Saves to jobs.jdText and clears the fit score so
 * the next rescore batch picks it up fresh.
 */
export function PasteJdPanel({ jobId, jdText }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(jdText);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const hasContent = jdText.trim().length > 0;

  function handleSave() {
    if (!text.trim()) return;
    setSaved(false);
    startTransition(async () => {
      await patchJobJd(jobId, text);
      setSaved(true);
      setOpen(false);
    });
  }

  return (
    <div style={{ marginTop: 8 }}>
      {!open && (
        <button
          type="button"
          className="paste-jd-trigger"
          onClick={() => { setOpen(true); setSaved(false); }}
        >
          {hasContent ? "✎ Edit job description" : "＋ Paste job description"}
        </button>
      )}

      {saved && !open && (
        <span className="paste-jd-saved-note" style={{ marginLeft: 10 }}>
          Saved — score will update on next rescore run ✓
        </span>
      )}

      {open && (
        <div className="paste-jd-panel">
          <textarea
            className="paste-jd-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the full job description here…"
            autoFocus
          />
          <div className="paste-jd-actions">
            <button
              type="button"
              className="paste-jd-save"
              disabled={isPending || !text.trim()}
              onClick={handleSave}
            >
              {isPending ? "Saving…" : "Save & queue rescore"}
            </button>
            <button
              type="button"
              className="paste-jd-cancel"
              disabled={isPending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
