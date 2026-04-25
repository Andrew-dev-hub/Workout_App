"use client";

import { use } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { ArrowLeft, Dumbbell, Star } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { formatDuration, formatWeight, MUSCLE_GROUP_LABELS, MUSCLE_GROUP_COLORS, cn } from "@/lib/utils";
import { calcVolume } from "@/lib/db";

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const session = useLiveQuery(() => db.workoutSessions.get(id), [id]);
  const setLogs = useLiveQuery(() => db.setLogs.where("sessionId").equals(id).sortBy("loggedAt"), [id]);

  const exercises = useLiveQuery(async () => {
    if (!setLogs) return [];
    const ids = [...new Set(setLogs.map(s => s.exerciseId))];
    return db.exercises.bulkGet(ids);
  }, [setLogs]);

  if (!session) return null;

  const volume = setLogs ? calcVolume(setLogs) : 0;
  const prCount = setLogs?.filter(s => s.isPR).length ?? 0;
  const exerciseIds = [...new Set(setLogs?.map(s => s.exerciseId) ?? [])];

  return (
    <div className="min-h-screen px-4 py-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/">
          <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center hover:bg-muted/70 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </div>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{session.name}</h1>
          <p className="text-xs text-muted-foreground">
            {format(new Date(session.startedAt), "EEEE d MMMM yyyy", { locale: fr })}
          </p>
        </div>
      </div>

      {/* Stats summary */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-3 gap-3 mb-6"
      >
        <div className="bg-card border border-border rounded-2xl p-3 text-center">
          <p className="text-xl font-bold">{formatDuration(session.durationSeconds)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Durée</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-3 text-center">
          <p className="text-xl font-bold">{Math.round(volume / 1000 * 10) / 10}<span className="text-sm font-normal">t</span></p>
          <p className="text-xs text-muted-foreground mt-0.5">Volume</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-3 text-center">
          <p className="text-xl font-bold text-amber-400">{prCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">PR</p>
        </div>
      </motion.div>

      {prCount > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3"
        >
          <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
          <p className="text-sm font-medium text-amber-400">
            {prCount} nouveau{prCount > 1 ? "x" : ""} record{prCount > 1 ? "s" : ""} personnel{prCount > 1 ? "s" : ""} ! 🏆
          </p>
        </motion.div>
      )}

      {/* Exercises */}
      <div className="space-y-3">
        {exerciseIds.map((exId, ei) => {
          const exercise = exercises?.[ei];
          if (!exercise) return null;
          const exSets = setLogs?.filter(s => s.exerciseId === exId && !s.isWarmup) ?? [];

          return (
            <motion.div
              key={exId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: ei * 0.05 }}
              className="bg-card border border-border rounded-2xl overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-sm">{exercise.name}</span>
                <span className={cn("ml-auto text-[10px] px-2 py-0.5 rounded-full border", MUSCLE_GROUP_COLORS[exercise.muscleGroup])}>
                  {MUSCLE_GROUP_LABELS[exercise.muscleGroup]}
                </span>
              </div>
              <div className="px-4 py-3 space-y-1.5">
                {exSets.map((s, i) => (
                  <div key={s.id} className={cn("flex items-center gap-3 text-sm", s.isPR && "text-amber-400")}>
                    <span className="text-muted-foreground w-5 text-center">{i + 1}</span>
                    <span className="font-semibold">{s.reps} × {formatWeight(s.weight)} kg</span>
                    {s.notes && <span className="text-xs text-muted-foreground truncate">{s.notes}</span>}
                    {s.isPR && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 ml-auto flex-shrink-0" />}
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
