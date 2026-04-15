// vercel.ts — Vercel project configuration
//
// Cron is handled OUT-OF-PLATFORM via GitHub Actions
// (.github/workflows/nightly-cron.yml) because Vercel Hobby only allows
// daily crons (max 1/day) and we need ~24 invocations/night to fit the
// pipeline inside the 300s function timeout. Upgrade to Pro would unlock
// native cron, but keeps us free.
//
// See .github/workflows/nightly-cron.yml for the actual schedule.
import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  buildCommand: "next build",
  framework: "nextjs",
};

export default config;
