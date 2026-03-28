/*************************************************
 * IGT B2B MEMBERS SHEET SYNC (FINALLY ADJUSTED)
 *************************************************/

const BACKEND_URL = "https://exchange-marathon-dashboard-backend.onrender.com";

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Dashboard Sync")
    .addItem("Sync IGT B2B Members", "syncIgtB2BSheet")
    .addToUi();
}

/**
 * Main Sync Function
 */
function syncIgtB2BSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // Ensure this matches your sheet name - exactly as it appears
  const sheet = ss.getSheetByName("Members") || ss.getActiveSheet(); 

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    SpreadsheetApp.getUi().alert("No data found in the sheet.");
    return;
  }

  // Row 1: Headers
  const headers = data[0].map(h => normalizeHeader(h));
  const rows = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // Skip empty rows
    if (row.every(cell => cell === "" || cell === null)) continue;
    
    // Check if Name exists (Column B / Index 1)
    if (!row[1]) continue;

    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = cleanValue(row[index]);
    });
    
    // Explicitly add a helper for the team totals
    // The backend is already expecting 'team_totals' and rewards
    rows.push(obj);
  }

  const payload = {
    tableName: "igt_b2b_members",
    rows: rows
  };

  try {
    const response = UrlFetchApp.fetch(`${BACKEND_URL}/sync/igt-b2b`, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload)
    });
    
    const result = JSON.parse(response.getContentText());
    if (result.ok) {
      SpreadsheetApp.getActiveSpreadsheet().toast(`Successfully synced ${result.upserted} records ✅`);
    } else {
      SpreadsheetApp.getUi().alert("Sync Error: " + result.error);
    }
  } catch (e) {
    SpreadsheetApp.getUi().alert("Connection Failed: Ensure the backend is awake.");
  }
}

// ===== HELPERS (CRITICAL FOR MAPPING) =====

/**
 * Normalizes headers.
 * "Team meeting (online/physical)" becomes "team_meeting_onlinephysical"
 * "Team Totals" becomes "team_totals"
 */
function normalizeHeader(header) {
  return String(header)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\w]/g, "");
}

function cleanValue(value) {
  if (value === "" || value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}
