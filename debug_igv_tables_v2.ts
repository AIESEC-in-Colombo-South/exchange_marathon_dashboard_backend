import { getSupabase } from "./src/supabase.js";
import dotenv from "dotenv";

dotenv.config();

async function checkTables() {
  const supabase = getSupabase() as any;
  const tables = ["matching_members", "ir_members", "marcom_members"];
  
  const report: any[] = [];
  for (const table of tables) {
    const { data, count, error } = await supabase
      .from(table)
      .select("*", { count: "exact" });
      
    report.push({
      table,
      count: count || 0,
      firstRow: data && data.length > 0 ? data[0] : null,
      error: error ? error.message : null
    });
  }
  
  console.log("DATABASE_REPORT_START");
  console.log(JSON.stringify(report, null, 2));
  console.log("DATABASE_REPORT_END");
}

checkTables();
