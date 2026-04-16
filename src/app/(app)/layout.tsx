import type { ReactNode } from "react";
import { TopBar } from "@/components/app-shell/TopBar";
import "@/components/app-shell/shell.css";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <TopBar />
      <main className="app-main">{children}</main>
    </div>
  );
}
