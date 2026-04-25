"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Dumbbell, BarChart2, BookOpen, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const NAV_ITEMS = [
  { href: "/",           icon: Home,       label: "Accueil"   },
  { href: "/programs",   icon: BookOpen,   label: "Programmes"},
  { href: "/workout",    icon: Dumbbell,   label: "Séance"    },
  { href: "/history",    icon: BarChart2,  label: "Stats"     },
  { href: "/exercises",  icon: ListChecks, label: "Exercices" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border pb-safe">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 flex-1 py-2 px-1 rounded-xl transition-colors relative",
                active ? "text-emerald-400" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {active && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute inset-0 bg-emerald-500/10 rounded-xl"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <Icon className="w-5 h-5 relative z-10" />
              <span className="text-[10px] font-medium relative z-10 leading-none">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
