"use client";

import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        window.location.href = "/inbox";
      } else {
        setError("Incorrect password");
        setShaking(true);
        setPassword("");
        setTimeout(() => setShaking(false), 410);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @keyframes disha-shake {
          0%, 100% { transform: translateX(0); }
          15%       { transform: translateX(-6px); }
          30%       { transform: translateX(6px); }
          45%       { transform: translateX(-6px); }
          60%       { transform: translateX(6px); }
          75%       { transform: translateX(-4px); }
          90%       { transform: translateX(4px); }
        }
        .disha-shake {
          animation: disha-shake 400ms ease-in-out;
        }
      `}</style>
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--ground)",
          padding: "24px",
        }}
      >
        <div
          className={shaking ? "disha-shake" : undefined}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: "40px 32px",
            boxShadow: "var(--shadow-lg)",
            width: "100%",
            maxWidth: 360,
          }}
        >
          <h1
            className="h1"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Disha
          </h1>
          <p
            style={{
              color: "var(--text-2)",
              marginTop: 4,
              fontSize: 15,
            }}
          >
            Job search, handled.
          </p>

          <form
            onSubmit={handleSubmit}
            style={{
              marginTop: 28,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <input
              type="password"
              placeholder="Password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              style={
                error
                  ? {
                      borderColor: "var(--danger)",
                      boxShadow: "0 0 0 3px rgba(153,27,27,0.15)",
                    }
                  : undefined
              }
            />

            <button
              type="submit"
              className="btn"
              style={{ width: "100%", justifyContent: "center" }}
              disabled={loading}
            >
              {loading ? "Entering\u2026" : "Enter"}
            </button>

            {error && (
              <p
                style={{
                  color: "var(--danger)",
                  fontSize: 13,
                  marginTop: 4,
                }}
              >
                {error}
              </p>
            )}
          </form>
        </div>
      </div>
    </>
  );
}
