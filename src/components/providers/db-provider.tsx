"use client";

import { useEffect, useState } from "react";
import { Dumbbell, RefreshCw } from "lucide-react";
import { db } from "@/lib/db";
import { buildSeedExercises } from "@/lib/seed-exercises";

export function DBProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    // Show error (not reload) after 6s — handles IndexedDB "blocked" state
    const timer = setTimeout(() => {
      if (!cancelled) {
        cancelled = true;
        setErrorMsg("La base de données ne répond pas. Cliquez sur Réinitialiser.");
        setStatus("error");
      }
    }, 6000);

    // Handle blocked event (another tab has the DB open)
    db.on("blocked", () => {
      if (!cancelled) {
        cancelled = true;
        clearTimeout(timer);
        setErrorMsg("Base de données bloquée par un autre onglet. Fermez les autres onglets et cliquez sur Réinitialiser.");
        setStatus("error");
      }
    });

    const run = async () => {
      try {
        const count = await db.exercises.count();
        if (count === 0) {
          await db.exercises.bulkPut(buildSeedExercises());
        }

        const settings = await db.settings.get(1);
        if (!settings) {
          await db.settings.put({
            id: 1, theme: "dark", defaultRestSeconds: 90,
            activeProgramId: null, onboardingDone: false,
          });
        }

        if (!cancelled) setStatus("ready");
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[DBProvider] bootstrap error:", msg);
          setErrorMsg(msg);
          setStatus("error");
        }
      } finally {
        clearTimeout(timer);
      }
    };

    run();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const handleReset = async () => {
    try { db.close(); } catch {}
    const g = globalThis as Record<string, unknown>;
    delete g.__workoutDB;
    delete g.__dbInitialized;

    await new Promise<void>((res) => {
      const req = indexedDB.deleteDatabase("WorkoutDB");
      req.onsuccess = req.onerror = () => res();
      setTimeout(res, 1500);
    });
    window.location.reload();
  };

  if (status === "error") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-6 text-center">
        <p className="text-destructive font-medium">Erreur base de données</p>
        <p className="text-sm text-muted-foreground max-w-xs">{errorMsg}</p>
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-sm hover:bg-emerald-500/20"
        >
          <RefreshCw className="w-4 h-4" /> Réinitialiser
        </button>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Dumbbell className="w-10 h-10 text-emerald-500 animate-pulse" />
        <p className="text-muted-foreground text-sm">Chargement…</p>
      </div>
    );
  }

  return <>{children}</>;
}
