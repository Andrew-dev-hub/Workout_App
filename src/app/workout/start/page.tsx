"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type WorkoutTemplate } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { useRouter } from "next/navigation";
import { ArrowLeft, Play, Dumbbell, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function WorkoutStartPage() {
  const router = useRouter();
  const [freeName, setFreeName] = useState("Séance libre");
  const [loading, setLoading] = useState(false);

  const settings = useLiveQuery(() => db.settings.get(1), []);
  const activeProgram = useLiveQuery(
    () => settings?.activeProgramId ? db.programs.get(settings.activeProgramId) : undefined,
    [settings?.activeProgramId]
  );
  const templates = useLiveQuery(
    async (): Promise<WorkoutTemplate[]> => {
      if (!settings?.activeProgramId) return [];
      return db.workoutTemplates.where("programId").equals(settings.activeProgramId).sortBy("order");
    },
    [settings?.activeProgramId]
  );
  const programs = useLiveQuery(() => db.programs.toArray(), []);

  const startWorkout = async (template?: WorkoutTemplate, name?: string) => {
    setLoading(true);
    const sessionName = name ?? template?.name ?? "Séance libre";
    const sessionId = uuidv4();
    await db.workoutSessions.add({
      id: sessionId,
      templateId: template?.id ?? null,
      programId: template?.programId ?? null,
      name: sessionName,
      startedAt: new Date(),
      completedAt: null,
      durationSeconds: 0,
      notes: "",
      mood: null,
    });
    router.push(`/workout/live?id=${sessionId}`);
  };

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
  const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="min-h-screen px-4 py-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/">
          <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center hover:bg-muted/70 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </div>
        </Link>
        <h1 className="text-xl font-bold">Démarrer une séance</h1>
      </div>

      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">

        {/* Quick free session */}
        <motion.div variants={item}>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Séance libre</h2>
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <Input
              value={freeName}
              onChange={e => setFreeName(e.target.value)}
              placeholder="Nom de la séance"
            />
            <Button
              className="w-full"
              onClick={() => startWorkout(undefined, freeName)}
              disabled={loading}
            >
              <Play className="w-4 h-4 mr-2" /> Démarrer maintenant
            </Button>
          </div>
        </motion.div>

        {/* Active program templates */}
        {activeProgram && templates && templates.length > 0 && (
          <motion.div variants={item}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {activeProgram.name}
              </h2>
              <Link href={`/programs/${activeProgram.id}`} className="text-xs text-emerald-400 hover:text-emerald-300">
                Modifier
              </Link>
            </div>
            <div className="space-y-2">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => startWorkout(template)}
                  disabled={loading}
                  className="w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-3 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all text-left"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: activeProgram.color + "22" }}
                  >
                    <Dumbbell className="w-5 h-5" style={{ color: activeProgram.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{template.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {template.exercises.length} exercice{template.exercises.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* No active program nudge */}
        {!activeProgram && programs && programs.length > 0 && (
          <motion.div variants={item}>
            <div className="bg-muted/30 border border-border border-dashed rounded-2xl p-4 text-center">
              <p className="text-sm text-muted-foreground mb-3">Aucun programme actif</p>
              <Link href="/programs">
                <Button variant="outline" size="sm">Choisir un programme</Button>
              </Link>
            </div>
          </motion.div>
        )}

        {/* No programs at all */}
        {(!programs || programs.length === 0) && (
          <motion.div variants={item}>
            <div className="bg-muted/30 border border-border border-dashed rounded-2xl p-5 text-center space-y-3">
              <Dumbbell className="w-8 h-8 text-muted-foreground mx-auto" />
              <div>
                <p className="text-sm font-medium">Pas encore de programme</p>
                <p className="text-xs text-muted-foreground mt-1">Crée un programme pour organiser tes séances</p>
              </div>
              <Link href="/programs">
                <Button variant="neon" size="sm">Créer un programme</Button>
              </Link>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
