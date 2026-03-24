import cors from "cors";
import express from "express";
import type { AddressInfo } from "node:net";
import { config } from "./config.js";
import { runSync } from "./sync.js";
import { getTeamDashboard } from "./aggregation.js";
import { syncState } from "./state.js";

const app = express();
app.use(cors());
app.use(express.json());

let schedulerBusy = false;

function startAutoSyncScheduler(): void {
  if (!config.syncScheduler.enabled) {
    console.log("Auto sync scheduler disabled (AUTO_SYNC_ENABLED=false).");
    return;
  }

  const intervalMinutes = Math.max(1, config.syncScheduler.intervalMinutes);
  const intervalMs = intervalMinutes * 60 * 1000;

  syncState.nextSyncTime = new Date(Date.now() + intervalMs).toISOString();
  console.log(`Auto sync scheduler enabled: every ${intervalMinutes} minute(s).`);

  // Run initial sync immediately
  void (async () => {
    schedulerBusy = true;
    try {
      console.log("Running initial sync...");
      const result = await runSync();
      console.log(`Initial sync completed: ${result.runId}`);
    } catch (error) {
      console.error("Initial sync failed:", error instanceof Error ? error.message : error);
    } finally {
      schedulerBusy = false;
    }
  })();

  setInterval(async () => {
    if (schedulerBusy) {
      console.log("Auto sync skipped: previous sync still running.");
      return;
    }

    schedulerBusy = true;
    syncState.nextSyncTime = new Date(Date.now() + intervalMs).toISOString();
    try {
      const result = await runSync();
      console.log(`Auto sync completed: ${result.runId} (${result.rowsRead} rows)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown auto-sync error";
      console.error("Auto sync failed:", message);
    } finally {
      schedulerBusy = false;
    }
  }, intervalMs);
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timezone: config.timezone });
});

app.post("/sync/run", async (_req, res) => {
  try {
    const result = await runSync();
    res.status(200).json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error";
    res.status(500).json({ ok: false, error: message });
  }
});

app.get("/api/dashboard/:team", async (req, res) => {
  try {
    const team = String(req.params.team || "").trim().toLowerCase();
    if (!team) {
      res.status(400).json({ ok: false, error: "Team is required" });
      return;
    }

    const periodParam = String(req.query.period || "daily");
    const validPeriods = ["daily", "weekly", "bi-weekly", "monthly", "marathon"];
    const period = validPeriods.includes(periodParam) ? (periodParam as any) : "daily";
    const asOfDate = typeof req.query.asOfDate === "string" ? req.query.asOfDate : undefined;

    const payload = await getTeamDashboard(team, period, asOfDate);
    res.status(200).json({ ok: true, data: payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown dashboard error";
    res.status(500).json({ ok: false, error: message });
  }
});

const syncOnce = process.argv.includes("--sync-once");
if (syncOnce) {
  runSync()
    .then((result) => {
      console.log("Sync completed", result);
      process.exit(0);
    })
    .catch((error) => {
      console.error("Sync failed", error);
      process.exit(1);
    });
} else {
  const server = app.listen(config.port, () => {
    const address = server.address() as AddressInfo | null;
    const port = address?.port || config.port;
    console.log(`Backend running on http://localhost:${port}`);
    startAutoSyncScheduler();
  });

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${config.port} is already in use. Stop the existing process or change PORT in .env.`);
      process.exit(1);
    }

    console.error("Server startup failed:", error.message);
    process.exit(1);
  });
}
