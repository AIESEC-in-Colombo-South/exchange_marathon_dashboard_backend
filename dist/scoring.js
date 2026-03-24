import { config } from "./config.js";
export function computePoints(counts) {
    return (counts.mous * config.scoring.mou +
        counts.coldCalls * config.scoring.coldCall +
        counts.followups * config.scoring.followup);
}
