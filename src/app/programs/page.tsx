"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Program } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { Plus, ChevronRight, Dumbbell, Pencil, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PROGRAM_COLORS } from "@/lib/utils";

export default function ProgramsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);

  const programs = useLiveQuery(
    () => db.programs.toArray().then(arr => arr.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))),
    []
  );

  return (
    <div className="min-h-screen px-4 py-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Programmes</h1>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1" /> Nouveau
        </Button>
      </div>

      {programs?.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
            <Dumbbell className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">Aucun programme</p>
            <p className="text-sm text-muted-foreground mt-1">Crée ton premier programme d'entraînement</p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1" /> Créer un programme
          </Button>
        </div>
      )}

      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {programs?.map((program) => (
            <motion.div
              key={program.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  {/* Color dot */}
                  <div className="w-10 h-10 rounded-xl flex-shrink-0" style={{ backgroundColor: program.color + "33", border: `2px solid ${program.color}55` }}>
                    <div className="w-full h-full rounded-xl flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: program.color }} />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold truncate">{program.name}</p>
                      {program.isActive && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex-shrink-0">Actif</span>
                      )}
                    </div>
                    {program.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{program.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setEditingProgram(program)}
                      className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <Link href={`/programs/${program.id}`}>
                      <div className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <ProgramDialog
        open={showCreate || !!editingProgram}
        program={editingProgram}
        onClose={() => { setShowCreate(false); setEditingProgram(null); }}
      />
    </div>
  );
}

function ProgramDialog({ open, program, onClose }: { open: boolean; program: Program | null; onClose: () => void }) {
  const [name, setName] = useState(program?.name ?? "");
  const [description, setDescription] = useState(program?.description ?? "");
  const [color, setColor] = useState(program?.color ?? PROGRAM_COLORS[0]);

  // Sync when program changes
  useState(() => {
    setName(program?.name ?? "");
    setDescription(program?.description ?? "");
    setColor(program?.color ?? PROGRAM_COLORS[0]);
  });

  const handleSave = async () => {
    if (!name.trim()) return;
    if (program) {
      await db.programs.update(program.id, { name: name.trim(), description: description.trim(), color });
    } else {
      await db.programs.add({
        id: uuidv4(),
        name: name.trim(),
        description: description.trim(),
        color,
        isActive: false,
        createdAt: new Date(),
      });
    }
    onClose();
    setName(""); setDescription(""); setColor(PROGRAM_COLORS[0]);
  };

  const handleDelete = async () => {
    if (!program) return;
    await db.workoutTemplates.where("programId").equals(program.id).delete();
    await db.programs.delete(program.id);
    onClose();
  };

  const handleSetActive = async () => {
    if (!program) return;
    await db.programs.where("isActive").equals(1).modify({ isActive: false });
    await db.programs.update(program.id, { isActive: true });
    await db.settings.update(1, { activeProgramId: program.id });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{program ? "Modifier le programme" : "Nouveau programme"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Nom</label>
            <Input
              placeholder="PPL, Full Body, Force…"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Description</label>
            <Textarea
              placeholder="Optionnel…"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="h-16"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Couleur</label>
            <div className="flex gap-2 flex-wrap">
              {PROGRAM_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-8 h-8 rounded-full transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    outline: color === c ? `3px solid ${c}` : "none",
                    outlineOffset: color === c ? "3px" : "0",
                  }}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={handleSave} disabled={!name.trim()}>
              {program ? "Enregistrer" : "Créer"}
            </Button>
            {program && !program.isActive && (
              <Button variant="neon" onClick={handleSetActive}>
                Définir comme actif
              </Button>
            )}
            {program && (
              <Button variant="ghost" onClick={handleDelete} className="text-destructive hover:text-destructive">
                <Trash2 className="w-4 h-4 mr-1" /> Supprimer le programme
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
