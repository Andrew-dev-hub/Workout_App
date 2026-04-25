import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { MuscleGroup } from "./db";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest:      "Pectoraux",
  back:       "Dos",
  shoulders:  "Épaules",
  legs:       "Jambes",
  arms:       "Bras",
  core:       "Abdominaux",
  cardio:     "Cardio",
  full_body:  "Corps entier",
};

export const MUSCLE_GROUP_COLORS: Record<MuscleGroup, string> = {
  chest:      "bg-rose-500/20 text-rose-400 border-rose-500/30",
  back:       "bg-blue-500/20 text-blue-400 border-blue-500/30",
  shoulders:  "bg-amber-500/20 text-amber-400 border-amber-500/30",
  legs:       "bg-violet-500/20 text-violet-400 border-violet-500/30",
  arms:       "bg-orange-500/20 text-orange-400 border-orange-500/30",
  core:       "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  cardio:     "bg-pink-500/20 text-pink-400 border-pink-500/30",
  full_body:  "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

export const PROGRAM_COLORS = [
  "#10b981", // emerald
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#f59e0b", // amber
  "#ef4444", // red
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#f97316", // orange
];

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h${m.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatWeight(kg: number): string {
  return kg % 1 === 0 ? `${kg}` : `${kg.toFixed(1)}`;
}
