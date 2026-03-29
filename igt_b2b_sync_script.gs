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
 * Test Connection function
 */
function testConnection() {
  try {
    const response = UrlFetchApp.fetch(`${BACKEND_URL}/health`, { muteHttpExceptions: true });
    SpreadsheetApp.getActiveSpreadsheet().toast(`Backend is awake! Time: ${JSON.parse(response.getContentText()).timezone} ✅`);
  } catch (e) {
    SpreadsheetApp.getUi().alert("Backend is still sleeping or unreachable. Please wait 30 seconds and try again.");
  }
}

/**
 * Main Sync Function
 */
function syncIgtB2BSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Members") || ss.getActiveSheet(); 

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    SpreadsheetApp.getUi().alert("No data found in the sheet.");
    return;
  }

  const headers = data[0].map(h => normalizeHeader(h));
  const rows = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row.every(cell => cell === "" || cell === null)) continue;
    if (!row[1]) continue;

    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = cleanValue(row[index]);
    });
    rows.push(obj);
  }

  const payload = {
    tableName: "igt_b2b_members",
    rows: rows
  };

  SpreadsheetApp.getActiveSpreadsheet().toast("Waking up the backend... Please wait ⏳");

  try {
    const response = UrlFetchApp.fetch(`${BACKEND_URL}/sync/igt-b2b`, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    
    const responseText = response.getContentText();
    const result = JSON.parse(responseText);
    
    if (result.ok) {
      SpreadsheetApp.getActiveSpreadsheet().toast(`Successfully synced ${result.upserted} records ✅`);
    } else {
      SpreadsheetApp.getUi().alert("Sync Error (Backend): " + (result.error || responseText));
    }
  } catch (e) {
    // If it fails, try a simple wake up GET and tell user to retry
    try { UrlFetchApp.fetch(BACKEND_URL); } catch(err) {} 
    SpreadsheetApp.getUi().alert("Connection Failed. The backend is waking up from sleep mode. Please wait 10-20 seconds and click Sync again.");
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
    .replace(/[^\w\s]/g, "") // Remove special characters like /
    .replace(/\s+/g, "_")    // Replace spaces with underscores
    .replace(/_+/g, "_");    // Collapse multiple underscores
}

function cleanValue(value) {
  if (value === "" || value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}
