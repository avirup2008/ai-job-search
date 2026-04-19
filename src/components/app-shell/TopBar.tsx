"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PasteRolePanel } from "@/components/paste-role/PasteRolePanel";

const NAV = [
  { href: "/inbox", label: "Inbox" },
  { href: "/gap-coach", label: "Gap Coach" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/analytics", label: "Analytics" },
  { href: "/profile", label: "Profile" },
  { href: "/admin", label: "Admin" },
] as const;

export function TopBar() {
  const pathname = usePathname();
  const [pasteOpen, setPasteOpen] = useState(false);

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }
  return (
    <header className="topbar">
      <Link href="/" className="topbar-brand" aria-label="Disha home">
        <span className="topbar-dot" aria-hidden="true" />
        <span className="topbar-name">
          Disha<span className="topbar-name-dot">.</span>
        </span>
      </Link>
      <div className="topbar-center">
        <nav className="topbar-nav">
          {NAV.map((item) => {
            const active =
              pathname === item.href || (pathname?.startsWith(item.href + "/") ?? false);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`topbar-link${active ? " topbar-link-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button className="topbar-paste" onClick={() => setPasteOpen(true)}>
          + Paste a role
        </button>
      </div>
      <button
        className="btn-ghost"
        onClick={handleSignOut}
        style={{ fontSize: 13, padding: "6px 12px" }}
      >
        Sign out
      </button>
      <PasteRolePanel open={pasteOpen} onClose={() => setPasteOpen(false)} />
    </header>
  );
}
