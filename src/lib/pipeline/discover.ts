import pLimit from "p-limit";
import { allSources } from "@/lib/sources";
import type { RawJob } from "@/lib/sources/types";

export interface DiscoverResult {
  jobs: RawJob[];
  perSource: Record<string, number>;
  errors: Record<string, string>;
  elapsedMs: number;
}

const SOURCE_TIMEOUT_MS = 45_000;

/**
 * Fan out to every registered job source in parallel (max 2 concurrent).
 * Each source is raced against a per-source deadline so one hanging source
 * (e.g. an Apify actor that never resolves) cannot consume the full Vercel
 * 300s function budget. Timeout failures are recorded in errors[source.name]
 * exactly like any other error — no change to the error isolation contract.
 */
export async function discover(
  opts: { sourceTimeoutMs?: number } = {}
): Promise<DiscoverResult> {
  const started = Date.now();
  const timeoutMs = opts.sourceTimeoutMs ?? SOURCE_TIMEOUT_MS;
  const limit = pLimit(6); // one slot per source — all fan out in parallel
  const sources = allSources();
  const perSource: Record<string, number> = {};
  const errors: Record<string, string> = {};

  const results = await Promise.all(
    sources.map((s) =>
      limit(async () => {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`timeout after ${timeoutMs}ms`)),
            timeoutMs
          )
        );
        try {
          const jobs = await Promise.race([s.fetch(), timeoutPromise]);
          perSource[s.name] = jobs.length;
          return jobs;
        } catch (e) {
          errors[s.name] = e instanceof Error ? e.message : String(e);
          perSource[s.name] = 0;
          return [] as RawJob[];
        }
      })
    )
  );

  return {
    jobs: results.flat(),
    perSource,
    errors,
    elapsedMs: Date.now() - started,
  };
}
