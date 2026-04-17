import type { JobSource, RawJob } from "./types";
import { AdzunaSource } from "./adzuna";
import { IndeedNlSource } from "./indeed-nl";
import { JoobleSource } from "./jooble";
import { MagnetmeSource } from "./magnetme";
import { NvbSource } from "./nvb";

export type { JobSource, RawJob };

export function allSources(): JobSource[] {
  return [
    new AdzunaSource(),
    new IndeedNlSource(),
    new JoobleSource(),
    new MagnetmeSource(),
    new NvbSource(),
  ];
}
