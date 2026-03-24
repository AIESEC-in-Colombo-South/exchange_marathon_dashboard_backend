import dotenv from "dotenv";

dotenv.config();

function numberEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function stringEnv(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

export const config = {
  port: numberEnv("PORT", 4000),
  timezone: stringEnv("TIMEZONE", "Asia/Colombo"),
  google: {
    spreadsheetId: stringEnv("GOOGLE_SPREADSHEET_ID"),
    sheetName: stringEnv("GOOGLE_SHEET_NAME", "Form Responses 1"),
    serviceAccountJson: stringEnv("GOOGLE_SERVICE_ACCOUNT_JSON"),
    columns: {
      email: stringEnv("SHEET_COL_EMAIL", "Email Address"),
      name: stringEnv("SHEET_COL_NAME", "Member Name"),
      role: stringEnv("SHEET_COL_ROLE", "Role"),
      team: stringEnv("SHEET_COL_TEAM", "Team"),
      squad: stringEnv("SHEET_COL_SQUAD", "Squad"),
      timestamp: stringEnv("SHEET_COL_TIMESTAMP", "Timestamp"),
      mous: stringEnv("SHEET_COL_MOUS", "MOUs"),
      coldCalls: stringEnv("SHEET_COL_COLD_CALLS", "Cold Calls"),
      followups: stringEnv("SHEET_COL_FOLLOWUPS", "Followups")
    }
  },
  firebase: {
    serviceAccountJson: stringEnv("FIREBASE_SERVICE_ACCOUNT_JSON")
  },
  scoring: {
    mou: numberEnv("POINTS_MOU", 10),
    coldCall: numberEnv("POINTS_COLD_CALL", 2),
    followup: numberEnv("POINTS_FOLLOWUP", 3)
  },
  syncScheduler: {
    enabled: booleanEnv("AUTO_SYNC_ENABLED", true),
    intervalMinutes: numberEnv("AUTO_SYNC_MINUTES", 30)
  }
};

export function assertSyncConfig(): void {
  if (!config.google.spreadsheetId) {
    throw new Error("GOOGLE_SPREADSHEET_ID is required for sync");
  }
  if (!config.google.serviceAccountJson) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is required for sync");
  }
  if (!config.firebase.serviceAccountJson) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required");
  }
}
