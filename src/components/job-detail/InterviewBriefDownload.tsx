interface Props { jobId: string }

export function InterviewBriefDownload({ jobId }: Props) {
  return (
    <section className="detail-section interview-brief-download">
      <h2>Pre-interview brief (PDF)</h2>
      <p className="meta">
        Combined interview prep + company dossier in one downloadable PDF. No new generation — formatting only.
      </p>
      <a
        href={`/api/interview-brief/${jobId}`}
        className="btn btn-primary"
        download
      >
        Download interview brief (PDF)
      </a>
    </section>
  );
}
