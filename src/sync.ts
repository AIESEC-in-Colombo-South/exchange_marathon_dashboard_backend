import { config, assertSyncConfig } from "./config.js";
import { toDateKey, toWeekKey, nowIso } from "./date.js";
import { db } from "./firebase.js";
import { computePoints } from "./scoring.js";
import { fetchSheetRows } from "./sheets.js";
import type { CriteriaCounts, MemberProfile, MemberSnapshot } from "./types.js";

interface SyncResult {
  rowsRead: number;
  dailySnapshotsWritten: number;
  weeklySnapshotsWritten: number;
  membersWritten: number;
  runId: string;
}

interface SnapshotAccumulator {
  profile: MemberProfile;
  counts: CriteriaCounts;
  sourceUpdatedAt: string;
  dayKey: string;
  weekKey: string;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseNumber(value: string): number {
  const n = Number(value || "0");
  return Number.isFinite(n) ? n : 0;
}

function avatarFromName(name: string): string {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
  return initials || "NA";
}

export async function runSync(): Promise<SyncResult> {
  assertSyncConfig();
  const firestore = db();
  const runId = `run_${Date.now()}`;
  const syncStart = nowIso();

  const rows = await fetchSheetRows();
  const dailyMap = new Map<string, SnapshotAccumulator>();

  for (const row of rows) {
    const email = normalizeEmail(row[config.google.columns.email] || "");
    if (!email) continue;

    const sourceTimestamp = row[config.google.columns.timestamp] || syncStart;
    const dayKey = toDateKey(sourceTimestamp);
    const weekKey = toWeekKey(sourceTimestamp);

    const name = row[config.google.columns.name] || email.split("@")[0];
    const role = row[config.google.columns.role] || "Member";
    const team = normalizeKey(row[config.google.columns.team] || "unassigned");
    const squad = row[config.google.columns.squad] || "General";

    const key = `${dayKey}_${email}`;
    const existing = dailyMap.get(key);
    const counts: CriteriaCounts = {
      mous: parseNumber(row[config.google.columns.mous]),
      coldCalls: parseNumber(row[config.google.columns.coldCalls]),
      followups: parseNumber(row[config.google.columns.followups])
    };

    if (!existing) {
      dailyMap.set(key, {
        profile: { email, name, role, team, squad },
        counts,
        sourceUpdatedAt: sourceTimestamp,
        dayKey,
        weekKey
      });
      continue;
    }

    existing.counts.mous += counts.mous;
    existing.counts.coldCalls += counts.coldCalls;
    existing.counts.followups += counts.followups;

    if (sourceTimestamp > existing.sourceUpdatedAt) {
      existing.sourceUpdatedAt = sourceTimestamp;
    }
  }

  const weeklyMap = new Map<string, SnapshotAccumulator>();
  for (const acc of dailyMap.values()) {
    const key = `${acc.weekKey}_${acc.profile.email}`;
    const existing = weeklyMap.get(key);
    if (!existing) {
      weeklyMap.set(key, {
        profile: acc.profile,
        counts: { ...acc.counts },
        sourceUpdatedAt: acc.sourceUpdatedAt,
        dayKey: acc.dayKey,
        weekKey: acc.weekKey
      });
      continue;
    }

    existing.counts.mous += acc.counts.mous;
    existing.counts.coldCalls += acc.counts.coldCalls;
    existing.counts.followups += acc.counts.followups;
    if (acc.sourceUpdatedAt > existing.sourceUpdatedAt) {
      existing.sourceUpdatedAt = acc.sourceUpdatedAt;
    }
  }

  const batch = firestore.batch();
  const syncedAt = nowIso();

  for (const entry of dailyMap.values()) {
    const id = `${entry.dayKey}_${entry.profile.email}`;
    const snapshot: MemberSnapshot = {
      id,
      email: entry.profile.email,
      name: entry.profile.name,
      role: entry.profile.role,
      team: entry.profile.team,
      squad: entry.profile.squad,
      dateKey: entry.dayKey,
      weekKey: entry.weekKey,
      counts: entry.counts,
      points: computePoints(entry.counts),
      sourceUpdatedAt: entry.sourceUpdatedAt,
      syncedAt
    };

    batch.set(firestore.collection("dailySnapshots").doc(id), snapshot, { merge: true });
    batch.set(
      firestore.collection("members").doc(entry.profile.email),
      {
        ...entry.profile,
        avatar: avatarFromName(entry.profile.name),
        updatedAt: syncedAt
      },
      { merge: true }
    );
  }

  for (const entry of weeklyMap.values()) {
    const id = `${entry.weekKey}_${entry.profile.email}`;
    const snapshot = {
      id,
      email: entry.profile.email,
      name: entry.profile.name,
      role: entry.profile.role,
      team: entry.profile.team,
      squad: entry.profile.squad,
      weekKey: entry.weekKey,
      counts: entry.counts,
      points: computePoints(entry.counts),
      sourceUpdatedAt: entry.sourceUpdatedAt,
      syncedAt
    };

    batch.set(firestore.collection("weeklySnapshots").doc(id), snapshot, { merge: true });
  }

  batch.set(firestore.collection("syncRuns").doc(runId), {
    runId,
    syncStart,
    syncEnd: syncedAt,
    timezone: config.timezone,
    rowsRead: rows.length,
    dailySnapshotsWritten: dailyMap.size,
    weeklySnapshotsWritten: weeklyMap.size,
    status: "succeeded"
  });

  await batch.commit();

  return {
    rowsRead: rows.length,
    dailySnapshotsWritten: dailyMap.size,
    weeklySnapshotsWritten: weeklyMap.size,
    membersWritten: dailyMap.size,
    runId
  };
}
