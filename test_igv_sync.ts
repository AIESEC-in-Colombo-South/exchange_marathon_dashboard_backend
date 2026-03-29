import { syncIgvIrmData } from "./src/sync_igt_ir_m.js";
import { IgvIrmSyncPayload } from "./src/types.js";
import dotenv from "dotenv";

dotenv.config();

const mockPayload: IgvIrmSyncPayload = {
  matching_members: [
    { name: "John Doe", role: "Specialist", team: "Matching A", matching_interviews: 10, acceptance: 5, approvals: 3, total: 18 },
    { name: "Jane Smith", role: "Lead", team: "Matching B", matching_interviews: 12, acceptance: 8, approvals: 5, total: 25 }
  ],
  ir_members: [
    { name: "Alice Brown", role: "Coord", team: "IR Alpha", ir_calls: 20, ir_application: 15, ir_approvals: 10, total: 45 },
    { name: "Bob White", role: "Manager", team: "IR Beta", ir_calls: 15, ir_application: 10, ir_approvals: 8, total: 33 }
  ],
  marcom_members: [
    { name: "Charlie Green", role: "Designer", flyers: 15, videos: 5, presentations: 10, total: 30 },
    { name: "Diana Prince", role: "Editor", flyers: 20, videos: 8, presentations: 5, total: 33 }
  ]
};

async function testSync() {
  console.log("🚀 Starting mock sync test...");
  try {
    const results = await syncIgvIrmData(mockPayload);
    console.log("✅ Sync results:", JSON.stringify(results, null, 2));
  } catch (error) {
    console.error("❌ Sync failed:", error);
  }
}

testSync();
