import { db } from "./firebase.js";
import { currentDateKey, getStartDateForPeriod } from "./date.js";
import { config } from "./config.js";
import { syncState } from "./state.js";
import type {
  TeamDashboardMiniTeam,
  TeamDashboardPayload,
  TeamDashboardPerformer
} from "./types.js";

function prettifyTeamSlug(team: string): string {
  if (!team) return "Team";
  return team
    .split(/[-_ ]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "NA";
}

export async function getTeamDashboard(
  team: string,
  period: "daily" | "weekly" | "bi-weekly" | "monthly" | "marathon" = "daily",
  asOfDate?: string
): Promise<TeamDashboardPayload> {
  const firestore = db();
  const dateKey = asOfDate || currentDateKey();

  const startDate = getStartDateForPeriod(period);
  const collection = "dailySnapshots";
  let docs: any[] = [];

  if (period === "daily") {
    const dailyQuery = firestore.collection(collection)
      .where("team", "==", team.toLowerCase())
      .where("dateKey", "==", dateKey);
    
    let dailySnapshot = await dailyQuery.get();
    
    if (dailySnapshot.empty && !asOfDate) {
      // Fallback to the latest available day if "today" is empty
      const latestDaySnapshot = await firestore.collection(collection)
        .where("team", "==", team.toLowerCase())
        .orderBy("dateKey", "desc")
        .limit(1)
        .get();
      
      if (!latestDaySnapshot.empty) {
        const latestDateKey = latestDaySnapshot.docs[0].data().dateKey;
        const fallbackSnapshot = await firestore.collection(collection)
          .where("team", "==", team.toLowerCase())
          .where("dateKey", "==", latestDateKey)
          .get();
        dailySnapshot = fallbackSnapshot;
        // Update dateKey so the frontend knows we are showing a fallback date
        dateKey = latestDateKey;
      }
    }
    docs = dailySnapshot.docs.map(d => d.data());
  } else {
    let rangeQuery = firestore.collection(collection).where("team", "==", team.toLowerCase());
    if (startDate) {
      rangeQuery = rangeQuery.where("dateKey", ">=", startDate);
    }
    const rangeSnapshot = await rangeQuery.get();
    docs = rangeSnapshot.docs.map(d => d.data());
  }

  const performerMap = new Map<string, TeamDashboardPerformer>();
  const memberSquadMap = new Map<string, string>(); // Email -> Squad

  for (const row of docs) {
    const email = String(row.email || "");
    const squad = String(row.squad || "General");
    memberSquadMap.set(email, squad);

    const existing = performerMap.get(email);
    const score = Number(row.points || 0);
    const counts = {
      mous: Number(row.counts?.mous || 0),
      coldCalls: Number(row.counts?.coldCalls || 0),
      followups: Number(row.counts?.followups || 0)
    };

    if (existing) {
      existing.score += score;
      existing.metrics.mous += counts.mous;
      existing.metrics.coldCalls += counts.coldCalls;
      existing.metrics.followups += counts.followups;
    } else {
      performerMap.set(email, {
        name: String(row.name || "Unknown"),
        role: String(row.role || "Member"),
        score: score,
        avatar: initials(String(row.name || "Unknown")),
        metrics: counts
      });
    }
  }

  const squadMap = new Map<string, TeamDashboardPerformer[]>();
  for (const [email, performer] of performerMap.entries()) {
    const squad = memberSquadMap.get(email) || "General";
    const peers = squadMap.get(squad) || [];
    peers.push(performer);
    squadMap.set(squad, peers);
  }

  const miniTeams: TeamDashboardMiniTeam[] = Array.from(squadMap.entries())
    .map(([name, performers]) => {
      const points = performers.reduce((sum, p) => sum + p.score, 0);
      return {
        name,
        rank: 0,
        points,
        growth: 0,
        icon: initials(name),
        performers: performers.sort((a, b) => b.score - a.score)
      };
    })
    .sort((a, b) => b.points - a.points)
    .map((item, index) => ({ ...item, rank: index + 1 }));

  const totalPoints = miniTeams.reduce((sum, item) => sum + item.points, 0);
  const completedActions = miniTeams
    .flatMap((item) => item.performers)
    .reduce((sum, p) => sum + p.metrics.mous + p.metrics.coldCalls + p.metrics.followups, 0);

  const lastSyncSnapshot = await firestore
    .collection("syncRuns")
    .orderBy("syncStart", "desc")
    .limit(1)
    .get();
  
  const lastSyncDoc = lastSyncSnapshot.docs[0]?.data();
  const lastSyncTime = lastSyncDoc?.syncStart || new Date().toISOString();
  const intervalMinutes = config.syncScheduler.intervalMinutes;
  const nextSyncTime = syncState.nextSyncTime;

  return {
    name: prettifyTeamSlug(team),
    displayName: `${prettifyTeamSlug(team)} Performance Dashboard`,
    miniTeams,
    totalPoints,
    totalGrowth: 0,
    completedActions,
    weeklyGrowth: 0,
    asOfDate: dateKey,
    period,
    syncInfo: {
      lastSyncTime,
      nextSyncTime,
      intervalMinutes
    }
  };
}
