import React, { ReactNode, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { api } from "@/utils/api";

const NAV = [
  { href: "/",                    icon: "⬛", label: "Dashboard" },
  { href: "/stocks",              icon: "📊", label: "Stock Analysis" },
  { href: "/charts",              icon: "📈", label: "Charts" },
  { href: "/options",             icon: "🎯", label: "Options" },
  { href: "/futures",             icon: "⚡", label: "Futures" },
  { href: "/bonds",               icon: "🏦", label: "Bonds" },
  { href: "/economic-indicators", icon: "🌐", label: "Economic Data" },
  { href: "/compare",             icon: "⚖️",  label: "Compare" },
  { href: "/portfolio",           icon: "💼", label: "Portfolio" },
  { href: "/watchlist",           icon: "👁️",  label: "Watchlist" },
  { href: "/sectors",             icon: "🏭", label: "Sectors" },
  { href: "/calculators",         icon: "🧮", label: "Calculators" },
  { href: "/wellness",            icon: "💯", label: "Wellness" },
  { href: "/brokers",             icon: "🏢", label: "My Brokers" },
  { href: "/chat",                icon: "🤖", label: "AI Assistant" },
];

export default function Layout({ children, title }: { children: ReactNode; title?: string }) {
  const router = useRouter();
  const [marketStatus, setMarketStatus] = useState<any>(null);
  const [sideOpen, setSideOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.marketStatus().then(setMarketStatus).catch(() => {});
    api.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function handleLogout() {
    // Clear Replit Auth cookie and reload to land on the login screen
    document.cookie = "REPL_AUTH=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    window.location.href = "/";
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg-deep)" }}>
      {/* Mobile overlay */}
      {sideOpen && (
        <div
          onClick={() => setSideOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 40 }}
        />
      )}

      {/* Sidebar */}
      <aside style={{
        width: 220, flexShrink: 0,
        background: "var(--bg-base)",
        borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column",
        transition: "transform 0.25s",
      }}>
        {/* Logo */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--gold)", letterSpacing: "-0.5px" }}>
            Artha
          </div>
          <div style={{ fontSize: "0.6rem", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>
            Financial Research AI
          </div>
        </div>

        {/* Market status pill */}
        {marketStatus && (
          <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              background: marketStatus.market_open ? "#14532d22" : "#7f1d1d22",
              border: `1px solid ${marketStatus.market_open ? "#14532d" : "#7f1d1d"}`,
              borderRadius: 6, padding: "5px 10px",
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: marketStatus.market_open ? "var(--green)" : "var(--red)" }} />
              <span style={{ fontSize: "0.7rem", color: marketStatus.market_open ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                Market {marketStatus.market_open ? "Open" : "Closed"}
              </span>
            </div>
          </div>
        )}

        {/* Nav links */}
        <nav style={{ flex: 1, padding: "10px 8px", overflowY: "auto" }}>
          {NAV.map(({ href, icon, label }) => {
            const active = router.pathname === href;
            return (
              <Link key={href} href={href} style={{ textDecoration: "none" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 12px", borderRadius: 8, marginBottom: 2,
                  background: active ? "var(--bg-hover)" : "transparent",
                  borderLeft: `2px solid ${active ? "var(--gold)" : "transparent"}`,
                  color: active ? "var(--text-1)" : "var(--text-3)",
                  fontSize: "0.875rem", fontWeight: active ? 600 : 400,
                  transition: "all 0.15s", cursor: "pointer",
                }}>
                  <span style={{ fontSize: "1rem", width: 18, textAlign: "center" }}>{icon}</span>
                  {label}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
          <div style={{ fontSize: "0.65rem", color: "var(--text-3)", lineHeight: 1.5 }}>
            v1.0.0 · Weeks 1–8 Complete<br />
            Not investment advice
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Topbar */}
        <header style={{
          height: 54, background: "var(--bg-base)", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", padding: "0 24px", gap: 12, flexShrink: 0,
        }}>
          <div style={{ flex: 1, fontSize: "1rem", fontWeight: 600, color: "var(--text-1)" }}>
            {title || NAV.find(n => n.href === router.pathname)?.label || "Dashboard"}
          </div>
          {marketStatus && (
            <div style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>
              {marketStatus.current_ist}
            </div>
          )}

          {user && (
            <div ref={menuRef} style={{ position: "relative" }}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: "transparent", border: "1px solid var(--border)",
                  borderRadius: 999, padding: "4px 10px 4px 4px", cursor: "pointer",
                }}
              >
                <span style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: user.profile_image ? `center / cover url(${user.profile_image})` : "#1e3a5f",
                  border: "1px solid var(--border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#93c5fd", fontWeight: 700, fontSize: "0.75rem",
                }}>
                  {!user.profile_image && (user.name?.[0]?.toUpperCase() || "U")}
                </span>
                <span style={{ fontSize: "0.8rem", color: "var(--text-2)", fontWeight: 500 }}>
                  {user.name}
                </span>
              </button>
              {menuOpen && (
                <div style={{
                  position: "absolute", right: 0, top: "calc(100% + 6px)",
                  background: "var(--bg-base)", border: "1px solid var(--border)",
                  borderRadius: 10, minWidth: 180, padding: 6, zIndex: 50,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                }}>
                  <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", marginBottom: 4 }}>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-1)", fontWeight: 600 }}>{user.name}</div>
                    <div style={{ fontSize: "0.65rem", color: "var(--text-3)", marginTop: 2 }}>Signed in</div>
                  </div>
                  <button
                    onClick={handleLogout}
                    style={{
                      width: "100%", textAlign: "left",
                      background: "transparent", border: "none", color: "var(--text-2)",
                      padding: "8px 12px", fontSize: "0.8rem", borderRadius: 6, cursor: "pointer",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}
        </header>

        {/* Page */}
        <main style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
