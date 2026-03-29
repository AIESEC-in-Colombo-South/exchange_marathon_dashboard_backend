import { getSupabase } from "./src/supabase.js";
import dotenv from "dotenv";

dotenv.config();

async function checkTables() {
  const supabase = getSupabase() as any;
  
  const tables = ["matching_members", "ir_members", "marcom_members"];
  
  for (const table of tables) {
    console.log(`\n--- Table: ${table} ---`);
    const { data, error, count } = await supabase
      .from(table)
      .select("*", { count: "exact" });
      
    if (error) {
      console.error(`❌ Error fetching from ${table}:`, error);
    } else {
      console.log(`Total rows: ${count}`);
      console.log(`Sample data:`, JSON.stringify(data?.slice(0, 2), null, 2));
    }

    // Check columns
    const { data: cols, error: colError } = await supabase
      .rpc('get_table_columns', { table_name: table }); // If rpc is available
    
    // Fallback: check schema via information_schema if possible, but usually select * is enough
  }
}

checkTables();
