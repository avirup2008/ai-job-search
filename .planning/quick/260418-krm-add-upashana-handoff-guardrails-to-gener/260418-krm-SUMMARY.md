---
phase: 260418-krm
plan: 01
subsystem: generation-prompts
tags: [guardrails, system-prompt, cv, cover-letter, linkedin]
key-files:
  modified:
    - src/lib/generate/cv.ts
    - src/lib/generate/cover-letter.ts
    - src/lib/linkedin/optimize.ts
decisions:
  - "Em-dashes intentionally preserved inside guardrail blocks (instructions to model, not generated output — post-gen sanitiser only runs on model output)"
  - "ROLES TO AVOID block added to cover-letter.ts only, as specified — not cv.ts or optimize.ts"
  - "In optimize.ts, new blocks inserted before the JSON schema instruction so the model still emits valid JSON"
  - "Pushed to main (worktree HEAD tracks main directly)"
metrics:
  completed: "2026-04-18"
  tasks: 3
  files_modified: 3
---

# Quick Task 260418-krm: Add Upashana Handoff Guardrails to Generation Prompts

**One-liner:** Added three content-level guardrail blocks (verified gaps, $80k revenue framing, mentor voice) to all three generation SYSTEM_PROMPTs, plus a roles-to-avoid block in the cover letter prompt only.

## What Changed

Three blocks were appended to the SYSTEM_PROMPT in each of the three generation files:

**Block A — VERIFIED GAPS:** Lists 8 items Upashana cannot claim (Google Ads, LinkedIn Ads, TikTok Ads, SQL/Tableau/Power BI, agency background, app marketing, EU research frameworks, Dutch professional fluency). Model must never imply experience with these.

**Block B — REVENUE CLAIM:** Locks the exact allowed phrasing for the GMAC $80k figure. Only "identified and revived a dormant partner channel... generating $80,000 in bulk GMAT test prep material sales" is acceptable. Bans "closed", "generated revenue", "drove" framings.

**Block C — MENTOR VOICE:** Prevents scope inflation. Distinguishes GMAC India (marketing execution only) from British Council (coordinator admin tasks). Caps British Council seniority at "operational lead with 1 direct report." Bans "senior", "head of", "led a team" language unless explicitly in profile.

**Block D — ROLES TO AVOID (cover-letter.ts only):** Instructs model to write a decline note instead of a strong pitch for Brand Manager, Content Strategist/Copywriter, industrial B2B without digital mandate, native Dutch required, or senior leadership titles.

## Files Modified

| File | Change |
|------|--------|
| `src/lib/generate/cv.ts` | Appended Blocks A + B + C to SYSTEM_PROMPT |
| `src/lib/generate/cover-letter.ts` | Appended Blocks A + B + C + D to SYSTEM_PROMPT |
| `src/lib/linkedin/optimize.ts` | Inserted Blocks A + B + C before the JSON schema instruction (so JSON output instruction remains last) |

## Commit

**SHA:** `4a84f16`
**Message:** `feat: encode handoff guardrails in generation prompts — verified gaps, $80k framing, mentor voice rules`
**Branch:** `main` (pushed to `origin/main`)

## Verification

- `npx tsc --noEmit` — exit 0, no errors
- All three shared blocks present in all three files (grep confirmed)
- ROLES TO AVOID present in cover-letter.ts only (count=1), absent from cv.ts (count=0) and optimize.ts (count=0)
- optimize.ts SYSTEM_PROMPT still ends with `Output ONLY valid JSON matching the schema...` followed by the JSON schema block

## Deviations from Plan

None — plan executed exactly as written.

Note: The plan task 3 mentioned the branch as `claude/nostalgic-lamarr` but the worktree HEAD tracks `main` directly. Pushed to `origin/main` (the correct tracking branch). This matches the actual git state confirmed by `git push origin HEAD -> main`.

## Self-Check: PASSED

- `src/lib/generate/cv.ts` — modified and committed: FOUND
- `src/lib/generate/cover-letter.ts` — modified and committed: FOUND
- `src/lib/linkedin/optimize.ts` — modified and committed: FOUND
- Commit `4a84f16` — FOUND in git log
- `tsc --noEmit` — exit 0
