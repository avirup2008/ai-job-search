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
 * Fan out to every registered job source in parallel — all sources run concurrently.
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
  const sources = allSources();
  const limit = pLimit(sources.length); // one slot per source — true parallel fan-out
  const perSource: Record<string, number> = {};
  const errors: Record<string, string> = {};

  const results = await Promise.all(
    sources.map((s) =>
      limit(async () => {
        let timerId: ReturnType<typeof setTimeout> | undefined;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timerId = setTimeout(
            () => reject(new Error(`timeout after ${timeoutMs}ms`)),
            timeoutMs
          );
        });
        try {
          const jobs = await Promise.race([s.fetch(), timeoutPromise]);
          clearTimeout(timerId);
          perSource[s.name] = jobs.length;
          return jobs;
        } catch (e) {
          clearTimeout(timerId);
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
