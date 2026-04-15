"use client";
import Link from "next/link";
import { useTransition } from "react";
import { companyAvatar, matchBand } from "@/lib/ui/avatar";
import { updateApplicationStatus } from "@/app/(app)/pipeline/actions";
import { PIPELINE_STAGES, type PipelineStage } from "@/app/(app)/pipeline/stages";

export interface PipelineCardData {
  applicationId: string;
  jobId: string;
  title: string;
  companyName: string;
  status: PipelineStage;
  fitScore: number | null;
  lastEventAt: Date | string | null;
}

function fmtDate(d: Date | string | null): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  const days = Math.floor((Date.now() - dt.getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const STAGE_LABEL: Record<PipelineStage, string> = {
  new: "New",
  saved: "Saved",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

export function PipelineCard({ data }: { data: PipelineCardData }) {
  const [pending, startTransition] = useTransition();
  const avatar = companyAvatar(data.companyName);
  const band = matchBand(data.fitScore);

  return (
    <article className="pipe-card" aria-busy={pending}>
      <div className="pipe-card-head">
        <div className="pipe-card-avatar" style={{ background: avatar.bg }} aria-hidden="true">
          {avatar.letter}
        </div>
        <div style={{ minWidth: 0 }}>
          <Link href={`/inbox/${data.jobId}`} className="pipe-card-title">{data.title}</Link>
          <div className="pipe-card-sub">{data.companyName}</div>
        </div>
      </div>
      {data.fitScore != null && (
        <span className="pipe-card-score mono" data-band={band}>
          {Math.round(data.fitScore)}% match
        </span>
      )}
      <div className="pipe-card-foot">
        <span className="pipe-card-date">{fmtDate(data.lastEventAt)}</span>
        <select
          className="pipe-select"
          value={data.status}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.value as PipelineStage;
            startTransition(async () => {
              await updateApplicationStatus(data.applicationId, next);
            });
          }}
          aria-label="Move to stage"
        >
          {PIPELINE_STAGES.map((s) => (
            <option key={s} value={s}>{STAGE_LABEL[s]}</option>
          ))}
        </select>
      </div>
    </article>
  );
}
