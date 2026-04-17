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
        setTimeout(() => setShaking(false), 420);
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
          0%,100% { transform: translateX(0); }
          15%      { transform: translateX(-7px); }
          30%      { transform: translateX(7px); }
          45%      { transform: translateX(-5px); }
          60%      { transform: translateX(5px); }
          75%      { transform: translateX(-3px); }
          90%      { transform: translateX(3px); }
        }
        .disha-shake { animation: disha-shake 420ms ease-in-out; }

        .login-wrap {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: var(--ground);
          padding: 24px;
        }

        .login-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 48px 40px 40px;
          box-shadow: 0 2px 4px rgba(26,24,20,0.04), 0 8px 24px rgba(26,24,20,0.08);
          width: 100%;
          max-width: 380px;
        }

        .login-eyebrow {
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          color: var(--accent);
          margin-bottom: 10px;
        }

        .login-title {
          font-family: var(--font-display);
          font-weight: 300;
          font-size: 48px;
          line-height: 1.0;
          letter-spacing: -0.03em;
          color: var(--text-1);
          margin: 0 0 6px;
        }

        .login-sub {
          font-family: var(--font-body);
          font-size: 14px;
          color: var(--text-2);
          margin: 0 0 32px;
        }

        .login-divider {
          height: 1px;
          background: var(--border);
          margin: 0 0 32px;
        }

        .login-input {
          width: 100%;
          box-sizing: border-box;
          padding: 11px 14px;
          font-family: var(--font-body);
          font-size: 14px;
          color: var(--text-1);
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 10px;
          outline: none;
          transition: border-color 120ms ease, box-shadow 120ms ease;
          margin-bottom: 10px;
        }
        .login-input::placeholder { color: var(--text-2); opacity: 0.7; }
        .login-input:hover { border-color: var(--border-h); }
        .login-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-dim); }
        .login-input.has-error { border-color: var(--danger); box-shadow: 0 0 0 3px rgba(153,27,27,0.12); }

        .login-btn {
          width: 100%;
          padding: 11px 20px;
          font-family: var(--font-body);
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          background: var(--accent);
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: background 120ms ease, transform 120ms ease, box-shadow 120ms ease;
          letter-spacing: 0.01em;
        }
        .login-btn:hover:not(:disabled) { background: var(--accent-h); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(29,74,53,0.25); }
        .login-btn:active:not(:disabled) { transform: translateY(0); box-shadow: none; }
        .login-btn:disabled { background: var(--border); color: var(--text-3); cursor: not-allowed; }

        .login-error {
          margin-top: 10px;
          font-size: 13px;
          color: var(--danger);
          min-height: 18px;
        }

        .login-footer {
          margin-top: 32px;
          font-size: 12px;
          color: var(--text-2);
          text-align: center;
          opacity: 0.6;
        }
      `}</style>

      <div className="login-wrap">
        <div className={`login-card${shaking ? " disha-shake" : ""}`}>
          <p className="login-eyebrow">Private access</p>
          <h1 className="login-title">Disha</h1>
          <p className="login-sub">Job search, handled.</p>
          <div className="login-divider" />

          <form onSubmit={handleSubmit}>
            <input
              type="password"
              placeholder="Enter password"
              className={`login-input${error ? " has-error" : ""}`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              autoComplete="current-password"
            />
            <button
              type="submit"
              className="login-btn"
              disabled={loading}
            >
              {loading ? "Entering…" : "Enter →"}
            </button>
            <p className="login-error">{error ?? ""}</p>
          </form>
        </div>

        <p className="login-footer">Disha · personal</p>
      </div>
    </>
  );
}
