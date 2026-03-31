import { getSupabase } from "./supabase.js";
export async function syncXcendPsData(payload) {
    if (!payload) {
        throw new Error("Missing sync payload.");
    }
    const supabase = getSupabase();
    const results = {};
    const syncConfigs = [
        {
            tableName: "xcend_cr",
            rows: payload.xcend_cr,
        },
        {
            tableName: "xcend_ir",
            rows: payload.xcend_ir,
        },
    ];
    for (const config of syncConfigs) {
        const { tableName, rows } = config;
        try {
            if (!rows || !Array.isArray(rows)) {
                throw new Error(`Invalid row data for ${tableName}`);
            }
            console.log(`🔄 Syncing table: ${tableName} with ${rows.length} rows...`);
            // 1. Clear existing data
            const { error: deleteError } = await supabase
                .from(tableName)
                .delete()
                .neq("id", -1);
            if (deleteError) {
                throw new Error(`Failed to clear table ${tableName}: ${deleteError.message}`);
            }
            // 2. Insert rows
            if (rows.length > 0) {
                const { error: insertError } = await supabase
                    .from(tableName)
                    .insert(rows);
                if (insertError) {
                    throw new Error(`Failed to insert into ${tableName}: ${insertError.message}`);
                }
            }
            results[tableName] = { count: rows.length, status: "success" };
            console.log(`✅ Table ${tableName} synced successfully.`);
        }
        catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            console.error(`❌ Error syncing table ${tableName}:`, errorMsg);
            results[tableName] = {
                count: 0,
                status: `error: ${errorMsg}`
            };
            throw new Error(`Sync failed for ${tableName}: ${errorMsg}`);
        }
    }
    return results;
}
