"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Exercise, type MuscleGroup } from "@/lib/db";
import { MUSCLE_GROUP_LABELS, MUSCLE_GROUP_COLORS, cn } from "@/lib/utils";
import { Search, X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CreateExerciseDialog } from "@/components/exercises/create-exercise-dialog";

const MUSCLE_FILTERS: { value: MuscleGroup | "all"; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "chest", label: "Pecs" },
  { value: "back", label: "Dos" },
  { value: "shoulders", label: "Épaules" },
  { value: "legs", label: "Jambes" },
  { value: "arms", label: "Bras" },
  { value: "core", label: "Abdos" },
  { value: "full_body", label: "Full Body" },
];

interface ExercisePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
  excludeIds?: string[];
}

export function ExercisePicker({ open, onClose, onSelect, excludeIds = [] }: ExercisePickerProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<MuscleGroup | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);

  const exercises = useLiveQuery(async () => {
    const all = await db.exercises.toArray();
    return all
      .filter((e) => {
        const matchSearch = e.name.toLowerCase().includes(search.toLowerCase());
        const matchFilter = filter === "all" || e.muscleGroup === filter;
        const notExcluded = !excludeIds.includes(e.id);
        return matchSearch && matchFilter && notExcluded;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [search, filter, excludeIds.join(",")]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md w-[95vw] max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle>Choisir un exercice</DialogTitle>
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> Créer
            </button>
          </div>
        </DialogHeader>

        <div className="px-4 pb-2 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Muscle group filter pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {MUSCLE_FILTERS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={cn(
                  "flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                  filter === value
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1 overflow-auto">
          <div className="px-2 pb-4 space-y-0.5">
            {exercises?.map((exercise) => (
              <button
                key={exercise.id}
                onClick={() => { onSelect(exercise); onClose(); }}
                className="w-full text-left px-3 py-3 rounded-xl hover:bg-muted/60 transition-colors flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{exercise.name}</p>
                  <p className="text-xs text-muted-foreground">{exercise.equipment}</p>
                </div>
                <span className={cn("text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0", MUSCLE_GROUP_COLORS[exercise.muscleGroup])}>
                  {MUSCLE_GROUP_LABELS[exercise.muscleGroup]}
                </span>
              </button>
            ))}
            {exercises?.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-8">Aucun exercice trouvé</p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>

      <CreateExerciseDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </Dialog>
  );
}
