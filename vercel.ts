// vercel.ts — Vercel project configuration
// Chunked-cron pattern: run every 15 min during a 6-hour UTC work window.
// Orchestrator is idempotent, so each tick gets ~5 min of work done and
// the next tick picks up the remainder. Total: 24 invocations × ~300s =
// plenty of runway for even the worst-case 14 min full batch.
//
// 00:00–06:00 UTC = 02:00–08:00 CEST (summer) = 01:00–07:00 CET (winter).
// This keeps the work window in the early hours regardless of DST.
import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  buildCommand: "next build",
  framework: "nextjs",
  crons: [
    { path: "/api/cron/nightly", schedule: "*/15 0-5 * * *" },
  ],
};

export default config;
