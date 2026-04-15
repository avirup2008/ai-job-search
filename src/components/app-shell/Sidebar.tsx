"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Today", glyph: "○" },
  { href: "/inbox", label: "Inbox", glyph: "◨" },
  { href: "/pipeline", label: "Pipeline", glyph: "▤" },
  { href: "/dashboard", label: "Dashboard", glyph: "◆" },
  { href: "/budget", label: "Budget", glyph: "€" },
  { href: "/profile", label: "Profile", glyph: "◉" },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sidebar" aria-label="Main navigation">
      <Link href="/" className="sidebar-brand" aria-label="Shortlist home">
        <span className="sidebar-brand-dot" aria-hidden="true" />
        <span className="sidebar-brand-name">Shortlist<span className="sidebar-brand-dot-end">.</span></span>
      </Link>
      <nav className="sidebar-nav">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || (pathname?.startsWith(item.href + "/") ?? false);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link${active ? " sidebar-link-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span className="sidebar-glyph" aria-hidden="true">{item.glyph}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-foot">
        <span className="meta">For Upashana</span>
      </div>
    </aside>
  );
}
