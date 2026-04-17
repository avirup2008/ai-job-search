"use client";

import { useCallback, useMemo, useState } from "react";
import { assembleResearchPrompt, type DossierLite } from "@/lib/interview/research-prompt";

interface Props {
  role: string;
  companyName: string;
  jdText: string;
  dossier: DossierLite | null;
}

export function InterviewPromptPanel({ role, companyName, jdText, dossier }: Props) {
  const prompt = useMemo(
    () => assembleResearchPrompt({ role, companyName, jdText, dossier }),
    [role, companyName, jdText, dossier],
  );
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the textarea manually
      const ta = document.getElementById("interview-prompt-ta") as HTMLTextAreaElement | null;
      ta?.select();
    }
  }, [prompt]);

  return (
    <section className="detail-section interview-prompt-panel">
      <div className="interview-prompt-header">
        <h2>Interview research prompt</h2>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleCopy}
          aria-label="Copy prompt to clipboard"
        >
          {copied ? "Copied!" : "Copy prompt"}
        </button>
      </div>
      <p className="meta">
        Paste this into Claude.ai (your subscription) for free, tailored interview prep. Zero API cost from Disha.
      </p>
      <textarea
        id="interview-prompt-ta"
        readOnly
        value={prompt}
        rows={16}
        className="interview-prompt-textarea"
      />
    </section>
  );
}
