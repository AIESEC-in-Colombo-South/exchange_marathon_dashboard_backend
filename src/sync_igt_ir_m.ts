import { getSupabase } from "./supabase.js";
import type { IgvIrmSyncPayload } from "./types.js";

export async function syncIgvIrmData(payload: IgvIrmSyncPayload) {
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
      console.log(`🔄 Syncing table: ${tableName} with ${rows.length} rows...`);

      // Clear existing data (Truncate strategy)
      const { error: deleteError } = await supabase
        .from(tableName)
        .delete()
        .neq("id", -1);

      if (deleteError) {
        throw new Error(`Failed to clear table ${tableName}: ${deleteError.message}`);
      }

      if (rows.length > 0) {
        // Map rows to ensure they match internal DB names if needed, 
        // though the payload seems to match the schema.
        const { error: insertError } = await supabase
          .from(tableName)
          .insert(rows);

        if (insertError) {
          throw new Error(`Failed to insert into ${tableName}: ${insertError.message}`);
        }
      }

      results[tableName] = { count: rows.length, status: "success" };
      console.log(`✅ Table ${tableName} synced successfully.`);
    } catch (e) {
      console.error(`❌ Error syncing table ${tableName}:`, e);
      results[tableName] = { 
        count: 0, 
        status: `error: ${e instanceof Error ? e.message : String(e)}` 
      };
    }
  }

  return results;
}
