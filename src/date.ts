import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek.js";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import { config } from "./config.js";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);

export function toDateKey(input: string | Date): string {
  return dayjs(input).tz(config.timezone).format("YYYY-MM-DD");
}

export function toWeekKey(input: string | Date): string {
  const d = dayjs(input).tz(config.timezone);
  return `${d.isoWeekYear()}-W${String(d.isoWeek()).padStart(2, "0")}`;
}

export function nowIso(): string {
  return dayjs().tz(config.timezone).toISOString();
}

export function currentDateKey(): string {
  return dayjs().tz(config.timezone).format("YYYY-MM-DD");
}

export function getStartDateForPeriod(period: string): string | null {
  const now = dayjs().tz(config.timezone);
  switch (period) {
    case "daily":
      return now.format("YYYY-MM-DD");
    case "weekly":
      return now.startOf("isoWeek").format("YYYY-MM-DD");
    case "bi-weekly":
      return now.subtract(14, "day").format("YYYY-MM-DD");
    case "monthly":
      return now.startOf("month").format("YYYY-MM-DD");
    case "marathon":
    default:
      return null;
  }
}
