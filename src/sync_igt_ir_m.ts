import { getSupabase } from "./supabase.js";
import type { IgvIrmSyncPayload } from "./types.js";

export async function syncIgvIrmData(payload: IgvIrmSyncPayload) {
  if (!payload) {
    throw new Error("Missing sync payload. Ensure your Apps Script is sending the data correctly.");
  }

  const supabase = getSupabase() as any;
  const results: Record<string, { count: number; status: string }> = {};

  const syncConfigs = [
    {
      tableName: "matching_members",
      rows: payload.matching_members,
    },
    {
      tableName: "ir_members",
      rows: payload.ir_members,
    },
    {
      tableName: "marcom_members",
      rows: payload.marcom_members,
    },
  ];

  for (const config of syncConfigs) {
    const { tableName, rows } = config;
    try {
      if (!rows || !Array.isArray(rows)) {
        throw new Error(`Invalid row data for ${tableName}`);
      }
      
      console.log(`🔄 Syncing table: ${tableName} with ${rows.length} rows...`);

      // 1. Remove duplicates from the payload itself before inserting
      // to avoid unique constraint violations
      const uniqueRows = [];
      const seenKeys = new Set();
      
      for (const row of rows as any[]) {
        let key;
        const name = String(row.name || "unknown").toLowerCase();
        
        if (tableName === "marcom_members") {
          key = `marcom|${name}`;
        } else {
          // matching_members and ir_members use (name, team)
          const team = String(row.team || "unknown").toLowerCase();
          key = `${tableName}|${name}|${team}`;
        }
        
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          uniqueRows.push(row);
        } else {
          console.warn(`⚠️ Skipping duplicate row in payload for ${tableName}: ${key}`);
        }
      }

      // 2. Clear existing data
      const { error: deleteError } = await supabase
        .from(tableName)
        .delete()
        .neq("id", -1);

      if (deleteError) {
        throw new Error(`Failed to clear table ${tableName}: ${deleteError.message}`);
      }

      // 3. Insert unique rows
      if (uniqueRows.length > 0) {
        const { error: insertError } = await supabase
          .from(tableName)
          .insert(uniqueRows);

        if (insertError) {
          throw new Error(`Failed to insert into ${tableName}: ${insertError.message}`);
        }
      }

      results[tableName] = { count: uniqueRows.length, status: "success" };
      console.log(`✅ Table ${tableName} synced successfully.`);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error(`❌ Error syncing table ${tableName}:`, errorMsg);
      results[tableName] = { 
        count: 0, 
        status: `error: ${errorMsg}` 
      };
      // We throw here to make the whole request fail so the user sees it in Apps Script
      throw new Error(`Sync failed for ${tableName}: ${errorMsg}`);
    }
  }

  return results;
}
