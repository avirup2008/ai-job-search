"use client";
import { useState } from "react";

export default function Login() {
  const [secret, setSecret] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      style={{ padding: 24, maxWidth: 360 }}
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ secret }),
        });
        if (r.ok) window.location.href = "/admin";
        else setErr("Invalid secret");
      }}
    >
      <h1>Admin</h1>
      <input
        type="password"
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        placeholder="ADMIN_SECRET"
        style={{ width: "100%" }}
      />
      <button type="submit" style={{ marginTop: 12 }}>Login</button>
      {err && <p style={{ color: "crimson" }}>{err}</p>}
    </form>
  );
}
