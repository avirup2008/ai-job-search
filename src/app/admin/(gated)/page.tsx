import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AdminHome() {
  return (
    <main>
      <h1>Admin</h1>
      <ul>
        <li><Link href="/admin/profile">Profile (Plan 1.6+)</Link></li>
        <li><Link href="/admin/jobs">Jobs (Plan 1.6+)</Link></li>
        <li><Link href="/admin/runs">Runs (Plan 1.6+)</Link></li>
      </ul>
    </main>
  );
}
