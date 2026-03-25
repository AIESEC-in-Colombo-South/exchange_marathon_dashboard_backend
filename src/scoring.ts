import { config } from "./config.js";
import type { CriteriaCounts } from "./types.js";

export interface ScoringRules {
  mou: number;
  coldCall: number;
  followup: number;
}

export function computePoints(counts: CriteriaCounts, customRules?: ScoringRules): number {
  const rules = customRules || config.scoring;
  return (
    counts.mous * rules.mou +
    counts.coldCalls * rules.coldCall +
    counts.followups * rules.followup
  );
}
