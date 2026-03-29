import { getIgvIrmDashboard } from "./src/aggregation.js";
import dotenv from "dotenv";

dotenv.config();

async function testAggregation() {
  console.log("🚀 Starting aggregation test...");
  try {
    const payload = await getIgvIrmDashboard();
    console.log("✅ Aggregation result:", JSON.stringify(payload, null, 2));
  } catch (error) {
    console.error("❌ Aggregation failed:", error);
  }
}

testAggregation();
