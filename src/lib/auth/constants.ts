/**
 * Shared auth constants for Disha session management.
 * Single source of truth for cookie name.
 *
 * EDGE-SAFE: no Node.js imports. This file is imported by middleware.ts
 * which runs in the Edge Runtime. Keep it free of node:* imports.
 *
 * For session token derivation use node:crypto directly in Node.js
 * contexts (API routes, page.tsx) — not here.
 */

export const COOKIE_NAME = "disha_session" as const;
