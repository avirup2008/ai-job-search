import Link from "next/link";
import { matchBand } from "@/lib/ui/avatar";

export interface JobCardData {
  id: string;
  title: string;
  companyName: string;
  location: string | null;
  source: string;
  sourceUrl: string;
  postedAt: Date | string | null;
  tier: number | null;
  fitScore: number | null;
  strengths: string[] | null;
  gaps: string[] | null;
  dutchRequired: boolean;
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

  return (
    <Link href={`/inbox/${job.id}`} className="job-card" data-band={band}>
      <div className="job-card-rail" aria-hidden="true" />
      <div className="job-card-body">
        <div className="job-card-top">
          <span className="job-card-company">{job.companyName}</span>
          <span className="job-card-score mono" data-band={band}>
            {score != null ? `${Math.round(score)}%` : "—"}
          </span>
        </div>
        <h3 className="job-card-title">{job.title}</h3>
        {topStrength && (
          <p className="job-card-strength">
            <span aria-hidden="true" className="job-card-strength-mark">+</span>
            {topStrength}
          </p>
        )}
        <div className="job-card-foot">
          {job.location && <span className="meta-chip">{job.location}</span>}
          {job.tier != null && <span className="meta-chip">Tier {job.tier}</span>}
          {job.dutchRequired && <span className="meta-chip">Dutch</span>}
          <span className="meta-chip meta-chip-source">{job.source}</span>
          {job.postedAt && <span className="meta-chip">{fmtDate(job.postedAt)}</span>}
        </div>
      </div>
    </Link>
  );
}
