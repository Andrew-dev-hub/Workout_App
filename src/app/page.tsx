"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Dumbbell, Flame, TrendingUp, Play } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { formatDuration } from "@/lib/utils";
import { format, startOfWeek, eachDayOfInterval, endOfWeek, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";

export default function HomePage() {
  const recentSessions = useLiveQuery(
    () =>
      db.workoutSessions
        .orderBy("startedAt")
        .reverse()
        .filter((s) => s.completedAt !== null)
        .limit(5)
        .toArray(),
    []
  );

  const weekSessions = useLiveQuery(async () => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    const end = endOfWeek(new Date(), { weekStartsOn: 1 });
    return db.workoutSessions
      .where("startedAt")
      .between(start, end)
      .filter((s) => s.completedAt !== null)
      .toArray();
  }, []);

  const activeSession = useLiveQuery(
    () => db.workoutSessions.filter((s) => s.completedAt === null).first(),
    []
  );

  const weekDays = eachDayOfInterval({
    start: startOfWeek(new Date(), { weekStartsOn: 1 }),
    end: endOfWeek(new Date(), { weekStartsOn: 1 }),
  });

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };
  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <div className="min-h-screen px-4 py-6 max-w-lg mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <p className="text-muted-foreground text-sm">
          {format(new Date(), "EEEE d MMMM", { locale: fr })}
        </p>
        <h1 className="text-3xl font-bold tracking-tight">
          Bonne séance 💪
        </h1>
      </motion.div>

      <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">

        {/* Active session banner */}
        {activeSession && (
          <motion.div variants={item}>
            <Link href="/workout/live">
              <div className="neon-border rounded-2xl p-4 bg-emerald-500/10 flex items-center gap-4 cursor-pointer hover:bg-emerald-500/15 transition-colors">
                <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center animate-pulse-neon">
                  <Play className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-emerald-400">Séance en cours</p>
                  <p className="text-sm text-muted-foreground">{activeSession.name}</p>
                </div>
                <span className="text-emerald-400 text-sm font-mono">▶</span>
              </div>
            </Link>
          </motion.div>
        )}

        {/* Week heatmap */}
        <motion.div variants={item} className="bg-card rounded-2xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-medium text-muted-foreground">Cette semaine</span>
            <span className="ml-auto text-emerald-400 font-bold">{weekSessions?.length ?? 0} séance{(weekSessions?.length ?? 0) > 1 ? "s" : ""}</span>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {weekDays.map((day) => {
              const trained = weekSessions?.some((s) =>
                isSameDay(new Date(s.startedAt), day)
              );
              const isToday = isSameDay(day, new Date());
              return (
                <div key={day.toISOString()} className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">
                    {format(day, "EEE", { locale: fr }).slice(0, 2)}
                  </span>
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium transition-all ${
                      trained
                        ? "bg-emerald-500 text-white shadow-neon-sm"
                        : isToday
                        ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {format(day, "d")}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Quick start */}
        <motion.div variants={item}>
          <Link href="/workout/start">
            <div className="bg-emerald-500 hover:bg-emerald-400 transition-colors rounded-2xl p-5 flex items-center gap-4 cursor-pointer shadow-neon-green">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <Dumbbell className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-bold text-white text-lg">Démarrer une séance</p>
                <p className="text-white/70 text-sm">Choisir un programme ou séance libre</p>
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Stats rapides */}
        <motion.div variants={item} className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-2xl p-4 border border-border">
            <TrendingUp className="w-5 h-5 text-blue-400 mb-2" />
            <p className="text-2xl font-bold">{recentSessions?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground">Séances récentes</p>
          </div>
          <div className="bg-card rounded-2xl p-4 border border-border">
            <Flame className="w-5 h-5 text-orange-400 mb-2" />
            <p className="text-2xl font-bold">
              {recentSessions && recentSessions.length > 0
                ? formatDuration(
                    Math.round(
                      recentSessions.reduce((a, s) => a + s.durationSeconds, 0) /
                        recentSessions.length
                    )
                  )
                : "—"}
            </p>
            <p className="text-xs text-muted-foreground">Durée moyenne</p>
          </div>
        </motion.div>

        {/* Historique récent */}
        {recentSessions && recentSessions.length > 0 && (
          <motion.div variants={item} className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <span className="text-sm font-medium">Séances récentes</span>
            </div>
            {recentSessions.map((session) => (
              <Link key={session.id} href={`/history/${session.id}`}>
                <div className="px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors border-b border-border last:border-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <Dumbbell className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{session.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(session.startedAt), "EEE d MMM", { locale: fr })} · {formatDuration(session.durationSeconds)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
