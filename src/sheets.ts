import { google } from "googleapis";
import { config } from "./config.js";

export type SheetRow = Record<string, string>;

function getGoogleAuth() {
  if (!config.google.serviceAccountJson) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not configured");
  }

  const credentials = JSON.parse(config.google.serviceAccountJson);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  });
}

export async function fetchSheetRows(): Promise<SheetRow[]> {
  if (!config.google.spreadsheetId) {
    throw new Error("GOOGLE_SPREADSHEET_ID is not configured");
  }

  const sheets = google.sheets({ version: "v4", auth: getGoogleAuth() });
  const range = `${config.google.sheetName}!A:Z`;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.google.spreadsheetId,
    range
  });

  const values = response.data.values || [];
  if (values.length < 2) return [];

  const headers = values[0].map((h) => String(h).trim());
  const rows = values.slice(1);

  return rows.map((cells) => {
    const obj: SheetRow = {};
    headers.forEach((header, index) => {
      obj[header] = String(cells[index] ?? "").trim();
    });
    return obj;
  });
}
