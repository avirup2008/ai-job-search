"use client";
import Link from "next/link";
import { useTransition } from "react";
import { matchBand } from "@/lib/ui/avatar";
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
  docCount?: number;
}

const STAGE_LABEL: Record<PipelineStage, string> = {
  new: "New",
  saved: "Saved",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

function fmtDate(d: Date | string | null): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  const days = Math.floor((Date.now() - dt.getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 7) return `${days}d ago`;
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function rowHint(data: PipelineCardData, groupColor?: string): string {
  if (groupColor === "amber" && data.lastEventAt) {
    return `Applied ${fmtDate(data.lastEventAt)}`;
  }
  return "";
}

function rowAction(data: PipelineCardData, groupColor?: string): { label: string; href: string } | null {
  if (groupColor === "green") {
    const docs = data.docCount ?? 0;
    return {
      label: docs > 0 ? "Review docs" : "Generate CV",
      href: `/inbox/${data.jobId}`,
    };
  }
  if (groupColor === "blue") {
    return { label: "Prep answers", href: `/inbox/${data.jobId}` };
  }
  return null;
}

/* ── ghost-select: used inside the focus card for the stage selector only ── */
function GhostSelect({ data }: { data: PipelineCardData }) {
  const [pending, startTransition] = useTransition();
  return (
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
  );
}

/* ── row variant: used in the bottom action-grouped list ── */
function RowCard({ data, groupColor }: { data: PipelineCardData; groupColor?: string }) {
  const [pending, startTransition] = useTransition();
  const band = matchBand(data.fitScore);
  const hint = rowHint(data, groupColor);
  const action = rowAction(data, groupColor);
  const railClass = `pipe-row-rail pipe-row-rail--${groupColor ?? "green"}`;

  return (
    <article className="pipe-row" aria-busy={pending}>
      <div className={railClass} aria-hidden="true" />
      <div className="pipe-row-body">
        <div className="pipe-row-info">
          <span className="pipe-row-company">{data.companyName}</span>
          <Link href={`/inbox/${data.jobId}`} className="pipe-row-title">{data.title}</Link>
          {hint && <span className="pipe-row-hint">{hint}</span>}
        </div>
        <div className="pipe-row-right">
          {data.fitScore != null && (
            <span className="pipe-row-score mono" data-band={band}>{Math.round(data.fitScore)}%</span>
          )}
          {action && (
            <Link href={action.href} className="pipe-btn pipe-btn-ghost pipe-btn-sm">
              {action.label}
            </Link>
          )}
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
      </div>
    </article>
  );
}

/* ── main export ── */
export function PipelineCard({
  data,
  variant = "row",
  groupColor,
}: {
  data: PipelineCardData;
  variant?: "row" | "ghost-select";
  groupColor?: string;
}) {
  if (variant === "ghost-select") {
    return <GhostSelect data={data} />;
  }
  return <RowCard data={data} groupColor={groupColor} />;
}
