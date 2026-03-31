import { getSupabase } from "./supabase.js";
import { currentDateKey, getStartDateForPeriod, nowIso } from "./date.js";
import { config } from "./config.js";
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
export async function getTeamDashboard(targetSlug, period = "daily", asOfDate, prefetchedDocs, level = "team") {
    const supabase = getSupabase();
    let dateKey = asOfDate || currentDateKey();
    const startDate = getStartDateForPeriod(period);
    let docs = [];
    if (prefetchedDocs) {
        if (startDate) {
            docs = prefetchedDocs.filter(d => d.dateKey >= startDate);
        }
        else {
            docs = prefetchedDocs;
        }
        if (!asOfDate && docs.length > 0) {
            const dates = Array.from(new Set(docs.map(d => d.dateKey))).sort().reverse();
            dateKey = dates[0] || dateKey;
        }
    }
    else {
        // Fetch from Supabase
        let query = supabase
            .from("daily_snapshots")
            .select("*")
            .eq(level === "team" ? "team_slug" : "function_slug", targetSlug.toLowerCase());
        if (period === "daily") {
            query = query.eq("date_key", dateKey);
        }
        else if (startDate) {
            query = query.gte("date_key", startDate);
        }
        const { data, error } = await query;
        if (error)
            throw error;
        docs = data || [];
    }
    const performerMap = new Map();
    const memberGroupMap = new Map();
    for (const row of docs) {
        const email = row.member_email || row.email;
        const teamValue = row.team_slug || row.team;
        const groupName = level === "function" ? (teamValue || "General") : "General";
        memberGroupMap.set(email, groupName);
        const existing = performerMap.get(email);
        const score = Number(row.points || 0);
        const counts = {
            mous: Number(row.mous || row.counts?.mous || 0),
            coldCalls: Number(row.cold_calls || row.counts?.coldCalls || 0),
            followups: Number(row.followups || row.counts?.followups || 0)
        };
        if (existing) {
            existing.score += score;
            existing.metrics.mous += counts.mous;
            existing.metrics.coldCalls += counts.coldCalls;
            existing.metrics.followups += counts.followups;
        }
        else {
            performerMap.set(email, {
                email, // 👈 Populate email
                name: String(row.name || "Unknown"),
                role: String(row.role || "Member"),
                score: Math.round(score),
                avatar: initials(String(row.name || "Unknown")),
                metrics: {
                    mous: Math.round(counts.mous),
                    coldCalls: Math.round(counts.coldCalls),
                    followups: Math.round(counts.followups)
                }
            });
        }
    }
    const groupMap = new Map();
    for (const [email, performer] of performerMap.entries()) {
        const groupName = memberGroupMap.get(email) || "General";
        const peers = groupMap.get(groupName) || [];
        peers.push(performer);
        groupMap.set(groupName, peers);
    }
    const miniTeams = Array.from(groupMap.entries())
        .map(([name, performers]) => {
        const points = performers.reduce((sum, p) => sum + p.score, 0);
        // Generate a slug from the name if none exists in the data
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        return {
            slug,
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
        name: level === "function" ? targetSlug.toUpperCase() : prettifyTeamSlug(targetSlug),
        displayName: `${level === "function" ? targetSlug.toUpperCase() : prettifyTeamSlug(targetSlug)} Performance Dashboard`,
        functionSlug: docs[0]?.function_slug || "b2b",
        miniTeams,
        totalPoints,
        totalGrowth: 0,
        completedActions,
        weeklyGrowth: 0,
        asOfDate: dateKey,
        period,
        syncInfo: {
            lastSyncTime: nowIso(), // Fallback
            nextSyncTime: nowIso(),
            intervalMinutes: config.syncScheduler.intervalMinutes
        }
    };
}
export async function getMktDashboard(title = "MKT", filterByPosition, options) {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from("mkt_members")
        .select("*")
        .order("Points", { ascending: false });
    if (error)
        throw error;
    const members = data || [];
    const applyMstWeighting = !!options?.applyMstWeighting;
    if (applyMstWeighting) {
        const parsedRows = members.map((m) => {
            const rawPosition = String(m.Position || "Member").trim();
            let teamPrefix = "";
            let roleName = rawPosition;
            if (rawPosition.includes("|")) {
                const parts = rawPosition.split("|");
                teamPrefix = parts[0]?.trim() || "";
                roleName = parts[1]?.trim() || rawPosition;
            }
            const roleLower = roleName.toLowerCase();
            let groupName = "Members";
            let normalizedRole = roleName.charAt(0).toUpperCase() + roleName.slice(1).toLowerCase();
            if (roleLower === "tl") {
                groupName = "TLs";
                normalizedRole = "TL";
            }
            else if (roleLower === "member") {
                groupName = "Members";
                normalizedRole = "Member";
            }
            else {
                groupName = normalizedRole;
            }
            if (teamPrefix) {
                groupName = teamPrefix;
            }
            return {
                groupName,
                roleLower,
                performer: {
                    email: `${String(m.Member || "unknown").toLowerCase().replace(/\s+/g, ".")}_mkt@example.com`,
                    name: String(m.Member || "Unknown"),
                    role: normalizedRole,
                    score: Math.round(Number(m.Points || 0)),
                    avatar: initials(String(m.Member || "Unknown")),
                    metrics: { mous: 0, coldCalls: 0, followups: 0 }
                }
            };
        });
        const teamRowsMap = new Map();
        for (const row of parsedRows) {
            const teamRows = teamRowsMap.get(row.groupName) || [];
            teamRows.push(row);
            teamRowsMap.set(row.groupName, teamRows);
        }
        const filterRole = filterByPosition?.toLowerCase();
        const miniTeams = Array.from(teamRowsMap.entries())
            .map(([name, rows]) => {
            const membersRows = rows.filter((r) => r.roleLower === "member");
            const tlRows = rows.filter((r) => r.roleLower === "tl");
            const memberPoints = membersRows.reduce((sum, r) => sum + r.performer.score, 0);
            const tlPoints = tlRows.reduce((sum, r) => sum + r.performer.score, 0);
            const basePoints = memberPoints + tlPoints;
            const weightedPoints = membersRows.length === 2 ? (basePoints * 4) / 3 : basePoints;
            const visibleRows = filterRole
                ? rows.filter((r) => r.roleLower === filterRole)
                : rows;
            return {
                slug: name.toLowerCase(),
                name,
                rank: 0,
                points: weightedPoints,
                growth: 0,
                icon: initials(name),
                performers: visibleRows.map((r) => r.performer).sort((a, b) => b.score - a.score),
                allPerformers: rows.map((r) => r.performer).sort((a, b) => b.score - a.score)
            };
        })
            .filter((t) => t.performers.length > 0)
            .sort((a, b) => b.points - a.points)
            .map((t, i) => ({ ...t, rank: i + 1 }));
        const totalPoints = miniTeams.reduce((sum, t) => sum + t.points, 0);
        return {
            name: title,
            displayName: `${title} Performance Dashboard`,
            functionSlug: title.toLowerCase(),
            miniTeams,
            totalPoints,
            totalGrowth: 0,
            completedActions: 0,
            weeklyGrowth: 0,
            asOfDate: currentDateKey(),
            period: "marathon",
            syncInfo: {
                lastSyncTime: nowIso(),
                nextSyncTime: nowIso(),
                intervalMinutes: config.syncScheduler.intervalMinutes
            }
        };
    }
    const groupMap = new Map();
    for (const m of members) {
        const rawPosition = String(m.Position || "Member").trim();
        let teamPrefix = "";
        let roleName = rawPosition;
        if (rawPosition.includes("|")) {
            const parts = rawPosition.split("|");
            teamPrefix = parts[0]?.trim() || "";
            roleName = parts[1]?.trim() || rawPosition;
        }
        const roleLower = roleName.toLowerCase();
        if (filterByPosition && roleLower !== filterByPosition.toLowerCase())
            continue;
        let groupName = "Members";
        let normalizedRole = roleName.charAt(0).toUpperCase() + roleName.slice(1).toLowerCase();
        if (roleLower === "tl") {
            groupName = "TLs";
            normalizedRole = "TL";
        }
        else if (roleLower === "member") {
            groupName = "Members";
            normalizedRole = "Member";
        }
        else {
            groupName = normalizedRole;
        }
        if (teamPrefix) {
            groupName = teamPrefix;
        }
        const performers = groupMap.get(groupName) || [];
        performers.push({
            email: `${m.Member.toLowerCase().replace(/\s+/g, '.')}_mkt@example.com`,
            name: m.Member,
            role: normalizedRole,
            score: Math.round(Number(m.Points || 0)),
            avatar: initials(m.Member),
            metrics: { mous: 0, coldCalls: 0, followups: 0 }
        });
        groupMap.set(groupName, performers);
    }
    const miniTeams = Array.from(groupMap.entries())
        .map(([name, performers]) => {
        const points = performers.reduce((sum, p) => sum + p.score, 0);
        return {
            slug: name.toLowerCase(),
            name,
            rank: 0,
            points,
            growth: 0,
            icon: initials(name),
            performers: performers.sort((a, b) => b.score - a.score)
        };
    })
        .sort((a, b) => b.points - a.points)
        .map((t, i) => ({ ...t, rank: i + 1 }));
    const totalPoints = miniTeams.reduce((sum, t) => sum + t.points, 0);
    return {
        name: title,
        displayName: `${title} Performance Dashboard`,
        functionSlug: title.toLowerCase(),
        miniTeams,
        totalPoints,
        totalGrowth: 0,
        completedActions: 0,
        weeklyGrowth: 0,
        asOfDate: currentDateKey(),
        period: "marathon",
        syncInfo: {
            lastSyncTime: nowIso(),
            nextSyncTime: nowIso(),
            intervalMinutes: config.syncScheduler.intervalMinutes
        }
    };
}
export async function getIRMTeamDashboard(tableName, period = "marathon") {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .order("total_points", { ascending: false });
    if (error)
        throw error;
    const rows = data || [];
    const performers = rows.map((r) => ({
        email: `${r.name.toLowerCase().replace(/\s+/g, ".")}_irm@example.com`,
        name: r.name,
        role: "IRM Member",
        score: Math.round(Number(r.total_points || 0)),
        avatar: initials(r.name),
        metrics: {
            mous: Math.round(Number(r.ir_applications || 0)),
            coldCalls: Math.round(Number(r.ir_calls || 0)),
            followups: Math.round(Number(r.ir_approvals || 0)),
        },
    }));
    const miniTeams = [
        {
            slug: tableName,
            name: prettifyTeamSlug(tableName),
            rank: 1,
            points: performers.reduce((sum, p) => sum + p.score, 0),
            growth: 0,
            icon: "IR",
            performers: performers.sort((a, b) => b.score - a.score),
        },
    ];
    return {
        name: prettifyTeamSlug(tableName),
        displayName: `${prettifyTeamSlug(tableName)} Performance Dashboard`,
        functionSlug: "irm",
        miniTeams,
        totalPoints: miniTeams[0].points,
        totalGrowth: 0,
        completedActions: performers.reduce((sum, p) => sum + p.metrics.mous + p.metrics.coldCalls + p.metrics.followups, 0),
        weeklyGrowth: 0,
        asOfDate: currentDateKey(),
        period: period,
        syncInfo: {
            lastSyncTime: nowIso(),
            nextSyncTime: nowIso(),
            intervalMinutes: config.syncScheduler.intervalMinutes,
        },
    };
}
export async function getMarcomDashboardFromTable() {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from("marcom")
        .select("*")
        .order("total_points", { ascending: false });
    if (error)
        throw error;
    const rows = data || [];
    const performers = rows.map((r) => ({
        email: `${r.name.toLowerCase().replace(/\s+/g, ".")}_marcom@example.com`,
        name: r.name,
        role: "Marcom Member",
        score: Math.round(Number(r.total_points || 0)),
        avatar: initials(r.name),
        metrics: {
            mous: Math.round(Number(r.flyers || 0)),
            coldCalls: Math.round(Number(r.videos || 0)),
            followups: Math.round(Number(r.presentations || 0)),
        },
    }));
    const miniTeams = [
        {
            slug: "marcom",
            name: "Marcom",
            rank: 1,
            points: performers.reduce((sum, p) => sum + p.score, 0),
            growth: 0,
            icon: "MC",
            performers: performers.sort((a, b) => b.score - a.score),
        },
    ];
    return {
        name: "MARCOM",
        displayName: "Marcom Performance Dashboard",
        functionSlug: "marcom",
        miniTeams,
        totalPoints: miniTeams[0].points,
        totalGrowth: 0,
        completedActions: performers.reduce((sum, p) => sum + p.metrics.mous + p.metrics.coldCalls + p.metrics.followups, 0),
        weeklyGrowth: 0,
        asOfDate: currentDateKey(),
        period: "marathon",
        syncInfo: {
            lastSyncTime: nowIso(),
            nextSyncTime: nowIso(),
            intervalMinutes: config.syncScheduler.intervalMinutes,
        },
    };
}
export async function getB2BDashboardFromTable() {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from("b2b_dashboard_members")
        .select("*")
        .order("total_pts", { ascending: false });
    if (error)
        throw error;
    const rows = data || [];
    const teamMap = new Map();
    for (const row of rows) {
        const teamName = String(row.team_name || "B2B").trim() || "B2B";
        const members = teamMap.get(teamName) || [];
        const memberName = String(row.member_name || "Unknown").trim() || "Unknown";
        members.push({
            email: String(row.email_address || `${memberName.toLowerCase().replace(/\s+/g, ".")}@example.com`),
            name: memberName,
            role: String(row.role || "B2B Member"),
            score: Math.ceil(Number(row.total_pts || 0)),
            avatar: initials(memberName),
            metrics: {
                mous: Number(row.mous || 0),
                coldCalls: Number(row.cold_calls || 0),
                followups: Number(row.followups || 0)
            }
        });
        teamMap.set(teamName, members);
    }
    const miniTeams = Array.from(teamMap.entries())
        .map(([name, performers]) => ({
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
        name,
        rank: 0,
        points: performers.reduce((sum, p) => sum + p.score, 0),
        growth: 0,
        icon: initials(name),
        performers: performers.sort((a, b) => b.score - a.score)
    }))
        .sort((a, b) => b.points - a.points)
        .map((team, index) => ({ ...team, rank: index + 1 }));
    const totalPoints = miniTeams.reduce((sum, team) => sum + team.points, 0);
    const completedActions = miniTeams
        .flatMap((team) => team.performers)
        .reduce((sum, performer) => sum + performer.metrics.mous + performer.metrics.coldCalls + performer.metrics.followups, 0);
    return {
        name: "IGV",
        displayName: "Incoming Global Volunteer - B2B",
        functionSlug: "igv_b2b",
        miniTeams,
        totalPoints,
        totalGrowth: 0,
        completedActions,
        weeklyGrowth: 0,
        asOfDate: currentDateKey(),
        period: "marathon",
        syncInfo: {
            lastSyncTime: nowIso(),
            nextSyncTime: nowIso(),
            intervalMinutes: config.syncScheduler.intervalMinutes
        }
    };
}
export async function getOgtDashboard() {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from("ogt_members")
        .select("*")
        .order("total_points", { ascending: false });
    if (error)
        throw error;
    const rows = data || [];
    const teamMap = new Map();
    const seenMembers = new Set();
    for (const row of rows) {
        const teamName = String(row.team_name || "OGT").trim() || "OGT";
        const memberName = String(row.member_name || "Unknown").trim() || "Unknown";
        const dedupKey = `${teamName}-${memberName.toLowerCase()}`;
        if (seenMembers.has(dedupKey))
            continue;
        seenMembers.add(dedupKey);
        const members = teamMap.get(teamName) || [];
        members.push({
            email: `${memberName.toLowerCase().replace(/\s+/g, ".")}_ogt@example.com`,
            name: memberName,
            role: String(row.member_role || "MEMBER"),
            score: Math.round(Number(row.total_points || 0)),
            avatar: initials(memberName),
            metrics: {
                mous: Math.round(Number(row.no_of_su || 0)),
                coldCalls: Math.round(Number(row.no_of_apl || 0)), // Use APL for second metric
                followups: Math.round(Number(row.no_of_apd || 0)), // Use APD for third metric
                // Additional metrics for OGT
                ogt_su: Math.round(Number(row.no_of_su || 0)),
                ogt_apl: Math.round(Number(row.no_of_apl || 0)),
                ogt_apd: Math.round(Number(row.no_of_apd || 0)),
                ogt_ir_calls: Math.round(Number(row.no_of_ir_calls_taken || 0)),
                ogt_campaigns: Math.round(Number(row.no_of_national_campaigns || 0)),
                ogt_flyers: Math.round(Number(row.no_of_pre_su_through_opp_flyers || 0))
            }
        });
        teamMap.set(teamName, members);
    }
    const miniTeams = Array.from(teamMap.entries())
        .map(([name, performers]) => ({
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
        name,
        rank: 0,
        points: performers.reduce((sum, p) => sum + p.score, 0),
        growth: 0,
        icon: initials(name),
        performers: performers.sort((a, b) => b.score - a.score)
    }))
        .sort((a, b) => b.points - a.points)
        .map((team, index) => ({ ...team, rank: index + 1 }));
    const totalPoints = miniTeams.reduce((sum, team) => sum + team.points, 0);
    const completedActions = miniTeams
        .flatMap((team) => team.performers)
        .reduce((sum, performer) => sum + performer.metrics.mous + performer.metrics.coldCalls + performer.metrics.followups, 0);
    return {
        name: "OGT",
        displayName: "Outgoing Global Talent Performance Dashboard",
        functionSlug: "ogt",
        miniTeams,
        totalPoints,
        totalGrowth: 0,
        completedActions,
        weeklyGrowth: 0,
        asOfDate: currentDateKey(),
        period: "marathon",
        syncInfo: {
            lastSyncTime: nowIso(),
            nextSyncTime: nowIso(),
            intervalMinutes: config.syncScheduler.intervalMinutes
        }
    };
}
export async function getIgtB2BDashboard() {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from("igt_b2b_members")
        .select("*")
        .order("total_points", { ascending: false });
    if (error)
        throw error;
    const rows = data || [];
    const teamMap = new Map();
    const seenMembers = new Set();
    for (const row of rows) {
        const teamName = String(row.team_name || "IGT").trim() || "IGT";
        const memberName = String(row.member_name || "Unknown").trim() || "Unknown";
        const dedupKey = `${teamName}-${memberName.toLowerCase()}`;
        if (seenMembers.has(dedupKey))
            continue;
        seenMembers.add(dedupKey);
        const members = teamMap.get(teamName) || [];
        members.push({
            email: `${memberName.toLowerCase().replace(/\s+/g, ".")}_igtb2b@example.com`,
            name: memberName,
            role: String(row.member_role || "MEMBER"),
            score: Math.round(Number(row.total_points || 0)),
            avatar: initials(memberName),
            metrics: {
                mous: Math.round(Number(row.meetings_scheduled || 0)),
                coldCalls: Math.round(Number(row.cold_calls || 0)),
                followups: Math.round(Number(row.follow_ups || 0)),
                igt_cold_calls: Math.round(Number(row.cold_calls || 0)),
                igt_follow_ups: Math.round(Number(row.follow_ups || 0)),
                igt_proposals: Math.round(Number(row.proposals_emails_sent || 0)),
                igt_meetings: Math.round(Number(row.meetings_scheduled || 0)),
                igt_leads: Math.round(Number(row.leads_generated || 0)),
                igt_contracts: Math.round(Number(row.contracts_signed || 0)),
                igt_training: Math.round(Number(row.training_attendance || 0)),
                igt_team_meeting: Math.round(Number(row.team_meeting || 0)),
                igt_team_bonus: Math.round(Number(row.team_cold_calls_bonus || 0))
            },
            team_totals: Math.round(Number(row.team_totals || 0)) // Temporary store per member
        });
        teamMap.set(teamName, members);
    }
    const miniTeams = Array.from(teamMap.entries())
        .map(([name, performers]) => {
        // Use team_totals from the first performer (matches all performers in same team)
        const teamTotals = performers[0].team_totals || 0;
        return {
            slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
            name,
            rank: 0,
            points: teamTotals, // Use team_totals from sheet
            growth: 0,
            icon: initials(name),
            performers: performers.sort((a, b) => b.score - a.score)
        };
    })
        .sort((a, b) => b.points - a.points)
        .map((team, index) => ({ ...team, rank: index + 1 }));
    const totalPoints = miniTeams.reduce((sum, team) => sum + team.points, 0);
    const completedActions = miniTeams
        .flatMap((team) => team.performers)
        .reduce((sum, performer) => sum + performer.metrics.mous + performer.metrics.coldCalls + performer.metrics.followups, 0);
    return {
        name: "IGT B2B",
        displayName: "Incoming Global Talent B2B Performance Dashboard",
        functionSlug: "igt_b2b",
        miniTeams,
        totalPoints,
        totalGrowth: 0,
        completedActions,
        weeklyGrowth: 0,
        asOfDate: currentDateKey(),
        period: "marathon",
        syncInfo: {
            lastSyncTime: nowIso(),
            nextSyncTime: nowIso(),
            intervalMinutes: 0
        }
    };
}
export async function getIgvIrmDashboard() {
    const supabase = getSupabase();
    // Fetch from three tables
    const [matchingRes, irRes, marcomRes] = await Promise.all([
        supabase.from("matching_members").select("*").order("total", { ascending: false }),
        supabase.from("ir_members").select("*").order("total", { ascending: false }),
        supabase.from("marcom_members").select("*").order("total", { ascending: false })
    ]);
    if (matchingRes.error)
        throw matchingRes.error;
    if (irRes.error)
        throw irRes.error;
    if (marcomRes.error)
        throw marcomRes.error;
    const matchingRows = matchingRes.data || [];
    const irRows = irRes.data || [];
    const marcomRows = marcomRes.data || [];
    // Map to Performer interface
    const matchingPerformers = matchingRows.map((r) => ({
        email: `${r.name.toLowerCase().replace(/\s+/g, ".")}_matching@example.com`,
        name: r.name,
        role: r.role || "Member",
        teamName: r.team || "Marcom", // Fallback if missing
        source: "matching",
        score: Math.round(Number(r.total || 0)),
        avatar: initials(r.name),
        metrics: {
            mous: Math.round(Number(r.matching_interviews || 0)),
            coldCalls: Math.round(Number(r.acceptance || 0)),
            followups: Math.round(Number(r.approvals || 0))
        }
    }));
    const irPerformers = irRows.map((r) => ({
        email: `${r.name.toLowerCase().replace(/\s+/g, ".")}_ir@example.com`,
        name: r.name,
        role: r.role || "Member",
        teamName: r.team || "Marcom",
        source: "ir",
        score: Math.round(Number(r.total || 0)),
        avatar: initials(r.name),
        metrics: {
            mous: Math.round(Number(r.ir_calls || 0)),
            coldCalls: Math.round(Number(r.ir_application || 0)),
            followups: Math.round(Number(r.ir_approvals || 0))
        }
    }));
    const marcomPerformers = marcomRows.map((r) => ({
        email: `${r.name.toLowerCase().replace(/\s+/g, ".")}_marcom@example.com`,
        name: r.name,
        role: r.role || "Member",
        teamName: r.team || "Marcom",
        source: "marcom",
        score: Math.round(Number(r.total || 0)),
        avatar: initials(r.name),
        metrics: {
            mous: Math.round(Number(r.flyers || 0)),
            coldCalls: Math.round(Number(r.videos || 0)),
            followups: Math.round(Number(r.presentations || 0))
        }
    }));
    const allPerformers = [...matchingPerformers, ...irPerformers, ...marcomPerformers];
    // Group by teamName dynamically
    const teamGroups = new Map();
    for (const p of allPerformers) {
        if (!teamGroups.has(p.teamName))
            teamGroups.set(p.teamName, []);
        teamGroups.get(p.teamName).push(p);
    }
    const miniTeams = Array.from(teamGroups.entries()).map(([teamName, performers]) => ({
        slug: teamName.toLowerCase().replace(/\s+/g, "_"),
        name: teamName,
        points: performers.reduce((s, p) => s + p.score, 0),
        growth: 0,
        icon: teamName.substring(0, 2).toUpperCase(),
        performers: performers.sort((a, b) => b.score - a.score).map(({ teamName, ...rest }) => rest)
    })).sort((a, b) => b.points - a.points).map((t, i) => ({ ...t, rank: i + 1 }));
    return {
        name: "IGV IR & M",
        displayName: "IGV IR & Matching Performance Dashboard",
        functionSlug: "igv_ir_m",
        miniTeams,
        totalPoints: miniTeams.reduce((s, t) => s + t.points, 0),
        totalGrowth: 0,
        completedActions: miniTeams.flatMap(t => t.performers).reduce((s, p) => s + p.metrics.mous + p.metrics.coldCalls + p.metrics.followups, 0),
        weeklyGrowth: 0,
        asOfDate: currentDateKey(),
        period: "marathon",
        syncInfo: {
            lastSyncTime: nowIso(),
            nextSyncTime: nowIso(),
            intervalMinutes: 0
        }
    };
}
export async function getIgtIrmDashboard() {
    const supabase = getSupabase();
    const [irRes, matchingRes] = await Promise.all([
        supabase.from("igt_ir_members").select("*").order("points", { ascending: false }),
        supabase.from("igt_matching_members").select("*").order("points", { ascending: false })
    ]);
    if (irRes.error)
        throw irRes.error;
    if (matchingRes.error)
        throw matchingRes.error;
    const irRows = irRes.data || [];
    const matchingRows = matchingRes.data || [];
    const irPerformers = irRows.map((r) => ({
        email: `${r.name.toLowerCase().replace(/\s+/g, ".")}_ir@igt.com`,
        name: r.name,
        role: r.role,
        score: Math.round(Number(r.points || 0)),
        avatar: initials(r.name),
        source: 'ir',
        metrics: {
            mous: Math.round(Number(r.ir_calls_scheduled || 0)),
            coldCalls: Math.round(Number(r.ir_cvs_collected || 0)),
            followups: Math.round(Number(r.ir_calls_participated || 0)),
            igt_ir_calls: Math.round(Number(r.ir_calls_scheduled || 0)),
            igt_ir_cvs: Math.round(Number(r.ir_cvs_collected || 0)),
            igt_ir_participated: Math.round(Number(r.ir_calls_participated || 0))
        }
    }));
    const matchingPerformers = matchingRows.map((r) => ({
        email: `${r.name.toLowerCase().replace(/\s+/g, ".")}_m@igt.com`,
        name: r.name,
        role: r.role,
        score: Math.round(Number(r.points || 0)),
        avatar: initials(r.name),
        source: 'matching',
        metrics: {
            mous: Math.round(Number(r.eps_reached_out_to || 0)),
            coldCalls: Math.round(Number(r.interviews_scheduled || 0)),
            followups: Math.round(Number(r.interviews_successful || 0)),
            igt_m_outreach: Math.round(Number(r.eps_reached_out_to || 0)),
            igt_m_interviews: Math.round(Number(r.interviews_scheduled || 0)),
            igt_m_success: Math.round(Number(r.interviews_successful || 0)),
            igt_m_apds: Math.round(Number(r.apds || 0))
        }
    }));
    const miniTeams = [
        {
            slug: "ir",
            name: "IR",
            rank: 1,
            points: irPerformers.reduce((s, p) => s + p.score, 0),
            growth: 0,
            icon: "IR",
            performers: irPerformers
        },
        {
            slug: "matching",
            name: "Matching",
            rank: 2,
            points: matchingPerformers.reduce((s, p) => s + p.score, 0),
            growth: 0,
            icon: "M",
            performers: matchingPerformers
        }
    ].sort((a, b) => b.points - a.points).map((t, i) => ({ ...t, rank: i + 1 }));
    return {
        name: "iGT IR & M",
        displayName: "iGT IR & Matching Performance Dashboard",
        functionSlug: "igt-ir-m",
        miniTeams,
        totalPoints: miniTeams.reduce((sum, t) => sum + t.points, 0),
        totalGrowth: 0,
        completedActions: miniTeams.flatMap(t => t.performers).reduce((sum, p) => sum + p.metrics.mous + p.metrics.coldCalls + p.metrics.followups, 0),
        weeklyGrowth: 0,
        asOfDate: currentDateKey(),
        period: "marathon",
        syncInfo: {
            lastSyncTime: nowIso(),
            nextSyncTime: nowIso(),
            intervalMinutes: 0
        }
    };
}
export async function getOgvPsCrDashboard() {
    const supabase = getSupabase();
    const { data: crData, error: crError } = await supabase.from("xcend_cr").select("*");
    if (crError)
        throw crError;
    const crRows = crData || [];
    const teamMap = new Map();
    const crPerformers = crRows.map((row) => ({
        email: `${row.person.toLowerCase().replace(/\s+/g, ".")}_cr@example.com`,
        name: row.person,
        role: row.role || "MEMBER",
        score: Math.round(Number(row.points || 0)),
        avatar: initials(row.person),
        metrics: {
            mous: Math.round(Number(row.number_of_sign_ups || 0)),
            coldCalls: Math.round(Number(row.number_of_applications || 0)),
            followups: Math.round(Number(row.number_of_approvals || 0)),
            cr_signups: Math.round(Number(row.number_of_sign_ups || 0)),
            cr_apps: Math.round(Number(row.number_of_applications || 0)),
            cr_approvals: Math.round(Number(row.number_of_approvals || 0))
        }
    }));
    teamMap.set("CR Performance", crPerformers);
    const miniTeams = Array.from(teamMap.entries())
        .map(([name, performers]) => ({
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
        name,
        rank: 0,
        points: performers.reduce((sum, p) => sum + p.score, 0),
        growth: 0,
        icon: initials(name),
        performers: performers.sort((a, b) => b.score - a.score)
    }))
        .map((team, index) => ({ ...team, rank: index + 1 }));
    const totalPoints = miniTeams.reduce((sum, team) => sum + team.points, 0);
    const completedActions = miniTeams
        .flatMap((team) => team.performers)
        .reduce((sum, performer) => sum + (performer.metrics.mous || 0) + (performer.metrics.coldCalls || 0) + (performer.metrics.followups || 0), 0);
    return {
        name: "oGV PS CR",
        displayName: "oGV PS Customer Relations Dashboard",
        functionSlug: "ogv_ps_cr",
        miniTeams,
        totalPoints,
        totalGrowth: 0,
        completedActions,
        weeklyGrowth: 0,
        asOfDate: currentDateKey(),
        period: "marathon",
        syncInfo: {
            lastSyncTime: nowIso(),
            nextSyncTime: nowIso(),
            intervalMinutes: config.syncScheduler.intervalMinutes
        }
    };
}
export async function getOgvPsIrDashboard() {
    const supabase = getSupabase();
    const { data: irData, error: irError } = await supabase.from("xcend_ir").select("*");
    if (irError)
        throw irError;
    const irRows = irData || [];
    const teamMap = new Map();
    const irPerformers = irRows.map((row) => ({
        email: `${row.person.toLowerCase().replace(/\s+/g, ".")}_ir@example.com`,
        name: row.person,
        role: row.role || "MEMBER",
        score: Math.round(Number(row.points || 0)),
        avatar: initials(row.person),
        metrics: {
            mous: Math.round(Number(row.number_of_ir_scheduled || 0)),
            coldCalls: Math.round(Number(row.number_of_ir_calls_taken || 0)),
            followups: Math.round(Number(row.matching || 0)),
            ir_scheduled: Math.round(Number(row.number_of_ir_scheduled || 0)),
            ir_calls: Math.round(Number(row.number_of_ir_calls_taken || 0)),
            ir_matching: Math.round(Number(row.matching || 0))
        }
    }));
    teamMap.set("IR Performance", irPerformers);
    const miniTeams = Array.from(teamMap.entries())
        .map(([name, performers]) => ({
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
        name,
        rank: 0,
        points: performers.reduce((sum, p) => sum + p.score, 0),
        growth: 0,
        icon: initials(name),
        performers: performers.sort((a, b) => b.score - a.score)
    }))
        .map((team, index) => ({ ...team, rank: index + 1 }));
    const totalPoints = miniTeams.reduce((sum, team) => sum + team.points, 0);
    const completedActions = miniTeams
        .flatMap((team) => team.performers)
        .reduce((sum, performer) => sum + (performer.metrics.mous || 0) + (performer.metrics.coldCalls || 0) + (performer.metrics.followups || 0), 0);
    return {
        name: "oGV PS IR",
        displayName: "oGV PS International Relations Dashboard",
        functionSlug: "ogv_ps_ir",
        miniTeams,
        totalPoints,
        totalGrowth: 0,
        completedActions,
        weeklyGrowth: 0,
        asOfDate: currentDateKey(),
        period: "marathon",
        syncInfo: {
            lastSyncTime: nowIso(),
            nextSyncTime: nowIso(),
            intervalMinutes: config.syncScheduler.intervalMinutes
        }
    };
}
