import type { WeeklyBrief } from "@/lib/analytics/weekly-brief";

export function WeeklyBriefBanner({ brief }: { brief: WeeklyBrief }) {
  return (
    <div className="weekly-brief-banner">
      <div className="weekly-brief-banner-header">
        <span className="weekly-brief-banner-label">Weekly strategy brief</span>
        <span className="weekly-brief-banner-week">{brief.weekStarting}</span>
      </div>
      <div className="weekly-brief-banner-stats">
        <div className="weekly-brief-stat">
          <span className="weekly-brief-stat-value">{brief.applicationsSentThisWeek}</span>
          <span className="weekly-brief-stat-label">applied</span>
        </div>
        <div className="weekly-brief-stat">
          <span className="weekly-brief-stat-value">{brief.t1Available}</span>
          <span className="weekly-brief-stat-label">T1 available</span>
        </div>
        <div className="weekly-brief-stat">
          <span className="weekly-brief-stat-value">{brief.topSourceThisWeek}</span>
          <span className="weekly-brief-stat-label">top source</span>
        </div>
      </div>
      {brief.callout && (
        <p className="weekly-brief-banner-callout">{brief.callout}</p>
      )}
    </div>
  );
}
