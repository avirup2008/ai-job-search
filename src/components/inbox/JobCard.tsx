import Link from "next/link";
import { companyAvatar, matchBand, matchLabel } from "@/lib/ui/avatar";

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
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function JobCard({ job }: { job: JobCardData }) {
  const avatar = companyAvatar(job.companyName);
  const band = matchBand(job.fitScore);
  const score = job.fitScore ?? null;
  const topStrength = job.strengths?.[0] ?? null;
  const topGap = job.gaps?.[0] ?? null;

  return (
    <Link href={`/inbox/${job.id}`} className="job-card">
      <div className="job-card-head">
        <div className="company-avatar" style={{ background: avatar.bg }} aria-hidden="true">
          {avatar.letter}
        </div>
        <div className="job-card-identity">
          <h3 className="job-card-title">{job.title}</h3>
          <div className="job-card-meta">
            <span>{job.companyName}</span>
            {job.location && <><span className="sep" aria-hidden="true">·</span><span>{job.location}</span></>}
            {job.postedAt && <><span className="sep" aria-hidden="true">·</span><span>{fmtDate(job.postedAt)}</span></>}
          </div>
        </div>
        <div className="job-card-score" data-band={band}>
          {score != null ? (
            <>
              <span className="job-card-score-num mono">{Math.round(score)}</span>
              <span className="job-card-score-pct mono">%</span>
            </>
          ) : (
            <span className="job-card-score-label">—</span>
          )}
        </div>
      </div>

      {(topStrength || topGap) && (
        <div className="job-card-insight">
          {topStrength && (
            <div className="insight-row">
              <span className="insight-label insight-strength" aria-label="Strength">+</span>
              <span>{topStrength}</span>
            </div>
          )}
          {topGap && (
            <div className="insight-row">
              <span className="insight-label insight-gap" aria-label="Gap">!</span>
              <span>{topGap}</span>
            </div>
          )}
        </div>
      )}

      <div className="job-card-foot">
        <span className={`badge badge-${band === "strong" ? "strong" : band === "medium" ? "medium" : "weak"}`}>
          {matchLabel(band)}
        </span>
        {job.tier != null && <span className="meta mono-sm">T{job.tier}</span>}
        {job.dutchRequired && <span className="meta mono-sm">Dutch req.</span>}
        <span className="meta mono-sm" style={{ marginLeft: "auto" }}>{job.source}</span>
      </div>
    </Link>
  );
}
