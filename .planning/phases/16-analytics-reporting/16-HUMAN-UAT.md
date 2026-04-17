---
status: partial
phase: 16-analytics-reporting
source: [16-VERIFICATION.md]
started: 2026-04-17T20:45:00Z
updated: 2026-04-17T20:45:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Source Quality panel — live data rendering
expected: /analytics shows "Source quality" hbar panel; each discovered source appears as a row with T1 count and conversion rate (%); empty-state message when no jobs discovered; bar widths proportional to T1 count

result: [pending]

### 2. Market Pulse panel — data-state branches
expected: "Market pulse" panel shows avg days-to-response (or "No responses yet"), T1 volume trend label (with up/down/neutral), per-source response rate rows; no division-by-zero crash when data is empty

result: [pending]

### 3. Weekly brief cron-to-card end-to-end
expected: Calling GET /api/cron/weekly-brief on a Monday with correct Authorization: Bearer header returns { ok: true, brief: {...} } and populates the "Weekly strategy brief" card on /analytics; calling on a non-Monday returns { ok: true, skipped: "not monday" }; calling without auth header returns 401

result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
