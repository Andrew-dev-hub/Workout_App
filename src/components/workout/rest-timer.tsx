"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, SkipForward, Plus } from "lucide-react";
import { formatDuration } from "@/lib/utils";

const REST_STORAGE_KEY = "workout_rest_end";

interface RestTimerProps {
  defaultSeconds: number;
  onDismiss: () => void;
}

export function RestTimer({ defaultSeconds, onDismiss }: RestTimerProps) {
  const [endsAt, setEndsAt] = useState<number>(() => {
    // Restore from localStorage if a timer was running
    const stored = localStorage.getItem(REST_STORAGE_KEY);
    if (stored) {
      const val = parseInt(stored);
      if (val > Date.now()) return val;
    }
    const newEnd = Date.now() + defaultSeconds * 1000;
    localStorage.setItem(REST_STORAGE_KEY, newEnd.toString());
    return newEnd;
  });

  const [remaining, setRemaining] = useState(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));

  useEffect(() => {
    const tick = () => {
      const r = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemaining(r);
      if (r <= 0) {
        localStorage.removeItem(REST_STORAGE_KEY);
        onDismiss();
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [endsAt, onDismiss]);

  const addTime = useCallback((secs: number) => {
    const newEnd = endsAt + secs * 1000;
    localStorage.setItem(REST_STORAGE_KEY, newEnd.toString());
    setEndsAt(newEnd);
  }, [endsAt]);

  const dismiss = useCallback(() => {
    localStorage.removeItem(REST_STORAGE_KEY);
    onDismiss();
  }, [onDismiss]);

  const progress = remaining / defaultSeconds;
  const circumference = 2 * Math.PI * 36;

  return (
    <motion.div
      initial={{ opacity: 0, y: 60 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 60 }}
      className="fixed bottom-24 left-0 right-0 z-40 flex justify-center px-4"
    >
      <div className="bg-card border border-border rounded-2xl p-4 shadow-xl w-full max-w-sm">
        <div className="flex items-center gap-4">
          {/* Circular progress */}
          <div className="relative w-20 h-20 flex-shrink-0">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted" />
              <circle
                cx="40" cy="40" r="36" fill="none"
                stroke="currentColor" strokeWidth="4"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - Math.max(0, progress))}
                strokeLinecap="round"
                className="text-emerald-500 transition-all duration-500"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-lg font-bold font-mono">
              {formatDuration(remaining)}
            </span>
          </div>

          <div className="flex-1">
            <p className="text-sm text-muted-foreground mb-2">Temps de repos</p>
            <div className="flex gap-2">
              <button
                onClick={() => addTime(30)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-muted text-sm font-medium hover:bg-muted/80 transition-colors"
              >
                <Plus className="w-3 h-3" /> 30s
              </button>
              <button
                onClick={dismiss}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-colors"
              >
                <SkipForward className="w-3 h-3" /> Skip
              </button>
            </div>
          </div>

          <button onClick={dismiss} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export function useRestTimer() {
  const [active, setActive] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem(REST_STORAGE_KEY);
    return !!stored && parseInt(stored) > Date.now();
  });

  const start = useCallback((seconds: number) => {
    const end = Date.now() + seconds * 1000;
    localStorage.setItem(REST_STORAGE_KEY, end.toString());
    setActive(true);
  }, []);

  const dismiss = useCallback(() => {
    localStorage.removeItem(REST_STORAGE_KEY);
    setActive(false);
  }, []);

  return { active, start, dismiss };
}
