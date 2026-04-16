# Shortlist UI Redesign — Design Spec

**Date:** 2026-04-16
**Status:** Approved via visual brainstorming session
**Scope:** Complete frontend rebuild of all pages + new query logic

---

## Brand Identity

- **Name:** Shortlist (was "AI Job Search")
- **Wordmark:** Cormorant Garamond italic 400, 24px, with Forest Green dot accent + trailing green period: `• Shortlist.`
- **Tab title:** "Shortlist"

## Design System

### Typography
| Role | Font | Weight | Size |
|---|---|---|---|
| Display / hero greeting | Cormorant Garamond italic | 300 | clamp(64px, 8vw, 92px) |
| Page titles (H1) | Cormorant Garamond italic | 300 | 36px |
| Card titles (featured) | Cormorant Garamond | 400 | 22-28px |
| Body / card titles | Plus Jakarta Sans | 600 | 15-17px |
| Body text | Plus Jakarta Sans | 400 | 14px |
| Data / numbers | IBM Plex Mono | 500 | varies |
| Document content | Lora | 400 | 14px |
| Labels / mono | IBM Plex Mono | 400 | 10-11px |

### Colors
- Ground: `#F7F5F0` (warm parchment)
- Surface: `#FFFFFF`
- Surface-2: `#F0EDE7`
- Accent: `#1D4A35` (Forest Green)
- Accent wash: `#E6F0EA`
- Warning/amber: `#92400E`
- Info/blue: `#1E40AF`
- Text-1: `#1A1814`, Text-2: `#6B6560`, Text-3: `#A8A29E`

### Match Score Bands
| Band | Score | Color | Label |
|---|---|---|---|
| Strong | 80%+ | `--accent` (#1D4A35) | "Ready to apply" |
| Medium | 65-79% | `--warning` (#92400E) | "Worth exploring" |
| Weak | 40-64% | `--text-2` (#6B6560) | "Stretch" |

---

## Sidebar (global)

- **Nav items:** Today, Inbox, Pipeline, Dashboard, Profile (5 items — Budget removed)
- **Paste button:** Green CTA `+ Paste a role` directly below Profile nav item (not pushed to bottom)
- **"For Upashana" removed**
- **Active state:** accent-wash background + accent text + font-weight 600
- **Wordmark:** clickable, links to `/`

---

## Page 1: Today (`/`)

**Layout:** Single centered narrative column (660px max-width), vertically centered on the page. `100vh, overflow: hidden` — no scrolling.

**Date label:** `THURSDAY 16 APRIL` — mono 11px, uppercase, no time shown.

**Greeting:** `Good morning, Upashana.` — Cormorant Garamond italic 300, clamp(64-92px). Changes automatically: morning (<12), afternoon (12-18), evening (>18). Name from profile DB.

**Subtext:** "You have **2** strong matches waiting. **384** new roles arrived overnight." — 17px body, 40px below greeting.

**Transition:** `—— One stands out` — mono 10px label with green line prefix.

**Featured card:** Inline in the narrative flow. Two-column grid (1fr auto): left has company uppercase + title in Cormorant 24px + strength sentence + green CTA button "Open this role →". Right has match % in mono 42px accent green. Card has left 4px accent rail, white bg, border, shadow on hover. **Auto-updates daily** — query: `ORDER BY fitScore DESC LIMIT 1` from T1-T3 jobs.

**KPI pills:** Three rounded pill-shaped links below the card: `44 in your inbox`, `2 strong matches`, `384 discovered`. Horizontal, `border-radius: 20px`, light border.

**Floating doc illustrations:** Three SVG document mockups (labeled COVER, CV, PLAN at 7-8px) positioned absolute in the margins. Gentle float animations (6-8s cycles). Growth curve SVG in background at 6% opacity. Accent dot pulses.

**Empty state:** Centered message if no jobs: "Discovery runs overnight. Check back in the morning."

---

## Page 2: Inbox (`/inbox`)

**Title:** "Your matches" (Cormorant italic 36px). Meta: "44 roles, sorted by fit"

**Filters:** Tab group: `All (44)` | `Ready to apply (2)` | `Worth exploring (12)` | `Stretch (30)` — maps to score bands (80+, 65-79, 40-64), NOT tiers.

**Section headers within the list:** `Ready to apply — strong fit with your profile (2)`, `Worth exploring — good fit, some areas to address (12)`, `Stretch — lower confidence, but could surprise you (30)`. Mono 10px with trailing line.

**Card layout:** Single column, full width up to 960px max-width. Each card:
- Grid: `3px rail | 1fr body | auto score`
- Rail colored by band (green/amber/grey)
- Top row: company name (11px uppercase letter-spaced bold, truncate with ellipsis) + match % (mono 28px, right-aligned)
- Title: Plus Jakarta Sans 600 17px (not serif — serif reserved for display)
- Strength line: `✦ Your HubSpot lifecycle experience is a direct fit...` — 13px, text-2 color. Speaks TO her about HER skills.
- Meta row: location · date · source as 11px mono chips. Source in title-case (not uppercase).
- `Save →` appears on hover (triggers `saveJobToPipeline` server action)

**Score band query change:** Replace `WHERE tier IN (1,2,3)` with score-band grouping: `fitScore >= 80` = "Ready to apply", `fitScore >= 65 AND fitScore < 80` = "Worth exploring", `fitScore >= 40 AND fitScore < 65` = "Stretch".

---

## Page 3: Job Detail (`/inbox/[jobId]`)

**Emotional arc:** You belong → you're prepared → here are the details → here's who they are.

**Header:** Company uppercase + location + source link. Title in Cormorant italic 36px. Match % 42px mono accent green. Meta row: posted date, type, work mode.

### Section 1: "Why you're a strong fit" (LEADS the page)
- Green accent card (`accent-wash` bg, left 4px accent border)
- Headline: "This role plays directly to your strongest skills."
- Strengths as `✦` prefixed sentences from `gapAnalysis.strengths[]`
- Below: "Areas to prepare for in the interview:" — gaps from `gapAnalysis.gaps[]` framed as interview prep with `○` prefix, amber color
- Compact breakdown bars: Skills / Tools / Seniority / Industry — 4-column grid, each with label + 4px bar + percentage from `fitBreakdown`

### Section 2: "Your application"
- 2×2 grid of doc cards
- Each card: name + status badge (Ready in green / Not generated in grey) + description + action buttons (Generate / Review / Regenerate / Download)
- **Generation experience (D):** clicking Generate shows sequential progress messages ("Reading the JD..." → "Reviewing your experience..." → "Writing..." → "Quality checks...") with progress bar, then transforms into confidence summary card ("References your Inbox Storage CRM rebuild... 276 words · ✓ Quality passed · ✓ No AI tells") with Review and Download buttons

### Section 3: "About the role"
- Full JD text in a white card with left 3px accent border. Lora serif 14px, max-width 68ch. **No max-height cap** — flows naturally.

### Section 4: "About the company" (snapshot)
- One-liner bold 15px
- Stage + Industry + low-signal as tag chips
- Marketing stack as inline chips (if detected)
- **"Why this company fits you"** — green accent callout with personalized text from strengths
- **No narrative wall of text** — only first 2 sentences if shown at all

### Sticky bottom bar
- "Ready to pursue this role? → Save to pipeline"

---

## Page 4: Doc Viewer (`/inbox/[jobId]/docs`)

**New route.** Split-pane layout:

**Left panel (300px):**
- Back link "← Back to role"
- Role context: company, title, score
- Doc tabs: Cover letter, Tailored CV, 30-60-90 Plan, Screening Q&A (+ any artifacts). Click to switch right panel. Active tab has accent border.
- "↓ Download application pack" button below tabs (future: zip, launch: sequential downloads)

**Right panel — document viewer:**
- Toolbar: doc title, action buttons (Copy, Download, Regenerate)
- Scrollable content area with centered white "page" (max-width 640px, Lora serif 14px/1.75)
- Each doc type has its own rendering:
  - **Cover letter:** subject line, greeting, body paragraphs, closing, signature with contact
  - **CV:** centered header, green section dividers, experience with metric highlights, skills chips
  - **30-60-90:** title + premise blockquote, three phase cards with green left-rail, open questions
  - **Screening Q&A:** opening line callout, questions with confidence badges (high=green, medium=amber, low=red), answers, closing question
- Quality strip at bottom: ✓ Quality passed, ✓ No AI tells, word count, generation timestamp

---

## Page 5: Pipeline (`/pipeline`)

**Title:** "Your pipeline" (Cormorant italic 36px). Meta: "5 roles in motion. Here's where to focus."

**Critical logic change:** Pipeline only shows roles with status `saved`, `applied`, `interview`, or `offer`. Status `new` is filtered OUT (that's what Inbox is for). The pipeline contains only roles she explicitly saved or acted on.

### Top row: Focus card (60%) + Progress panel (40%)

**Focus card:**
- Label: `—— Do this next`
- Shows the highest-priority saved role (logic: highest fitScore among saved roles with incomplete docs, or oldest saved role without application)
- Company, title (Cormorant italic 28px), score (mono 32px green), prompt ("Your cover letter and CV are ready. Review them, then apply."), two buttons: "Review & apply →" (primary) + "Next role" (ghost)

**Progress panel:**
- Label: `Your progress`
- Stats: roles saved, docs generated, applied, interviews — each with number + label
- Interview stat: "it's working ✦"
- Mini timeline below divider: recent events with colored dots (green=save, amber=applied, blue=interview) + relative timestamps

### Bottom: Action-grouped role list

Grouped by what she needs to DO, not status:
- **"Review & prepare"** (green count badge) — saved roles with docs to review or generate
- **"Waiting to hear back"** (amber count badge) — applied roles with days-since count
- **"Interview coming up"** (blue count badge) — interview-stage roles with "Prep answers" button

Each role card: 3px colored rail + company + title + score + hint text + contextual action button (Generate CV / Mark applied / Prep answers).

**New query logic needed:**
```sql
-- Focus card: highest-score saved role with incomplete doc set
SELECT j.*, COUNT(d.id) as doc_count
FROM applications a
JOIN jobs j ON a.job_id = j.id
LEFT JOIN documents d ON d.application_id = a.id
WHERE a.status = 'saved'
GROUP BY j.id
ORDER BY doc_count ASC, j.fit_score DESC
LIMIT 1

-- Action grouping: join docs to determine completeness
-- "Review & prepare" = status IN (saved) 
-- "Waiting to hear back" = status = 'applied'
-- "Interview coming up" = status = 'interview'
```

---

## Page 6: Dashboard (`/dashboard`)

**Title:** "Your search" (Cormorant italic 36px). Period tabs: This week / This month / All time.

**5 KPI tiles** — each with value + delta arrow + context:
- Discovered (total + ↑ % week-over-week)
- Matched (T1-T3 count + ↑ delta)
- Avg match score (% + ↑ trending)
- Applied (count + "of N saved")
- Interviews (count + conversion %)

**6-panel grid:**
1. **Match quality over time** (2-col span) — SVG area chart, daily avg fitScore, accent green fill, data points + x-axis dates
2. **Score distribution** — histogram of fitScore ranges (40-50, 50-60, etc.), colored by band
3. **Most requested skills** — horizontal bars from JD tool extraction, sorted by frequency
4. **Pipeline funnel** — Discovered → Matched → Saved → Applied → Interview with proportional bars
5. **Activity heatmap** (GitHub-style) — daily engagement grid, 4 weeks, green intensity levels. **Must fill full card width.**
6. **Where your matches are** — location bar chart from job.location

**Bottom row:**
- **Budget** — €X.XX / €20 with progress bar, percentage, remaining
- **Streak card** (2-col span) — day count + encouraging message ("From discovery to interview in under 7 days — that's faster than most candidates.")

**New queries needed:**
- Daily avg fitScore over time (for area chart)
- fitScore histogram (GROUP BY score bands)
- Tool frequency from gapAnalysis or JD parsing
- Daily activity counts (for heatmap)
- Location frequency (GROUP BY job.location)

---

## Page 7: Profile (`/profile`)

**Title:** "Your profile" (Cormorant italic 36px). Meta: "This is what Shortlist knows about you."

**Identity card:** Avatar (green circle, initial), name (Cormorant italic 28px), headline, contact links, Edit button.

**Two-column layout (main + 300px aside):**

### Main column:
1. **Tools & skills** — chip grid. Primary chips (green wash) for strongest skills. Regular chips for others. `+ Add skill` dashed button.
2. **Key achievements** — cards with description left, metric right in accent green mono. `+ Add an achievement` dashed button.
3. **Experience** — timeline with dot-and-line connector. Company, role, period, bulleted highlights with green metrics.

### Aside:
1. **Profile strength** — dot indicators (filled=strong, hollow=weak). Green tip card suggesting improvements ("Adding STAR stories would improve your screening Q&A").
2. **Search preferences** — editable rows: location, commute, work mode, salary floor, visa, availability. Each with "edit" link.
3. **How this affects matches** — explainer text.

**Launch state:** Read-only display of seeded profile data. Edit buttons + add buttons present but link to "coming soon" or admin page. Full editing + auto-rescore is Phase 10+.

---

## Paste-a-role (Phase 10 — UI designed, not built in this phase)

**Trigger:** Green `+ Paste a role` button in sidebar.
**Flow:** Slide-out panel from right → paste URL or JD text → auto-detect company/title → "Score this role →" → result with match %, "Why this fits you" callout, strengths/gaps → "Save to pipeline" or "Close" → confirmation with "Open role & generate docs →" or "Paste another role".

---

## Generation Experience (applies to all doc generation)

**Approach D: Progress messages + confidence summary.**

**During generation (15-30 seconds):**
Sequential messages with progress bar:
1. "Reading the job description..." (15%)
2. "Reviewing your experience at {company}..." (35%)
3. "Matching your skills to their requirements..." (55%)
4. "Writing your {docType}..." (80%)
5. "Running quality checks..." (95%)

**On completion:**
Progress bar fades out, replaced by confidence summary card:
- "References your Inbox Storage CRM rebuild and 212-lead Meta campaign..."
- `276 words · ✓ Quality passed · ✓ No AI tells`
- "Review full letter" + "Download" buttons

---

## Technical Notes

### Font change
- Remove: Instrument Serif
- Add: Cormorant Garamond (ital 300, 400), Lora (400, 500, 600, ital 400)
- Keep: Plus Jakarta Sans, IBM Plex Mono

### New routes
- `/inbox/[jobId]/docs` — in-app doc viewer (split-pane)

### Query changes
- Inbox: score-band grouping replaces tier filtering
- Pipeline: filter OUT status="new", join docs for completeness
- Dashboard: daily averages, histograms, activity counts, location/skill frequency
- Today: no changes (already queries top fitScore)

### No backend changes
- All API endpoints unchanged
- All generation logic unchanged
- Database schema unchanged
- Scoring/ranking unchanged
