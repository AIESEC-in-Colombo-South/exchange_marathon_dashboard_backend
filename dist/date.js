import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek.js";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import { config } from "./config.js";
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);
export function toDateKey(input) {
    const d = dayjs(input);
    if (!d.isValid()) {
        return dayjs().tz(config.timezone).format("YYYY-MM-DD");
    }
    return d.tz(config.timezone).format("YYYY-MM-DD");
}
export function toWeekKey(input) {
    const d = dayjs(input);
    if (!d.isValid()) {
        const now = dayjs().tz(config.timezone);
        return `${now.isoWeekYear()}-W${String(now.isoWeek()).padStart(2, "0")}`;
    }
    const dz = d.tz(config.timezone);
    return `${dz.isoWeekYear()}-W${String(dz.isoWeek()).padStart(2, "0")}`;
}
export function nowIso() {
    return dayjs().tz(config.timezone).toISOString();
}
export function currentDateKey() {
    return dayjs().tz(config.timezone).format("YYYY-MM-DD");
}
export function getStartDateForPeriod(period) {
    const now = dayjs().tz(config.timezone);
    switch (period) {
        case "daily":
            return now.format("YYYY-MM-DD");
        case "weekly":
            return now.subtract(6, "day").format("YYYY-MM-DD");
        case "bi-weekly":
            return now.subtract(13, "day").format("YYYY-MM-DD");
        case "monthly":
            return now.subtract(30, "day").format("YYYY-MM-DD");
        case "marathon":
        default:
            return null;
    }
}
