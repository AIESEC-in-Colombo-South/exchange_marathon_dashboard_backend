import { config } from "./config.js";
import type { CriteriaCounts } from "./types.js";

export function computePoints(counts: CriteriaCounts): number {
  return (
    counts.mous * config.scoring.mou +
    counts.coldCalls * config.scoring.coldCall +
    counts.followups * config.scoring.followup
  );
}
