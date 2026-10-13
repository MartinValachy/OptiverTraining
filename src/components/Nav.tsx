"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "./AppProvider";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/today/", label: "Today" },
  { href: "/dashboard/", label: "Stats" },
  { href: "/plan/", label: "Plan" },
  { href: "/settings/", label: "Settings" },
];

export function Nav() {
  const path = usePathname();
  const { pending, online, session, supabaseEnabled } = useApp();
  // Hide chrome while an exam is running to stay distraction-free.
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <nav className="mx-auto flex max-w-3xl items-center gap-1 overflow-x-auto px-2 sm:px-4">
        <Link href="/" className="mr-1 flex min-h-11 items-center font-semibold tracking-tight">
          OA<span className="text-accent">·</span>Trainer
        </Link>
        <div className="ml-auto flex items-center">
          {LINKS.slice(1).map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`flex min-h-11 items-center rounded-md px-2 text-sm ${path === l.href ? "text-fg" : "text-muted"}`}
            >
              {l.label}
            </Link>
          ))}
          <span
            title={!online ? "Offline: results are queued locally" : pending ? `${pending} rows waiting to sync` : session ? "Synced" : "Local only"}
            className={`ml-1 inline-block h-2.5 w-2.5 rounded-full ${!online ? "bg-warn" : pending && session ? "bg-accent" : session || !supabaseEnabled ? "bg-good" : "bg-muted"}`}
            data-testid="sync-dot"
          />
        </div>
      </nav>
    </header>
  );
}
