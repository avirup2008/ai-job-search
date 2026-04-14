export interface RawJob {
  source: string;                      // 'adzuna' | 'jooble' | 'werknl' | 'nvb' | ...
  sourceExternalId: string;            // stable id within source
  sourceUrl: string;                   // public URL for the listing
  title: string;
  jdText: string;                      // plain text; HTML stripped
  companyName: string | null;
  companyDomain: string | null;        // null if unknown; populated by later enrichment
  location: string | null;
  postedAt: Date | null;
}

export interface JobSource {
  readonly name: string;
  fetch(): Promise<RawJob[]>;
}
