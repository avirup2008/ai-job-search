import type { JobSource, RawJob } from "./types";
import { AdzunaSource } from "./adzuna";
// IndeedNlSource disabled: Cloudflare now blocks server-side RSS fetches with 403.
// Re-enable if a proxy/workaround becomes available.
// import { IndeedNlSource } from "./indeed-nl";
import { JoobleSource } from "./jooble";
import { MagnetmeSource } from "./magnetme";
import { NvbSource } from "./nvb";

export type { JobSource, RawJob };

export function allSources(): JobSource[] {
  return [
    new AdzunaSource(),
    // new IndeedNlSource(), // blocked by Cloudflare
    new JoobleSource(),
    new MagnetmeSource(),
    new NvbSource(),
  ];
}
