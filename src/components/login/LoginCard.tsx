"use client";
import { useState } from "react";

export function LoginCard() {
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
        setTimeout(() => setShaking(false), 420);
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @keyframes disha-shake {
          0%,100%{transform:translateX(0)}15%{transform:translateX(-7px)}
          30%{transform:translateX(7px)}45%{transform:translateX(-5px)}
          60%{transform:translateX(5px)}75%{transform:translateX(-3px)}
          90%{transform:translateX(3px)}
        }
        .login-card-shake { animation: disha-shake 420ms ease-in-out; }
        .login-card-wrap {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 28px 28px 24px;
          box-shadow: 0 4px 16px rgba(26,24,20,0.08);
          max-width: 420px;
        }
        .login-card-label {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--text-3);
          margin-bottom: 14px;
        }
        .login-card-row {
          display: flex;
          gap: 10px;
          align-items: center;
        }
        .login-card-input {
          flex: 1;
          padding: 10px 14px;
          font-family: var(--font-body);
          font-size: 14px;
          color: var(--text-1);
          background: var(--ground);
          border: 1px solid var(--border);
          border-radius: 8px;
          outline: none;
          transition: border-color 120ms, box-shadow 120ms;
        }
        .login-card-input::placeholder { color: var(--text-3); }
        .login-card-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-dim); }
        .login-card-input.err { border-color: var(--danger); box-shadow: 0 0 0 3px rgba(153,27,27,0.12); }
        .login-card-btn {
          padding: 10px 20px;
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 600;
          color: #fff;
          background: var(--accent);
          border: none;
          border-radius: 8px;
          cursor: pointer;
          white-space: nowrap;
          transition: background 120ms, transform 120ms;
        }
        .login-card-btn:hover:not(:disabled) { background: var(--accent-h); transform: translateY(-1px); }
        .login-card-btn:disabled { background: var(--border); color: var(--text-3); cursor: not-allowed; }
        .login-card-error {
          margin-top: 10px;
          font-size: 12px;
          color: var(--danger);
          min-height: 16px;
        }
      `}</style>
      <div className={`login-card-wrap${shaking ? " login-card-shake" : ""}`}>
        <p className="login-card-label">Enter your password to continue</p>
        <form onSubmit={handleSubmit}>
          <div className="login-card-row">
            <input
              type="password"
              placeholder="Password"
              className={`login-card-input${error ? " err" : ""}`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              autoComplete="current-password"
            />
            <button type="submit" className="login-card-btn" disabled={loading}>
              {loading ? "…" : "Enter →"}
            </button>
          </div>
          <p className="login-card-error">{error ?? ""}</p>
        </form>
      </div>
    </>
  );
}
