"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type MuscleGroup } from "@/lib/db";
import { MUSCLE_GROUP_LABELS, MUSCLE_GROUP_COLORS, cn } from "@/lib/utils";
import { Plus, Search, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CreateExerciseDialog } from "@/components/exercises/create-exercise-dialog";
import { motion, AnimatePresence } from "framer-motion";

const MUSCLE_FILTERS: { value: MuscleGroup | "all"; label: string }[] = [
  { value: "all",        label: "Tous" },
  { value: "chest",      label: "Pecs" },
  { value: "back",       label: "Dos" },
  { value: "shoulders",  label: "Épaules" },
  { value: "legs",       label: "Jambes" },
  { value: "arms",       label: "Bras" },
  { value: "core",       label: "Abdos" },
  { value: "full_body",  label: "Full Body" },
];

const EQUIPMENT_LABELS: Record<string, string> = {
  barbell:         "Barre",
  dumbbell:        "Haltères",
  machine:         "Machine",
  cable:           "Poulie",
  bodyweight:      "Poids de corps",
  kettlebell:      "Kettlebell",
  resistance_band: "Élastique",
  other:           "Autre",
};

export default function ExercisesPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<MuscleGroup | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const exercises = useLiveQuery(async () => {
    const all = await db.exercises.toArray();
    return all
      .filter((e) => {
        const matchSearch = e.name.toLowerCase().includes(search.toLowerCase());
        const matchFilter = filter === "all" || e.muscleGroup === filter;
        return matchSearch && matchFilter;
      })
      .sort((a, b) => {
        // Custom exercises first, then alphabetical
        if (a.isCustom !== b.isCustom) return a.isCustom ? -1 : 1;
        return a.name.localeCompare(b.name, "fr");
      });
  }, [search, filter]);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await db.exercises.delete(id);
    } finally {
      setDeleting(null);
    }
  };

  const customCount = exercises?.filter((e) => e.isCustom).length ?? 0;
  const totalCount = exercises?.length ?? 0;

  return (
    <div className="min-h-screen px-4 py-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Exercices</h1>
          <p className="text-muted-foreground text-sm">
            {totalCount} exercice{totalCount > 1 ? "s" : ""}
            {customCount > 0 && ` · ${customCount} personnalisé${customCount > 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-400 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Créer
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un exercice…"
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

      {/* Muscle filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-none">
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

      {/* Exercise list */}
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {exercises?.map((exercise) => (
            <motion.div
              key={exercise.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card rounded-2xl border border-border px-4 py-3 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-medium text-sm truncate">{exercise.name}</p>
                  {exercise.isCustom && (
                    <span className="flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                      Perso
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full border", MUSCLE_GROUP_COLORS[exercise.muscleGroup])}>
                    {MUSCLE_GROUP_LABELS[exercise.muscleGroup]}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {EQUIPMENT_LABELS[exercise.equipment] ?? exercise.equipment}
                  </span>
                </div>
              </div>

              {exercise.isCustom && (
                <button
                  onClick={() => handleDelete(exercise.id)}
                  disabled={deleting === exercise.id}
                  className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
                  aria-label="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {exercises?.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Aucun exercice trouvé
          </div>
        )}
      </div>

      <CreateExerciseDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}
