import React, { useEffect, useState } from "react";
import { api } from "@/utils/api";

interface User {
  id: string;
  name: string;
  profile_image?: string;
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  async function checkAuth() {
    try {
      const u = await api.me();
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    checkAuth();
  }, []);

  function handleLogin() {
    if (typeof window === "undefined") return;
    const w = 360, h = 560;
    const left = window.screen.width / 2 - w / 2;
    const top = window.screen.height / 2 - h / 2;
    const popup = window.open(
      `https://replit.com/auth_with_repl_site?domain=${window.location.host}`,
      "Login",
      `width=${w},height=${h},left=${left},top=${top}`
    );

    // Poll for login completion (the proxy will start sending the X-Replit-User-* headers)
    const t = setInterval(async () => {
      try {
        const u = await api.me();
        if (u?.id) {
          setUser(u);
          clearInterval(t);
          if (popup && !popup.closed) popup.close();
        }
      } catch {}
      if (popup && popup.closed) {
        // User closed without finishing — keep polling briefly in case headers landed
      }
    }, 1500);
    setTimeout(() => clearInterval(t), 180000);
  }

  if (checking) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--bg-deep)", color: "var(--text-2)",
      }}>
        <span className="spinner" style={{ marginRight: 10 }} /> Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <div style={{
          minHeight: "100vh",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "var(--bg-deep)", padding: 20,
        }}>
          <div className="card" style={{
            maxWidth: 420, width: "100%", padding: "36px 32px", textAlign: "center",
          }}>
            <div style={{
              fontSize: "1.8rem", fontWeight: 800, color: "var(--gold)", marginBottom: 4,
            }}>Artha</div>
            <div style={{
              fontSize: "0.7rem", color: "var(--text-3)", textTransform: "uppercase",
              letterSpacing: "0.1em", marginBottom: 28,
            }}>
              Financial Research AI
            </div>

            <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-1)", marginBottom: 8 }}>
              Welcome back
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--text-3)", marginBottom: 28, lineHeight: 1.6 }}>
              Sign in to access live Indian market data, your watchlist, portfolio tracking, and the AI assistant.
            </div>

            <button
              onClick={handleLogin}
              style={{
                width: "100%", padding: "12px 18px", borderRadius: 10,
                background: "#fff", color: "#1a1a1a", border: "1px solid #e5e7eb",
                fontSize: "0.95rem", fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
            >
              <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
              </svg>
              Sign in with Google
            </button>

            <div style={{
              fontSize: "0.7rem", color: "var(--text-3)", marginTop: 18, lineHeight: 1.6,
            }}>
              Secure login. We never see your password.
            </div>
          </div>
        </div>
      </>
    );
  }

  return <>{children}</>;
}
