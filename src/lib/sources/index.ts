import type { JobSource, RawJob } from "./types";
import { AdzunaSource } from "./adzuna";
import { ApifyIndeedSource } from "./apify-indeed";
import { ApifyLinkedInSource } from "./apify-linkedin";
// IndeedNlSource (RSS) disabled: Cloudflare blocks server-side fetches with 403.
// Replaced by ApifyIndeedSource which bypasses via managed browser.
// import { IndeedNlSource } from "./indeed-nl";
import { JoobleSource } from "./jooble";
import { MagnetmeSource } from "./magnetme";
import { NvbSource } from "./nvb";
import { WttjSource } from "./wttj";

export type { JobSource, RawJob };

export function allSources(): JobSource[] {
  return [
    new AdzunaSource(),
    new ApifyIndeedSource(),
    new ApifyLinkedInSource(),
    new JoobleSource(),
    new MagnetmeSource(),
    new NvbSource(),
    new WttjSource(),
  ];
}
