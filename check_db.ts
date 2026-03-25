import { getSupabase } from "./src/supabase.js";

async function checkTable() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("mkt_members")
    .select("*")
    .limit(1);

  if (error) {
    console.error("Error fetching mkt_members:", error.message);
  } else {
    console.log("mkt_members data:", data);
  }
}

checkTable();
