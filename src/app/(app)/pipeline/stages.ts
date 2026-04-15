export const PIPELINE_STAGES = ["new", "saved", "applied", "interview", "offer", "rejected"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];
