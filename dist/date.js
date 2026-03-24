import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek.js";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import { config } from "./config.js";
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);
export function toDateKey(input) {
    return dayjs(input).tz(config.timezone).format("YYYY-MM-DD");
}
export function toWeekKey(input) {
    const d = dayjs(input).tz(config.timezone);
    return `${d.isoWeekYear()}-W${String(d.isoWeek()).padStart(2, "0")}`;
}
export function nowIso() {
    return dayjs().tz(config.timezone).toISOString();
}
export function currentDateKey() {
    return dayjs().tz(config.timezone).format("YYYY-MM-DD");
}
