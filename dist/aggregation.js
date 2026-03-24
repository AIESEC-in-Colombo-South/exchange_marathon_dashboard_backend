import { db } from "./firebase.js";
import { currentDateKey } from "./date.js";
function prettifyTeamSlug(team) {
    if (!team)
        return "Team";
    return team
        .split(/[-_ ]+/)
        .filter(Boolean)
        .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
        .join(" ");
}
function initials(name) {
    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("") || "NA";
}
export async function getTeamDashboard(team, period = "daily", asOfDate) {
    const firestore = db();
    const dateKey = asOfDate || currentDateKey();
    const collection = period === "daily" ? "dailySnapshots" : "weeklySnapshots";
    let query = firestore.collection(collection).where("team", "==", team.toLowerCase());
    if (period === "daily") {
        query = query.where("dateKey", "==", dateKey);
    }
    const snapshot = await query.get();
    const docs = snapshot.docs.map((doc) => doc.data());
    const squadMap = new Map();
    for (const row of docs) {
        const squad = String(row.squad || "General");
        const performers = squadMap.get(squad) || [];
        performers.push({
            name: String(row.name || "Unknown"),
            role: String(row.role || "Member"),
            score: Number(row.points || 0),
            avatar: initials(String(row.name || "Unknown")),
            metrics: {
                mous: Number(row.counts?.mous || 0),
                coldCalls: Number(row.counts?.coldCalls || 0),
                followups: Number(row.counts?.followups || 0)
            }
        });
        squadMap.set(squad, performers);
    }
    const miniTeams = Array.from(squadMap.entries())
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
    return {
        name: prettifyTeamSlug(team),
        displayName: `${prettifyTeamSlug(team)} Performance Dashboard`,
        miniTeams,
        totalPoints,
        totalGrowth: 0,
        completedActions,
        weeklyGrowth: 0,
        asOfDate: dateKey,
        period
    };
}
