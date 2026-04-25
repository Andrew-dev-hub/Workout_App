"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Copy, Plus, Trash2, Star } from "lucide-react";
import { type Exercise, type SetLog } from "@/lib/db";
import { MUSCLE_GROUP_LABELS, MUSCLE_GROUP_COLORS, cn, formatWeight } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface SetInput {
  id: string;          // local temp id
  reps: string;
  weight: string;
  notes: string;
  isWarmup: boolean;
  confirmed: boolean;
  isPR: boolean;
  logId?: string;      // DB id once saved
}

interface ExerciseLogCardProps {
  exercise: Exercise;
  defaultSets: number;
  defaultRepsMin: number;
  defaultRepsMax: number;
  defaultRestSeconds: number;
  lastSets: SetLog[];
  sets: SetInput[];
  onSetsChange: (sets: SetInput[]) => void;
  onConfirmSet: (setIndex: number) => Promise<void>;
  onStartRest: () => void;
}

export function ExerciseLogCard({
  exercise,
  defaultSets,
  defaultRepsMin,
  defaultRepsMax,
  lastSets,
  sets,
  onSetsChange,
  onConfirmSet,
  onStartRest,
}: ExerciseLogCardProps) {

  const updateSet = useCallback((index: number, field: keyof SetInput, value: string | boolean) => {
    onSetsChange(sets.map((s, i) => i === index ? { ...s, [field]: value } : s));
  }, [sets, onSetsChange]);

  const addSet = useCallback(() => {
    const last = sets.filter(s => !s.isWarmup).at(-1);
    onSetsChange([...sets, {
      id: crypto.randomUUID(),
      reps: last?.reps ?? defaultRepsMin.toString(),
      weight: last?.weight ?? "",
      notes: "",
      isWarmup: false,
      confirmed: false,
      isPR: false,
    }]);
  }, [sets, onSetsChange, defaultRepsMin]);

  const removeSet = useCallback((index: number) => {
    if (sets[index].confirmed) return;
    onSetsChange(sets.filter((_, i) => i !== index));
  }, [sets, onSetsChange]);

  const copyLastSession = useCallback(() => {
    if (lastSets.length === 0) return;
    const workSets = lastSets.filter(s => !s.isWarmup);
    onSetsChange(workSets.map(s => ({
      id: crypto.randomUUID(),
      reps: s.reps.toString(),
      weight: s.weight.toString(),
      notes: s.notes,
      isWarmup: false,
      confirmed: false,
      isPR: false,
    })));
  }, [lastSets, onSetsChange]);

  const handleConfirm = useCallback(async (index: number) => {
    await onConfirmSet(index);
    onStartRest();
  }, [onConfirmSet, onStartRest]);

  const workSets = sets.filter(s => !s.isWarmup);
  const confirmedCount = workSets.filter(s => s.confirmed).length;
  const progress = defaultSets > 0 ? confirmedCount / defaultSets : 0;

  return (
    <div className="space-y-4">
      {/* Exercise header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold leading-tight">{exercise.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn("text-xs px-2 py-0.5 rounded-full border", MUSCLE_GROUP_COLORS[exercise.muscleGroup])}>
              {MUSCLE_GROUP_LABELS[exercise.muscleGroup]}
            </span>
            <span className="text-xs text-muted-foreground">{exercise.equipment}</span>
          </div>
        </div>

        {/* Progress ring */}
        <div className="relative w-12 h-12 flex-shrink-0">
          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted" />
            <circle
              cx="24" cy="24" r="20" fill="none"
              stroke="currentColor" strokeWidth="3"
              strokeDasharray={2 * Math.PI * 20}
              strokeDashoffset={2 * Math.PI * 20 * (1 - Math.min(progress, 1))}
              strokeLinecap="round"
              className="text-emerald-500 transition-all duration-500"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
            {confirmedCount}/{defaultSets}
          </span>
        </div>
      </div>

      {/* Last session ghost */}
      {lastSets.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-muted/40 rounded-xl px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/60">Dernière fois : </span>
            {lastSets.filter(s => !s.isWarmup).map((s, i) => (
              <span key={i}>{i > 0 && " · "}{s.reps}×{formatWeight(s.weight)}kg</span>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={copyLastSession}
            className="text-emerald-400 hover:text-emerald-300 flex-shrink-0 h-8 px-2"
          >
            <Copy className="w-3.5 h-3.5 mr-1" />
            Copier
          </Button>
        </div>
      )}

      {/* Column headers */}
      <div className="grid grid-cols-[28px_1fr_80px_80px_36px] gap-1.5 px-1">
        <span className="text-xs text-muted-foreground text-center">#</span>
        <span className="text-xs text-muted-foreground">Note machine</span>
        <span className="text-xs text-muted-foreground text-center">Reps</span>
        <span className="text-xs text-muted-foreground text-center">Kg</span>
        <span></span>
      </div>

      {/* Sets */}
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {sets.map((set, index) => {
            const prevSet = lastSets[index];
            const workIndex = sets.slice(0, index + 1).filter(s => !s.isWarmup).length;

            return (
              <motion.div
                key={set.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className={cn(
                  "grid grid-cols-[28px_1fr_80px_80px_36px] gap-1.5 items-center rounded-xl px-2 py-1.5 transition-colors",
                  set.confirmed ? "bg-emerald-500/10" : set.isWarmup ? "bg-muted/30" : "bg-muted/20",
                  set.isPR && "ring-1 ring-amber-500/50"
                )}>
                  {/* Set number */}
                  <div className="flex items-center justify-center">
                    {set.isWarmup ? (
                      <span className="text-[10px] text-muted-foreground font-medium">W</span>
                    ) : (
                      <span className={cn("text-sm font-bold", set.confirmed ? "text-emerald-400" : "text-muted-foreground")}>
                        {workIndex}
                      </span>
                    )}
                  </div>

                  {/* Notes */}
                  <input
                    type="text"
                    value={set.notes}
                    onChange={e => updateSet(index, "notes", e.target.value)}
                    placeholder={prevSet?.notes || "Réglage…"}
                    disabled={set.confirmed}
                    className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 outline-none w-full disabled:opacity-60"
                  />

                  {/* Reps */}
                  <input
                    type="number"
                    value={set.reps}
                    onChange={e => updateSet(index, "reps", e.target.value)}
                    placeholder={prevSet ? prevSet.reps.toString() : "Reps"}
                    disabled={set.confirmed}
                    className="bg-input text-sm text-center font-semibold rounded-lg h-9 outline-none focus:ring-2 focus:ring-emerald-500 w-full disabled:opacity-60"
                  />

                  {/* Weight */}
                  <input
                    type="number"
                    value={set.weight}
                    onChange={e => updateSet(index, "weight", e.target.value)}
                    placeholder={prevSet ? formatWeight(prevSet.weight) : "kg"}
                    disabled={set.confirmed}
                    step="0.5"
                    className="bg-input text-sm text-center font-semibold rounded-lg h-9 outline-none focus:ring-2 focus:ring-emerald-500 w-full disabled:opacity-60"
                  />

                  {/* Action button */}
                  {set.confirmed ? (
                    <div className="flex items-center justify-center">
                      {set.isPR ? (
                        <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      ) : (
                        <Check className="w-4 h-4 text-emerald-500" />
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleConfirm(index)}
                      disabled={!set.reps || !set.weight}
                      className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* PR badge */}
                {set.isPR && set.confirmed && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="mt-1 ml-2"
                  >
                    <span className="text-[10px] text-amber-400 font-bold">🏆 RECORD PERSONNEL !</span>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Add set / remove last */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={addSet} className="flex-1 border-dashed">
          <Plus className="w-4 h-4 mr-1" /> Ajouter une série
        </Button>
        {sets.length > 0 && !sets.at(-1)?.confirmed && (
          <Button variant="ghost" size="sm" onClick={() => removeSet(sets.length - 1)} className="text-destructive hover:text-destructive px-2">
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Instructions */}
      {exercise.instructions && (
        <details className="group">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors list-none flex items-center gap-1">
            <span>ℹ</span> Technique
          </summary>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed pl-4 border-l border-border">
            {exercise.instructions}
          </p>
        </details>
      )}
    </div>
  );
}
