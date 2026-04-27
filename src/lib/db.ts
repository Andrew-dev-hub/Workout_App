import Dexie, { type EntityTable } from "dexie";

// ─── Types ───────────────────────────────────────────────────────────────────

export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "legs"
  | "arms"
  | "core"
  | "cardio"
  | "full_body";

export type Equipment =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "cable"
  | "bodyweight"
  | "kettlebell"
  | "resistance_band"
  | "other";

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  instructions: string;
  imageBlob: Blob | null;
  isCustom: boolean;
  createdAt: Date;
}

export interface TemplateExercise {
  exerciseId: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
  notes: string;
  order: number;
}

export interface WorkoutTemplate {
  id: string;
  programId: string;
  name: string;
  dayOfWeek: number | null; // 0=Mon … 6=Sun
  order: number;
  exercises: TemplateExercise[];
}

export interface Program {
  id: string;
  name: string;
  description: string;
  color: string; // hex accent
  isActive: boolean;
  createdAt: Date;
}

export interface WorkoutSession {
  id: string;
  templateId: string | null;
  programId: string | null;
  name: string;
  startedAt: Date;
  completedAt: Date | null;
  durationSeconds: number;
  notes: string;
  mood: number | null; // 1–5
}

export interface SetLog {
  id: string;
  sessionId: string;
  exerciseId: string;
  setNumber: number;
  reps: number;
  weight: number; // kg
  notes: string;
  isWarmup: boolean;
  isPR: boolean;
  loggedAt: Date;
}

export interface Settings {
  id: 1;
  theme: "dark";
  defaultRestSeconds: number;
  activeProgramId: string | null;
  onboardingDone: boolean;
}

// ─── Database ─────────────────────────────────────────────────────────────────

class WorkoutDB extends Dexie {
  exercises!: EntityTable<Exercise, "id">;
  programs!: EntityTable<Program, "id">;
  workoutTemplates!: EntityTable<WorkoutTemplate, "id">;
  workoutSessions!: EntityTable<WorkoutSession, "id">;
  setLogs!: EntityTable<SetLog, "id">;
  settings!: EntityTable<Settings, "id">;

  constructor() {
    super("WorkoutDB");

    this.version(1).stores({
      exercises:       "&id, muscleGroup, equipment, isCustom",
      programs:        "&id, isActive",
      workoutTemplates:"&id, programId",
      workoutSessions: "&id, templateId, programId, startedAt, completedAt",
      setLogs:         "&id, sessionId, exerciseId, loggedAt, isPR",
      settings:        "&id",
    });
  }
}

// Singleton persistant à travers les rechargements HMR de Turbopack
const _g = globalThis as typeof globalThis & { __workoutDB?: WorkoutDB };
if (!_g.__workoutDB) {
  _g.__workoutDB = new WorkoutDB();
}
export const db: WorkoutDB = _g.__workoutDB;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Calcule le volume total d'une session (kg × reps, séries de travail seulement) */
export function calcVolume(sets: SetLog[]): number {
  return sets
    .filter((s) => !s.isWarmup)
    .reduce((acc, s) => acc + s.weight * s.reps, 0);
}

/** Vérifie si un set est un PR pour cet exercice (poids max historique) */
export async function checkPR(
  exerciseId: string,
  weight: number,
  currentSessionId: string
): Promise<boolean> {
  if (weight <= 0) return false;

  // Un PR existait déjà dans une session précédente à ce poids ou plus
  const inPrevious = await db.setLogs
    .where("exerciseId")
    .equals(exerciseId)
    .filter((s) => s.sessionId !== currentSessionId && !s.isWarmup && s.weight >= weight)
    .count();
  if (inPrevious > 0) return false;

  // Ce poids a déjà été atteint dans la session courante → PR déjà comptabilisé
  const inCurrentSession = await db.setLogs
    .where("exerciseId")
    .equals(exerciseId)
    .filter((s) => s.sessionId === currentSessionId && !s.isWarmup && s.weight >= weight)
    .count();
  return inCurrentSession === 0;
}

/** Récupère les données de la dernière session pour un exercice donné */
export async function getLastSessionSets(
  exerciseId: string,
  currentSessionId: string
): Promise<SetLog[]> {
  // Trouve la session la plus récente contenant cet exercice
  const recentSets = await db.setLogs
    .where("exerciseId")
    .equals(exerciseId)
    .filter((s) => s.sessionId !== currentSessionId)
    .sortBy("loggedAt");

  if (recentSets.length === 0) return [];

  const lastSessionId = recentSets[recentSets.length - 1].sessionId;
  return recentSets.filter((s) => s.sessionId === lastSessionId);
}

/** Récupère ou crée les settings (singleton id=1) */
export async function getSettings(): Promise<Settings> {
  const existing = await db.settings.get(1);
  if (existing) return existing;

  const defaults: Settings = {
    id: 1,
    theme: "dark",
    defaultRestSeconds: 90,
    activeProgramId: null,
    onboardingDone: false,
  };
  await db.settings.put(defaults);
  return defaults;
}
