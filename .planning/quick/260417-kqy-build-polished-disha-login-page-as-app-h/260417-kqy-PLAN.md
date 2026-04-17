---
phase: quick
plan: 260417-kqy
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/page.tsx
  - src/app/api/auth/login/route.ts
  - src/app/api/auth/logout/route.ts
  - src/middleware.ts
  - src/components/app-shell/TopBar.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "Visiting / shows a centred Disha login card, not app content"
    - "Correct password sets disha_session cookie and redirects to /inbox"
    - "Wrong password shakes the card and shows red error text"
    - "Authenticated users can reach /inbox, /pipeline, /analytics without being redirected"
    - "Unauthenticated users hitting any gated route are redirected to /"
    - "TopBar has a Sign out link that clears the cookie and returns to /"
  artifacts:
    - path: src/app/page.tsx
      provides: Login page component
    - path: src/app/api/auth/login/route.ts
      provides: POST handler — validates password, sets disha_session cookie
    - path: src/app/api/auth/logout/route.ts
      provides: POST handler — clears disha_session cookie, redirects to /
    - path: src/middleware.ts
      provides: Edge auth gate using disha_session cookie
    - path: src/components/app-shell/TopBar.tsx
      provides: Sign out button wired to /api/auth/logout
  key_links:
    - from: src/app/page.tsx
      to: /api/auth/login
      via: fetch POST on form submit
    - from: src/middleware.ts
      to: disha_session cookie
      via: Web Crypto sha256 comparison
    - from: src/components/app-shell/TopBar.tsx
      to: /api/auth/logout
      via: fetch POST on Sign out click
---

<objective>
Replace the placeholder homepage with a polished Disha login page, add matching
auth API routes, and update the middleware to gate on the new disha_session cookie.

Purpose: Disha is a personal app — a single password gate is the right protection.
The current middleware uses the old aijs_admin / ADMIN_SECRET pairing which is now
superseded.

Output: Login page at /, two auth API routes, updated middleware, Sign out in TopBar.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@src/app/globals.css
@src/app/layout.tsx
@src/middleware.ts
@src/components/app-shell/TopBar.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Auth API routes — /api/auth/login and /api/auth/logout</name>
  <files>src/app/api/auth/login/route.ts, src/app/api/auth/logout/route.ts</files>
  <action>
Create both route files as Node.js serverless functions (NOT Edge — needs Node crypto).

**src/app/api/auth/login/route.ts**
- Import: `import crypto from "node:crypto"` and `{ NextResponse } from "next/server"`.
- Export a named `POST` function (no `export const runtime`; defaults to Node).
- Parse body as JSON; expect `{ password: string }`.
- Read `process.env.DISHA_PASSWORD`. If undefined, return 503 `{ error: "server misconfigured" }`.
- Compute `expectedHash = crypto.createHash("sha256").update(DISHA_PASSWORD).digest("hex")`.
- Compute `submittedHash = crypto.createHash("sha256").update(password ?? "").digest("hex")`.
- Use `crypto.timingSafeEqual(Buffer.from(expectedHash), Buffer.from(submittedHash))` for comparison.
- On match: create NextResponse with `{ ok: true }`, set cookie `disha_session` = `expectedHash`,
  `httpOnly: true`, `sameSite: "lax"`, `path: "/"`, `maxAge: 60 * 60 * 24 * 30`. Return 200.
- On mismatch: return 401 `{ error: "incorrect password" }`.

**src/app/api/auth/logout/route.ts**
- Export named `POST` function.
- Delete cookie `disha_session` (set maxAge 0 / expires in the past).
- Return `NextResponse.redirect(new URL("/", request.url))`.
  Accept `request: NextRequest` as the parameter so the URL is available.
  </action>
  <verify>
    <automated>curl -s -X POST http://localhost:3000/api/auth/login -H "content-type: application/json" -d '{"password":"wrong"}' | grep -q "incorrect" && echo "401 OK" || echo "FAIL"</automated>
  </verify>
  <done>POST /api/auth/login returns 401 for wrong password and 200 + Set-Cookie for correct password. POST /api/auth/logout clears the cookie and redirects to /.</done>
</task>

<task type="auto">
  <name>Task 2: Login page at / and update middleware</name>
  <files>src/app/page.tsx, src/middleware.ts</files>
  <action>
**src/app/page.tsx** — "use client" component.

Imports: `useState`, `useRef` from react.

State: `password: string`, `error: string | null`, `shaking: boolean`, `loading: boolean`.

Layout: full-viewport flex column + row centred (`min-h-screen flex items-center justify-center`
using inline styles or Tailwind if available — prefer CSS vars / globals.css classes since the
project uses plain CSS classes).

Use inline styles that reference CSS variables so fonts and colours match the design system.
The page background should be `var(--ground)`.

Card structure (inline styles, ~360px wide):
```
background: var(--surface)
border: 1px solid var(--border)
border-radius: 16px            /* rounded-xl */
padding: 40px 32px
box-shadow: var(--shadow-lg)
width: 100%
max-width: 360px
```

Add a `@keyframes shake` animation in a `<style>` tag inside the component:
```css
@keyframes disha-shake {
  0%, 100% { transform: translateX(0); }
  15%       { transform: translateX(-6px); }
  30%       { transform: translateX(6px); }
  45%       { transform: translateX(-6px); }
  60%       { transform: translateX(6px); }
  75%       { transform: translateX(-4px); }
  90%       { transform: translateX(4px); }
}
```
Apply `animation: disha-shake 400ms ease-in-out` to the card when `shaking === true`.
Reset `shaking` to false after 400ms via `setTimeout`.

Card content (top to bottom):
1. `<h1>` with class `h1` and inline `font-family: var(--font-display)` — text: "Disha"
2. `<p>` — text: "Job search, handled." — colour `var(--text-2)`, margin-top 4px, font-size 15px
3. `<form>` with onSubmit handler, margin-top 28px, display flex flex-col gap 12px
4. `<input>` — type="password", placeholder="Password", className="input" (uses globals.css .input),
   value={password}, onChange handler. If `error` is set, add `border-color: var(--danger)` and
   `box-shadow: 0 0 0 3px rgba(153,27,27,0.15)` via inline style override.
5. `<button>` type="submit" className="btn" with `width: "100%"` — text: loading ? "Entering…" : "Enter"
   disabled when loading.
6. If `error`: `<p>` with colour `var(--danger)`, font-size 13px, margin-top 4px — text: {error}

onSubmit handler:
- e.preventDefault()
- setLoading(true), setError(null)
- fetch POST /api/auth/login with `{ password }`
- On 200: `window.location.href = "/inbox"`
- On non-200: parse json, setError("Incorrect password"), setShaking(true),
  setTimeout(() => setShaking(false), 410), setPassword("")
- Finally: setLoading(false)

---

**src/middleware.ts** — full rewrite.

Cookie name changes from `aijs_admin` to `disha_session`.
Auth logic changes from plain string compare to sha256 compare using Web Crypto (Edge runtime).

New logic:
```typescript
const COOKIE_NAME = "disha_session";

async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const pw = process.env.DISHA_PASSWORD;
  if (!pw) return false;
  const cookieValue = request.cookies.get(COOKIE_NAME)?.value;
  if (!cookieValue) return false;
  const encoded = new TextEncoder().encode(pw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const expectedHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return cookieValue === expectedHex;
}
```

In the middleware function, `await isAuthenticated(request)`.
- Authenticated: `return NextResponse.next()`
- Unauthenticated API route: return 401 JSON
- Unauthenticated page route: redirect to `/` (not `/admin/login`)

Matcher — keep existing gated paths, no changes to matcher array:
```typescript
export const config = {
  matcher: [
    "/inbox/:path*",
    "/pipeline/:path*",
    "/analytics/:path*",
    "/paste/:path*",
    "/api/generate/:path*",
    "/api/download-pack/:path*",
  ],
};
```
Note: `/`, `/api/auth/*`, `/api/cron/*`, `/api/health`, `/p/:slug*` are NOT in the matcher,
so they are never processed by middleware — this is correct, no explicit allow-list needed.

The middleware function must be declared `async` since `isAuthenticated` uses `await`.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>
/ renders the login card. TypeScript reports no errors in page.tsx or middleware.ts.
Middleware correctly redirects unauthenticated requests to / instead of /admin/login.
  </done>
</task>

<task type="auto">
  <name>Task 3: Sign out button in TopBar</name>
  <files>src/components/app-shell/TopBar.tsx</files>
  <action>
Add a "Sign out" button to the right side of the TopBar, after the existing "+ Paste a role" button.

Implementation:
- Add a `handleSignOut` async function inside the component:
  ```typescript
  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }
  ```
- Add after the existing `<button className="topbar-paste">` element:
  ```tsx
  <button
    className="btn-ghost"
    onClick={handleSignOut}
    style={{ fontSize: 13, padding: "6px 12px" }}
  >
    Sign out
  </button>
  ```
- Use the existing `btn-ghost` class from globals.css for consistent styling.
- No new imports needed — `fetch` and `window` are browser globals.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>TopBar renders a "Sign out" button. Clicking it posts to /api/auth/logout and redirects to /.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → /api/auth/login | Unauthenticated POST; password arrives in JSON body |
| Edge middleware → gated routes | Cookie value crosses Edge runtime; compared against env var hash |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-kqy-01 | Spoofing | /api/auth/login | mitigate | timingSafeEqual prevents timing oracle; sha256 stored in cookie avoids plaintext exposure |
| T-kqy-02 | Information Disclosure | disha_session cookie | mitigate | httpOnly prevents JS access; sameSite=lax blocks cross-site send |
| T-kqy-03 | Spoofing | middleware sha256 compare | accept | sha256 of a personal password is sufficient for single-user personal app; bcrypt overkill |
| T-kqy-04 | Elevation of Privilege | missing DISHA_PASSWORD env var | mitigate | login route returns 503; middleware returns false (fail closed) |
</threat_model>

<verification>
1. `npx tsc --noEmit` — zero errors across all five modified files
2. Local dev: `DISHA_PASSWORD=test pnpm dev`, visit http://localhost:3000 — login card renders
3. Submit wrong password — card shakes, "Incorrect password" in red, input clears
4. Submit correct password — redirected to /inbox
5. Visit /inbox without cookie — redirected to /
6. Click Sign out — cookie cleared, redirected to /
</verification>

<success_criteria>
- Login card renders at / with Disha heading, subtitle, password input, Enter button
- Correct password → disha_session cookie set → redirect /inbox
- Wrong password → 401 → shake animation + red error
- Middleware uses disha_session (not aijs_admin) for all gated routes
- Unauthenticated gated page → redirect to / (not /admin/login)
- TopBar Sign out button posts to /api/auth/logout and redirects to /
- TypeScript clean: npx tsc --noEmit passes
</success_criteria>

<output>
After completion, create `.planning/quick/260417-kqy-build-polished-disha-login-page-as-app-h/260417-kqy-SUMMARY.md`
</output>
