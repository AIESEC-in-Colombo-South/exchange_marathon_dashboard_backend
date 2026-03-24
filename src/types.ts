export interface CriteriaCounts {
  mous: number;
  coldCalls: number;
  followups: number;
}

export interface MemberProfile {
  email: string;
  name: string;
  role: string;
  team: string;
  squad: string;
}

export interface MemberSnapshot {
  id: string;
  email: string;
  name: string;
  role: string;
  team: string;
  squad: string;
  dateKey: string;
  weekKey: string;
  counts: CriteriaCounts;
  points: number;
  sourceUpdatedAt: string;
  syncedAt: string;
}

export interface TeamDashboardPerformer {
  name: string;
  role: string;
  score: number;
  avatar: string;
  metrics: CriteriaCounts;
}

export interface TeamDashboardMiniTeam {
  name: string;
  rank: number;
  points: number;
  growth: number;
  icon: string;
  performers: TeamDashboardPerformer[];
}

export interface TeamDashboardPayload {
  name: string;
  displayName: string;
  miniTeams: TeamDashboardMiniTeam[];
  totalPoints: number;
  totalGrowth: number;
  completedActions: number;
  weeklyGrowth: number;
  asOfDate: string;
  period: "daily" | "weekly" | "bi-weekly" | "monthly" | "marathon";
  syncInfo?: {
    lastSyncTime: string;
    nextSyncTime: string;
    intervalMinutes: number;
  };
}
