import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth/admin";
import type { ReactNode } from "react";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (!(await isAdmin())) redirect("/admin/login");
  return <div style={{ padding: 24 }}>{children}</div>;
}
