import pLimit from "p-limit";
import { allSources } from "@/lib/sources";
import type { RawJob } from "@/lib/sources/types";

export interface DiscoverResult {
  jobs: RawJob[];
  perSource: Record<string, number>;
  errors: Record<string, string>;
  elapsedMs: number;
}

/**
 * Fan out to every registered job source in parallel (max 2 concurrent),
 * normalize errors into per-source strings so one bad source never poisons the
 * whole run, and return the flattened job list plus diagnostics.
 */
export async function discover(): Promise<DiscoverResult> {
  const started = Date.now();
  const limit = pLimit(2);
  const sources = allSources();
  const perSource: Record<string, number> = {};
  const errors: Record<string, string> = {};

  const results = await Promise.all(
    sources.map((s) =>
      limit(async () => {
        try {
          const jobs = await s.fetch();
          perSource[s.name] = jobs.length;
          return jobs;
        } catch (e) {
          errors[s.name] = e instanceof Error ? e.message : String(e);
          perSource[s.name] = 0;
          return [] as RawJob[];
        }
      }),
    ),
  );

  return {
    jobs: results.flat(),
    perSource,
    errors,
    elapsedMs: Date.now() - started,
  };
}
