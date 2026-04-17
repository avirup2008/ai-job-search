---
status: partial
phase: 15-candidate-intelligence-ui
source: [15-VERIFICATION.md]
started: 2026-04-17T20:20:00Z
updated: 2026-04-17T20:20:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Gap Coach page — live data rendering
expected: /gap-coach route renders T2 jobs sorted by fitScore descending; each row shows company name, title, score %, delta "−N pts to T1", and gap strings; nav link "Gap Coach" appears between Inbox and Pipeline; empty-state message shown when no T2 jobs exist

result: [pending]

### 2. Interview prompt panel — status gate + clipboard
expected: On a job detail page where application status is "interview", the research prompt panel appears with a textarea and Copy button; clicking Copy writes the prompt text to clipboard (paste confirms full text); on any non-interview job, the panel does NOT appear

result: [pending]

### 3. PDF download — file integrity
expected: Clicking "Download interview brief (PDF)" triggers a file download named disha-interview-brief-{company}-{title}.pdf; opening the file in Preview/Acrobat shows a title page with company name and role, a dossier section, and an interview prep section with markdown content rendered as formatted text

result: [pending]

### 4. API route 404 guards
expected: curl /api/interview-brief/NON-EXISTENT-UUID returns 404 JSON; route returns 404 when no application exists for the job; route returns 404 when no interview-prep document exists for the application

result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
