import Link from "next/link";
import { matchBand } from "@/lib/ui/avatar";
import { SaveButton } from "./SaveButton";

export interface JobCardData {
  id: string;
  title: string;
  companyName: string;
  location: string | null;
  source: string;
  sourceUrl: string;
  postedAt: Date | string | null;
  tier: number | null;
  previousTier: number | null;
  fitScore: number | null;
  strengths: string[] | null;
  gaps: string[] | null;
  dutchRequired: boolean;
  isNew?: boolean;
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

export function JobCard({ job }: { job: JobCardData }) {
  const band = matchBand(job.fitScore);
  const score = job.fitScore ?? null;
  const topStrength = job.strengths?.[0] ?? null;
  const dateStr = fmtDate(job.postedAt);

  return (
    <div className="job-card" data-band={band}>
      <div className="job-card-rail" aria-hidden="true" />
      <Link href={`/inbox/${job.id}`} className="job-card-body">
        <div className="job-card-top">
          <span className="job-card-company">{job.companyName}</span>
          {job.isNew && <span className="new-badge">New</span>}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {job.previousTier != null && job.previousTier !== job.tier && (
              <span
                className="drift-badge"
                data-direction={job.previousTier > (job.tier ?? 0) ? "up" : "down"}
                title="Score drift detected on last nightly run"
              >
                T{job.previousTier} &rarr; T{job.tier}
              </span>
            )}
            <span className="job-card-score mono" data-band={band}>
              {score != null ? `${Math.round(score)}%` : "\u2014"}
            </span>
          </div>
        </div>
        <h3 className="job-card-title">{job.title}</h3>
        {topStrength && (
          <p className="job-card-strength">
            <span aria-hidden="true" className="job-card-strength-mark">&#10022;</span>
            {topStrength}
          </p>
        )}
        <div className="job-card-foot">
          {job.location && <span className="meta-chip">{job.location}</span>}
          {dateStr && <span className="meta-chip">{dateStr}</span>}
          <span className="meta-chip meta-chip-source">{job.source}</span>
        </div>
      </Link>
      <div className="job-card-actions">
        <SaveButton jobId={job.id} />
      </div>
    </div>
  );
}
