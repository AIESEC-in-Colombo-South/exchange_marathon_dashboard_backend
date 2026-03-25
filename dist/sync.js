import { config, assertSyncConfig } from "./config.js";
import { toDateKey, toWeekKey, nowIso } from "./date.js";
import { getSupabase } from "./supabase.js";
import { computePoints } from "./scoring.js";
import { fetchMultipleSheets } from "./sheets.js";
import { getTeamDashboard } from "./aggregation.js";
function normalizeEmail(value) {
    return value.trim().toLowerCase();
}
function normalizeKey(value) {
    return value.trim().toLowerCase().replace(/\s+/g, "_");
}
function parseAction(actionStr) {
    const s = actionStr.toLowerCase().replace(/\s+/g, "");
    if (s.includes("mou"))
        return "mous";
    if (s.includes("coldcall"))
        return "coldCalls";
    if (s.includes("followup"))
        return "followups";
    return null;
}
function parseNumber(value) {
    const n = Number(value || "0");
    return Number.isFinite(n) ? n : 0;
}
function normalizeTimestamp(value, fallbackIso) {
    if (!value)
        return fallbackIso;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()))
        return fallbackIso;
    return parsed.toISOString();
}
export async function runSync() {
    assertSyncConfig();
    const supabase = getSupabase();
    const runId = `run_${Date.now()}`;
    const syncStart = nowIso();
    // 1. Fetch data from all configured sheets
    const multiSheetData = await fetchMultipleSheets(config.google.sheetNames);
    const dailyMap = new Map();
    const logsToUpsert = [];
    const functionsSet = new Map();
    const teamsSet = new Map();
    const allMembersRaw = [];
    let totalRows = 0;
    const getMapping = (sheetName) => {
        const s = sheetName.toLowerCase();
        if (s === "team1")
            return { func: "b2b", team: "b2b_team1" };
        if (s === "team2")
            return { func: "b2b", team: "b2b_team2" };
        return { func: "b2b", team: normalizeKey(sheetName) };
    };
    for (const [sheetName, rows] of Object.entries(multiSheetData)) {
        const mapping = getMapping(sheetName);
        totalRows += rows.length;
        functionsSet.set(mapping.func, { slug: mapping.func, name: mapping.func.toUpperCase() });
        teamsSet.set(mapping.team, {
            slug: mapping.team,
            name: sheetName,
            functionSlug: mapping.func
        });
        console.log(`📑 Processing sheet: "${sheetName}" (${rows.length} rows)`);
        if (rows.length > 0) {
            console.log(`📌 Headers found: ${Object.keys(rows[0]).join(", ")}`);
            console.log(`📝 First Row Sample:`, JSON.stringify(rows[0], null, 2));
        }
        for (const row of rows) {
            const email = normalizeEmail(row[config.google.columns.email] || "");
            if (!email) {
                // console.log("⚠️ Row skipped: No email found in column", config.google.columns.email);
                continue;
            }
            const sourceTimestamp = normalizeTimestamp(row[config.google.columns.timestamp] || "", syncStart);
            const dayKey = toDateKey(sourceTimestamp);
            const weekKey = toWeekKey(sourceTimestamp);
            const name = row[config.google.columns.name] || email.split("@")[0];
            const role = row[config.google.columns.role] || "Member";
            const squad = row[config.google.columns.squad] || "General";
            const profile = { email, name, role, functionSlug: mapping.func, team: mapping.team, squad };
            allMembersRaw.push({ ...profile, mappingTeam: mapping.team });
            const actionStr = row[config.google.columns.action] || "";
            const actionType = parseAction(actionStr);
            const rowCounts = { mous: 0, coldCalls: 0, followups: 0 };
            if (actionType) {
                rowCounts[actionType] = 1;
                logsToUpsert.push({
                    memberEmail: email,
                    functionSlug: mapping.func,
                    teamSlug: mapping.team,
                    actionType: actionType,
                    actionTimestamp: sourceTimestamp,
                    syncedAt: syncStart
                });
            }
            else {
                rowCounts.mous = parseNumber(row[config.google.columns.mous]);
                rowCounts.coldCalls = parseNumber(row[config.google.columns.coldCalls]);
                rowCounts.followups = parseNumber(row[config.google.columns.followups]);
                // Legacy count-based sheets do not provide a single Action column.
                // Expand numeric counts into action log rows so action_logs remains in sync.
                const countEntries = [
                    { type: "mous", count: rowCounts.mous },
                    { type: "coldCalls", count: rowCounts.coldCalls },
                    { type: "followups", count: rowCounts.followups }
                ];
                for (const entry of countEntries) {
                    for (let i = 0; i < entry.count; i += 1) {
                        const ts = new Date(sourceTimestamp);
                        ts.setMilliseconds(ts.getMilliseconds() + i);
                        logsToUpsert.push({
                            memberEmail: email,
                            functionSlug: mapping.func,
                            teamSlug: mapping.team,
                            actionType: entry.type,
                            actionTimestamp: ts.toISOString(),
                            syncedAt: syncStart
                        });
                    }
                }
            }
            // Aggregate for Snapshots (EVERY member gets a snapshot for the day)
            const snapshotKey = `${dayKey}_${email}`;
            let acc = dailyMap.get(snapshotKey);
            if (!acc) {
                acc = {
                    profile,
                    counts: { mous: 0, coldCalls: 0, followups: 0 },
                    sourceUpdatedAt: sourceTimestamp,
                    dayKey,
                    weekKey
                };
                dailyMap.set(snapshotKey, acc);
            }
            acc.counts.mous += rowCounts.mous;
            acc.counts.coldCalls += rowCounts.coldCalls;
            acc.counts.followups += rowCounts.followups;
            if (sourceTimestamp > acc.sourceUpdatedAt)
                acc.sourceUpdatedAt = sourceTimestamp;
        }
    }
    const syncedAt = nowIso();
    // 2. Perform Upserts to Supabase
    console.log("📤 Syncing to Supabase...");
    // 2.1 Upsert Functions
    const functionsData = Array.from(functionsSet.values()).map(f => ({
        slug: f.slug,
        display_name: f.name
    }));
    const { error: functionsError } = await supabase.from("functions").upsert(functionsData);
    if (functionsError) {
        throw new Error(`functions upsert failed: ${functionsError.message}`);
    }
    // 2.2 Upsert Teams
    const teamsData = Array.from(teamsSet.values()).map(t => ({
        slug: t.slug,
        display_name: t.name,
        function_slug: t.functionSlug
    }));
    const { error: teamsError } = await supabase.from("teams").upsert(teamsData);
    if (teamsError) {
        throw new Error(`teams upsert failed: ${teamsError.message}`);
    }
    // 2.3 Upsert Actions Logs (Ensure logs are deduplicated and saved FIRST)
    if (logsToUpsert.length > 0) {
        const logData = logsToUpsert.map(l => ({
            member_email: l.memberEmail,
            function_slug: l.functionSlug,
            team_slug: l.teamSlug,
            action_type: l.actionType,
            action_timestamp: l.actionTimestamp,
            synced_at: syncedAt
        }));
        const { error: logsError } = await supabase.from("action_logs").upsert(logData);
        if (logsError) {
            throw new Error(`action_logs upsert failed: ${logsError.message}`);
        }
        console.log(`✅ Upserted ${logData.length} logs.`);
    }
    // 2.4 Calculate Lifetime Totals from action_logs Ground Truth
    // We fetch counts for every member whose data we touched during this sync
    const uniqueEmails = Array.from(new Set(allMembersRaw.map(m => m.email)));
    console.log(`📊 Recalculating totals for ${uniqueEmails.length} members...`);
    // We query action_logs for these members to get their true lifetime totals
    const { data: logAggs, error: aggError } = await supabase
        .from("action_logs")
        .select("member_email, action_type")
        .in("member_email", uniqueEmails);
    if (aggError) {
        console.warn("Failed to fetch aggregate logs:", aggError.message);
    }
    else {
        // Process aggregates into member-level totals
        const emailToTotals = new Map();
        for (const log of (logAggs || [])) {
            const email = log.member_email;
            let totals = emailToTotals.get(email);
            if (!totals) {
                totals = { mous: 0, coldCalls: 0, followups: 0 };
                emailToTotals.set(email, totals);
            }
            const type = log.action_type;
            if (type === "mous")
                totals.mous++;
            else if (type === "coldCalls")
                totals.coldCalls++;
            else if (type === "followups")
                totals.followups++;
        }
        // Prepare Members for Upsert with their TRUE lifetime totals
        const finalMembersMap = new Map();
        for (const m of allMembersRaw) {
            if (!finalMembersMap.has(m.email)) {
                const t = emailToTotals.get(m.email) || { mous: 0, coldCalls: 0, followups: 0 };
                finalMembersMap.set(m.email, {
                    email: m.email,
                    name: m.name,
                    role: m.role,
                    team_slug: m.mappingTeam,
                    squad: m.squad,
                    mous: t.mous,
                    cold_calls: t.coldCalls,
                    followups: t.followups,
                    points: computePoints(t),
                    updated_at: syncedAt
                });
            }
        }
        const membersToUpsert = Array.from(finalMembersMap.values());
        if (membersToUpsert.length > 0) {
            const { error: membersError } = await supabase.from("members").upsert(membersToUpsert);
            if (membersError) {
                throw new Error(`members upsert failed: ${membersError.message}`);
            }
            console.log(`✅ Updated ${membersToUpsert.length} member profiles with lifetime totals.`);
        }
    }
    // 2.5 Upsert Snapshots
    const snapshotsToUpsert = Array.from(dailyMap.values()).map(acc => ({
        id: `${acc.dayKey}_${acc.profile.email}`,
        member_email: acc.profile.email,
        function_slug: acc.profile.functionSlug,
        team_slug: acc.profile.team,
        date_key: acc.dayKey,
        week_key: acc.weekKey,
        mous: acc.counts.mous,
        cold_calls: acc.counts.coldCalls,
        followups: acc.counts.followups,
        points: computePoints(acc.counts),
        source_updated_at: acc.sourceUpdatedAt,
        synced_at: syncedAt
    }));
    if (snapshotsToUpsert.length > 0) {
        const { error: snapshotsError } = await supabase.from("daily_snapshots").upsert(snapshotsToUpsert);
        if (snapshotsError) {
            throw new Error(`daily_snapshots upsert failed: ${snapshotsError.message}`);
        }
    }
    // 3. Update Dashboard Cache
    const periods = ["daily", "weekly", "marathon"];
    const allDailySnapshots = snapshotsToUpsert.map(s => ({
        id: s.id,
        email: s.member_email,
        name: "Member",
        role: "Member",
        functionSlug: s.function_slug,
        team: s.team_slug,
        squad: "General",
        dateKey: s.date_key,
        weekKey: s.week_key,
        counts: { mous: s.mous, coldCalls: s.cold_calls, followups: s.followups },
        points: s.points,
        sourceUpdatedAt: s.source_updated_at,
        syncedAt
    }));
    // 3.1 Update Dashboard Cache for Teams
    const cachePromises = Array.from(teamsSet.values()).flatMap(team => periods.map(async (period) => {
        try {
            const dashboard = await getTeamDashboard(team.slug, period, undefined, allDailySnapshots);
            dashboard.syncInfo = { lastSyncTime: syncStart, nextSyncTime: nowIso(), intervalMinutes: config.syncScheduler.intervalMinutes, runId };
            const { error: cacheError } = await supabase.from("dashboard_cache").upsert({
                id: `${team.slug}_${period}`,
                team_slug: team.slug,
                period,
                payload: dashboard,
                synced_at: syncedAt
            });
            if (cacheError) {
                throw new Error(`team dashboard_cache upsert failed (${team.slug}/${period}): ${cacheError.message}`);
            }
        }
        catch (e) {
            console.error(`Failed to update cache for ${team.slug}/${period}:`, e);
        }
    }));
    await Promise.all(cachePromises);
    // 3.2 Update Dashboard Cache for Functions
    const functionCachePromises = Array.from(functionsSet.values()).flatMap(func => periods.map(async (period) => {
        try {
            const dashboard = await getTeamDashboard(func.slug, period, undefined, allDailySnapshots, "function");
            dashboard.syncInfo = { lastSyncTime: syncStart, nextSyncTime: nowIso(), intervalMinutes: config.syncScheduler.intervalMinutes, runId };
            const { error: functionCacheError } = await supabase.from("dashboard_cache").upsert({
                id: `${func.slug}_${period}`,
                function_slug: func.slug,
                period,
                payload: dashboard,
                synced_at: syncedAt
            });
            if (functionCacheError) {
                throw new Error(`function dashboard_cache upsert failed (${func.slug}/${period}): ${functionCacheError.message}`);
            }
        }
        catch (e) {
            console.error(`Failed to update Function cache for ${func.slug}/${period}:`, e);
        }
    }));
    await Promise.all(functionCachePromises);
    return {
        rowsRead: totalRows,
        logsUpserted: logsToUpsert.length,
        snapshotsUpserted: snapshotsToUpsert.length,
        runId
    };
}
