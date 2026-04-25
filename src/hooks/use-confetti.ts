"use client";

import { useCallback } from "react";
import confetti from "canvas-confetti";

export function useConfetti() {
  const firePR = useCallback(() => {
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.55 },
      colors: ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b"],
      zIndex: 9999,
    });
  }, []);

  const fireFinish = useCallback(() => {
    const end = Date.now() + 1800;
    const frame = () => {
      confetti({ particleCount: 6, angle: 60, spread: 55, origin: { x: 0 }, colors: ["#10b981", "#3b82f6"] });
      confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1 }, colors: ["#8b5cf6", "#f59e0b"] });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, []);

  return { firePR, fireFinish };
}
