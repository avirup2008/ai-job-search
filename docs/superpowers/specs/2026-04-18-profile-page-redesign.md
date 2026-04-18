# Profile Page Visual Overhaul — Design Spec

**Date:** 2026-04-18  
**Status:** Approved  
**Scope:** `/profile` route — visual redesign only, no data model changes, no server action changes

---

## Problem

The current profile page is single-column dominant, left-centred, long-scrolling, with the right aside underutilised. Content order buries experience at the bottom below skills/achievements. The identity card feels generic — no brand presence. The sidebar shows profile-strength dots and static preferences text that adds no action value.

---

## Design Decisions (locked)

| Question | Decision |
|---|---|
| Hero treatment | Dark forest green fill (`#1D4A35`), white text |
| Layout below hero | Two-column: left ~62%, right sidebar ~38% |
| Experience section | Timeline, top 2 roles full, "Show N earlier" collapses older roles |
| Left column order | Experience → Achievement metric cards → Education + certs |
| Sidebar content | Skills tags → Live pipeline snapshot → Next action nudge |

---

## Architecture

No new files needed beyond CSS additions. All changes are in:
- `src/app/(app)/profile/page.tsx` — layout structure, content order, new JSX sections
- `src/components/profile/profile.css` — new utility classes and overrides

The server component renders everything statically. Pipeline counts come from existing data already available in `page.tsx` (jobs are fetched alongside profile). No new DB queries, no new server actions.

---

## Section Specs

### 1. Hero Card

**Replaces:** `.profile-identity` (currently white card, generic)

**Structure:**
```
.profile-hero  (background: #1D4A35, border-radius: var(--r-lg), padding: 28px 32px)
├─ .profile-hero-avatar   (60px circle, rgba(255,255,255,0.18) bg, white initial letter)
├─ .profile-hero-body
│  ├─ .profile-hero-name   (font-weight 700, font-size 20px, color #fff, letter-spacing -0.4px)
│  ├─ .profile-hero-title  (font-size 13px, color rgba(255,255,255,0.65))
│  └─ .profile-hero-meta   (flex row: 📍 location · 🇳🇱 Dutch level · 🔗 LinkedIn · 🌐 Portfolio)
└─ .profile-hero-right
   ├─ .profile-hero-score  (large %, font-size 32px, font-weight 700, color #fff)
   ├─ .profile-hero-score-label  ("Profile strength", uppercase, muted white)
   └─ .profile-hero-edit   (ghost button, rgba(255,255,255,0.12) bg, white border+text)
```

Meta row items: muted white (rgba 0.5) for info items, brighter white (0.85) + font-weight 500 for links.

---

### 2. Two-Column Layout

**CSS change to `.profile-layout`:**
```css
.profile-layout {
  display: grid;
  grid-template-columns: 1fr 320px;  /* was 1fr 300px */
  gap: var(--s-6);
  align-items: start;
}
```

Left column: Experience → Achievements → Education.  
Right column: Skills → Pipeline → Next action.

---

### 3. Experience — Timeline with Show/Hide

**Replaces:** current `.profile-timeline` (shows all roles equally)

**Behaviour:**
- Top 2 roles (most recent) always shown in full with bullets
- Roles 3+ hidden behind a `<button class="profile-timeline-more">↓ Show N earlier roles (…dates)</button>`
- Button toggles via `useState` in a thin client wrapper component
- Current role dot: `--accent` fill. Older role dots: `--border` fill.
- Connector line between dots

**New component:** `src/components/profile/ExperienceTimeline.tsx`  
- `"use client"` — needs toggle state only
- Accepts `roles` prop (from existing `profile.roles` JSONB)
- Renders top 2 expanded, rest collapsed behind toggle
- Uses existing `.profile-timeline`, `.profile-timeline-item`, `.profile-timeline-dot`, `.profile-timeline-connector` classes

**No CSS changes needed** — existing timeline classes are reused.

---

### 4. Achievement Metric Cards

**Replaces:** `.profile-achievement` list (currently inline, editable)

**New section in left column, below experience:**
```
.profile-metric-grid  (display: flex; flex-direction: column; gap: var(--s-3))
└─ .profile-metric-card × N
   ├─ .profile-metric-value  (font-size 22px, font-weight 700, color: var(--accent), min-width: 58px)
   └─ .profile-metric-body
      ├─ .profile-metric-title  (font-size 13px, font-weight 600, color: var(--text-1))
      └─ .profile-metric-context (font-size 11px, color: var(--text-2))
```

Card background: `var(--accent-wash)` (`#E6F0EA`), border: `1px solid var(--accent-a15)`, border-radius: `var(--r-md)`, padding: `12px 16px`, display: `flex`, align-items: `center`, gap: `16px`.

Metric values are derived from `profile.achievements` JSONB (the `metric` field on each achievement object). The editable `EditableAchievements` component moves here — rendered below the metric cards as the add/edit interface.

---

### 5. Education + Certifications

**New section, below achievement cards:**
```
.profile-education-card  (white card, border, border-radius: var(--r-lg), padding: 16px 20px)
├─ section label: "Education" (existing .profile-section-title style)
├─ .profile-edu-row × N  (flex row, space-between, font-size 13px)
│  ├─ left: degree bold + institution muted
│  └─ right: year muted
├─ divider (1px solid var(--border))
├─ section label: "Certifications"
└─ chip row: existing .profile-chip style (muted variant)
```

Data source: `profile.education` JSONB field. If the field doesn't exist yet, render a static hardcoded block for now (MA Political Science · University of Delhi 2012, BA Political Science (Hons) · University of Delhi 2010). Certifications also static for now (HubSpot Marketing Hub, Google Ads — in progress, Meta Blueprint).

**Note:** This is a display-only section in this phase. No edit UI.

---

### 6. Sidebar — Skills Panel

**Replaces:** Profile strength card in aside

**Structure:**
```
.profile-aside-card
├─ .profile-section-title: "Skills"
└─ .profile-skill-tags  (flex-wrap: wrap, gap: 6px)
   ├─ .profile-chip.profile-chip-primary × N  (primary skills — green)
   └─ .profile-chip × N  (secondary skills — muted)
```

Data source: existing `profile.toolStack` JSONB. Primary skills = items where `primary: true` (top N items), rest are secondary. The existing `EditableChipList` component moves here — skills are editable from the sidebar.

---

### 7. Sidebar — Live Pipeline Snapshot

**New card below skills:**
```
.profile-pipeline-card  (white card, border, border-radius: var(--r-lg), padding: 16px 20px)
├─ .profile-section-title: "Active pipeline"
├─ .profile-pipeline-rows
│  ├─ row: Applied  · count (grey dot)
│  ├─ row: Screening · count (amber dot)
│  └─ row: Interview · count (green dot)
├─ divider
└─ .profile-pipeline-avg: "Avg. fit score" · value%
```

Data source: job counts by status already available in the profile page (add a simple count query grouped by status in `page.tsx` — single DB call, no new schema). Dot colours: Applied = `var(--text-3)`, Screening = `#D4A84B`, Interview = `var(--accent)`.

**New CSS classes:**
```css
.profile-pipeline-row { display:flex; justify-content:space-between; align-items:center; padding: 4px 0; }
.profile-pipeline-dot { width:8px; height:8px; border-radius:2px; flex-shrink:0; }
.profile-pipeline-avg { display:flex; justify-content:space-between; font-size:12px; color:var(--text-2); padding-top:10px; }
```

---

### 8. Sidebar — Next Action Nudge

**New card below pipeline:**
```
.profile-next-action  (background: var(--accent-wash), border: 1px solid var(--accent-a15), border-radius: var(--r-lg), padding: 14px 18px)
├─ .profile-next-action-label: "Next action" (font-size 11px, font-weight 600, color: var(--accent))
└─ .profile-next-action-text (font-size 12px, color: #3D6B55)
```

Logic: find the earliest upcoming interview from jobs list (status = "interview", has `nextAction` or interview date). If none, show "No interviews scheduled — keep applying." as fallback.

---

### 9. Sidebar — Search Preferences (moved/kept)

The existing search preferences card moves below next-action, or is removed from sidebar if it makes the sidebar too long. Decision: **keep it**, but trim to 5 rows max (Location, Work mode, Salary, Availability, Dutch level). Remove the "How this affects matches" explainer card entirely.

---

## Responsive Behaviour

At `≤900px`: single column, hero becomes compact (smaller font, avatar 48px), sidebar cards flow below the main column. Same breakpoint as existing.

---

## What Does NOT Change

- Server actions (`actions.ts`) — untouched
- Database schema — untouched
- LinkedIn tab — untouched
- `EditableChipList` and `EditableAchievements` components — moved, not rewritten
- `RescoreNotice` toast — untouched
- URL structure — untouched

---

## Files to Touch

| File | Change |
|---|---|
| `src/app/(app)/profile/page.tsx` | New hero JSX, reorder sections, add pipeline query, add education section, move EditableChipList to sidebar |
| `src/components/profile/profile.css` | Add hero, metric card, pipeline, next-action, education CSS classes |
| `src/components/profile/ExperienceTimeline.tsx` | New client component for collapsible timeline |

---

## CSS Classes Added

| Class | Purpose |
|---|---|
| `.profile-hero` | Dark green hero wrapper |
| `.profile-hero-avatar` | White-tinted avatar circle |
| `.profile-hero-body` | Name/title/meta column |
| `.profile-hero-name` | White bold name |
| `.profile-hero-title` | Muted white headline |
| `.profile-hero-meta` | Flex row of location/links |
| `.profile-hero-right` | Score + edit button |
| `.profile-hero-score` | Large % number |
| `.profile-hero-edit` | Ghost edit button |
| `.profile-metric-grid` | Flex column of metric cards |
| `.profile-metric-card` | Individual achievement metric card |
| `.profile-metric-value` | Big green number |
| `.profile-metric-body` | Title + context column |
| `.profile-metric-title` | Metric title |
| `.profile-metric-context` | Metric context line |
| `.profile-edu-row` | Education degree row |
| `.profile-pipeline-row` | Pipeline stage row |
| `.profile-pipeline-dot` | Coloured stage indicator |
| `.profile-pipeline-avg` | Avg fit score row |
| `.profile-next-action` | Next action nudge card |
| `.profile-next-action-label` | "Next action" label |
| `.profile-next-action-text` | Action description |
| `.profile-skill-tags` | Skills tag container in sidebar |
