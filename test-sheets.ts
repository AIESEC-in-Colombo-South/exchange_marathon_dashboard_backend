import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

const authJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

if (!authJson || !spreadsheetId) {
    console.error("Missing ENV vars");
    process.exit(1);
}

const credentials = JSON.parse(authJson);
const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
});

const sheets = google.sheets({ version: "v4", auth });

console.log("🚀 Testing Google Sheets Connection...");
console.log(`ID: ${spreadsheetId}`);

async function test() {
    try {
        const res = await sheets.spreadsheets.get({ spreadsheetId });
        console.log("✅ SUCCESS! Spreadsheet Title:", res.data.properties?.title);
    } catch (err) {
        console.error("❌ FAILED:", err);
    }
}

test();
