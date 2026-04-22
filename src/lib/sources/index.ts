import type { JobSource, RawJob } from "./types";
import { AdzunaSource } from "./adzuna";
// ApifyIndeedSource disabled: Apify free tier exhausted until 2026-05-18.
// import { ApifyIndeedSource } from "./apify-indeed";
// ApifyLinkedInSource disabled: Apify free tier exhausted until 2026-05-18.
// import { ApifyLinkedInSource } from "./apify-linkedin";
// IndeedNlSource (RSS) re-enabled as fallback while Apify is unavailable.
// Was blocked by Cloudflare in Apr 2026 — worth retrying.
import { IndeedNlSource } from "./indeed-nl";
import { JoobleSource } from "./jooble";
import { MagnetmeSource } from "./magnetme";
import { NvbSource } from "./nvb";
import { WttjSource } from "./wttj";
import { LinkedInGuestSource } from "./linkedin-guest";

export type { JobSource, RawJob };

export function allSources(): JobSource[] {
  return [
    new AdzunaSource(),
    new IndeedNlSource(),
    new JoobleSource(),
    new LinkedInGuestSource(),
    new MagnetmeSource(),
    new NvbSource(),
    new WttjSource(),
  ];
}
