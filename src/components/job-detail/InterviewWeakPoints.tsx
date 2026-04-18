const WEAK_POINTS: { title: string; framing: string }[] = [
  {
    title: "Under 1 year in current role",
    framing:
      "\"I was the sole marketing hire — I built the full HubSpot stack, demand gen, and SEO function from scratch. I'm looking to take that foundation into a team with more scope and specialisation.\"",
  },
  {
    title: "No Google Ads experience",
    framing:
      "Honest answer: Google Ads certification is currently in progress. I have hands-on Meta Ads experience (212 leads at \u20ac1.29 CPL) and strong campaign analytics skills. Google Ads is the next natural step.",
  },
  {
    title: "No agency experience",
    framing:
      "I\u2019ve always worked in-house, which means I own full-funnel results end to end \u2014 not just deliverables for a client. That accountability is what I bring.",
  },
  {
    title: "$80k GMAC partner revenue",
    framing:
      "\"I identified a dormant partner channel \u2014 test prep agencies that GMAC hadn\u2019t activated \u2014 built the relationships with IMS India and Manya Education, and ran targeted discount outreach that generated $80,000 in bulk GMAT material sales. I did not close a pre-existing deal; I created the opportunity.\"",
  },
  {
    title: "Political Science degree (for non-marketing roles)",
    framing:
      "Acknowledge directly: my degree is in Political Science, but my 10-year track record is in project management and marketing operations \u2014 government-funded training programmes at British Council, multi-market campaigns at GMAC, full marketing stack ownership at Inbox Storage.",
  },
];

export function InterviewWeakPoints() {
  return (
    <section className="detail-section">
      <h2>Known weak points \u2014 prepare for these</h2>
      <p className="detail-section-desc">
        These questions will likely come up. Prepared framings are below \u2014 practise saying them out loud.
      </p>
      <div className="weak-points-list">
        {WEAK_POINTS.map((wp, i) => (
          <div key={i} className="weak-point-item">
            <div className="weak-point-title">
              <span className="weak-point-index">{i + 1}</span>
              {wp.title}
            </div>
            <p className="weak-point-framing">{wp.framing}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
