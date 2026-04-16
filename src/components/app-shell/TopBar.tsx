"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Today" },
  { href: "/inbox", label: "Inbox" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/dashboard", label: "Analytics" },
  { href: "/profile", label: "Profile" },
] as const;

export function TopBar() {
  const pathname = usePathname();
  return (
    <header className="topbar">
      <Link href="/" className="topbar-brand" aria-label="Disha home">
        <span className="topbar-dot" aria-hidden="true" />
        <span className="topbar-name">
          Disha<span className="topbar-name-dot">.</span>
        </span>
      </Link>
      <nav className="topbar-nav">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || (pathname?.startsWith(item.href + "/") ?? false);
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
      <button className="topbar-paste" disabled title="Coming soon — paste a LinkedIn URL or JD to score it">+ Paste a role</button>
    </header>
  );
}
