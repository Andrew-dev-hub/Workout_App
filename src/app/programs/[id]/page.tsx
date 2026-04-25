"use client";

import { use, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type WorkoutTemplate, type TemplateExercise } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { ArrowLeft, Plus, Grip, Trash2, ChevronDown, ChevronUp, Dumbbell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExercisePicker } from "@/components/exercises/exercise-picker";
import { MUSCLE_GROUP_LABELS, MUSCLE_GROUP_COLORS, cn } from "@/lib/utils";

const DAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export default function ProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [addingExerciseTo, setAddingExerciseTo] = useState<string | null>(null);

  const program = useLiveQuery(() => db.programs.get(id), [id]);
  const templates = useLiveQuery(
    () => db.workoutTemplates.where("programId").equals(id).sortBy("order"),
    [id]
  );

  if (!program) return null;

  return (
    <div className="min-h-screen px-4 py-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/programs">
          <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center hover:bg-muted/70 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </div>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: program.color }} />
            <h1 className="text-xl font-bold">{program.name}</h1>
          </div>
          {program.description && <p className="text-xs text-muted-foreground mt-0.5">{program.description}</p>}
        </div>
        <Button size="sm" onClick={() => setShowAddTemplate(true)}>
          <Plus className="w-4 h-4 mr-1" /> Ajouter
        </Button>
      </div>

      {templates?.length === 0 && (
        <div className="flex flex-col items-center py-16 gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <Dumbbell className="w-7 h-7 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">Aucune séance</p>
            <p className="text-sm text-muted-foreground mt-1">Ajoute des séances type (Push, Pull, Legs…)</p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {templates?.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            expanded={expandedTemplate === template.id}
            onToggle={() => setExpandedTemplate(t => t === template.id ? null : template.id)}
            onAddExercise={() => setAddingExerciseTo(template.id)}
          />
        ))}
      </div>

      {/* Add template dialog */}
      <AddTemplateDialog
        open={showAddTemplate}
        programId={id}
        nextOrder={templates?.length ?? 0}
        onClose={() => setShowAddTemplate(false)}
      />

      {/* Exercise picker */}
      <ExercisePicker
        open={!!addingExerciseTo}
        onClose={() => setAddingExerciseTo(null)}
        onSelect={async (exercise) => {
          if (!addingExerciseTo) return;
          const template = await db.workoutTemplates.get(addingExerciseTo);
          if (!template) return;
          const newEx: TemplateExercise = {
            exerciseId: exercise.id,
            sets: 3,
            repsMin: 8,
            repsMax: 12,
            restSeconds: 90,
            notes: "",
            order: template.exercises.length,
          };
          await db.workoutTemplates.update(addingExerciseTo, {
            exercises: [...template.exercises, newEx],
          });
        }}
      />
    </div>
  );
}

function TemplateCard({
  template,
  expanded,
  onToggle,
  onAddExercise,
}: {
  template: WorkoutTemplate;
  expanded: boolean;
  onToggle: () => void;
  onAddExercise: () => void;
}) {
  const exercises = useLiveQuery(
    () => db.exercises.bulkGet(template.exercises.map(e => e.exerciseId)),
    [template.exercises]
  );

  const handleRemoveExercise = async (exerciseId: string) => {
    await db.workoutTemplates.update(template.id, {
      exercises: template.exercises
        .filter(e => e.exerciseId !== exerciseId)
        .map((e, i) => ({ ...e, order: i })),
    });
  };

  const handleUpdateExercise = async (exerciseId: string, field: keyof TemplateExercise, value: number | string) => {
    await db.workoutTemplates.update(template.id, {
      exercises: template.exercises.map(e =>
        e.exerciseId === exerciseId ? { ...e, [field]: value } : e
      ),
    });
  };

  const handleDeleteTemplate = async () => {
    await db.workoutTemplates.delete(template.id);
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="font-semibold">{template.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {template.exercises.length} exercice{template.exercises.length !== 1 ? "s" : ""}
            {template.dayOfWeek !== null && ` · ${DAY_LABELS[template.dayOfWeek]}`}
          </p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-4 pb-4 pt-3 space-y-2">
              {template.exercises.map((te, i) => {
                const ex = exercises?.[i];
                if (!ex) return null;
                return (
                  <div key={te.exerciseId} className="flex items-center gap-2 py-2 border-b border-border/50 last:border-0">
                    <Grip className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ex.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border", MUSCLE_GROUP_COLORS[ex.muscleGroup])}>
                          {MUSCLE_GROUP_LABELS[ex.muscleGroup]}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <input
                            type="number"
                            value={te.sets}
                            onChange={e => handleUpdateExercise(te.exerciseId, "sets", parseInt(e.target.value) || 3)}
                            className="w-8 text-center bg-muted rounded px-1 py-0.5 text-xs"
                            min="1" max="10"
                          />
                          <span>séries ×</span>
                          <input
                            type="number"
                            value={te.repsMin}
                            onChange={e => handleUpdateExercise(te.exerciseId, "repsMin", parseInt(e.target.value) || 8)}
                            className="w-8 text-center bg-muted rounded px-1 py-0.5 text-xs"
                          />
                          <span>–</span>
                          <input
                            type="number"
                            value={te.repsMax}
                            onChange={e => handleUpdateExercise(te.exerciseId, "repsMax", parseInt(e.target.value) || 12)}
                            className="w-8 text-center bg-muted rounded px-1 py-0.5 text-xs"
                          />
                          <span>reps</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveExercise(te.exerciseId)}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}

              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={onAddExercise} className="flex-1 border-dashed text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Exercice
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDeleteTemplate} className="text-destructive hover:text-destructive text-xs px-2">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AddTemplateDialog({ open, programId, nextOrder, onClose }: {
  open: boolean;
  programId: string;
  nextOrder: number;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [day, setDay] = useState<number | null>(null);

  const handleSave = async () => {
    if (!name.trim()) return;
    await db.workoutTemplates.add({
      id: uuidv4(),
      programId,
      name: name.trim(),
      dayOfWeek: day,
      order: nextOrder,
      exercises: [],
    });
    setName(""); setDay(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nouvelle séance type</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Nom</label>
            <Input placeholder="Push A, Pull, Legs…" value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Jour (optionnel)</label>
            <div className="flex gap-1.5 flex-wrap">
              {DAY_LABELS.map((label, i) => (
                <button
                  key={i}
                  onClick={() => setDay(d => d === i ? null : i)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                    day === i ? "bg-emerald-500 text-white border-emerald-500" : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={handleSave} disabled={!name.trim()} className="w-full">Créer</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
