// Using native fetch

async function testIgtSync() {
  const payload = {
    igt_ir_members: [
      {
        name: "Test IR Member",
        role: "IR Specialist",
        ir_calls_scheduled: 5,
        ir_cvs_collected: 10,
        ir_calls_participated: 3,
        points: 150
      }
    ],
    igt_matching_members: [
      {
        name: "Test Matching Member",
        role: "Matching Specialist",
        eps_reached_out_to: 20,
        interviews_scheduled: 8,
        interviews_successful: 4,
        apds: 2,
        points: 200
      }
    ],
    synced_at: new Date().toISOString()
  };

  console.log("🚀 Sending test sync payload to iGT dashboard endpoint...");
  
  try {
    const response = await fetch('http://localhost:4000/sync/igt-dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log("✅ Sync Result:", JSON.stringify(result, null, 2));

    if (response.ok) {
      console.log("📊 Fetching dashboard data...");
      const dbResponse = await fetch('http://localhost:4000/api/dashboard/igt-ir-m?period=marathon');
      const dbResult = await dbResponse.json();
      console.log("✅ Dashboard Data:", JSON.stringify(dbResult, null, 2));
    }
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

testIgtSync();
