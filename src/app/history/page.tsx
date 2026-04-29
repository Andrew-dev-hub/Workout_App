"use client";

import { useState, useMemo, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Exercise, type SetLog, type WorkoutSession, type Program } from "@/lib/db";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { format, subWeeks, eachWeekOfInterval, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, Star, Dumbbell, ArrowLeft, Search,
  ChevronRight, Trophy, Zap, BarChart2, Flame,
} from "lucide-react";
import {
  cn, MUSCLE_GROUP_LABELS, MUSCLE_GROUP_COLORS,
  formatWeight, formatDuration,
} from "@/lib/utils";
import { Input } from "@/components/ui/input";
import Link from "next/link";

// ── Helpers ───────────────────────────────────────────────────────────────────

function estimateOneRM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

function fmtVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`;
  return `${Math.round(kg)} kg`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface WeekPoint { label: string; volume: number; sessions: number }

interface GlobalData {
  totalSessions: number;
  totalVolume: number;
  totalPRs: number;
  avgDuration: number;
  volumePerWeek: WeekPoint[];
  recentSessions: WorkoutSession[];
}

interface ExerciseSummary {
  exercise: Exercise;
  maxWeight: number;
  totalSessions: number;
  lastDate: Date;
}

interface ExerciseDataPoint {
  label: string;
  date: Date;
  maxWeight: number;
  maxReps: number;
  bestOneRM: number;
  volume: number;
  hasPR: boolean;
  sets: SetLog[];
}

interface ExerciseStatsData {
  dataPoints: ExerciseDataPoint[];
  allMaxWeight: number;
  allMaxReps: number;
  allBestOneRM: number;
  totalVolume: number;
  totalPRs: number;
}

// ── Chart helpers ─────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900/95 border border-zinc-700 rounded-xl px-3 py-2.5 text-xs shadow-xl backdrop-blur">
      <p className="text-zinc-400 mb-1.5 font-medium">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-bold" style={{ color: p.color ?? p.fill }}>
          {p.name}: {p.value}{p.unit ?? ""}
        </p>
      ))}
    </div>
  );
}

function PRDot(props: any) {
  const { cx, cy, payload } = props;
  if (!cx || !cy) return null;
  if (payload?.hasPR) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={8} fill="#f59e0b" opacity={0.18} />
        <circle cx={cx} cy={cy} r={4} fill="#f59e0b" />
      </g>
    );
  }
  return <circle cx={cx} cy={cy} r={3} fill="#10b981" />;
}

// ── UI primitives ─────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, color = "text-emerald-400",
}: {
  label: string; value: string | number; sub?: string; icon: any; color?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-3 flex flex-col gap-0.5">
      <Icon className={cn("w-4 h-4 mb-1", color)} />
      <p className="text-lg font-bold leading-tight">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
      {children}
    </h2>
  );
}

// ── Global Tab ────────────────────────────────────────────────────────────────

function GlobalTab({ data, allPrograms }: { data: GlobalData | null; allPrograms: Program[] | undefined }) {
  const programsMap = useMemo(() => {
    const map = new Map<string, Program>();
    allPrograms?.forEach((p) => map.set(p.id, p));
    return map;
  }, [allPrograms]);

  if (!data) return (
    <div className="text-center py-16 text-muted-foreground text-sm">Chargement…</div>
  );

  if (data.totalSessions === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="text-center py-20 space-y-3">
        <Dumbbell className="w-14 h-14 text-muted-foreground/20 mx-auto" />
        <p className="text-muted-foreground text-sm font-medium">Aucune séance enregistrée</p>
        <p className="text-muted-foreground/50 text-xs">
          Complète ta première séance pour voir tes stats !
        </p>
      </motion.div>
    );
  }

  const hasData = data.volumePerWeek.some((w) => w.volume > 0 || w.sessions > 0);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }} className="space-y-6">

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Dumbbell} label="Séances totales"
          value={data.totalSessions} color="text-emerald-400" />
        <StatCard icon={Trophy} label="PRs battus"
          value={data.totalPRs} color="text-amber-400" />
        <StatCard icon={Zap} label="Volume total"
          value={fmtVolume(data.totalVolume)} color="text-blue-400" />
        <StatCard icon={Flame} label="Durée moyenne"
          value={formatDuration(data.avgDuration)} color="text-orange-400" />
      </div>

      {/* Volume area chart */}
      {hasData && (
        <div>
          <SectionTitle>Volume · 12 dernières semaines</SectionTitle>
          <div className="bg-card border border-border rounded-2xl p-4">
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={data.volumePerWeek}
                margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 9 }}
                  axisLine={false} tickLine={false} interval={2} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 9 }} axisLine={false}
                  tickLine={false} tickFormatter={(v) => `${v}t`} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="volume" name="Volume" unit=" t"
                  stroke="#10b981" strokeWidth={2} fill="url(#volGrad)"
                  dot={false} activeDot={{ r: 4, fill: "#10b981" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Sessions frequency bar chart */}
      {hasData && (
        <div>
          <SectionTitle>Fréquence · séances / semaine</SectionTitle>
          <div className="bg-card border border-border rounded-2xl p-4">
            <ResponsiveContainer width="100%" height={110}>
              <BarChart data={data.volumePerWeek}
                margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 9 }}
                  axisLine={false} tickLine={false} interval={2} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 9 }} axisLine={false}
                  tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="sessions" name="Séances" fill="#3b82f6"
                  radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent sessions list */}
      {data.recentSessions.length > 0 && (
        <div>
          <SectionTitle>Dernières séances</SectionTitle>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {data.recentSessions.map((s, i) => (
              <Link key={s.id} href={`/history/${s.id}`}>
                <div
                  className={cn("px-4 py-3 flex items-center gap-3 hover:bg-muted/40 transition-colors",
                    i < data.recentSessions.length - 1 && "border-b border-border")}>
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <Dumbbell className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.programId && (() => { const p = programsMap.get(s.programId!); return p ? (
                        <span style={{ color: p.color }} className="font-medium">{p.name} · {" "}</span>
                      ) : null; })()}
                      {format(new Date(s.startedAt), "EEE d MMM", { locale: fr })} ·{" "}
                      {formatDuration(s.durationSeconds)}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Exercises Tab ─────────────────────────────────────────────────────────────

function ExercisesTab({
  summaries, search, onSearch, onSelect,
}: {
  summaries: ExerciseSummary[];
  search: string;
  onSearch: (s: string) => void;
  onSelect: (e: Exercise) => void;
}) {
  const isEmpty = summaries.length === 0 && search === "";

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }} className="space-y-4">

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Rechercher un exercice…" value={search}
          onChange={(e) => onSearch(e.target.value)} className="pl-9" />
      </div>

      {isEmpty ? (
        <div className="text-center py-20 space-y-3">
          <BarChart2 className="w-14 h-14 text-muted-foreground/20 mx-auto" />
          <p className="text-muted-foreground text-sm font-medium">Aucun exercice tracé</p>
          <p className="text-muted-foreground/50 text-xs">
            Les exercices que tu pratiques apparaîtront ici
          </p>
        </div>
      ) : summaries.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-10">Aucun résultat</p>
      ) : (
        <div className="space-y-2">
          {summaries.map(({ exercise, maxWeight, totalSessions, lastDate }) => (
            <button key={exercise.id} onClick={() => onSelect(exercise)}
              className="w-full bg-card border border-border rounded-2xl px-4 py-3 flex items-center gap-3 hover:border-muted-foreground/40 transition-colors text-left">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-sm truncate">{exercise.name}</p>
                  <span className={cn("flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full border",
                    MUSCLE_GROUP_COLORS[exercise.muscleGroup])}>
                    {MUSCLE_GROUP_LABELS[exercise.muscleGroup]}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{totalSessions} séance{totalSessions > 1 ? "s" : ""}</span>
                  <span>Max : {formatWeight(maxWeight)} kg</span>
                  <span>{format(lastDate, "d MMM yy", { locale: fr })}</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ── Exercise Detail View ──────────────────────────────────────────────────────

function ExerciseDetailView({
  exercise, stats, onBack,
}: {
  exercise: Exercise;
  stats: ExerciseStatsData | null;
  onBack: () => void;
}) {
  const [metric, setMetric] = useState<"weight" | "oneRM" | "volume">("weight");

  return (
    <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      className="min-h-screen px-4 py-6 max-w-lg mx-auto pb-24">

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack}
          className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center hover:bg-muted/70 transition-colors flex-shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-lg truncate">{exercise.name}</h1>
          <span className={cn("text-[10px] px-2 py-0.5 rounded-full border inline-block mt-0.5",
            MUSCLE_GROUP_COLORS[exercise.muscleGroup])}>
            {MUSCLE_GROUP_LABELS[exercise.muscleGroup]}
          </span>
        </div>
      </div>

      {!stats ? (
        <div className="text-center py-20 space-y-3">
          <Dumbbell className="w-14 h-14 text-muted-foreground/20 mx-auto" />
          <p className="text-muted-foreground text-sm">Aucune donnée pour cet exercice</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={Trophy} label="1RM estimé" color="text-amber-400"
              value={`${formatWeight(stats.allBestOneRM)} kg`} />
            <StatCard icon={TrendingUp} label="Poids max" color="text-emerald-400"
              value={`${formatWeight(stats.allMaxWeight)} kg`} />
            <StatCard icon={Zap} label="Reps max" color="text-blue-400"
              value={stats.allMaxReps}
              sub={`${stats.dataPoints.length} séance${stats.dataPoints.length > 1 ? "s" : ""}`} />
            <StatCard icon={Star} label="PRs battus" color="text-amber-400"
              value={stats.totalPRs}
              sub={`Vol. total : ${fmtVolume(stats.totalVolume)}`} />
          </div>

          {/* Chart */}
          {stats.dataPoints.length >= 1 && (
            <div>
              {/* Metric selector */}
              <div className="flex bg-muted rounded-xl p-1 mb-4">
                {([
                  { key: "weight" as const, label: "Poids max" },
                  { key: "oneRM"  as const, label: "1RM estimé" },
                  { key: "volume" as const, label: "Volume" },
                ]).map(({ key, label }) => (
                  <button key={key} onClick={() => setMetric(key)}
                    className={cn(
                      "flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors",
                      metric === key
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}>
                    {label}
                  </button>
                ))}
              </div>

              <div className="bg-card border border-border rounded-2xl p-4">
                <ResponsiveContainer width="100%" height={190}>
                  {metric === "volume" ? (
                    <BarChart data={stats.dataPoints}
                      margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 9 }}
                        axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#6b7280", fontSize: 9 }} axisLine={false}
                        tickLine={false} tickFormatter={(v) => fmtVolume(v)} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="volume" name="Volume" fill="#3b82f6"
                        radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : (
                    <LineChart data={stats.dataPoints}
                      margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 9 }}
                        axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#6b7280", fontSize: 9 }} axisLine={false}
                        tickLine={false} tickFormatter={(v) => `${v} kg`}
                        domain={["auto", "auto"]} />
                      <Tooltip content={<ChartTooltip />} />
                      <Line
                        type="monotone"
                        dataKey={metric === "weight" ? "maxWeight" : "bestOneRM"}
                        name={metric === "weight" ? "Poids max" : "1RM estimé"}
                        unit=" kg"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        dot={(p: any) => <PRDot key={`dot-${p.index}`} {...p} />}
                        activeDot={{ r: 5, fill: "#10b981", stroke: "#065f46", strokeWidth: 2 }}
                      />
                    </LineChart>
                  )}
                </ResponsiveContainer>

                {stats.totalPRs > 0 && metric !== "volume" && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0" />
                    <span className="text-[10px] text-muted-foreground">
                      Point doré = nouveau record personnel (PR)
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Session history */}
          <div>
            <SectionTitle>Historique des séances</SectionTitle>
            <div className="space-y-2">
              {[...stats.dataPoints].reverse().slice(0, 10).map((point, i) => (
                <motion.div key={point.date.toISOString()}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.035 }}
                  className="bg-card border border-border rounded-2xl overflow-hidden">

                  <div className={cn(
                    "px-4 py-2.5 border-b border-border flex items-center gap-2",
                    point.hasPR && "bg-amber-500/5"
                  )}>
                    <span className="text-xs font-medium text-muted-foreground capitalize">
                      {format(point.date, "EEEE d MMMM", { locale: fr })}
                    </span>
                    {point.hasPR && (
                      <span className="ml-auto flex items-center gap-1 text-amber-400 text-[10px] font-bold">
                        <Star className="w-3 h-3 fill-amber-400" /> PR
                      </span>
                    )}
                  </div>

                  <div className="px-4 py-2.5 space-y-1.5">
                    {point.sets.map((s, si) => (
                      <div key={s.id}
                        className={cn("flex items-center gap-3 text-sm",
                          s.isPR && "text-amber-400")}>
                        <span className="text-muted-foreground w-4 text-center text-xs shrink-0">
                          {si + 1}
                        </span>
                        <span className="font-semibold">
                          {s.reps} × {formatWeight(s.weight)} kg
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto shrink-0">
                          ~{estimateOneRM(s.weight, s.reps)} kg 1RM
                        </span>
                        {s.isPR && (
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                        )}
                      </div>
                    ))}

                    <div className="pt-1 flex gap-4 text-[10px] text-muted-foreground border-t border-border mt-1">
                      <span>Vol. {fmtVolume(point.volume)}</span>
                      <span>Max {formatWeight(point.maxWeight)} kg</span>
                      <span>{point.maxReps} reps max</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const [tab, setTab] = useState<"global" | "exercises">("global");
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [exerciseSearch, setExerciseSearch] = useState("");

  const allSessions = useLiveQuery(
    () => db.workoutSessions.filter((s) => s.completedAt !== null).toArray(), []
  );
  const allSetLogs = useLiveQuery(() => db.setLogs.toArray(), []);
  const allExercises = useLiveQuery(() => db.exercises.toArray(), []);
  const allPrograms = useLiveQuery(() => db.programs.toArray(), []);

  // ── Global stats ──
  const globalData = useMemo((): GlobalData | null => {
    if (!allSessions || !allSetLogs) return null;
    const workSets = allSetLogs.filter((s) => !s.isWarmup);
    const totalVolume = workSets.reduce((acc, s) => acc + s.weight * s.reps, 0);
    const totalPRs = workSets.filter((s) => s.isPR).length;
    const avgDuration =
      allSessions.length > 0
        ? Math.round(allSessions.reduce((a, s) => a + s.durationSeconds, 0) / allSessions.length)
        : 0;

    const now = new Date();
    const weeks = eachWeekOfInterval(
      { start: subWeeks(startOfWeek(now, { weekStartsOn: 1 }), 11), end: now },
      { weekStartsOn: 1 }
    );
    const volumePerWeek: WeekPoint[] = weeks.map((weekStart) => {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const weekSessions = allSessions.filter((s) => {
        const d = new Date(s.startedAt);
        return d >= weekStart && d <= weekEnd;
      });
      const ids = new Set(weekSessions.map((s) => s.id));
      const weekLogs = workSets.filter((s) => ids.has(s.sessionId));
      const volumeT =
        Math.round((weekLogs.reduce((acc, s) => acc + s.weight * s.reps, 0) / 1000) * 10) / 10;
      return {
        label: format(weekStart, "d MMM", { locale: fr }),
        volume: volumeT,
        sessions: weekSessions.length,
      };
    });

    const recentSessions = [...allSessions]
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, 5);

    return {
      totalSessions: allSessions.length,
      totalVolume, totalPRs, avgDuration,
      volumePerWeek, recentSessions,
    };
  }, [allSessions, allSetLogs]);

  // ── Exercise summaries (tab 2 list) ──
  const exerciseSummaries = useMemo((): ExerciseSummary[] => {
    if (!allSetLogs || !allExercises) return [];
    const workSets = allSetLogs.filter((s) => !s.isWarmup);
    const loggedIds = new Set(workSets.map((s) => s.exerciseId));

    return allExercises
      .filter(
        (e) =>
          loggedIds.has(e.id) &&
          (exerciseSearch === "" ||
            e.name.toLowerCase().includes(exerciseSearch.toLowerCase()))
      )
      .map((exercise) => {
        const sets = workSets.filter((s) => s.exerciseId === exercise.id);
        const maxWeight = Math.max(...sets.map((s) => s.weight), 0);
        const lastLog = sets.reduce(
          (latest, s) =>
            !latest || new Date(s.loggedAt) > new Date(latest.loggedAt) ? s : latest,
          sets[0]
        );
        return {
          exercise,
          maxWeight,
          totalSessions: new Set(sets.map((s) => s.sessionId)).size,
          lastDate: new Date(lastLog.loggedAt),
        };
      })
      .sort((a, b) => b.lastDate.getTime() - a.lastDate.getTime());
  }, [allSetLogs, allExercises, exerciseSearch]);

  // ── Per-exercise detail ──
  const exerciseStats = useMemo((): ExerciseStatsData | null => {
    if (!selectedExercise || !allSetLogs || !allSessions) return null;
    const logs = allSetLogs
      .filter((s) => s.exerciseId === selectedExercise.id && !s.isWarmup)
      .sort((a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime());
    if (logs.length === 0) return null;

    const sessionMap = new Map<string, SetLog[]>();
    for (const log of logs) {
      if (!sessionMap.has(log.sessionId)) sessionMap.set(log.sessionId, []);
      sessionMap.get(log.sessionId)!.push(log);
    }

    const dataPoints: ExerciseDataPoint[] = [];
    for (const [sessionId, sets] of sessionMap.entries()) {
      const session = allSessions.find((s) => s.id === sessionId);
      if (!session) continue;
      const date = new Date(session.startedAt);
      dataPoints.push({
        label: format(date, "d MMM", { locale: fr }),
        date,
        maxWeight: Math.max(...sets.map((s) => s.weight)),
        maxReps: Math.max(...sets.map((s) => s.reps)),
        bestOneRM: Math.max(...sets.map((s) => estimateOneRM(s.weight, s.reps))),
        volume: sets.reduce((acc, s) => acc + s.weight * s.reps, 0),
        hasPR: sets.some((s) => s.isPR),
        sets,
      });
    }
    dataPoints.sort((a, b) => a.date.getTime() - b.date.getTime());

    return {
      dataPoints,
      allMaxWeight: Math.max(...dataPoints.map((d) => d.maxWeight)),
      allMaxReps: Math.max(...dataPoints.map((d) => d.maxReps)),
      allBestOneRM: Math.max(...dataPoints.map((d) => d.bestOneRM)),
      totalVolume: logs.reduce((acc, s) => acc + s.weight * s.reps, 0),
      totalPRs: logs.filter((s) => s.isPR).length,
    };
  }, [selectedExercise, allSetLogs, allSessions]);

  // Show exercise detail
  if (selectedExercise) {
    return (
      <ExerciseDetailView
        exercise={selectedExercise}
        stats={exerciseStats}
        onBack={() => setSelectedExercise(null)}
      />
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 max-w-lg mx-auto pb-24">
      <h1 className="text-2xl font-bold mb-5">Stats</h1>

      {/* Tabs */}
      <div className="flex bg-muted rounded-xl p-1 mb-5">
        {(["global", "exercises"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn(
              "flex-1 py-2 text-sm font-medium rounded-lg transition-colors",
              tab === t
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}>
            {t === "global" ? "Vue globale" : "Par exercice"}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === "global" ? (
          <GlobalTab key="global" data={globalData} allPrograms={allPrograms} />
        ) : (
          <ExercisesTab
            key="exercises"
            summaries={exerciseSummaries}
            search={exerciseSearch}
            onSearch={setExerciseSearch}
            onSelect={setSelectedExercise}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
