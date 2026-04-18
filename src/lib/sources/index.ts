import type { JobSource, RawJob } from "./types";
import { AdzunaSource } from "./adzuna";
import { ApifyIndeedSource } from "./apify-indeed";
// IndeedNlSource (RSS) disabled: Cloudflare blocks server-side fetches with 403.
// Replaced by ApifyIndeedSource which bypasses via managed browser.
// import { IndeedNlSource } from "./indeed-nl";
import { JoobleSource } from "./jooble";
import { MagnetmeSource } from "./magnetme";
import { NvbSource } from "./nvb";

export type { JobSource, RawJob };

export function allSources(): JobSource[] {
  return [
    new AdzunaSource(),
    new ApifyIndeedSource(),
    new JoobleSource(),
    new MagnetmeSource(),
    new NvbSource(),
  ];
}
