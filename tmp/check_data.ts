import { getSupabase } from "../src/supabase.js";

async function checkData() {
    const supabase = getSupabase();
    console.log("Checking mkt_members table...");
    const { data, error } = await supabase
        .from("mkt_members")
        .select("*")
        .limit(10);
    
    if (error) {
        console.error("Error fetching mkt_members:", error.message);
        return;
    }

    console.log("Sample rows from mkt_members:");
    console.table(data);

    console.log("\nChecking marcom API payload...");
    // We can't easily call the API here without starting the server,
    // but we can call getMktDashboard directly.
    const { getMktDashboard } = await import("../src/aggregation.js");
    const payload = await getMktDashboard("MST");
    
    console.log("MST Dashboard Payload (MiniTeams):");
    payload.miniTeams.forEach(mt => {
        console.log(`- Team: ${mt.name} (Slug: ${mt.slug}), Points: ${mt.points}, Performers: ${mt.performers.length}`);
        mt.performers.slice(0, 2).forEach(p => {
            console.log(`  * ${p.name} | Role: ${p.role}`);
        });
    });
}

checkData().catch(console.error);
