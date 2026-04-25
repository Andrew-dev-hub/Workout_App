"use client";

import { useState } from "react";
import { v4 as uuid } from "uuid";
import { db, type MuscleGroup, type Equipment } from "@/lib/db";
import { MUSCLE_GROUP_LABELS, cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const MUSCLE_OPTIONS: MuscleGroup[] = [
  "chest", "back", "shoulders", "legs", "arms", "core", "cardio", "full_body",
];

const EQUIPMENT_OPTIONS: { value: Equipment; label: string }[] = [
  { value: "barbell",        label: "Barre" },
  { value: "dumbbell",       label: "Haltères" },
  { value: "machine",        label: "Machine" },
  { value: "cable",          label: "Poulie" },
  { value: "bodyweight",     label: "Poids de corps" },
  { value: "kettlebell",     label: "Kettlebell" },
  { value: "resistance_band",label: "Élastique" },
  { value: "other",          label: "Autre" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
}

export function CreateExerciseDialog({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>("chest");
  const [equipment, setEquipment] = useState<Equipment>("barbell");
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setName("");
    setMuscleGroup("chest");
    setEquipment("barbell");
    setInstructions("");
    setError("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = async () => {
    if (!name.trim()) { setError("Le nom est requis."); return; }
    setSaving(true);
    try {
      const id = uuid();
      await db.exercises.add({
        id,
        name: name.trim(),
        muscleGroup,
        secondaryMuscles: [],
        equipment,
        instructions: instructions.trim(),
        imageBlob: null,
        isCustom: true,
        createdAt: new Date(),
      });
      reset();
      onCreated?.(id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md w-[95vw] p-0">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle>Nouvel exercice</DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-5 space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label>Nom *</Label>
            <Input
              placeholder="ex: Curl marteau incliné"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(""); }}
              autoFocus
            />
          </div>

          {/* Muscle group */}
          <div className="space-y-1.5">
            <Label>Groupe musculaire *</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {MUSCLE_OPTIONS.map((mg) => (
                <button
                  key={mg}
                  type="button"
                  onClick={() => setMuscleGroup(mg)}
                  className={cn(
                    "py-1.5 rounded-lg text-xs font-medium border transition-colors",
                    muscleGroup === mg
                      ? "bg-emerald-500 text-white border-emerald-500"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                  )}
                >
                  {MUSCLE_GROUP_LABELS[mg]}
                </button>
              ))}
            </div>
          </div>

          {/* Equipment */}
          <div className="space-y-1.5">
            <Label>Équipement *</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {EQUIPMENT_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setEquipment(value)}
                  className={cn(
                    "py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors text-left",
                    equipment === value
                      ? "bg-emerald-500 text-white border-emerald-500"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-1.5">
            <Label>Instructions <span className="text-muted-foreground font-normal">(optionnel)</span></Label>
            <Textarea
              placeholder="Description du mouvement…"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {error && <p className="text-destructive text-xs">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white">
              {saving ? "Création…" : "Créer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
