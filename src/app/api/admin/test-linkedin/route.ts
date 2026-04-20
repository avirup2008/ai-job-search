import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { ApifyLinkedInSource } from "@/lib/sources/apify-linkedin";

export const runtime = "nodejs";
export const maxDuration = 60;

// Admin-only: test the LinkedIn Apify source with a single keyword ("marketing automation").
// Full 5-keyword run happens in the nightly cron — this just verifies the actor is working.
export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  try {
    const source = new ApifyLinkedInSource();
    const url = new URL("https://www.linkedin.com/jobs/search/");
    url.searchParams.set("keywords", "marketing automation");
    url.searchParams.set("location", "Netherlands");
    url.searchParams.set("f_TPR", "r604800");

    const jobs = await source.runActor([url.toString()]);
    const sample = jobs.slice(0, 5).map((j) => `${j.title} @ ${j.companyName ?? "?"}`);
    return NextResponse.json({ ok: true, count: jobs.length, sample });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
