import { db } from "./db";
import { buildSeedExercises } from "./seed-exercises";

// Persiste à travers les rechargements HMR
const _g = globalThis as typeof globalThis & { __dbInitialized?: boolean };

export async function initDB(): Promise<void> {
  if (_g.__dbInitialized) return;
  _g.__dbInitialized = true;

  const exerciseCount = await db.exercises.count();
  if (exerciseCount === 0) {
    await db.exercises.bulkPut(buildSeedExercises());
  }

  const settings = await db.settings.get(1);
  if (!settings) {
    await db.settings.put({
      id: 1,
      theme: "dark",
      defaultRestSeconds: 90,
      activeProgramId: null,
      onboardingDone: false,
    });
  }
}
