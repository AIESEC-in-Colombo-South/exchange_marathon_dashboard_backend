import { config } from "./config.js";
import { getSupabase } from "./supabase.js";
import { fetchMultipleSheets } from "./sheets.js";
import { nowIso } from "./date.js";
import type { MktMember } from "./types.js";

export async function syncMktMembers() {
  const spreadsheetId = config.google.mkt?.spreadsheetId;
  const sheetName = config.google.mkt?.sheetName || "Sheet1";

  if (!spreadsheetId) {
    console.warn("⚠️ MKT_SPREADSHEET_ID is not configured. Skipping MKT sync.");
    return { success: false, error: "MKT_SPREADSHEET_ID missing" };
  }

  console.log(`🔄 Starting MKT sync from sheet: ${sheetName} (${spreadsheetId})`);

  try {
    const multiSheetData = await fetchMultipleSheets([sheetName], spreadsheetId);
    const rows = multiSheetData[sheetName];

    if (!rows || rows.length === 0) {
      console.warn(`⚠️ No data found in MKT sheet "${sheetName}"`);
      return { success: true, count: 0 };
    }

    const records: MktMember[] = rows
      .map((row) => ({
        Member: String(row["Member"] || "").trim(),
        Position: String(row["Position"] || "").trim(),
        Points: String(row["Points"] || "0").trim(),
        updated_at: nowIso()
      }))
      .filter((r) => r.Member !== "" && r.Position !== "");

    if (records.length === 0) {
      console.warn("⚠️ No valid MKT records to sync after filtering empty rows.");
      return { success: true, count: 0 };
    }

    const supabase = getSupabase() as any;
    const { error } = await supabase
      .from("mkt_members")
      .upsert(records, { onConflict: "Member,Position" });

    if (error) {
      throw error;
    }

    console.log(`✅ Successfully synced ${records.length} MktMembers.`);
    return { success: true, count: records.length };

  } catch (error) {
    console.error("❌ MKT sync failed:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
