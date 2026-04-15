import type { ReactNode } from "react";
import { Sidebar } from "@/components/app-shell/Sidebar";
import "@/components/app-shell/shell.css";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">{children}</main>
    </div>
  );
}
