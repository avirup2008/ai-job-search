// vercel.ts — Vercel project configuration
//
// The DISCOVERY pipeline (~24 invocations/night) still runs OUT-OF-PLATFORM
// via GitHub Actions (.github/workflows/nightly-cron.yml) because Vercel
// Hobby allows at most 1 cron/day on the platform itself.
//
// The RETENTION purge (Phase 11) is exactly 1/day, so it fits Hobby's native
// cron budget — hence the `crons` entry below. The two coexist: GH Actions
// drives discovery; Vercel Cron drives retention.
//
// See .github/workflows/nightly-cron.yml for the discovery schedule.
import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  buildCommand: "next build",
  framework: "nextjs",
  crons: [
    // 01:00 UTC = 03:00 Europe/Amsterdam (CEST). Close enough in CET (02:00
    // local) — DST drift not worth the engineering cost for a retention job.
    { path: "/api/cron/purge", schedule: "0 1 * * *" },
  ],
};

export default config;
