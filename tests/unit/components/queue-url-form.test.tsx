/**
 * QueueUrlForm — unit tests for client-side validation logic.
 *
 * No DOM / testing-library available (vitest env: node). Tests exercise the
 * validation rules that will be implemented in QueueUrlForm.tsx by importing
 * and calling the exported validation helper directly.
 *
 * The component itself is verified visually in the Task 3 checkpoint.
 */

import { describe, it, expect } from "vitest";
import { validateQueueUrl, LINKEDIN_MESSAGE } from "@/components/inbox/QueueUrlForm";

const VALID_URL = "https://werk.nl/vacature/12345";

describe("QueueUrlForm — validateQueueUrl", () => {
  it("t1: returns error when URL is empty", () => {
    expect(validateQueueUrl("")).toEqual({ ok: false, error: "Paste a job URL first." });
  });

  it("t2: returns error when URL is whitespace only", () => {
    expect(validateQueueUrl("   ")).toEqual({ ok: false, error: "Paste a job URL first." });
  });

  it("t3: returns error for non-http URL (ftp://)", () => {
    const result = validateQueueUrl("ftp://example.com/job");
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toContain("http://");
  });

  it("t4: returns LinkedIn error BEFORE any network call — exact message", () => {
    const result = validateQueueUrl("https://www.linkedin.com/jobs/view/1234567890");
    expect(result).toEqual({ ok: false, error: LINKEDIN_MESSAGE });
  });

  it("t5: returns LinkedIn error for http linkedin.com variant", () => {
    const result = validateQueueUrl("http://linkedin.com/in/someone");
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toBe(LINKEDIN_MESSAGE);
  });

  it("t6: returns ok:true for a valid non-LinkedIn https URL", () => {
    expect(validateQueueUrl(VALID_URL)).toEqual({ ok: true });
  });

  it("t7: returns ok:true for a valid http URL", () => {
    expect(validateQueueUrl("http://example-jobs.com/role/42")).toEqual({ ok: true });
  });
});

describe("QueueUrlForm — LINKEDIN_MESSAGE constant", () => {
  it("contains the canonical LinkedIn rejection text", () => {
    expect(LINKEDIN_MESSAGE).toContain("LinkedIn requires login");
    expect(LINKEDIN_MESSAGE).toContain("job description text");
  });
});
