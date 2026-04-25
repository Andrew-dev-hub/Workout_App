"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Exercise, type SetLog, type TemplateExercise, checkPR, getLastSessionSets } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, CheckCircle2, Dumbbell, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ExerciseLogCard, type SetInput } from "@/components/workout/exercise-log-card";
import { RestTimer, useRestTimer } from "@/components/workout/rest-timer";
import { ExercisePicker } from "@/components/exercises/exercise-picker";
import { useConfetti } from "@/hooks/use-confetti";
import { formatDuration, cn } from "@/lib/utils";

interface LiveExercise {
  exercise: Exercise;
  templateConfig: TemplateExercise | null;
}

function LiveWorkoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("id") ?? "";

  const { firePR, fireFinish } = useConfetti();
  const { active: restActive, start: startRest, dismiss: dismissRest } = useRestTimer();

  const [liveExercises, setLiveExercises] = useState<LiveExercise[]>([]);
  const [setInputs, setSetInputs] = useState<Record<string, SetInput[]>>({});
  const [lastSets, setLastSets] = useState<Record<string, SetLog[]>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [showFinish, setShowFinish] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const session = useLiveQuery(() => db.workoutSessions.get(sessionId), [sessionId]);
  const settings = useLiveQuery(() => db.settings.get(1), []);

  // Load template exercises on mount
  useEffect(() => {
    if (!session || liveExercises.length > 0) return;

    const load = async () => {
      let exercises: LiveExercise[] = [];

      if (session.templateId) {
        const template = await db.workoutTemplates.get(session.templateId);
        if (template && template.exercises.length > 0) {
          const exList = await db.exercises.bulkGet(template.exercises.map(e => e.exerciseId));
          exercises = template.exercises
            .map((te, i) => ({ exercise: exList[i]!, templateConfig: te }))
            .filter(e => e.exercise != null);
        }
      }

      if (exercises.length > 0) {
        setLiveExercises(exercises);
        // Load last session data for each exercise
        const last: Record<string, SetLog[]> = {};
        for (const { exercise, templateConfig } of exercises) {
          last[exercise.id] = await getLastSessionSets(exercise.id, sessionId);
          // Pre-fill set inputs from template
          const count = templateConfig?.sets ?? 3;
          const prevSets = last[exercise.id].filter(s => !s.isWarmup);
          setSetInputs(prev => ({
            ...prev,
            [exercise.id]: Array.from({ length: count }, (_, i) => ({
              id: uuidv4(),
              reps: prevSets[i]?.reps.toString() ?? templateConfig?.repsMin.toString() ?? "8",
              weight: prevSets[i]?.weight.toString() ?? "",
              notes: prevSets[i]?.notes ?? templateConfig?.notes ?? "",
              isWarmup: false,
              confirmed: false,
              isPR: false,
            })),
          }));
        }
        setLastSets(last);
      }
    };

    load();
  }, [session, liveExercises.length, sessionId]);

  // Elapsed timer
  useEffect(() => {
    if (!session?.startedAt) return;
    const tick = () => setElapsed(Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session?.startedAt]);

  const addExercise = useCallback(async (exercise: Exercise) => {
    const existing = liveExercises.find(e => e.exercise.id === exercise.id);
    if (existing) return;
    const prev = await getLastSessionSets(exercise.id, sessionId);
    setLastSets(ls => ({ ...ls, [exercise.id]: prev }));
    setSetInputs(si => ({
      ...si,
      [exercise.id]: Array.from({ length: 3 }, (_, i) => ({
        id: uuidv4(),
        reps: prev[i]?.reps.toString() ?? "8",
        weight: prev[i]?.weight.toString() ?? "",
        notes: prev[i]?.notes ?? "",
        isWarmup: false,
        confirmed: false,
        isPR: false,
      })),
    }));
    const newExercises = [...liveExercises, { exercise, templateConfig: null }];
    setLiveExercises(newExercises);
    setCurrentIndex(newExercises.length - 1);
  }, [liveExercises, sessionId]);

  const handleConfirmSet = useCallback(async (exerciseId: string, setIndex: number) => {
    const sets = setInputs[exerciseId] ?? [];
    const s = sets[setIndex];
    if (!s || !s.reps || !s.weight) return;

    const reps = parseInt(s.reps);
    const weight = parseFloat(s.weight);
    const isPR = await checkPR(exerciseId, weight, sessionId);

    const logId = uuidv4();
    const workSets = sets.slice(0, setIndex + 1).filter(x => !x.isWarmup);
    await db.setLogs.add({
      id: logId,
      sessionId,
      exerciseId,
      setNumber: workSets.length,
      reps,
      weight,
      notes: s.notes,
      isWarmup: s.isWarmup,
      isPR,
      loggedAt: new Date(),
    });

    if (isPR) firePR();

    setSetInputs(prev => ({
      ...prev,
      [exerciseId]: prev[exerciseId].map((si, i) =>
        i === setIndex ? { ...si, confirmed: true, isPR, logId } : si
      ),
    }));
  }, [setInputs, sessionId, firePR]);

  const handleFinish = useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    const now = new Date();
    await db.workoutSessions.update(sessionId, {
      completedAt: now,
      durationSeconds: elapsed,
    });
    fireFinish();
    router.push(`/history/${sessionId}`);
  }, [sessionId, elapsed, fireFinish, router, finishing]);

  const currentExercise = liveExercises[currentIndex];
  const totalSets = Object.values(setInputs).flat().filter(s => s.confirmed && !s.isWarmup).length;

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Dumbbell className="w-8 h-8 text-emerald-500 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-xl border-b border-border px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <div className="flex-1 min-w-0">
            <p className="font-bold truncate">{session.name}</p>
            <p className="text-xs text-emerald-400 font-mono">{formatDuration(elapsed)} · {totalSets} série{totalSets !== 1 ? "s" : ""}</p>
          </div>
          <button
            onClick={() => setShowPicker(true)}
            className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center hover:bg-muted/70 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowFinish(true)}
            className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center hover:bg-emerald-500/30 transition-colors"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </button>
        </div>
      </div>

      {/* Exercise navigation tabs */}
      {liveExercises.length > 0 && (
        <div className="border-b border-border bg-background/60 backdrop-blur-sm">
          <div className="flex overflow-x-auto scrollbar-none px-2 gap-1 max-w-lg mx-auto py-2">
            {liveExercises.map((le, i) => {
              const exSets = setInputs[le.exercise.id] ?? [];
              const done = exSets.filter(s => s.confirmed && !s.isWarmup).length;
              const total = le.templateConfig?.sets ?? exSets.filter(s => !s.isWarmup).length;
              const complete = total > 0 && done >= total;

              return (
                <button
                  key={le.exercise.id}
                  onClick={() => setCurrentIndex(i)}
                  className={cn(
                    "flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap",
                    i === currentIndex
                      ? "bg-emerald-500 text-white"
                      : complete
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {complete && "✓ "}
                  {le.exercise.name.length > 14 ? le.exercise.name.slice(0, 14) + "…" : le.exercise.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 px-4 pt-6 pb-32 max-w-lg mx-auto w-full">
        {liveExercises.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <Dumbbell className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-lg">Séance vide</p>
              <p className="text-muted-foreground text-sm mt-1">Ajoute des exercices pour commencer</p>
            </div>
            <Button onClick={() => setShowPicker(true)}>
              <Plus className="w-4 h-4 mr-2" /> Ajouter un exercice
            </Button>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {currentExercise && (
                <ExerciseLogCard
                  exercise={currentExercise.exercise}
                  defaultSets={currentExercise.templateConfig?.sets ?? 3}
                  defaultRepsMin={currentExercise.templateConfig?.repsMin ?? 8}
                  defaultRepsMax={currentExercise.templateConfig?.repsMax ?? 12}
                  defaultRestSeconds={currentExercise.templateConfig?.restSeconds ?? settings?.defaultRestSeconds ?? 90}
                  lastSets={lastSets[currentExercise.exercise.id] ?? []}
                  sets={setInputs[currentExercise.exercise.id] ?? []}
                  onSetsChange={newSets => setSetInputs(prev => ({ ...prev, [currentExercise.exercise.id]: newSets }))}
                  onConfirmSet={i => handleConfirmSet(currentExercise.exercise.id, i)}
                  onStartRest={() => startRest(currentExercise.templateConfig?.restSeconds ?? settings?.defaultRestSeconds ?? 90)}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Prev / Next exercise nav */}
      {liveExercises.length > 1 && (
        <div className="fixed bottom-24 left-0 right-0 flex justify-between px-4 pointer-events-none z-30">
          <button
            onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            className="pointer-events-auto w-10 h-10 rounded-full bg-card border border-border shadow-lg flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setCurrentIndex(i => Math.min(liveExercises.length - 1, i + 1))}
            disabled={currentIndex === liveExercises.length - 1}
            className="pointer-events-auto w-10 h-10 rounded-full bg-card border border-border shadow-lg flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Rest timer */}
      <AnimatePresence>
        {restActive && (
          <RestTimer
            defaultSeconds={settings?.defaultRestSeconds ?? 90}
            onDismiss={dismissRest}
          />
        )}
      </AnimatePresence>

      {/* Exercise picker */}
      <ExercisePicker
        open={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={addExercise}
        excludeIds={liveExercises.map(e => e.exercise.id)}
      />

      {/* Finish dialog */}
      <Dialog open={showFinish} onOpenChange={setShowFinish}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Terminer la séance ?</DialogTitle>
            <DialogDescription>
              Durée : {formatDuration(elapsed)} · {totalSets} séries enregistrées
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-2">
            <Button onClick={handleFinish} disabled={finishing} className="w-full">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Valider la séance
            </Button>
            <Button variant="ghost" onClick={() => setShowFinish(false)} className="w-full">
              Continuer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function LiveWorkoutPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Dumbbell className="w-8 h-8 text-emerald-500 animate-pulse" />
      </div>
    }>
      <LiveWorkoutContent />
    </Suspense>
  );
}
