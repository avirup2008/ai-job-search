---
phase: 260418-krm
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/generate/cv.ts
  - src/lib/generate/cover-letter.ts
  - src/lib/linkedin/optimize.ts
autonomous: true
requirements:
  - HANDOFF-GAPS
  - HANDOFF-80K
  - HANDOFF-MENTOR
  - HANDOFF-ROLES-AVOID
must_haves:
  truths:
    - "All three generation SYSTEM_PROMPTs include a VERIFIED GAPS block listing the 8 unclaimable items."
    - "All three generation SYSTEM_PROMPTs include the REVENUE CLAIM framing section with the exact allowed GMAC phrasing."
    - "All three generation SYSTEM_PROMPTs include the WRITING RULES — MENTOR VOICE block with GMAC vs British Council scope distinction."
    - "Only cover-letter.ts includes the ROLES TO AVOID block."
    - "TypeScript compiles cleanly (npx tsc --noEmit) after edits."
    - "Change is committed and pushed to origin main."
  artifacts:
    - path: src/lib/generate/cv.ts
      provides: "CV SYSTEM_PROMPT with gaps + $80k + mentor guardrails"
      contains: "VERIFIED GAPS — NEVER CLAIM THESE"
    - path: src/lib/generate/cover-letter.ts
      provides: "Cover letter SYSTEM_PROMPT with gaps + $80k + mentor + roles-to-avoid guardrails"
      contains: "ROLES TO AVOID — DECLINE OR FLAG"
    - path: src/lib/linkedin/optimize.ts
      provides: "LinkedIn optimizer SYSTEM_PROMPT with gaps + $80k + mentor guardrails"
      contains: "REVENUE CLAIM — EXACT FRAMING REQUIRED"
  key_links:
    - from: "src/lib/generate/cv.ts SYSTEM_PROMPT"
      to: "Anthropic Sonnet call in generateCV()"
      via: "system parameter in llm.structured()"
      pattern: "system:\\s*SYSTEM_PROMPT"
    - from: "src/lib/generate/cover-letter.ts SYSTEM_PROMPT"
      to: "Anthropic Sonnet call in generateCoverLetter()"
      via: "system parameter in llm.structured()"
      pattern: "system:\\s*SYSTEM_PROMPT"
    - from: "src/lib/linkedin/optimize.ts SYSTEM_PROMPT"
      to: "Anthropic Sonnet call in optimizeLinkedinProfile()"
      via: "system parameter in client.messages.create()"
      pattern: "system:\\s*SYSTEM_PROMPT"
---

<objective>
Encode Upashana's handoff guardrails — verified gaps, $80k framing, mentor voice, and roles-to-avoid — into the three generation system prompts (CV, cover letter, LinkedIn optimizer) so Disha cannot claim skills or inflate scope that Upashana can't back up in interviews.

Purpose: The existing anti-AI rules prevent stylistic tells, but nothing prevents factual overreach. This plan adds content-level guardrails tied to her real profile truth.
Output: Three edited TypeScript files, clean `tsc --noEmit`, committed + pushed to `origin/main`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/lib/generate/cv.ts
@src/lib/generate/cover-letter.ts
@src/lib/linkedin/optimize.ts
@src/lib/generate/anti-ai.ts

<interfaces>
All three files follow the same pattern:
- `const SYSTEM_PROMPT = \`...\`;` at the top of the file
- SYSTEM_PROMPT is passed as `system:` parameter to the Anthropic Sonnet call
- Anti-AI guardrails live in `src/lib/generate/anti-ai.ts` (FORBIDDEN_SUBSTRINGS / FORBIDDEN_REGEX) and run post-generation — DO NOT duplicate those rules in the prompts.
- The new guardrails are ADDITIONS to the existing prompt text, appended BEFORE the closing backtick. Do not remove or rewrite existing content.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add shared guardrail blocks to all three SYSTEM_PROMPTs</name>
  <files>src/lib/generate/cv.ts, src/lib/generate/cover-letter.ts, src/lib/linkedin/optimize.ts</files>
  <action>
In each of the three files, append the following three blocks to the end of the existing `SYSTEM_PROMPT` template literal (just before the closing backtick). Keep the existing prompt content intact — these are additions, not replacements.

Block A — VERIFIED GAPS (append verbatim, preceded by a blank line):

```
## VERIFIED GAPS — NEVER CLAIM THESE
The candidate has NOT done the following. Never imply, suggest, or claim experience with:
- Google Ads (certification in progress — may mention in-progress, never as experience)
- LinkedIn Ads — zero experience
- TikTok Ads — zero experience
- SQL, Tableau, Power BI — not in toolkit
- Agency background — none
- App marketing / mobile user acquisition — none
- EU research funding frameworks (MSCA, Horizon Europe, NWO) — none
- Dutch professional fluency — A2 only; do not imply professional Dutch ability
```

Block B — REVENUE CLAIM (append verbatim, preceded by a blank line):

```
## REVENUE CLAIM — EXACT FRAMING REQUIRED
When referencing the GMAC partner channel revenue, the ONLY acceptable framing is:
"identified and revived a dormant partner channel… generating $80,000 in bulk GMAT test prep material sales"

NEVER write: "closed $80,000", "generated $80,000 in revenue", "drove $80,000", or any version
that implies she closed a deal rather than identified and revived the opportunity.
```

Block C — MENTOR VOICE (append verbatim, preceded by a blank line):

```
## WRITING RULES — MENTOR VOICE
- Be an objective mentor, not a hype coach. Do not inflate experience.
- Never add seniority or scope that is not explicitly in the profile.
- GMAC India role: marketing execution (campaign planning, webinars, email campaigns, education fairs, school visits). Do NOT attribute admin tasks (booking tickets, inventory, data entry) to this role — those were British Council coordinator work.
- British Council PM role: candidate was the operational lead. The senior manager held strategic/leadership-level oversight only. She had 1 direct report on the North East project. Do not overstate seniority beyond "operational lead".
- Do not frame her as "senior", "head of", "led a team", or any leadership language beyond what is stated.
```

IMPORTANT: The prompts contain literal em-dash characters (—) inside these blocks. That is intentional — these are instructions TO the model about what NOT to write, not generated output. The post-generation em-dash sanitiser runs on model OUTPUT, not on the SYSTEM_PROMPT string itself. Leave the em-dashes in the block text exactly as specified above.

Apply the same three blocks, in the same order, to:
1. `src/lib/generate/cv.ts` — append to SYSTEM_PROMPT (currently ends at LENGTH section line 45)
2. `src/lib/generate/cover-letter.ts` — append to SYSTEM_PROMPT (currently ends at SIGNATURE section line 74)
3. `src/lib/linkedin/optimize.ts` — append to SYSTEM_PROMPT, but BEFORE the `Output ONLY valid JSON matching the schema...` line and the `JSON schema:` block. The JSON schema instruction must remain at the very end of the prompt so the model still emits JSON.
  </action>
  <verify>
    <automated>cd "/Users/avi/Downloads/Claude/Code/AI Job Search" && npx tsc --noEmit</automated>
    Also grep to confirm all three blocks present in all three files:
    `grep -l "VERIFIED GAPS — NEVER CLAIM THESE" src/lib/generate/cv.ts src/lib/generate/cover-letter.ts src/lib/linkedin/optimize.ts` → 3 matches
    `grep -l "REVENUE CLAIM — EXACT FRAMING REQUIRED" src/lib/generate/cv.ts src/lib/generate/cover-letter.ts src/lib/linkedin/optimize.ts` → 3 matches
    `grep -l "WRITING RULES — MENTOR VOICE" src/lib/generate/cv.ts src/lib/generate/cover-letter.ts src/lib/linkedin/optimize.ts` → 3 matches
  </verify>
  <done>
- All three files contain all three new section headers.
- `npx tsc --noEmit` exits 0.
- Existing prompt content in each file is preserved (no accidental deletion of existing rules).
- In `optimize.ts`, the `Output ONLY valid JSON matching the schema.` line and the `JSON schema: { ... }` block remain at the very end of the SYSTEM_PROMPT.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add ROLES TO AVOID block to cover-letter.ts only</name>
  <files>src/lib/generate/cover-letter.ts</files>
  <action>
Append ONE additional block to the SYSTEM_PROMPT in `src/lib/generate/cover-letter.ts` ONLY. Place it after the three shared blocks added in Task 1, still before the closing backtick.

Block (preceded by a blank line):

```
## ROLES TO AVOID — DECLINE OR FLAG
If the job description is primarily for any of the following, do not write a strong pitch.
Write a brief honest note instead ("This role may not be the right fit because…"):
- Brand Manager title
- Content Strategist / Copywriter (content creation as primary function)
- Industrial or technical B2B (manufacturing, engineering sector with no digital mandate)
- Requires native Dutch
- Senior leadership title (Director, Head of, VP, etc.)
```

Do NOT add this block to `cv.ts` or `optimize.ts`.
  </action>
  <verify>
    <automated>cd "/Users/avi/Downloads/Claude/Code/AI Job Search" && npx tsc --noEmit</automated>
    Grep checks:
    - `grep -c "ROLES TO AVOID — DECLINE OR FLAG" src/lib/generate/cover-letter.ts` → 1
    - `grep -c "ROLES TO AVOID — DECLINE OR FLAG" src/lib/generate/cv.ts` → 0
    - `grep -c "ROLES TO AVOID — DECLINE OR FLAG" src/lib/linkedin/optimize.ts` → 0
  </verify>
  <done>
- `cover-letter.ts` contains exactly one ROLES TO AVOID block, placed after the three shared blocks.
- `cv.ts` and `optimize.ts` do NOT contain a ROLES TO AVOID block.
- `npx tsc --noEmit` exits 0.
  </done>
</task>

<task type="auto">
  <name>Task 3: Commit and push to origin/main</name>
  <files>(git only — no source edits)</files>
  <action>
From repo root:
1. `git status` — confirm only the three target files are modified.
2. `git add src/lib/generate/cv.ts src/lib/generate/cover-letter.ts src/lib/linkedin/optimize.ts`
3. Commit with the exact message from the task description:
   ```
   feat: encode handoff guardrails in generation prompts — verified gaps, $80k framing, mentor voice rules
   ```
   Use a HEREDOC to preserve the em-dash.
4. `git push origin HEAD` (current branch is `claude/nostalgic-lamarr` per pre-session status — push to the current tracking branch, not main directly; the user's convention in this repo uses feature branches then merges. If user explicitly wants main, use `git push origin HEAD:main`).

NOTE: The task description says "push to origin main" but the working branch is `claude/nostalgic-lamarr`. Push to the current branch (`origin claude/nostalgic-lamarr`) so the normal merge flow applies. Do not force-push. Do not merge to main without explicit approval.
  </action>
  <verify>
    <automated>cd "/Users/avi/Downloads/Claude/Code/AI Job Search" && git log -1 --format="%s" | grep -F "feat: encode handoff guardrails in generation prompts"</automated>
    Also confirm `git status` is clean after push.
  </verify>
  <done>
- One new commit on `claude/nostalgic-lamarr` with the specified message.
- Commit pushed to `origin/claude/nostalgic-lamarr`.
- `git status` clean.
  </done>
</task>

</tasks>

<verification>
End-to-end check:
1. `npx tsc --noEmit` → 0 errors.
2. All three SYSTEM_PROMPTs contain the three shared blocks (gaps / revenue / mentor).
3. Only `cover-letter.ts` contains the ROLES TO AVOID block.
4. `optimize.ts` still ends its SYSTEM_PROMPT with the JSON schema instruction (so the model still returns JSON).
5. Commit landed on origin with the required message.
</verification>

<success_criteria>
- Three files modified, all pass `tsc --noEmit`.
- Guardrail text matches the task description verbatim (including em-dashes inside the INSTRUCTIONS to the model — those are intentional and do not affect the output sanitiser).
- Commit pushed.
</success_criteria>

<output>
After completion, create `.planning/quick/260418-krm-add-upashana-handoff-guardrails-to-gener/260418-krm-SUMMARY.md` summarising what changed, the commit SHA, and any deviations (e.g. branch pushed to instead of main).
</output>
